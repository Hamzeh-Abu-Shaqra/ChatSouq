import type { AIProvider } from "@chatsouq/ai";
import type { Constraints } from "./types";
import type { ScoredCandidate } from "./rank";

const ARABIC_RE = /[؀-ۿ]/;

export function formatJOD(n: number): string {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return `${v} JOD`;
}

export interface Explanation {
  why: string;
  pros: string[];
  cons: string[];
}

export interface ExplainResult {
  /** Conversational 2–4 sentence chat reply mentioning results by **bold** name. */
  summary: string;
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

function codeCons(c: ScoredCandidate, constraints: Constraints, cheapest: number | null, lang: "en" | "ar"): string[] {
  const cons: string[] = [];
  if (cheapest !== null && c.price !== null && c.price > cheapest) {
    cons.push(lang === "ar"
      ? `أغلى بـ ${formatJOD(c.price - cheapest)} من أرخص خيار هنا`
      : `${formatJOD(c.price - cheapest)} more than the cheapest option here`);
  }
  if (constraints.budgetMax !== null && c.price !== null && c.price > constraints.budgetMax * 0.9 && c.price <= constraints.budgetMax) {
    cons.push(lang === "ar" ? "قريب من حد ميزانيتك" : "Near the top of your budget");
  }
  if (!c.brand) {
    cons.push(lang === "ar" ? "الماركة غير محددة في الإعلان" : "Brand not specified in the listing");
  }
  if (constraints.categories.length > 0 && c.category && !constraints.categories.includes(c.category)) {
    cons.push(lang === "ar" ? `مدرج ضمن ${c.category}` : `Listed under ${c.category}`);
  }
  return cons.slice(0, 3);
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
    return `أفضل خيار هو **${name}**${price} من ${best.vendorName}.${alts}`;
  }
  const from = ` from ${best.vendorName}`;
  const budget = constraints.budgetMax ? ` within your ${formatJOD(constraints.budgetMax)} budget` : "";
  const alts = altCount > 0 ? ` I've also found ${altCount} alternative${altCount > 1 ? "s" : ""} worth a look.` : "";
  return `**${name}**${price}${from} is the top match${budget}.${alts}`;
}

/**
 * Build explanations for the shown items. Pros/cons (and all numbers) are
 * computed in code from listing facts. Claude generates the conversational
 * `summary` and rewrites the per-item "why" sentence — constrained to the
 * provided facts and told not to introduce any numbers — so accuracy is never
 * delegated. Full bilingual support: English ↔ Arabic.
 */
export async function explainItems(
  provider: AIProvider,
  query: string,
  ranked: ScoredCandidate[],
  constraints: Constraints
): Promise<ExplainResult> {
  const lang: "en" | "ar" = ARABIC_RE.test(query) ? "ar" : "en";
  const pricedShown = ranked.filter((c) => c.price !== null).map((c) => c.price as number);
  const cheapest = pricedShown.length ? Math.min(...pricedShown) : null;

  const explanations = new Map<number, Explanation>();
  ranked.forEach((c, i) => {
    explanations.set(c.id, {
      why: codeWhy(c, constraints, i === 0, lang),
      pros: codePros(c, constraints, cheapest, lang),
      cons: codeCons(c, constraints, cheapest, lang),
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

    const res = await provider.complete({
      system:
        "You are ChatSouq, Amman's AI shopping assistant. " +
        "Write a direct, conversational 2–3 sentence reply that actually answers the user's request. " +
        "Mention the top pick and key alternatives by **bolding** their names. " +
        "Be specific — say what makes the top pick the right choice (type, quality, availability). " +
        "Then write a 1-sentence 'why' per item (max 20 words) focusing on fit, not price. " +
        "Use ONLY the provided facts. Do NOT invent features, specs, or availability details not in the data. " +
        `${langInstruction} ` +
        'Return JSON: {"summary": "string", "items": [{"id": number, "why": "string"}]}',
      messages: [{ role: "user", content: `${contextLine}\nItems: ${JSON.stringify(items)}` }],
      json: true,
      temperature: 0.4,
      maxTokens: 900,
    });

    const parsed = JSON.parse(res.text) as { summary?: string; items?: { id: number; why: string }[] };
    const summary = typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : buildCodeSummary(ranked, constraints, lang);

    if (Array.isArray(parsed.items)) {
      for (const p of parsed.items) {
        const existing = explanations.get(p.id);
        if (existing && typeof p.why === "string" && p.why.trim()) {
          existing.why = p.why.trim();
        }
      }
    }

    return { summary, explanations };
  } catch {
    return { summary: buildCodeSummary(ranked, constraints, lang), explanations };
  }
}
