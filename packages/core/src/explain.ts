import type { AIProvider } from "@chatsouq/ai";
import type { Constraints, QueryContext } from "./types";
import type { ScoredCandidate } from "./rank";

const ARABIC_RE = /[؀-ۿ]/;

export function formatJOD(n: number): string {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return `${v} JOD`;
}

export interface Explanation {
  why: string;
  pros: string[];
  tags?: string[];
}

export interface ExplainExtra {
  connectorText?: string;
  insightText?: string;
  followUpPrompts?: string[];
}

export interface ExplainResult {
  /** Editorial intro paragraph (drop-cap worthy). */
  summary: string;
  /** Italic connector between top pick and alternatives. */
  connectorText?: string;
  /** Practical tips callout. */
  insightText?: string;
  /** Suggested follow-up queries. */
  followUpPrompts?: string[];
  explanations: Map<number, Explanation>;
}

function codeWhy(c: ScoredCandidate, constraints: Constraints, isBest: boolean, lang: "en" | "ar"): string {
  const brand = c.brand ? `${c.brand} ` : "";
  if (lang === "ar") {
    const lead = isBest ? "الخيار الأفضل" : "بديل";
    const priceStr = c.price !== null ? ` بسعر ${formatJOD(c.price)}` : "";
    return `${lead}: ${brand}${c.name}${priceStr} من ${c.vendorName}.`.replace(/\s+/g, " ");
  }
  const lead = isBest ? "Top pick" : "Alternative";
  const priceStr = c.price !== null ? ` at ${formatJOD(c.price)}` : "";
  const recipient = constraints.recipient ? ` for your ${constraints.recipient}` : "";
  return `${lead}: ${brand}${c.name}${priceStr} from ${c.vendorName}${recipient}.`.replace(/\s+/g, " ");
}

function codePros(c: ScoredCandidate, constraints: Constraints, cheapest: number | null, lang: "en" | "ar"): string[] {
  const pros: string[] = [];
  if (constraints.budgetMax !== null && c.price !== null && c.price <= constraints.budgetMax) {
    const head = constraints.budgetMax - c.price;
    if (lang === "ar") {
      pros.push(head > 0 ? `ضمن ميزانيتك (${formatJOD(constraints.budgetMax)})` : `بحد ميزانيتك تماماً`);
    } else {
      pros.push(head > 0 ? `${formatJOD(head)} under your ${formatJOD(constraints.budgetMax)} budget` : `Right at your ${formatJOD(constraints.budgetMax)} budget`);
    }
  }
  if (c.keywordHits > 0 || c.components.vec >= 0.6) {
    pros.push(lang === "ar" ? "يطابق ما طلبته بدقة" : "Closely matches what you described");
  }
  if (c.brand) {
    pros.push(lang === "ar" ? `منتج ${c.brand} أصلي` : `Genuine ${c.brand} product`);
  }
  if (cheapest !== null && c.price !== null && c.price === cheapest) {
    pros.push(lang === "ar" ? "أقل سعر بين هذه الخيارات" : "Lowest price among these options");
  }
  const vendor = c.vendorLocation ? `${c.vendorName} (${c.vendorLocation})` : c.vendorName;
  pros.push(lang === "ar" ? `متوفر من ${vendor}` : `Sold by ${vendor}`);
  return pros.slice(0, 4);
}

/** Fallback summary when the LLM is mocked or unavailable. */
function buildCodeSummary(
  ranked: ScoredCandidate[],
  constraints: Constraints,
  lang: "en" | "ar",
): string {
  if (ranked.length === 0) {
    return lang === "ar"
      ? `لم أجد نتائج مطابقة لـ "${constraints.rawQuery}" في الكتالوج الحالي.`
      : `I couldn't find a match for "${constraints.rawQuery}" in the current catalogue.`;
  }
  const best = ranked[0]!;
  const name = [best.brand, best.name].filter(Boolean).join(" ");
  const price = best.price != null
    ? (lang === "ar" ? ` بسعر ${formatJOD(best.price)}` : ` at ${formatJOD(best.price)}`)
    : "";
  const altCount = ranked.length - 1;
  if (lang === "ar") {
    const alts = altCount > 0 ? ` وعندي ${altCount} بديل${altCount === 1 ? "" : " إضافي"} كذلك.` : ".";
    return `أفضل خيار هو ${name}${price} من ${best.vendorName}.${alts}`;
  }
  const from = ` from ${best.vendorName}`;
  const budget = constraints.budgetMax ? ` within your ${formatJOD(constraints.budgetMax)} budget` : "";
  const alts = altCount > 0 ? ` I've also found ${altCount} alternative${altCount > 1 ? "s" : ""} worth a look.` : "";
  return `${name}${price}${from} is the top match${budget}.${alts}`;
}

/**
 * Build explanations for the shown items. Pros (and all numbers) are
 * computed in code from listing facts. Claude generates the conversational
 * `summary` and rewrites the per-item "why" sentence — constrained to the
 * provided facts and told not to introduce any numbers — so accuracy is never
 * delegated. Full bilingual support: English ↔ Arabic.
 */
