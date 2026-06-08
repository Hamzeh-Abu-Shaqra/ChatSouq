import { sql } from "drizzle-orm";
import { db } from "@chatsouq/db";
import { getProvider, getEmbedder, type AIProvider, type Embedder } from "@chatsouq/ai";
import { webSearch, formatWebResults } from "./web-search";
import type {
  PlaceCandidate,
  PlaceIntent,
  PlaceRecommendationResponse,
  PlaceResultItem,
  RecommendInput,
  ResultPlace,
} from "./types";

// Jordan's 12 governorates + common aliases. Detecting one scopes a place query
// to a region (and keeps us strictly on the Jordan knowledge graph).
const GOVERNORATES: Record<string, string> = {
  amman: "Amman",
  irbid: "Irbid",
  zarqa: "Zarqa",
  mafraq: "Mafraq",
  balqa: "Balqa",
  salt: "Balqa",
  madaba: "Madaba",
  karak: "Karak",
  tafilah: "Tafilah",
  tafila: "Tafilah",
  maan: "Ma'an",
  "ma'an": "Ma'an",
  aqaba: "Aqaba",
  jerash: "Jerash",
  ajloun: "Ajloun",
  ajlun: "Ajloun",
};

/**
 * Curated query-term -> place-category hints. Values are the normalized place
 * categories produced at ingest (see packages/db/scripts/lib/normalize.ts) and
 * are matched case-insensitively against the real categories in the DB.
 */
const PLACE_HINTS: Record<string, string[]> = {
  restaurant: ["Restaurant"],
  restaurants: ["Restaurant"],
  eat: ["Restaurant", "Fast Food"],
  food: ["Restaurant", "Fast Food"],
  dinner: ["Restaurant"],
  lunch: ["Restaurant"],
  cafe: ["Cafe", "Coffee Shop"],
  coffee: ["Cafe", "Coffee Shop"],
  cafes: ["Cafe", "Coffee Shop"],
  dessert: ["Dessert"],
  bakery: ["Bakery"],
  sweets: ["Sweets", "Pastry"],
  bar: ["Bar"],
  pub: ["Bar"],
  gym: ["Gym"],
  fitness: ["Gym", "Sports Center"],
  workout: ["Gym"],
  spa: ["Spa"],
  salon: ["Salon"],
  barber: ["Salon"],
  haircut: ["Salon"],
  pharmacy: ["Pharmacy"],
  pharmacies: ["Pharmacy"],
  hospital: ["Hospital"],
  clinic: ["Clinic", "Medical Center"],
  doctor: ["Doctor", "Clinic"],
  dentist: ["Dentist"],
  hotel: ["Hotel", "Guest House", "Hostel"],
  hostel: ["Hostel"],
  stay: ["Hotel", "Guest House"],
  supermarket: ["Supermarket"],
  grocery: ["Supermarket", "Convenience Store"],
  market: ["Market", "Supermarket"],
  mall: ["Shopping Mall"],
  bank: ["Bank"],
  atm: ["Bank"],
  museum: ["Museum"],
  park: ["Park"],
  attraction: ["Attraction", "Viewpoint"],
  school: ["School"],
  university: ["University", "College"],
  gas: ["Gas Station"],
  fuel: ["Gas Station"],
  bookstore: ["Bookstore"],
  florist: ["Florist"],
  optician: ["Optician"],
  vet: ["Veterinary"],
  veterinary: ["Veterinary"],
};

let categoryCache: { at: number; values: string[] } | null = null;

/** Distinct place categories (cached 5 min). */
export async function getPlaceCategories(): Promise<string[]> {
  if (categoryCache && Date.now() - categoryCache.at < 5 * 60_000) {
    return categoryCache.values;
  }
  const rows = (await db.execute(
    sql`SELECT DISTINCT category FROM places WHERE category IS NOT NULL ORDER BY category`
  )) as unknown as { category: string }[];
  const values = rows.map((r) => r.category);
  categoryCache = { at: Date.now(), values };
  return values;
}

const STOPWORDS = new Set([
  "a","an","the","in","on","near","nearby","close","best","good","top","find","show",
  "me","my","want","need","looking","for","to","of","is","are","where","place","places",
  "spot","spots","around","at","go","visit","get","some","any","with","and","or","jordan",
]);

