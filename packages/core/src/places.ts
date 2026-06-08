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

// Jordan's 12 governorates + common aliases + Arabic names.
// Detecting one scopes a place query to a region.
const GOVERNORATES: Record<string, string> = {
  // English
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
  // Arabic
  "عمان":    "Amman",
  "إربد":    "Irbid",
  "اربد":    "Irbid",
  "الزرقاء": "Zarqa",
  "زرقاء":   "Zarqa",
  "العقبة":  "Aqaba",
  "عقبة":    "Aqaba",
  "المفرق":  "Mafraq",
  "مفرق":    "Mafraq",
  "البلقاء": "Balqa",
  "السلط":   "Balqa",
  "مادبا":   "Madaba",
  "الكرك":   "Karak",
  "كرك":     "Karak",
  "الطفيلة": "Tafilah",
  "معان":    "Ma'an",
  "جرش":     "Jerash",
  "عجلون":   "Ajloun",
};

/**
 * Well-known Amman neighbourhoods and districts. Mentioning one of these is a
 * very strong signal that the query is about a physical place, not a product.
 * Each adds +2 to the place signal when detected.
 */
const AMMAN_DISTRICTS = [
  // Jabal areas (any "jabal" = hilltop district = always a place query)
  "jabal amman", "jabal hussein", "jabal webdeh", "jabal luweibdeh", "jabal nuzha",
  "jabal",       // generic — still a place signal
  // Upscale west Amman
  "abdoun", "sweifieh", "shmeisani", "khalda", "dabouq", "deir ghbar",
  "um uthaina", "umm uthaina", "um utheina", "tla' ali", "tlaa ali",
  // Circles (landmark references)
  "1st circle", "2nd circle", "3rd circle", "4th circle",
  "5th circle", "6th circle", "7th circle", "8th circle",
  "first circle", "second circle", "third circle", "fourth circle",
  "fifth circle", "sixth circle", "seventh circle", "eighth circle",
  // Central / commercial
  "downtown amman", "downtown", "city centre", "rainbow street",
  "rainbow", "garden street", "mecca street", "wasfi tal", "wasfi el tal",
  // East Amman / other
  "zarqa road", "sports city", "sport city", "jubeiha", "sweileh",
  "bayader wadi seer", "wadi seer", "nakheel", "marj el hamam", "sahab",
  // Aqaba districts
  "aqaba marina", "aqaba port", "tala bay",
];

/**
 * Curated query-term -> place-category hints. Values are the normalized place
 * categories produced at ingest (see packages/db/scripts/lib/normalize.ts) and
 * are matched case-insensitively against the real categories in the DB.
 */
