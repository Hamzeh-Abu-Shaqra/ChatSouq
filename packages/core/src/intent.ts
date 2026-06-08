import type { AIProvider } from "@chatsouq/ai";
import type { Constraints, UserProfileInput } from "./types";

const CURRENCY_WORDS = /\b(jod|jd|dinars?|د\.?ا)\b/i;

/**
 * Curated query-term -> canonical category hints. Values MUST be canonical
 * department names (see packages/db/scripts/lib/taxonomy.ts) — they are matched
 * (case-insensitively) against the real categories stored in the DB at runtime.
 */
const CATEGORY_HINTS: Record<string, string[]> = {
  // Beauty & skincare
  skincare: ["beauty & skincare"],
  skin: ["beauty & skincare"],
  serum: ["beauty & skincare"],
  moisturizer: ["beauty & skincare"],
  cleanser: ["beauty & skincare"],
  cream: ["beauty & skincare"],
  lotion: ["beauty & skincare"],
  sunscreen: ["beauty & skincare"],
  // Makeup
  makeup: ["makeup"],
  lipstick: ["makeup"],
  mascara: ["makeup"],
  foundation: ["makeup"],
  eyeshadow: ["makeup"],
  concealer: ["makeup"],
  // Hair
  hair: ["hair care"],
  shampoo: ["hair care"],
  conditioner: ["hair care"],
  // Fragrance
  perfume: ["perfume & fragrance"],
  fragrance: ["perfume & fragrance"],
  cologne: ["perfume & fragrance"],
  scent: ["perfume & fragrance"],
  // Health
  vitamin: ["health & wellness"],
  vitamins: ["health & wellness"],
  supplement: ["health & wellness"],
  wellness: ["health & wellness"],
  // Phones / tablets / computers
  phone: ["mobile phones"],
  iphone: ["mobile phones"],
  smartphone: ["mobile phones"],
  android: ["mobile phones"],
  tablet: ["tablets"],
  ipad: ["tablets"],
  laptop: ["computers & laptops"],
  computer: ["computers & laptops"],
  macbook: ["computers & laptops"],
  monitor: ["computers & laptops"],
  keyboard: ["computers & laptops"],
  // Audio / TV / cameras / gaming
  headphones: ["audio & headphones"],
  headphone: ["audio & headphones"],
  earbuds: ["audio & headphones"],
  earphones: ["audio & headphones"],
  airpods: ["audio & headphones"],
  speaker: ["audio & headphones"],
  soundbar: ["audio & headphones"],
  audio: ["audio & headphones"],
  tv: ["tvs & displays"],
  television: ["tvs & displays"],
  projector: ["tvs & displays"],
  camera: ["cameras"],
  lens: ["cameras"],
  gopro: ["cameras"],
  gaming: ["gaming"],
  console: ["gaming"],
  playstation: ["gaming"],
  xbox: ["gaming"],
  nintendo: ["gaming"],
  // Electronics accessories
  charger: ["electronics & accessories"],
  cable: ["electronics & accessories"],
  powerbank: ["electronics & accessories"],
  adapter: ["electronics & accessories"],
  router: ["electronics & accessories"],
  // Home
  blender: ["home appliances"],
  microwave: ["home appliances"],
  fridge: ["home appliances"],
  refrigerator: ["home appliances"],
  vacuum: ["home appliances"],
  kettle: ["home appliances"],
  toaster: ["home appliances"],
  vase: ["home & living"],
  plant: ["home & living"],
  flower: ["home & living"],
  candle: ["home & living"],
  lamp: ["home & living"],
  furniture: ["home & living"],
  decor: ["home & living"],
  // Watches / jewelry / bags
  watch: ["watches & accessories"],
  watches: ["watches & accessories"],
  smartwatch: ["watches & accessories"],
  jewelry: ["jewelry"],
  necklace: ["jewelry"],
  ring: ["jewelry"],
  bracelet: ["jewelry"],
  earring: ["jewelry"],
  bag: ["bags & luggage"],
  backpack: ["bags & luggage"],
  handbag: ["bags & luggage"],
  luggage: ["bags & luggage"],
  suitcase: ["bags & luggage"],
  wallet: ["bags & luggage"],
  // Toys / baby
  toy: ["toys & games"],
  toys: ["toys & games"],
  lego: ["toys & games"],
  puzzle: ["toys & games"],
  baby: ["baby & kids"],
  kids: ["baby & kids"],
  stroller: ["baby & kids"],
  // Food / sports / stationery
  chocolate: ["food & gourmet"],
  chocolates: ["food & gourmet"],
  sweets: ["food & gourmet"],
  coffee: ["food & gourmet"],
  tea: ["food & gourmet"],
  camping: ["sports & outdoors"],
  tent: ["sports & outdoors"],
  outdoor: ["sports & outdoors"],
  fitness: ["sports & outdoors"],
  yoga: ["sports & outdoors"],
  bicycle: ["sports & outdoors"],
  pen: ["stationery & office"],
  notebook: ["stationery & office"],
  stationery: ["stationery & office"],
};