function extractKeywords(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

function matchPlaceCategories(q: string, dbCategories: string[]): string[] {
  const lower = q.toLowerCase();
  const byLower = new Map(dbCategories.map((c) => [c.toLowerCase(), c]));
  const matched = new Set<string>();
  for (const [term, cats] of Object.entries(PLACE_HINTS)) {
    if (new RegExp(`\\b${term}\\b`).test(lower)) {
      for (const c of cats) {
        const real = byLower.get(c.toLowerCase());
        if (real) matched.add(real);
      }
    }
  }
  // Direct mention of a real category name (e.g. "pharmacy", "museum").
  for (const [lc, real] of byLower) {
    if (lc.length > 3 && lower.includes(lc)) matched.add(real);
  }
  return [...matched];
}

function detectGovernorate(q: string): string | null {
  const lower = q.toLowerCase();
  for (const [k, v] of Object.entries(GOVERNORATES)) {
    if (new RegExp(`\\b${k}\\b`).test(lower)) return v;
  }
  return null;
}

/** Parse a place/service query into structured intent. */
export function parsePlaceIntent(query: string, dbCategories: string[]): PlaceIntent {
  return {
    rawQuery: query,
    categories: matchPlaceCategories(query, dbCategories),
    governorate: detectGovernorate(query),
    city: null,
    keywords: extractKeywords(query),
  };
}

/** Count matching PLACE_HINTS keywords without requiring DB categories. */
function staticHintMatches(query: string): number {
  const lower = query.toLowerCase();
  let n = 0;
  for (const term of Object.keys(PLACE_HINTS)) {
    if (new RegExp(`\\b${term}\\b`).test(lower)) n++;
  }
  return n;
}

/**
 * A 0..N "this is a places query" signal. Used by the router to decide between the
 * product catalogue and the Jordan places graph.
 *
 * Fires on static PLACE_HINTS keywords first (no DB required) so obvious place
 * queries like "cafe" or "pharmacy" are caught even before places are ingested.
 * DB-backed bonuses are added when categories are available.
 */
export function placeSignal(query: string, dbCategories: string[]): number {
  // Static keyword signal — works with an empty DB.
  let s = staticHintMatches(query) * 2;

  // DB-backed bonuses: confirmed category hit + direct category name mention.
  if (dbCategories.length > 0) {
    const lower = query.toLowerCase();
    const byLower = new Map(dbCategories.map((c) => [c.toLowerCase(), c]));
    for (const [term, cats] of Object.entries(PLACE_HINTS)) {
      if (new RegExp(`\\b${term}\\b`).test(lower)) {
        for (const c of cats) {
          if (byLower.has(c.toLowerCase())) { s += 1; break; }
        }
      }
    }
    for (const [lc] of byLower) {
      if (lc.length > 3 && lower.includes(lc)) s += 1;
    }
  }

  const intent = parsePlaceIntent(query, dbCategories);
  if (intent.governorate) s += 1;
  if (/\b(near me|nearby|close to|around here|in town)\b/i.test(query)) s += 2;
  if (/\b(where|place|places|spot|visit|go to|open now)\b/i.test(query)) s += 1;
  return s;
}

function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

interface SearchOpts {
  poolSize?: number;
  useCategoryFilter: boolean;
  useGovernorateFilter: boolean;
}

async function searchPlaces(
  intent: PlaceIntent,
  queryVec: number[],
  queryText: string,
  opts: SearchOpts
): Promise<PlaceCandidate[]> {
  const poolSize = opts.poolSize ?? 120;
  const vecLit = toVectorLiteral(queryVec);
  const conditions = [sql`p.embedding IS NOT NULL`];

  if (opts.useCategoryFilter && intent.categories.length > 0) {
    const cats = sql.join(
      intent.categories.map((c) => sql`${c}`),
      sql`, `
    );
    conditions.push(sql`p.category IN (${cats})`);
  }
  if (opts.useGovernorateFilter && intent.governorate) {
    conditions.push(sql`p.governorate = ${intent.governorate}`);
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const rows = (await db.execute(sql`
    SELECT
      p.id, p.name, p.name_ar AS "nameAr", p.category, p.subcategory,
      p.governorate, p.city, p.address, p.phone, p.website,
      p.opening_hours AS "openingHours", p.lat, p.lng, p.source_url AS "sourceUrl",
      p.search_text AS "searchText",
      (1 - (p.embedding <=> ${vecLit}::vector)) AS "vecSim",
      similarity(coalesce(p.search_text, ''), ${queryText}) AS "txtSim"
    FROM places p
    WHERE ${whereClause}
    ORDER BY (1 - (p.embedding <=> ${vecLit}::vector)) + 2.0 * similarity(coalesce(p.search_text, ''), ${queryText}) DESC
    LIMIT ${poolSize}
  `)) as unknown as Record<string, unknown>[];

  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    nameAr: (r.nameAr as string) ?? null,
    category: String(r.category),
    subcategory: (r.subcategory as string) ?? null,
    governorate: (r.governorate as string) ?? null,
    city: (r.city as string) ?? null,
    address: (r.address as string) ?? null,
    phone: (r.phone as string) ?? null,
    website: (r.website as string) ?? null,
    openingHours: (r.openingHours as string) ?? null,
    lat: r.lat === null || r.lat === undefined ? null : Number(r.lat),
    lng: r.lng === null || r.lng === undefined ? null : Number(r.lng),
    sourceUrl: (r.sourceUrl as string) ?? null,
    searchText: (r.searchText as string) ?? null,
    vecSim: Number(r.vecSim ?? 0),
    txtSim: Number(r.txtSim ?? 0),
  }));
}