export async function explainItems(
  provider: AIProvider,
  query: string,
  ranked: ScoredCandidate[],
  constraints: Constraints,
  memoryBlock?: string,
  context?: QueryContext,
): Promise<ExplainResult> {
  const lang: "en" | "ar" = ARABIC_RE.test(query) ? "ar" : "en";
  const pricedShown = ranked.filter((c) => c.price !== null).map((c) => c.price as number);
  const cheapest = pricedShown.length ? Math.min(...pricedShown) : null;

  const explanations = new Map<number, Explanation>();
  ranked.forEach((c, i) => {
    explanations.set(c.id, {
      why: codeWhy(c, constraints, i === 0, lang),
      pros: codePros(c, constraints, cheapest, lang),
    });
  });

  if (provider.isMock) {
    return { summary: buildCodeSummary(ranked, constraints, lang), explanations };
  }

  try {
    const items = ranked.map((c, i) => ({
      id: c.id,
      name: c.name,
      brand: c.brand ?? null,
      category: c.category,
      price: c.price != null ? `${c.price} JOD` : null,
      vendor: c.vendorName,
      matchedKeywords: constraints.keywords.filter((k) =>
        (c.searchText ?? c.name).toLowerCase().includes(k)
      ),
      role: i === 0 ? "best" : "alternative",
    }));

    const langInstruction = lang === "ar"
      ? "IMPORTANT: Write both the 'summary' and all 'why' values in Arabic only."
      : "Write both the 'summary' and all 'why' values in English.";

    const contextLine = [
      `User request: "${query}"`,
      constraints.keywords.length ? `Key requirements: ${constraints.keywords.join(", ")}` : "",
      constraints.budgetMax ? `Budget: up to ${constraints.budgetMax} JOD` : "",
      constraints.recipient ? `Gift for: ${constraints.recipient}` : "",
      constraints.occasion ? `Occasion: ${constraints.occasion}` : "",
    ].filter(Boolean).join("\n");

    const memCtx = memoryBlock ? `\nUSER CONTEXT (use to personalise):\n${memoryBlock}` : "";

    // Temporal context — tells Claude what time of day / season / holiday it is in Jordan
    const t = context?.temporal;
    const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const temporalCtx = t
      ? `\nTEMPORAL CONTEXT: It's ${dayNames[t.localDay] ?? "today"} ${t.timeOfDay} in Amman${t.isRamadan ? " (Ramadan — note for gifting context)" : ""}${t.holiday ? ` (${t.holiday} — public holiday)` : ""}.`
      : "";

    const res = await provider.complete({
      system:
        "You are ChatSouq, Amman's AI shopping assistant. " +
        "Write an editorial-quality response with four parts: " +
        "intro: a rich 2–4 sentence editorial paragraph about the search context (no bullets). " +
        "connector: a single italic sentence (max 30 words) connecting the top pick to alternatives. " +
        "insight: a 1–2 sentence practical shopping tip (delivery time, warranty, best deal timing). " +
        "followUps: 4 short follow-up query suggestions (max 8 words each). " +
        "For each item: a 1-sentence 'why' (max 20 words) and up to 4 short feature tags (e.g. Wireless, ANC, 40hr battery). " +
        "Use ONLY provided facts — no invented specs. " +
        `${langInstruction}${memCtx}${temporalCtx} ` +
        'Return JSON exactly: {"intro":"...","connector":"...","insight":"...","followUps":["..."],"items":[{"id":number,"why":"...","tags":["..."]}]}',
      messages: [{ role: "user", content: `${contextLine}\nItems: ${JSON.stringify(items)}` }],
      json: true,
      temperature: 0.4,
      maxTokens: 1100,
    });

    const raw: unknown = JSON.parse(res.text);
    const parsed: {
      intro?: string; connector?: string; insight?: string; followUps?: string[];
      summary?: string; items?: { id: number; why: string; tags?: string[] }[];
    } = Array.isArray(raw) ? { items: raw as { id: number; why: string }[] } : (raw as typeof parsed);

    const summary = (typeof parsed.intro === "string" && parsed.intro.trim())
      ? parsed.intro.trim()
      : (typeof parsed.summary === "string" && parsed.summary.trim())
      ? parsed.summary.trim()
      : buildCodeSummary(ranked, constraints, lang);

    const connectorText  = typeof parsed.connector === "string" ? parsed.connector.trim() : undefined;
    const insightText    = typeof parsed.insight === "string" ? parsed.insight.trim() : undefined;
    const followUpPrompts = Array.isArray(parsed.followUps)
      ? (parsed.followUps as string[]).filter((s) => typeof s === "string").slice(0, 4)
      : undefined;

    if (Array.isArray(parsed.items)) {
      for (const p of parsed.items) {
        const existing = explanations.get(p.id);
        if (existing && typeof p.why === "string" && p.why.trim()) {
          existing.why = p.why.trim();
        }
        if (existing && Array.isArray(p.tags) && p.tags.length) {
          existing.tags = p.tags.slice(0, 5);
        }
      }
    }

    return { summary, connectorText, insightText, followUpPrompts, explanations };
  } catch {
    return { summary: buildCodeSummary(ranked, constraints, lang), explanations };
  }
}
