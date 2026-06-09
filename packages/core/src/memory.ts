/**
 * ChatSouq Memory & Thread System
 *
 * Manages persistent conversation threads and learned user preferences.
 *
 * How it works:
 *   1. Every chat turn is appended to the `conversations` table (keyed by sessionId).
 *   2. After each exchange, Claude asynchronously extracts structured preferences
 *      (budget, area, interests, family status) and stores them in extracted_prefs.
 *   3. On the next query, relevant memory is injected into the system prompt so
 *      Claude always has context — even if the user starts a new session.
 *   4. Every 4 turns a rolling summary is generated so long threads stay fast.
 */

import { sql } from "drizzle-orm";
import { db } from "@chatsouq/db";
import type { AIProvider } from "@chatsouq/ai";
import type { ConvMessage } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractedPrefs {
  budget?: number;                    // Monthly / shopping budget in JOD
  area?: string;                      // Preferred area in Jordan
  city?: string;                      // City (Amman, Irbid, Aqaba…)
  familyStatus?: string;              // "single" | "couple" | "family"
  interests?: string[];               // ["restaurants","tech","fashion"…]
  priceRange?: "budget" | "mid" | "luxury";
  preferredBrands?: string[];
  language?: "en" | "ar";
  [key: string]: unknown;
}

export interface ThreadContext {
  sessionId: string;
  conversationId: string | null;
  messages: ConvMessage[];
  prefs: ExtractedPrefs;
  summary: string | null;
  turnCount: number;
}

// ── Thread retrieval ──────────────────────────────────────────────────────────

/**
 * Load the most recent conversation for a sessionId.
 * Creates a new one if none exists. Never throws.
 */
export async function loadThread(sessionId: string): Promise<ThreadContext> {
  try {
    const rows = (await db.execute(sql`
      SELECT id, messages, extracted_prefs, summary, turn_count
      FROM conversations
      WHERE session_id = ${sessionId}
      ORDER BY updated_at DESC
      LIMIT 1
    `)) as unknown as {
      id: string;
      messages: ConvMessage[];
      extracted_prefs: ExtractedPrefs;
      summary: string | null;
      turn_count: number;
    }[];

    if (rows.length > 0) {
      const row = rows[0]!;
      return {
        sessionId,
        conversationId: row.id,
        messages: (row.messages as ConvMessage[]) ?? [],
        prefs: (row.extracted_prefs as ExtractedPrefs) ?? {},
        summary: row.summary,
        turnCount: row.turn_count ?? 0,
      };
    }
  } catch {
    // DB not reachable — return empty context, don't crash
  }

  return {
    sessionId,
    conversationId: null,
    messages: [],
    prefs: {},
    summary: null,
    turnCount: 0,
  };
}

// ── Thread persistence ────────────────────────────────────────────────────────

/**
 * Append a user + assistant turn to the conversation and return the updated
 * conversation ID. Creates the row if this is the first turn.
 * Fire-and-forget safe — callers should not await critical paths on this.
 */
export async function appendTurn(
  sessionId: string,
  conversationId: string | null,
  userMsg: string,
  assistantMsg: string,
  currentMessages: ConvMessage[]
): Promise<string | null> {
  try {
    const updated: ConvMessage[] = [
      ...currentMessages,
      { role: "user",      content: userMsg      },
      { role: "assistant", content: assistantMsg },
    ];
    // Keep at most 40 messages (20 turns) in the live array — older content
    // is preserved in the rolling summary instead.
    const trimmed = updated.slice(-40);
    const messagesJson = JSON.stringify(trimmed);

    if (conversationId) {
      await db.execute(sql`
        UPDATE conversations
        SET
          messages    = ${messagesJson}::jsonb,
          last_query  = ${userMsg.slice(0, 500)},
          turn_count  = turn_count + 1,
          updated_at  = NOW()
        WHERE id = ${conversationId}
      `);
      return conversationId;
    } else {
      const rows = (await db.execute(sql`
        INSERT INTO conversations (session_id, messages, last_query, turn_count)
        VALUES (
          ${sessionId},
          ${messagesJson}::jsonb,
          ${userMsg.slice(0, 500)},
          1
        )
        RETURNING id
      `)) as unknown as { id: string }[];
      return rows[0]?.id ?? null;
    }
  } catch {
    return conversationId;
  }
}

// ── Preference extraction ─────────────────────────────────────────────────────

/**
 * After every turn, Claude silently reads the exchange and extracts any new
 * structured facts about the user. Merges with existing prefs (never deletes).
 * Runs as a background task — never blocks the response.
 */