const PLACE_HINTS: Record<string, string[]> = {
  // ── Food & Drink ────────────────────────────────────────────────────────────
  restaurant: ["Restaurant"],
  restaurants: ["Restaurant"],
  eat: ["Restaurant", "Fast Food"],
  food: ["Restaurant", "Fast Food"],
  dinner: ["Restaurant"],
  lunch: ["Restaurant"],
  breakfast: ["Cafe", "Restaurant"],
  cafe: ["Cafe", "Coffee Shop"],
  coffee: ["Cafe", "Coffee Shop"],
  cafes: ["Cafe", "Coffee Shop"],
  dessert: ["Dessert"],
  bakery: ["Bakery"],
  sweets: ["Sweets", "Pastry"],
  bar: ["Bar"],
  pub: ["Bar"],
  // ── Health ─────────────────────────────────────────────────────────────────
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
  doctors: ["Doctor", "Clinic"],
  dentist: ["Dentist"],
  dentists: ["Dentist"],
  medical: ["Hospital", "Clinic", "Medical Center"],
  health: ["Hospital", "Clinic", "Pharmacy"],
  // ── Shopping ───────────────────────────────────────────────────────────────
  supermarket: ["Supermarket"],
  grocery: ["Supermarket", "Convenience Store"],
  market: ["Market", "Supermarket"],
  mall: ["Shopping Mall"],
  shop: ["Shop", "Store"],
  store: ["Shop", "Store"],
  shopping: ["Shopping Mall", "Store"],
  // ── Services ───────────────────────────────────────────────────────────────
  bank: ["Bank"],
  atm: ["Bank"],
  lawyer: ["Lawyer", "Law Firm"],
  lawyers: ["Lawyer", "Law Firm"],
  legal: ["Lawyer", "Law Firm"],
  accountant: ["Accountant"],
  engineer: ["Engineer"],
  architect: ["Architect"],
  pharmacist: ["Pharmacist"],
  gas: ["Gas Station"],
  fuel: ["Gas Station"],
  // ── Education ──────────────────────────────────────────────────────────────
  school: ["School"],
  schools: ["School"],
  university: ["University", "College"],
  universities: ["University", "College"],
  college: ["University", "College"],
  education: ["School", "University", "College"],
  // ── Hospitality ────────────────────────────────────────────────────────────
  hotel: ["Hotel", "Guest House", "Hostel"],
  hotels: ["Hotel", "Guest House"],
  hostel: ["Hostel"],
  stay: ["Hotel", "Guest House"],
  accommodation: ["Hotel", "Guest House", "Hostel"],
  // ── Religion ───────────────────────────────────────────────────────────────
  mosque: ["Mosque"],
  mosques: ["Mosque"],
  masjid: ["Mosque"],
  prayer: ["Mosque"],
  church: ["Church"],
  // ── Tourism / Attractions ──────────────────────────────────────────────────
  museum: ["Museum"],
  park: ["Park"],
  attraction: ["Attraction", "Viewpoint"],
  landmark: ["Attraction", "Museum"],
  // ── Other ─────────────────────────────────────────────────────────────────
  bookstore: ["Bookstore"],
  florist: ["Florist"],
  optician: ["Optician"],
  vet: ["Veterinary"],
  veterinary: ["Veterinary"],

  // ── Arabic terms ─────────────────────────────────────────────────────────────
  // Food & drink
  "مطعم":          ["Restaurant"],
  "مطاعم":         ["Restaurant"],
  "مطبخ":          ["Restaurant"],
  "كافيه":         ["Cafe", "Coffee Shop"],
  "كافيهات":       ["Cafe", "Coffee Shop"],
  "مقهى":          ["Cafe", "Coffee Shop"],
  "مقاهي":         ["Cafe", "Coffee Shop"],
  "قهوة":          ["Cafe", "Coffee Shop"],
  "فطور":          ["Cafe", "Restaurant"],
  "غداء":          ["Restaurant"],
  "عشاء":          ["Restaurant"],
  "أكل":           ["Restaurant", "Fast Food"],
  "اكل":           ["Restaurant", "Fast Food"],
  "وجبة سريعة":    ["Fast Food"],
  "فاست فود":      ["Fast Food"],
  "بيتزا":         ["Restaurant", "Fast Food"],
  "برغر":          ["Fast Food", "Restaurant"],
  "شاورما":        ["Fast Food", "Restaurant"],
  "فلافل":         ["Fast Food", "Restaurant"],
  "بوفيه":         ["Restaurant"],
  "حلويات":        ["Dessert", "Pastry"],
  "كيك":           ["Bakery", "Dessert"],
  "بيكري":         ["Bakery"],
  "مخبز":          ["Bakery"],
  // Health & wellness
  "صيدلية":        ["Pharmacy"],
  "صيدليات":       ["Pharmacy"],
  "مستشفى":        ["Hospital"],
  "مستشفيات":      ["Hospital"],
  "عيادة":         ["Clinic", "Medical Center"],
  "عيادات":        ["Clinic", "Medical Center"],
  "دكتور":         ["Doctor", "Clinic"],
  "دكتورة":        ["Doctor", "Clinic"],
  "طبيب":          ["Doctor", "Clinic"],
  "أطباء":         ["Doctor", "Clinic"],
  "طبيب أسنان":    ["Dentist"],
  "طبيب اسنان":    ["Dentist"],
  "أسنان":         ["Dentist"],
  "اسنان":         ["Dentist"],
  "جيم":           ["Gym"],
  "نادي رياضي":    ["Gym", "Sports Center"],
  "صالة رياضية":   ["Gym"],
  "سبا":           ["Spa"],
  "مساج":          ["Spa"],
  "صالون":         ["Salon"],
  "كوافير":        ["Salon"],
  "حلاق":          ["Salon"],
  "حلاقة":         ["Salon"],
  // Shopping & services
  "سوبرماركت":     ["Supermarket"],
  "بقالة":         ["Supermarket", "Convenience Store"],
  "سوق":           ["Market", "Supermarket"],
  "مول":           ["Shopping Mall"],
  "مول تجاري":     ["Shopping Mall"],
  "محل":           ["Shop", "Store"],
  "محلات":         ["Shop", "Store"],
  "بنك":           ["Bank"],
  "بنوك":          ["Bank"],
  "صراف":          ["Bank"],
  "محامي":         ["Lawyer", "Law Firm"],
  "محامين":        ["Lawyer", "Law Firm"],
  "محاسب":         ["Accountant"],
  "محطة وقود":     ["Gas Station"],
  "بنزين":         ["Gas Station"],
  // Education
  "مدرسة":         ["School"],
  "مدارس":         ["School"],
  "جامعة":         ["University", "College"],
  "جامعات":        ["University", "College"],
  "كلية":          ["University", "College"],
  // Hospitality
  "فندق":          ["Hotel", "Guest House", "Hostel"],
  "فنادق":         ["Hotel", "Guest House"],
  "نزل":           ["Hostel"],
  "شقة فندقية":    ["Hotel", "Guest House"],
  // Religion
  "مسجد":          ["Mosque"],
  "مساجد":         ["Mosque"],
  "جامع":          ["Mosque"],
  "كنيسة":         ["Church"],
  "كنائس":         ["Church"],
  // Attractions & tourism
  "متحف":          ["Museum"],
  "متاحف":         ["Museum"],
  "حديقة":         ["Park"],
  "حدائق":         ["Park"],
  "معالم":         ["Attraction", "Museum"],
  "سياحة":         ["Attraction", "Viewpoint"],
  // Other
  "مكتبة":         ["Bookstore"],
  "بيطري":         ["Veterinary"],
  "نظارات":        ["Optician"],

  // ── Gifts & Flowers ────────────────────────────────────────────────────────
  gift:             ["Gift Shop", "Souvenir Shop"],
  gifts:            ["Gift Shop", "Souvenir Shop"],
  "gift shop":      ["Gift Shop"],
  "gift store":     ["Gift Shop"],
  "gift center":    ["Gift Shop", "Souvenir Shop"],
  "gifts center":   ["Gift Shop", "Souvenir Shop"],
  souvenir:         ["Souvenir Shop"],
  souvenirs:        ["Souvenir Shop"],
  flowers:          ["Florist"],
  "flower shop":    ["Florist"],
  "flower bouquet": ["Florist"],
  // Arabic gifts & flowers
  "هدية":           ["Gift Shop"],
  "هدايا":          ["Gift Shop", "Souvenir Shop"],
  "محل هدايا":      ["Gift Shop"],
  "مركز هدايا":     ["Gift Shop", "Souvenir Shop"],
  "تذكارات":        ["Souvenir Shop"],
  "ورد":            ["Florist"],
  "ورود":           ["Florist"],
  "زهور":           ["Florist"],
  "زهرات":          ["Florist"],
  "باقة ورد":       ["Florist"],
  "محل ورود":       ["Florist"],
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
  // English
  "a","an","the","in","on","near","nearby","close","best","good","top","find","show",
  "me","my","want","need","looking","for","to","of","is","are","where","place","places",
  "spot","spots","around","at","go","visit","get","some","any","with","and","or","jordan",
  // Arabic function words & filler
  "في","من","إلى","الى","على","عند","قرب","بجانب","حول","بالقرب",
  "أين","اين","وين","فين","كيف","ماذا","ما","هل",
  "أفضل","افضل","أحسن","احسن","أقرب","اقرب",
  "ابحث","أبحث","اريد","أريد","محتاج","ابغى","أبغى","حابب","حابة",
  "الأردن","الاردن","عمان",
  "مكان","أماكن","محل","اقترح","وصي","دلني","دورلي","شوفلي",
  "طيب","جيد","جيدة","حلو","حلوة","زين","كويس","مرتاح","ممتاز",
  "قريب","بالجانب","وسط","منطقة","ناحية",
]);

