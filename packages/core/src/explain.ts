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

/**
 * Build explanations for the shown items. Pros/cons (and all numbers) are
 * computed in code from listing facts. Claude only rewrites the "why" sentence —
 * constrained to the provided facts and told not to introduce any numbers — so
 * accuracy is never delegated. Full bilingual support: English ↔ Arabic.
 */
export async function explainItems(
  provider: AIProvider,
  query: string,
  ranked: ScoredCandidate[],
  constraints: Constraints
): Promise<Map<number, Explanation>> {
  const lang: "en" | "ar" = ARABIC_RE.test(query) ? "ar" : "en";
  const pricedShown = ranked.filter((c) => c.price !== null).map((c) => c.price as number);
  const cheapest = pricedShown.length ? Math.min(...pricedShown) : null;

  const result = new Map<number, Explanation>();
  ranked.forEach((c, i) => {
    result.set(c.id, {
      why: codeWhy(c, constraints, i === 0, lang),
      pros: codePros(c, constraints, cheapest, lang),
      cons: codeCons(c, constraints, cheapest, lang),
    });
  });

  if (provider.isMock) return result;

  try {
    const items = ranked.map((c, i) => ({
      id: c.id,
      name: c.name,
      brand: c.brand ?? null,
      category: c.category,
      vendor: c.vendorName,
      matchedKeywords: constraints.keywords.filter((k) =>
        (c.searchText ?? c.name).toLowerCase().includes(k)
      ),
      role: i === 0 ? "best" : "alternative",
    }));

    const langInstruction = lang === "ar"
      ? "IMPORTANT: Write the 'why' value in Arabic only."
      : "Write the 'why' value in English.";

    const contextLine = [
      `Shopper's request: "${query}"`,
      constraints.keywords.length ? `Key requirements: ${constraints.keywords.join(", ")}` : "",
      constraints.recipient ? `Gift for: ${constraints.recipient}` : "",
      constraints.occasion ? `Occasion: ${constraints.occasion}` : "",
    ].filter(Boolean).join("\n");

    const res = await provider.complete({
      system:
        "You write one specific sentence (max 28 words) explaining why each item fits the shopper's " +
        "exact need, in the context of shopping in Jordan. Focus on what makes this product the right " +
        "match — category, features, or use case. Use ONLY the provided facts. Do NOT mention prices, " +
        `amounts, or numbers. ${langInstruction} ` +
        'Return JSON: an array of {"id": number, "why": string}.',
      messages: [{ role: "user", content: `${contextLine}\nItems: ${JSON.stringify(items)}` }],
      json: true,
      temperature: 0.3,
      maxTokens: 800,
    });
    const parsed = JSON.parse(res.text) as { id: number; why: string }[];
    for (const p of parsed) {
      const existing = result.get(p.id);
      if (existing && typeof p.why === "string" && p.why.trim()) {
        existing.why = p.why.trim();
      }
    }
  } catch {
    // keep code-generated whys
  }
  return result;
}