// ── Scraped-source integration ────────────────────────────────────────────────
//
// Queries jordan_places (Google Maps) and jordan_restaurants (Talabat) in
// parallel with the main OSM places table. Falls back gracefully if the
// embedding column hasn't been added yet (run embed-scraped.ts first).
//
// IDs are offset by large constants so they never collide with OSM place IDs:
//   jordan_places     → id + 2_000_000
//   jordan_restaurants → id + 3_000_000

async function fetchScrapedCandidates(
  intent: PlaceIntent,
  queryVec: number[],
  queryText: string,
  limit: number
): Promise<PlaceCandidate[]> {
  const vecLit = toVectorLiteral(queryVec);
  const all: PlaceCandidate[] = [];
  const wantRestaurant =
    intent.categories.some((c) =>
      /restaurant|cafe|coffee|food|bakery|dessert|fast.food/i.test(c)
    ) ||
    /\b(eat|food|restaurant|cafe|coffee|lunch|dinner|breakfast|delivery)\b/i.test(
      intent.rawQuery
    );
  const wantPlace = !wantRestaurant || intent.categories.length === 0;

  // ── jordan_places (Google Maps) ──────────────────────────────────────────
  if (wantPlace) {
    try {
      const rows = (await db.execute(sql`
        SELECT
          p.id + 2000000   AS id,
          p.name,
          p.category,
          p.address,
          p.phone,
          p.website,
          p.rating,
          p.search_text    AS "searchText",
          (1 - (p.embedding <=> ${vecLit}::vector))                          AS "vecSim",
          similarity(coalesce(p.search_text, ''), ${queryText})              AS "txtSim"
        FROM jordan_places p
        WHERE p.embedding IS NOT NULL
        ORDER BY "vecSim" + 2.0 * "txtSim" DESC
        LIMIT ${limit}
      `)) as unknown as Record<string, unknown>[];

      for (const r of rows) {
        // Encode Google Maps rating (0-5) as a tiny vecSim bonus (max 0.08).
        const ratingBonus = r.rating ? (Number(r.rating) / 5) * 0.08 : 0;
        all.push({
          id: Number(r.id),
          name: String(r.name),
          nameAr: null,
          category: String(r.category ?? "Place"),
          subcategory: null,
          governorate: "Amman",
          city: "Amman",
          address: (r.address as string) ?? null,
          phone: (r.phone as string) ?? null,
          website: (r.website as string) ?? null,
          openingHours: null,
          lat: null,
          lng: null,
          sourceUrl: null,
          searchText: (r.searchText as string) ?? null,
          vecSim: Math.min(1, Number(r.vecSim ?? 0) + ratingBonus),
          txtSim: Number(r.txtSim ?? 0),
        });
      }
    } catch {
      /* embedding column not yet created — silently skip */
    }
  }

  // ── jordan_restaurants (Talabat) ─────────────────────────────────────────
  if (wantRestaurant) {
    try {
      const rows = (await db.execute(sql`
        SELECT
          r.id + 3000000   AS id,
          r.name,
          r.cuisine,
          r.rating,
          r.delivery_time  AS "deliveryTime",
          r.url,
          r.search_text    AS "searchText",
          (1 - (r.embedding <=> ${vecLit}::vector))                          AS "vecSim",
          similarity(coalesce(r.search_text, ''), ${queryText})              AS "txtSim"
        FROM jordan_restaurants r
        WHERE r.embedding IS NOT NULL
        ORDER BY "vecSim" + 2.0 * "txtSim" DESC
        LIMIT ${limit}
      `)) as unknown as Record<string, unknown>[];

      for (const r of rows) {
        const ratingBonus = r.rating ? (Number(r.rating) / 5) * 0.10 : 0;
        const delivery = r.deliveryTime ? `Delivery: ${r.deliveryTime}` : null;
        all.push({
          id: Number(r.id),
          name: String(r.name),
          nameAr: null,
          category: String(r.cuisine ?? "Restaurant"),
          subcategory: "Restaurant",
          governorate: "Amman",
          city: "Amman",
          address: null,
          phone: null,
          website: (r.url as string) ?? null,
          openingHours: delivery,
          lat: null,
          lng: null,
          sourceUrl: (r.url as string) ?? null,
          searchText: (r.searchText as string) ?? null,
          vecSim: Math.min(1, Number(r.vecSim ?? 0) + ratingBonus),
          txtSim: Number(r.txtSim ?? 0),
        });
      }
    } catch {
      /* embedding column not yet created — silently skip */
    }
  }

  return all;
}