/** True when the string contains at least one Arabic character */
function containsArabicChar(s: string): boolean {
  return /[؀-ۿ]/.test(s);
}

function extractKeywords(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => {
      if (w.length < 2) return false;
      if (STOPWORDS.has(w)) return false;
      if (/^\d+$/.test(w)) return false;
      // Arabic tokens: keep anything ≥ 2 chars that's not a stopword
      if (containsArabicChar(w)) return w.length >= 2;
      return w.length > 2;
    });
}

function placeHintPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (term.includes(" ")) return new RegExp(escaped, "i");
  if (containsArabicChar(term)) return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, "i");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

function normalizeArabicPrefixesPlace(q: string): string {
  return q
    .replace(/(^|\s)لل/g, "$1ال")
    .replace(/(^|\s)ل(?=[؀-ۿ])/g, "$1")
    .replace(/(^|\s)ب(?=[؀-ۿ])/g, "$1");
}

function matchPlaceCategories(q: string, dbCategories: string[]): string[] {
  const lower = q.toLowerCase();
  const normalized = normalizeArabicPrefixesPlace(lower);
  const byLower = new Map(dbCategories.map((c) => [c.toLowerCase(), c]));
  const matched = new Set<string>();
  const hints = Object.entries(PLACE_HINTS).sort((a, b) => {
    const aw = a[0].includes(" ") ? 1 : 0;
    const bw = b[0].includes(" ") ? 1 : 0;
    return bw - aw || b[0].length - a[0].length;
  });
  for (const [term, cats] of hints) {
    const pat = placeHintPattern(term);
    if (pat.test(lower) || pat.test(normalized)) {
      for (const c of cats) {
        // Prefer the canonical DB name if it exists; otherwise use the hint name
        // directly so that category scoring and the hard guard still work even
        // when the DB has no rows for that category yet.
        const real = byLower.get(c.toLowerCase()) ?? c;
        matched.add(real);
      }
    }
  }
  for (const [lc, real] of byLower) {
    if (lc.length > 3 && (lower.includes(lc) || normalized.includes(lc))) matched.add(real);
  }
  return [...matched];
}