const RECIPIENTS: Record<string, string> = {
  mother: "mother", mom: "mother", mum: "mother", mama: "mother",
  wife: "wife", husband: "husband",
  girlfriend: "girlfriend", boyfriend: "boyfriend",
  father: "father", dad: "father",
  sister: "sister", brother: "brother",
  son: "son", daughter: "daughter",
  kid: "kids", kids: "kids", child: "kids", children: "kids",
  friend: "friend", colleague: "colleague", boss: "boss",
};

const OCCASIONS: Record<string, string> = {
  birthday: "birthday", anniversary: "anniversary", wedding: "wedding",
  engagement: "engagement", graduation: "graduation",
  ramadan: "ramadan", eid: "eid", christmas: "christmas",
  valentine: "valentine", valentines: "valentine",
  housewarming: "housewarming", newborn: "new baby",
};

const STOPWORDS = new Set([
  "a","an","the","for","to","of","in","on","under","below","less","than","my","me","i",
  "want","need","looking","find","get","buy","gift","present","with","and","or","best",
  "good","nice","jod","jd","dinar","dinars","around","about","budget","price","cheap",
  "between","max","maximum","up","at","is","that","she","he","her","his","likes","like",
]);

function parseBudget(q: string): { min: number | null; max: number | null } {
  const text = q.toLowerCase();
  const num = (s: string | undefined) => Number((s ?? "").replace(/,/g, ""));

  const between = text.match(/between\s+(\d[\d,]*)\s+(?:and|to|-)\s+(\d[\d,]*)/);
  if (between) return { min: num(between[1]), max: num(between[2]) };

  const range = text.match(/(\d[\d,]*)\s*-\s*(\d[\d,]*)\s*(?:jod|jd|dinars?)?/);
  if (range && /(jod|jd|dinar|budget|price)/.test(text)) {
    return { min: num(range[1]), max: num(range[2]) };
  }

  // "around/about 80" -> a band centered on the target, not just "<= 80".
  const around = text.match(/(?:around|about|approximately|roughly|~|circa)\s+(\d[\d,]*)/);
  if (around) {
    const n = num(around[1]);
    return { min: Math.floor(n * 0.7), max: Math.ceil(n * 1.3) };
  }

  const under = text.match(/(?:under|below|less than|max|maximum|up to|within)\s+(\d[\d,]*)/);
  if (under) return { min: null, max: num(under[1]) };

  const over = text.match(/(?:over|above|more than|at least|from)\s+(\d[\d,]*)/);
  if (over) return { min: num(over[1]), max: null };

  // "50 jod" / "budget of 50" / "around 50"
  const withCurrency = text.match(/(\d[\d,]*)\s*(?:jod|jd|dinars?)/);
  if (withCurrency) return { min: null, max: num(withCurrency[1]) };
  const budgetOf = text.match(/(?:budget|price)\s*(?:of|is|:)?\s*(\d[\d,]*)/);
  if (budgetOf) return { min: null, max: num(budgetOf[1]) };

  return { min: null, max: null };
}

function parseQuantity(q: string): number | null {
  const m = q.toLowerCase().match(/\bfor\s+(two|three|four|2|3|4)\b/);
  const token = m?.[1];
  if (!token) return null;
  const map: Record<string, number> = { two: 2, three: 3, four: 4 };
  return map[token] ?? Number(token);
}