export async function extractPreferences(
  sessionId: string,
  conversationId: string | null,
  userMsg: string,
  assistantMsg: string,
  existingPrefs: ExtractedPrefs,
  provider: AIProvider
): Promise<void> {
  if (provider.isMock || !conversationId) return;

  try {
    const res = await provider.complete({
      system:
        "You extract structured user preferences from a chat exchange. " +
        "Return ONLY a JSON object with any of these keys if you can confidently infer them " +
        "(omit keys you cannot infer): " +
        '{"budget": number_in_JOD, "area": "string", "city": "string", ' +
        '"familyStatus": "single|couple|family", "interests": ["string"], ' +
        '"priceRange": "budget|mid|luxury", "preferredBrands": ["string"], ' +
        '"language": "en|ar"}. ' +
        "Return {} if nothing can be inferred. No explanation, just JSON.",
      messages: [{
        role: "user",
        content: `User said: "${userMsg}"\nAssistant replied: "${assistantMsg.slice(0, 400)}"`,
      }],
      json: true,
      temperature: 0,
      maxTokens: 200,
    });

    const newFacts = JSON.parse(res.text) as ExtractedPrefs;
    if (!newFacts || Object.keys(newFacts).length === 0) return;

    // Merge: arrays are unioned, scalars overwrite only if newly observed
    const merged: ExtractedPrefs = { ...existingPrefs };
    for (const [k, v] of Object.entries(newFacts)) {
      if (v === null || v === undefined) continue;
      if (Array.isArray(v) && Array.isArray(merged[k])) {
        merged[k] = [...new Set([...(merged[k] as string[]), ...(v as string[])])];
      } else {
        merged[k] = v;
      }
    }

    await db.execute(sql`
      UPDATE conversations
      SET extracted_prefs = ${JSON.stringify(merged)}::jsonb
      WHERE id = ${conversationId}
    `);
  } catch {
    // Best-effort — never block
  }
}

// ── Rolling summary ───────────────────────────────────────────────────────────

/**
 * Every 4 turns, generate a compact summary of the conversation so far.
 * Stored in the conversations.summary column. Injected into long threads
 * instead of dumping all raw messages.
 */