function detectGovernorate(q: string): string | null {
  const lower = q.toLowerCase();
  const normalized = normalizeArabicPrefixesPlace(lower);
  const entries = Object.entries(GOVERNORATES).sort((a, b) => b[0].length - a[0].length);
  for (const [k, v] of entries) {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pat = containsArabicChar(k)
      ? new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`)
      : new RegExp(`\\b${escaped}\\b`, "i");
    if (pat.test(lower) || pat.test(normalized)) return v;
  }
  return null;
}

/** Returns the matched district name if the query references an Amman neighbourhood. */
function detectDistrict(q: string): string | null {
  const lower = q.toLowerCase();
  // Sort longest first so "jabal amman" matches before "jabal"
  const sorted = [...AMMAN_DISTRICTS].sort((a, b) => b.length - a.length);
  for (const d of sorted) {
    const escaped = d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`).test(lower)) return d;
  }
  return null;
}

/** Parse a place/service query into structured intent. */
export function parsePlaceIntent(query: string, dbCategories: string[]): PlaceIntent {
  const district = detectDistrict(query);
  return {
    rawQuery: query,
    categories: matchPlaceCategories(query, dbCategories),
    governorate: detectGovernorate(query) ?? (district ? "Amman" : null),
    city: district ? "Amman" : null,
    district,
    keywords: extractKeywords(query),
  };
}