function matchCategories(q: string, dbCategories: string[]): string[] {
  const lower = q.toLowerCase();
  const byLower = new Map(dbCategories.map((c) => [c.toLowerCase(), c]));
  const matched = new Set<string>();

  // 1) curated hints
  for (const [term, cats] of Object.entries(CATEGORY_HINTS)) {
    if (new RegExp(`\\b${term}\\b`).test(lower)) {
      for (const c of cats) {
        const real = byLower.get(c);
        if (real) matched.add(real);
      }
    }
  }
  // 2) direct substring of a real category name appearing in the query
  for (const [lc, real] of byLower) {
    const head = (lc.split(/[&,/]/)[0] ?? "").trim();
    if (head.length > 3 && lower.includes(head)) matched.add(real);
  }
  return [...matched];
}

function extractKeywords(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

function firstMatch(q: string, table: Record<string, string>): string | null {
  const lower = q.toLowerCase();
  for (const [k, v] of Object.entries(table)) {
    if (new RegExp(`\\b${k}\\b`).test(lower)) return v;
  }
  return null;
}

/**
 * Deterministic intent parser. All numeric constraints (budget) are extracted
 * here in code — never from an LLM. Returns a structured Constraints object.
 */
export function parseConstraints(query: string, dbCategories: string[]): Constraints {
  const budget = parseBudget(query);
  return {
    rawQuery: query,
    budgetMin: budget.min,
    budgetMax: budget.max,
    currency: CURRENCY_WORDS.test(query) ? "JOD" : "JOD",
    categories: matchCategories(query, dbCategories),
    keywords: extractKeywords(query),
    brands: [],
    recipient: firstMatch(query, RECIPIENTS),
    occasion: firstMatch(query, OCCASIONS),
    quantity: parseQuantity(query),
  };
}

/** Fold a user profile into constraints (only fills gaps the user didn't state). */
export function applyProfile(c: Constraints, profile?: UserProfileInput): Constraints {
  if (!profile) return c;
  const out = { ...c, brands: [...c.brands] };
  if (out.budgetMax === null) {
    const b = profile.shopping?.shoppingBudget ?? profile.financial?.shoppingBudget;
    if (typeof b === "number") out.budgetMax = b;
  }
  if (profile.shopping?.preferredBrands?.length) {
    out.brands = [...new Set([...out.brands, ...profile.shopping.preferredBrands])];
  }
  return out;
}

/**
 * Optional LLM enrichment: when a real provider is configured, ask it to map the
 * query to additional category names + keywords. Numbers are NOT touched here —
 * budget stays exactly as parsed deterministically. Best-effort; failures ignored.
 */
export async function enrichWithLLM(
  c: Constraints,
  provider: AIProvider,
  dbCategories: string[]
): Promise<Constraints> {
  if (provider.isMock) return c;
  try {
    const alreadyMapped = c.categories.join(", ");
    const res = await provider.complete({
      system:
        "You map a shopping query to specific product categories in a Jordan e-commerce catalogue. " +
        'Return JSON {"categories": string[], "keywords": string[]}. ' +
        "Rules:\n" +
        "1. Only use category names EXACTLY as given in the list.\n" +
        "2. Pick the MOST SPECIFIC matching category — never add a broad umbrella category " +
        "(e.g. 'Electronics & Accessories') when a specific sub-category already matches " +
        "(e.g. 'Audio & Headphones'). Broad categories are only valid when no specific one fits.\n" +
        "3. Add at most 1-2 categories. Do NOT include prices or numbers in keywords.",
      messages: [
        {
          role: "user",
          content: `Query: ${c.rawQuery}\nAlready mapped to: ${alreadyMapped || "none"}\nAvailable categories: ${dbCategories.join(", ")}`,
        },
      ],
      json: true,
      temperature: 0,
      maxTokens: 300,
    });
    const parsed = JSON.parse(res.text) as { categories?: string[]; keywords?: string[] };
    const valid = new Set(dbCategories);
    const llmCats = (parsed.categories ?? []).filter((x) => valid.has(x));
    // Only add LLM categories that are at least as specific as already-mapped ones.
    // Heuristic: if we already have a specific category and LLM adds a broader one
    // (shorter name = more general in this taxonomy), skip it.
    const existingMin = c.categories.length ? Math.min(...c.categories.map((x) => x.length)) : 0;
    const filteredCats = llmCats.filter(
      (cat) => c.categories.length === 0 || cat.length >= existingMin - 5
    );
    return {
      ...c,
      categories: [...new Set([...c.categories, ...filteredCats])],
      keywords: [...new Set([...c.keywords, ...(parsed.keywords ?? []).map((k) => k.toLowerCase())])],
    };
  } catch {
    return c;
  }
}