export async function maybeUpdateSummary(
  conversationId: string | null,
  messages: ConvMessage[],
  turnCount: number,
  provider: AIProvider
): Promise<void> {
  if (provider.isMock || !conversationId || turnCount % 4 !== 0 || messages.length < 6) return;

  try {
    const transcript = messages
      .slice(-12)
      .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content.slice(0, 300)}`)
      .join("\n");

    const res = await provider.complete({
      system:
        "Summarize this ChatSouq conversation in 2-3 sentences. " +
        "Focus on: what the user is looking for, any preferences/constraints mentioned, " +
        "and what was recommended. Be concise and factual. Respond in the same language as the user.",
      messages: [{ role: "user", content: transcript }],
      temperature: 0,
      maxTokens: 200,
    });

    await db.execute(sql`
      UPDATE conversations
      SET summary = ${res.text.trim()}
      WHERE id = ${conversationId}
    `);
  } catch {
    // Best-effort
  }
}

// ── Memory injection ──────────────────────────────────────────────────────────

/**
 * Build a memory context block to inject into any system prompt.
 * Returns an empty string if there's nothing useful to inject.
 */
export function buildMemoryBlock(ctx: ThreadContext): string {
  const parts: string[] = [];

  // Extracted preferences
  const prefs = ctx.prefs;
  const prefLines: string[] = [];
  if (prefs.budget)          prefLines.push(`Budget: ${prefs.budget} JOD`);
  if (prefs.area)            prefLines.push(`Preferred area: ${prefs.area}`);
  if (prefs.city)            prefLines.push(`City: ${prefs.city}`);
  if (prefs.familyStatus)    prefLines.push(`Family status: ${prefs.familyStatus}`);
  if (prefs.priceRange)      prefLines.push(`Price sensitivity: ${prefs.priceRange}`);
  if (prefs.interests?.length)      prefLines.push(`Interests: ${prefs.interests.join(", ")}`);
  if (prefs.preferredBrands?.length) prefLines.push(`Preferred brands: ${prefs.preferredBrands.join(", ")}`);

  if (prefLines.length > 0) {
    parts.push(`KNOWN USER PREFERENCES (learned from this conversation):\n${prefLines.join("\n")}`);
  }

  // Rolling summary for long threads
  if (ctx.summary && ctx.turnCount > 6) {
    parts.push(`CONVERSATION SUMMARY SO FAR:\n${ctx.summary}`);
  }

  return parts.length > 0 ? `\n--- MEMORY ---\n${parts.join("\n\n")}\n--------------\n` : "";
}

// ── Feedback recording ────────────────────────────────────────────────────────

/**
 * Record a click or rating event. Used by the /api/feedback endpoint.
 * Also updates the click_stats aggregation table.
 */
export async function recordFeedback(opts: {
  sessionId: string;
  conversationId: string | null;
  query: string;
  resultKind: string;
  shownIds: number[];
  clickedId?: number;
  clickedRank?: number;
  rating?: number;
  feedbackText?: string;
}): Promise<void> {
  try {
    const queryNorm = opts.query.toLowerCase().trim().replace(/\s+/g, " ").slice(0, 200);

    await db.execute(sql`
      INSERT INTO query_feedback
        (session_id, conversation_id, query, result_kind, shown_ids, clicked_id, clicked_rank, rating, feedback_text)
      VALUES (
        ${opts.sessionId},
        ${opts.conversationId ?? null},
        ${opts.query},
        ${opts.resultKind},
        ${JSON.stringify(opts.shownIds)}::jsonb,
        ${opts.clickedId ?? null},
        ${opts.clickedRank ?? null},
        ${opts.rating ?? null},
        ${opts.feedbackText ?? null}
      )
    `);

    // Update click_stats for every shown result
    for (let i = 0; i < opts.shownIds.length; i++) {
      const rid = opts.shownIds[i]!;
      const wasClicked = opts.clickedId === rid ? 1 : 0;
      const wasUp   = opts.rating === 1 && opts.clickedId === rid ? 1 : 0;
      const wasDown = opts.rating === -1 ? 1 : 0;

      await db.execute(sql`
        INSERT INTO click_stats (query_norm, result_id, result_kind, impressions, clicks, thumbs_up, thumbs_down, ctr)
        VALUES (${queryNorm}, ${rid}, ${opts.resultKind}, 1, ${wasClicked}, ${wasUp}, ${wasDown}, ${wasClicked})
        ON CONFLICT (query_norm, result_id, result_kind) DO UPDATE SET
          impressions = click_stats.impressions + 1,
          clicks      = click_stats.clicks      + ${wasClicked},
          thumbs_up   = click_stats.thumbs_up   + ${wasUp},
          thumbs_down = click_stats.thumbs_down + ${wasDown},
          ctr         = (click_stats.clicks + ${wasClicked})::float / (click_stats.impressions + 1),
          updated_at  = NOW()
      `);
    }
  } catch {
    // Fire-and-forget
  }
}

// ── CTR boost (learning signal injected into ranking) ────────────────────────

/**
 * Fetch click-through rates for a set of result IDs on a given query.
 * Used by the ranking layer to boost historically clicked results.
 * Returns a map of resultId → CTR boost (0–0.15).
 */
export async function getCtrBoosts(
  query: string,
  resultIds: number[],
  resultKind: string
): Promise<Map<number, number>> {
  const boosts = new Map<number, number>();
  if (resultIds.length === 0) return boosts;

  // Validate: only include positive integers (DB primary keys) to prevent injection
  const safeIds = resultIds.map(Number).filter((n) => Number.isFinite(n) && n > 0 && n === Math.floor(n));
  if (safeIds.length === 0) return boosts;

  try {
    const queryNorm = query.toLowerCase().trim().replace(/\s+/g, " ").slice(0, 200);
    // Validate IDs before using sql.raw() to prevent injection
    const safeIds = resultIds.map(Number).filter((n) => Number.isFinite(n) && n > 0 && n === Math.floor(n));
    if (safeIds.length === 0) return boosts;
    const rows = (await db.execute(sql`
      SELECT result_id, ctr, clicks
      FROM click_stats
      WHERE query_norm = ${queryNorm}
        AND result_kind = ${resultKind}
        AND result_id = ANY(ARRAY[${sql.raw(safeIds.join(","))}]::int[])
        AND clicks >= 2
    `)) as unknown as { result_id: number; ctr: number; clicks: number }[];

    for (const r of rows) {
      // Scale CTR (0-1) to a max boost of 0.15.
      // Old formula: ctr * 0.15 meant max boost of 0.15 only at 100% CTR — too weak.
      // New formula: sqrt(ctr) gives sqrt(0.3)=0.55 → boost 0.083; sqrt(0.7)=0.84 → boost 0.126.
      // Also weight by click volume so 2 clicks at 100% CTR doesn't beat 200 clicks at 40%.
      const volumeFactor = Math.min(1, Math.log10(r.clicks + 1) / Math.log10(50 + 1));
      boosts.set(r.result_id, Math.min(0.15, Math.sqrt(r.ctr) * 0.18 * volumeFactor));
    }
  } catch {
    // Best-effort
  }
  return boosts;
}