/** Count matching PLACE_HINTS keywords without requiring DB categories. */
function staticHintMatches(query: string): number {
  const lower = query.toLowerCase();
  const normalized = normalizeArabicPrefixesPlace(lower);
  let n = 0;
  for (const term of Object.keys(PLACE_HINTS)) {
    const pat = placeHintPattern(term);
    if (pat.test(lower) || pat.test(normalized)) n++;
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
  const lower = query.toLowerCase();
  const normalized = normalizeArabicPrefixesPlace(lower);

  // Static keyword signal — works with an empty DB.
  let s = staticHintMatches(query) * 2;

  // DB-backed bonuses: confirmed category hit + direct category name mention.
  if (dbCategories.length > 0) {
    const byLower = new Map(dbCategories.map((c) => [c.toLowerCase(), c]));
    for (const [term, cats] of Object.entries(PLACE_HINTS)) {
      const pat = placeHintPattern(term);
      if (pat.test(lower) || pat.test(normalized)) {
        for (const c of cats) {
          if (byLower.has(c.toLowerCase())) { s += 1; break; }
        }
      }
    }
    for (const [lc] of byLower) {
      if (lc.length > 3 && (lower.includes(lc) || normalized.includes(lc))) s += 1;
    }
  }

  const intent = parsePlaceIntent(query, dbCategories);
  if (intent.governorate) s += 1;
  // Named Amman district/neighbourhood is a very strong place indicator (+2)
  if (detectDistrict(query)) s += 2;
  // English proximity signals
  if (/\b(near me|nearby|close to|around here|in town)\b/i.test(query)) s += 2;
  if (/\b(where|place|places|spot|visit|go to|open now)\b/i.test(query)) s += 1;
  // Arabic proximity / location signals
  if (/قريب مني|بالقرب من|بجانبي|حواليه|قريبة مني/.test(query)) s += 2;
  if (/أين|اين|وين|فين|كيف أوصل|كيف اوصل|أماكن|مكان/.test(query)) s += 1;
  // Arabic governorates or country name (without needing a place category match)
  if (/عمان|إربد|اربد|الزرقاء|العقبة|الأردن|الاردن/.test(query)) s += 1;
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
    rating: null, // OSM places table does not have a rating column
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

// Keywords that trigger a jordan_people (professionals) lookup.
const PEOPLE_RE =
  /\b(doctor|doctors|physician|physicians|dentist|dentists|lawyer|lawyers|attorney|legal|accountant|accountants|architect|architects|engineer|engineers|pharmacist|pharmacists|specialist|specialists|consultant|consultants|professional|professionals)\b/i;

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
    /\b(eat|food|restaurant|cafe|coffee|lunch|dinner|breakfast|delivery)\b/i.test(intent.rawQuery) ||
    // Arabic food & drink queries
    /مطعم|مطاعم|كافيه|مقهى|قهوة|أكل|اكل|وجبة|فطور|غداء|عشاء|توصيل طعام|بيتزا|برغر|شاورما|فلافل|بوفيه/.test(intent.rawQuery);
  const wantPeople = PEOPLE_RE.test(intent.rawQuery) ||
    intent.categories.some((c) => /doctor|dentist|lawyer|accountant|architect|engineer|pharmacist/i.test(c));
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
          rating: r.rating !== null && r.rating !== undefined ? Number(r.rating) : null,
          vecSim: Number(r.vecSim ?? 0),
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
          rating: r.rating !== null && r.rating !== undefined ? Number(r.rating) : null,
          vecSim: Number(r.vecSim ?? 0),
          txtSim: Number(r.txtSim ?? 0),
        });
      }
    } catch {
      /* embedding column not yet created — silently skip */
    }
  }

  // ── jordan_people (Professionals — doctors, lawyers, dentists, etc.) ──────
  if (wantPeople) {
    try {
      const rows = (await db.execute(sql`
        SELECT
          p.id + 4000000   AS id,
          p.name,
          p.name_ar        AS "nameAr",
          p.title,
          p.subcategory,
          p.specialty,
          p.organization,
          p.address,
          p.phone,
          p.website,
          p.search_text    AS "searchText",
          (1 - (p.embedding <=> ${vecLit}::vector))                          AS "vecSim",
          similarity(coalesce(p.search_text, ''), ${queryText})              AS "txtSim"
        FROM jordan_people p
        WHERE p.embedding IS NOT NULL
        ORDER BY "vecSim" + 2.0 * "txtSim" DESC
        LIMIT ${limit}
      `)) as unknown as Record<string, unknown>[];

      for (const r of rows) {
        // Use the professional role as category (e.g. "Doctor", "Lawyer")
        const prof = String(r.subcategory ?? r.title ?? "Professional");
        // Show organization as "opening hours" field — surfaces on place cards
        const org = r.organization ? String(r.organization) : null;
        all.push({
          id: Number(r.id),
          name: String(r.name ?? ""),
          nameAr: (r.nameAr as string) ?? null,
          category: prof,
          subcategory: (r.specialty as string) ?? null,
          governorate: "Amman",
          city: "Amman",
          address: (r.address as string) ?? null,
          phone: (r.phone as string) ?? null,
          website: (r.website as string) ?? null,
          openingHours: org,
          lat: null,
          lng: null,
          sourceUrl: null,
          searchText: (r.searchText as string) ?? null,
          rating: null,
          vecSim: Number(r.vecSim ?? 0),
          txtSim: Number(r.txtSim ?? 0),
        });
      }
    } catch {
      /* jordan_people embedding not yet created — silently skip */
    }
  }

  return all;
}

// ── Direct name lookup ────────────────────────────────────────────────────────
// When the user types a specific named place ("taj mall", "city mall",
// "mövenpick hotel"), do a fast ILIKE search by name BEFORE the vector search.
// Results get vecSim=0.95 / txtSim=1.0 so ranking always promotes them to #1.