// ── Deduplication ─────────────────────────────────────────────────────────────
// Remove scraped candidates whose name is too similar to an already-included
// OSM candidate (avoids showing the same place twice from different sources).

function deduplicateCandidates(candidates: PlaceCandidate[]): PlaceCandidate[] {
  const seen = new Set<string>();
  const out: PlaceCandidate[] = [];
  for (const c of candidates) {
    const key = c.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────

interface ScoredPlace extends PlaceCandidate {
  score: number;
  keywordHits: number;
}

const PLACE_WEIGHTS = { vec: 0.5, txt: 0.15, keyword: 0.2, category: 0.1, geo: 0.05 };

function rescaleVec(cos: number): number {
  return Math.max(0, Math.min(1, (cos - 0.15) / 0.5));
}

function rankPlaces(candidates: PlaceCandidate[], intent: PlaceIntent): ScoredPlace[] {
  const wantedCats = new Set(intent.categories.map((c) => c.toLowerCase()));
  const scored = candidates.map((c) => {
    const hay = (c.searchText || c.name).toLowerCase();
    let hits = 0;
    for (const k of intent.keywords) if (hay.includes(k)) hits++;
    const keyword = intent.keywords.length ? hits / intent.keywords.length : 0;
    const category = wantedCats.size > 0 && wantedCats.has(c.category.toLowerCase()) ? 1 : 0;
    const geo =
      intent.governorate && c.governorate && c.governorate === intent.governorate ? 1 : 0;
    const score =
      PLACE_WEIGHTS.vec * rescaleVec(c.vecSim) +
      PLACE_WEIGHTS.txt * Math.max(0, Math.min(1, c.txtSim)) +
      PLACE_WEIGHTS.keyword * keyword +
      PLACE_WEIGHTS.category * category +
      PLACE_WEIGHTS.geo * geo;
    return { ...c, score, keywordHits: hits };
  });
  scored.sort((a, b) => b.score - a.score || b.vecSim - a.vecSim);
  return scored;
}

function toResultPlace(c: PlaceCandidate): ResultPlace {
  return {
    id: c.id,
    name: c.name,
    nameAr: c.nameAr,
    category: c.category,
    subcategory: c.subcategory,
    governorate: c.governorate,
    city: c.city,
    address: c.address,
    phone: c.phone,
    website: c.website,
    openingHours: c.openingHours,
    lat: c.lat,
    lng: c.lng,
    sourceUrl: c.sourceUrl,
  };
}

const ARABIC_CHAR_RE = /[؀-ۿ]/;

function placeWhy(c: ScoredPlace, isBest: boolean, queryLang: "en" | "ar"): string {
  const lead = isBest ? "Top pick" : "Alternative";
  const where = c.city ? `in ${c.city}` : c.governorate ? `in ${c.governorate}` : "in Jordan";
  const nameIsArabic = ARABIC_CHAR_RE.test(c.name);
  // When the name is Arabic and the query is English, omit the raw name from the
  // reasoning text — the card heading will display it correctly in RTL.
  const namePart = nameIsArabic && queryLang === "en" ? "" : `: ${c.name}`;
  return `${lead}${namePart}, a ${c.category.toLowerCase()} ${where}.`.replace(/\s+/g, " ").replace(/^(Top pick|Alternative), /, "$1: ");
}

function placePros(c: ScoredPlace, intent: PlaceIntent, lang: "en" | "ar"): string[] {
  const pros: string[] = [];
  const loc = c.city ?? c.governorate;
  if (intent.governorate && c.governorate === intent.governorate) {
    pros.push(lang === "ar" ? `موجود في ${c.governorate}` : `Located in ${c.governorate}`);
  } else if (loc) {
    pros.push(lang === "ar" ? `موجود في ${loc}` : `Located in ${loc}`);
  }
  if (c.keywordHits > 0 || rescaleVec(c.vecSim) >= 0.6) {
    pros.push(lang === "ar" ? "يطابق ما بحثت عنه" : "Closely matches what you asked for");
  }
  if (c.phone) pros.push(lang === "ar" ? `للتواصل: ${c.phone}` : `Contact: ${c.phone}`);
  if (c.website) pros.push(lang === "ar" ? "يوجد موقع إلكتروني للمراجعة" : "Has a website you can check");
  if (c.openingHours) pros.push(lang === "ar" ? "أوقات العمل متاحة" : "Opening hours listed");
  return pros.slice(0, 4);
}

function placeCons(c: ScoredPlace, lang: "en" | "ar"): string[] {
  const cons: string[] = [];
  if (!c.phone && !c.website) cons.push(lang === "ar" ? "لا يوجد رقم هاتف أو موقع إلكتروني" : "No phone or website listed");
  if (!c.address && !c.city) cons.push(lang === "ar" ? "العنوان التفصيلي غير محدد" : "Exact address not specified");
  if (!c.openingHours) cons.push(lang === "ar" ? "أوقات العمل غير مذكورة" : "Opening hours not listed");
  return cons.slice(0, 2);
}

function buildSummary(intent: PlaceIntent, count: number, relaxedGov: boolean, lang: "en" | "ar"): string {
  if (lang === "ar") {
    if (count === 0) return `لم أتمكن من العثور على مكان مطابق لـ "${intent.rawQuery}" في الأردن.`;
    const what = intent.categories.length ? intent.categories[0]! : "مكان";
    const where = intent.governorate && !relaxedGov ? ` في ${intent.governorate}` : "";
    const lead = count === 1 ? `إليك أفضل ${what}` : `إليك أفضل ${count} خيارات ${what}`;
    const tail = relaxedGov ? " (وسّعت نطاق البحث لأعرض خيارات حقيقية)" : "";
    return `${lead}${where} وجدتها.${tail}`;
  }
  if (count === 0) return `I couldn't find a matching place for "${intent.rawQuery}" in Jordan yet.`;
  const what = intent.categories.length ? intent.categories[0]!.toLowerCase() : "place";
  const where = intent.governorate && !relaxedGov ? ` in ${intent.governorate}` : "";
  const lead = count === 1 ? `Here is the best ${what}` : `Here are the top ${count} ${what} options`;
  const tail = relaxedGov ? " (I widened the area to show real options)" : "";
  return `${lead}${where} I found.${tail}`;
}

interface Deps {
  provider?: AIProvider;
  embedder?: Embedder;
}

/**
 * Recommend Jordan places/services. Mirrors the product engine: deterministic
 * intent -> retrieval (vector + trigram, optional category/governorate hard
 * filter with graceful relaxation) -> weighted ranking -> fact-grounded
 * explanations. Strictly the Jordan places graph; no invented facts.
 */
export async function recommendPlaces(
  input: RecommendInput,
  deps: Deps = {}
): Promise<PlaceRecommendationResponse> {
  const started = Date.now();
  const provider = deps.provider ?? getProvider();
  const embedder = deps.embedder ?? getEmbedder();
  const limit = Math.max(1, Math.min(input.limit ?? 4, 8));

  const categories = await getPlaceCategories();

  const queryLang: "en" | "ar" = /[؀-ۿ]/.test(input.query) ? "ar" : "en";

  // Places table not yet populated — return a clear "not ready" message rather
  // than falling through to the product search and returning irrelevant results.
  if (categories.length === 0) {
    return {
      kind: "places",
      query: input.query,
      intent: { rawQuery: input.query, categories: [], governorate: detectGovernorate(input.query), city: null, keywords: [] },
      summary: queryLang === "ar"
        ? "لا تزال قاعدة بيانات الأماكن قيد البناء — حاول مجدداً قريباً."
        : "I'm still building my knowledge of Jordan's places and services — check back shortly.",
      best: null,
      alternatives: [],
      meta: { provider: provider.name, embedder: embedder.name, candidateCount: 0, tookMs: Date.now() - started, relaxedCategory: false, relaxedGovernorate: false },
    };
  }

  const intent = parsePlaceIntent(input.query, categories);

  const embedText = [input.query, ...intent.categories, ...intent.keywords].filter(Boolean).join(" ");
  const [queryVec] = await embedder.embed([embedText]);
  if (!queryVec) throw new Error("Failed to embed the query.");

  const wantGov = intent.governorate !== null;
  const plans = [
    { c: true, g: true },
    { c: true, g: false },
    { c: false, g: true },
    { c: false, g: false },
  ];

  // ── OSM places (main knowledge graph) ──────────────────────────────────────
  let candidates: PlaceCandidate[] = [];
  let chosen = plans[0]!;
  for (const p of plans) {
    const got = await searchPlaces(intent, queryVec, input.query, {
      useCategoryFilter: p.c,
      useGovernorateFilter: p.g,
    });
    if (got.length >= limit) {
      candidates = got;
      chosen = p;
      break;
    }
    if (got.length > candidates.length) {
      candidates = got;
      chosen = p;
    }
  }

  const relaxedGovernorate = wantGov && !chosen.g;
  const relaxedCategory = intent.categories.length > 0 && !chosen.c;

  // ── Scraped sources (Google Maps + Talabat) ─────────────────────────────────
  // Fetch in parallel; merge and deduplicate so OSM records come first and
  // scraped records fill gaps or surface higher-rated options.
  const scraped = await fetchScrapedCandidates(intent, queryVec, input.query, limit * 2);
  const merged  = deduplicateCandidates([...candidates, ...scraped]);

  const ranked = rankPlaces(merged, intent).slice(0, limit);

  // Build code-based why/pros/cons as fallback, then enrich with Claude + web search if available.
  const whyMap = new Map<number, string>(ranked.map((c, i) => [c.id, placeWhy(c, i === 0, queryLang)]));
  if (!provider.isMock && ranked.length > 0) {
    try {
      // Fire web search in parallel with building the place list — no added latency
      const webSearchQuery = intent.categories.length > 0
        ? `${intent.categories[0]} ${intent.governorate ?? "Amman"}`
        : input.query;
      const webResults = await webSearch(webSearchQuery, { maxResults: 3, searchDepth: "basic" });
      const webContext = formatWebResults(webResults, "LIVE WEB INFO");

      const placeItems = ranked.map((c, i) => ({
        id: c.id,
        name: ARABIC_CHAR_RE.test(c.name) ? (c.nameAr ?? c.name) : c.name,
        category: c.category,
        city: c.city ?? c.governorate ?? "Jordan",
        phone: c.phone ? "yes" : "no",
        website: c.website ? "yes" : "no",
        openingHours: c.openingHours ?? null,
        role: i === 0 ? "best" : "alternative",
      }));
      const langInstruction = queryLang === "ar"
        ? "IMPORTANT: Write all 'why' values in Arabic only."
        : "Write all 'why' values in English.";
      const placeRes = await provider.complete({
        system:
          "You write one specific sentence (max 28 words) explaining why each place fits the user's " +
          "request, in the context of searching in Jordan. Mention the category and location. " +
          `Use ONLY the provided facts — no invented details. ${langInstruction}` +
          (webContext ? `\n${webContext}` : "") +
          '\nReturn JSON: an array of {"id": number, "why": string}.',
        messages: [{
          role: "user",
          content: `User asked for: "${input.query}"\nPlaces: ${JSON.stringify(placeItems)}`,
        }],
        json: true,
        temperature: 0.3,
        maxTokens: 600,
      });
      const parsed = JSON.parse(placeRes.text) as { id: number; why: string }[];
      for (const p of parsed) {
        if (typeof p.why === "string" && p.why.trim()) whyMap.set(p.id, p.why.trim());
      }
    } catch {
      // keep code-generated whys
    }
  }

  const items: PlaceResultItem[] = ranked.map((c, i) => ({
    place: toResultPlace(c),
    score: Number(c.score.toFixed(4)),
    isBest: i === 0,
    why: whyMap.get(c.id) ?? placeWhy(c, i === 0, queryLang),
    pros: placePros(c, intent, queryLang),
    cons: placeCons(c, queryLang),
  }));

  return {
    kind: "places",
    query: input.query,
    intent,
    summary: buildSummary(intent, items.length, relaxedGovernorate, queryLang),
    best: items[0] ?? null,
    alternatives: items.slice(1),
    meta: {
      provider: provider.name,
      embedder: embedder.name,
      candidateCount: candidates.length,
      tookMs: Date.now() - started,
      relaxedCategory,
      relaxedGovernorate,
    },
  };
}
