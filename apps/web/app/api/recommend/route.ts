import { NextResponse } from "next/server";
import { assist } from "@chatsouq/core";
import {
  loadThread,
  appendTurn,
  extractPreferences,
  maybeUpdateSummary,
  buildMemoryBlock,
} from "@chatsouq/core/memory";
import type { ConvMessage } from "@chatsouq/core";
import { db, schema } from "@chatsouq/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    query?: string;
    sessionId?: string;
    history?: ConvMessage[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query) return NextResponse.json({ error: "Missing query" }, { status: 400 });
  if (query.length > 500) return NextResponse.json({ error: "Query too long" }, { status: 400 });

  const sessionId = (body.sessionId ?? "").trim() || crypto.randomUUID();

  // ── Load persisted thread from DB ──────────────────────────────────────────
  // DB thread is the authoritative history source; client-sent history is only
  // used as a fallback if the DB has nothing (first-ever request from this session).
  const thread = await loadThread(sessionId);

  // Merge: prefer DB messages if we have them, otherwise use client-provided
  const dbMessages = thread.messages;
  const clientMessages: ConvMessage[] = (body.history ?? [])
    .slice(-10)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 800) }));

  const history: ConvMessage[] = dbMessages.length > 0 ? dbMessages.slice(-20) : clientMessages;

  // Build memory context block from learned preferences
  const memoryBlock = buildMemoryBlock(thread);

  try {
    const result = await assist({
      query,
      history,
      // Inject learned preferences into the profile for the product engine
      profile: thread.prefs.budget
        ? { financial: { shoppingBudget: thread.prefs.budget as number } }
        : undefined,
      // Memory block is now a first-class field on RecommendInput — injected into
      // every engine (products, places, general) so all LLM calls have user context.
      memoryBlock,
    });

    // ── Persist this turn in the background ───────────────────────────────────
    // Get a clean text representation of the assistant response for storage
    const assistantText = getResponseText(result);

    // Fire all persistence tasks in parallel — don't block the response
    const conversationId = thread.conversationId;
    const newTurnCount = thread.turnCount + 1;
    Promise.all([
      appendTurn(sessionId, conversationId, query, assistantText, history).then(
        async (newConvId) => {
          // After appending, extract preferences + maybe update summary
          if (newConvId) {
            const { getProvider } = await import("@chatsouq/ai");
            const provider = getProvider();
            const updatedHistory = [
              ...history,
              { role: "user" as const, content: query },
              { role: "assistant" as const, content: assistantText },
            ];
            await Promise.all([
              extractPreferences(sessionId, newConvId, query, assistantText, thread.prefs, provider),
              maybeUpdateSummary(newConvId, updatedHistory, newTurnCount, provider),
            ]).catch(() => {});
          }
        }
      ).catch(() => {}),

      // Log in recommendations table as before
      (result.kind === "products" || result.kind === "places") &&
        db.insert(schema.recommendations)
          .values({
            sessionId,
            query,
            constraints:
              result.kind === "products"
                ? (result.constraints as unknown as Record<string, unknown>)
                : (result.intent   as unknown as Record<string, unknown>),
            bestListingId: result.kind === "products" ? (result.best?.listing.id ?? null) : null,
            results: {
              kind: result.kind,
              ids: result.kind === "products"
                ? [result.best?.listing.id, ...result.alternatives.map((a) => a.listing.id)].filter(Boolean)
                : [result.best?.place.id,   ...result.alternatives.map((a) => a.place.id)  ].filter(Boolean),
            },
            provider: result.meta.provider,
          })
          .catch(() => {}),
    ]).catch(() => {});

    return NextResponse.json({ ...result, sessionId });
  } catch (err) {
    console.error("[recommend] error:", err);
    return NextResponse.json({ error: "Recommendation failed" }, { status: 500 });
  }
}

/** Extract a plain-text summary from any AssistResponse for storage. */
function getResponseText(result: Awaited<ReturnType<typeof assist>>): string {
  if (result.kind === "products") {
    const best = result.best;
    return [
      result.summary,
      best ? `Best pick: ${best.listing.name} — ${best.why}` : "",
    ].filter(Boolean).join(" ");
  }
  if (result.kind === "places") {
    const best = result.best;
    return [
      result.summary,
      best ? `Top place: ${best.place.name} — ${best.why}` : "",
    ].filter(Boolean).join(" ");
  }
  // general
  return result.summary ?? "";
}