async function directNameSearch(query: string, limit: number): Promise<PlaceCandidate[]> {
  // Build %token1%token2% pattern from words longer than 2 characters
  const tokens = query.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (tokens.length === 0) return [];
  const pattern = `%${tokens.join("%")}%`;
  const results: PlaceCandidate[] = [];

  // OSM places
  try {
    const rows = (await db.execute(sql`
      SELECT p.id, p.name, p.name_ar AS "nameAr", p.category, p.subcategory,
             p.governorate, p.city, p.address, p.phone, p.website,
             p.opening_hours AS "openingHours", p.lat, p.lng,
             p.source_url AS "sourceUrl", p.search_text AS "searchText"
      FROM places p
      WHERE lower(p.name) LIKE ${pattern}
         OR lower(coalesce(p.name_ar, '')) LIKE ${pattern}
      LIMIT ${limit}
    `)) as unknown as Record<string, unknown>[];
    for (const r of rows) {
      results.push({
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
        lat: r.lat != null ? Number(r.lat) : null,
        lng: r.lng != null ? Number(r.lng) : null,
        sourceUrl: (r.sourceUrl as string) ?? null,
        searchText: (r.searchText as string) ?? null,
        rating: null,
        vecSim: 0.95,
        txtSim: 1.0,
      });
    }
  } catch { /* skip */ }

  // jordan_places (Google Maps scraped)
  try {
    const rows = (await db.execute(sql`
      SELECT p.id + 2000000 AS id, p.name, p.category, p.address,
             p.phone, p.website, p.rating, p.search_text AS "searchText"
      FROM jordan_places p
      WHERE lower(p.name) LIKE ${pattern}
      LIMIT ${limit}
    `)) as unknown as Record<string, unknown>[];
    for (const r of rows) {
      results.push({
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
        lat: null, lng: null, sourceUrl: null,
        searchText: (r.searchText as string) ?? null,
        rating: r.rating != null ? Number(r.rating) : null,
        vecSim: 0.95,
        txtSim: 1.0,
      });
    }
  } catch { /* skip */ }

  return results;
}

// ── Deduplication ─────────────────────────────────────────────────────────────
// Remove scraped candidates whose name is too similar to an already-included
// OSM candidate (avoids showing the same place twice from different sources).

function deduplicateCandidates(candidates: PlaceCandidate[]): PlaceCandidate[] {
  const seen = new Set<string>();
  const out: PlaceCandidate[] = [];
  for (const c of candidates) {
    const key = c.name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "").slice(0, 24);
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

// vec reduced further — semantic similarity alone should not win over completeness
// completeness tripled (0.04 → 0.13) — an OSM stub with no contact info must not rank #1
// rating increased (0.06 → 0.11) — Google Maps / Talabat stars are a strong quality proxy
// total = 1.00
const PLACE_WEIGHTS = {
  vec:          0.25,
  txt:          0.05,
  keyword:      0.22,
  category:     0.13,
  geo:          0.11,
  rating:       0.11,  // Google Maps / Talabat 0-5 score
  completeness: 0.13,  // phone + address + hours + coords + website
};

function rescaleVec(cos: number): number {
  return Math.max(0, Math.min(1, (cos - 0.15) / 0.5));
}

/**
 * Data completeness score [0..1] — rewards places that have the information
 * a user actually needs: a number to call, an address to navigate to, opening
 * hours so they know when to go, coordinates for the map, and a website.
 *
 * Points (max 8):
 *   phone present        +2  (most actionable — can call right away)
 *   address present      +2  (can navigate there)
 *   website present      +1  (can research / book online)
 *   openingHours present +1  (know when it's open)
 *   lat + lng present    +1  (mappable)
 *   sourceUrl present    +1  (verified external source)
 */
function placeCompletenessScore(c: PlaceCandidate): number {
  let pts = 0;
  if (c.phone)                           pts += 2;
  if (c.address)                         pts += 2;
  if (c.website)                         pts += 1;
  if (c.openingHours)                    pts += 1;
  if (c.lat !== null && c.lng !== null)  pts += 1;
  if (c.sourceUrl)                       pts += 1;
  return pts / 8;
}

/**
 * Normalize a 0-5 star rating to [0..1].
 * Returns 0 when no rating is available (not a penalty — just neutral).
 */
function placeRatingScore(c: PlaceCandidate): number {
  if (c.rating === null || c.rating === undefined) return 0;
  return Math.max(0, Math.min(1, c.rating / 5));
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
      PLACE_WEIGHTS.vec          * rescaleVec(c.vecSim) +
      PLACE_WEIGHTS.txt          * Math.max(0, Math.min(1, c.txtSim)) +
      PLACE_WEIGHTS.keyword      * keyword +
      PLACE_WEIGHTS.category     * category +
      PLACE_WEIGHTS.geo          * geo +
      PLACE_WEIGHTS.rating       * placeRatingScore(c) +
      PLACE_WEIGHTS.completeness * placeCompletenessScore(c);
    return { ...c, score, keywordHits: hits };
  });
  scored.sort((a, b) => b.score - a.score || b.vecSim - a.vecSim);

  // Hard guard 1: when the user asked for a specific category (e.g. "Hotel"),
  // the #1 pick MUST match that category — a post office or pharmacy should
  // never beat a hotel just because it has better completeness/rating scores.
  if (intent.categories.length > 0 && scored.length > 1) {
    const topCat = scored[0]!.category.toLowerCase();
    if (!wantedCats.has(topCat)) {
      const firstCatMatch = scored.findIndex((c) => wantedCats.has(c.category.toLowerCase()));
      if (firstCatMatch > 0) {
        const [catMatch] = scored.splice(firstCatMatch, 1);
        scored.unshift(catMatch!);
      }
    }
  }

  // Hard guard 2: the #1 pick must have at least one piece of actionable data.
  // An OSM stub with only coordinates but no phone / address / website should
  // never win when alternatives with real contact info exist.
  if (scored.length > 1 && !hasActionableData(scored[0]!)) {
    const firstWithData = scored.findIndex(hasActionableData);
    if (firstWithData > 0) {
      const [stub] = scored.splice(firstWithData, 1);
      scored.unshift(stub!);
    }
  }

  return scored;
}

/** At least one piece of contact/navigation info the user can actually act on. */
function hasActionableData(c: PlaceCandidate): boolean {
  return !!(c.phone || c.address || c.website || c.sourceUrl);
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
    rating: c.rating ?? null,
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
  // Show rating prominently when present (Google Maps / Talabat)
  if (c.rating !== null && c.rating !== undefined && c.rating >= 3.5) {
    const stars = c.rating.toFixed(1);
    pros.push(lang === "ar" ? `تقييم ${stars}/5` : `Rated ${stars}/5`);
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

function buildPlaceCodeSummary(ranked: PlaceCandidate[], intent: PlaceIntent, lang: "en" | "ar"): string {
  if (ranked.length === 0) {
    return lang === "ar"
      ? `لم أتمكن من العثور على مكان مطابق لـ "${intent.rawQuery}" في الأردن.`
      : `I couldn't find a matching place for "${intent.rawQuery}" in Jordan yet.`;
  }
  const best = ranked[0]!;
  const where = [best.city, best.governorate].filter(Boolean)[0];
  const altCount = ranked.length - 1;
  if (lang === "ar") {
    const loc = where ? ` في ${where}` : "";
    const alts = altCount > 0 ? ` وعندي ${altCount} خيار${altCount === 1 ? "" : " إضافي"} كذلك.` : ".";
    return `أفضل خيار هو **${best.name}**${loc}.${alts}`;
  }
  const loc = where ? ` in ${where}` : "";
  const alts = altCount > 0 ? ` I've also found ${altCount} other option${altCount > 1 ? "s" : ""} worth considering.` : "";
  return `**${best.name}**${loc} is the top match for your search.${alts}`;
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

  // Use static hint categories when the OSM places table is still empty —
  // this lets scraped sources (jordan_places, jordan_restaurants) serve results
  // immediately without waiting for the full OSM ingest to complete.
  const intent = parsePlaceIntent(input.query, categories);

  const embedText = [input.query, ...intent.categories, ...intent.keywords].filter(Boolean).join(" ");

  // Direct name lookup + vector embedding run in parallel — zero added latency.
  // The name search finds specific places by ILIKE even when vector similarity is
  // weak (e.g. "taj mall" → exact name match beats all semantic alternatives).
  const queryWords = input.query.trim().split(/\s+/).length;
  const [queryVecResult, nameMatches] = await Promise.all([
    embedder.embed([embedText]),
    queryWords <= 5 ? directNameSearch(input.query, 4) : Promise.resolve([]),
  ]);
  const [queryVec] = queryVecResult;
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
  // Name matches go FIRST — their txtSim=1.0 / vecSim=0.95 will naturally win
  // in rankPlaces, ensuring the specifically-named place beats generic category results.
  const merged  = deduplicateCandidates([...nameMatches, ...candidates, ...scraped]);

  const ranked = rankPlaces(merged, intent).slice(0, limit);

  // Build code-based why/pros/cons as fallback, then enrich with Claude + web search if available.
  const whyMap = new Map<number, string>(ranked.map((c, i) => [c.id, placeWhy(c, i === 0, queryLang)]));
  let llmSummary: string | null = null;
  if (!provider.isMock && ranked.length > 0) {
    try {
      // Fire web search in parallel with building the place list — no added latency
      // Use the full original query for trend/discovery/temporal searches so "new cafes
      // in Rainbow Street this week" actually searches for that, not just "Cafe Amman".
      const hasTrendSignal = /trending|this week|new\b|open(ed|ing)|pop.?up|latest|recent|what.?s/i.test(input.query);
      const webSearchQuery = hasTrendSignal
        ? `${input.query} Amman Jordan`
        : [
            ...(intent.categories.length > 0 ? [intent.categories[0]!] : []),
            ...(intent.district ? [intent.district] : []),
            intent.governorate ?? "Amman",
          ].join(" ") || input.query;
      const webResults = await webSearch(webSearchQuery, { maxResults: 3, searchDepth: "basic" });
      const webContext = formatWebResults(webResults, "LIVE WEB INFO");

      // Rich place context — include rating and address so the LLM can write
      // a genuinely informative summary, not just a template.
      const placeItems = ranked.map((c, i) => ({
        id: c.id,
        name: ARABIC_CHAR_RE.test(c.name) ? (c.nameAr ?? c.name) : c.name,
        category: c.category,
        subcategory: c.subcategory ?? null,
        city: c.city ?? c.governorate ?? "Jordan",
        address: c.address ? c.address.slice(0, 80) : null,
        rating: c.rating != null ? `${c.rating}/5` : null,
        phone: c.phone ? "yes" : "no",
        website: c.website ? "yes" : "no",
        openingHours: c.openingHours ?? null,
        role: i === 0 ? "best" : "alternative",
      }));
      const langInstruction = queryLang === "ar"
        ? "IMPORTANT: Write both the 'summary' and all 'why' values in Arabic only."
        : "Write both the 'summary' and all 'why' values in English.";
      const memCtx = input.memoryBlock ? `\nUSER CONTEXT (use to personalise):\n${input.memoryBlock}` : "";
      const placeRes = await provider.complete({
        system:
          "You are ChatSouq, Amman's local guide. " +
          "Write a direct, conversational 2–3 sentence reply that actually answers the user's request. " +
          "Mention the top pick and key alternatives by **bolding** their names. " +
          "Be specific: mention rating, what makes it stand out, or neighbourhood. " +
          "If the user asked for a specific named place, confirm or clarify that. " +
          "Then write a 1-sentence 'why' per place (max 20 words). " +
          `Use ONLY the provided facts — no invented details. ${langInstruction}` +
          memCtx +
          (webContext ? `\n${webContext}` : "") +
          '\nReturn JSON exactly: {"summary": "...", "items": [{"id": number, "why": "..."}]}',
        messages: [{
          role: "user",
          content: `User asked for: "${input.query}"\nPlaces: ${JSON.stringify(placeItems)}`,
        }],
        json: true,
        temperature: 0.4,
        maxTokens: 900,
      });
      // Robust parsing: LLM may return old array format [{id,why}] or new {summary,items}
      const raw: unknown = JSON.parse(placeRes.text);
      const parsed: { summary?: string; items?: { id: number; why: string }[] } =
        Array.isArray(raw) ? { items: raw as { id: number; why: string }[] } : (raw as typeof parsed);
      if (typeof parsed.summary === "string" && parsed.summary.trim()) {
        llmSummary = parsed.summary.trim();
      }
      if (Array.isArray(parsed.items)) {
        for (const p of parsed.items) {
          if (typeof p.why === "string" && p.why.trim()) whyMap.set(p.id, p.why.trim());
        }
      }
    } catch {
      // keep code-generated whys and fallback summary
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
    summary: llmSummary ?? buildPlaceCodeSummary(ranked, intent, queryLang),
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
