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
import { extractRichIntent, NEIGHBORHOOD_CANONICAL } from "./placeIntent";
import { rankPlacesRich } from "./placeRanker";
import {
  buildCacheKey,
  getCachedPlaceResponse,
  setCachedPlaceResponse,
} from "./responseCache";
import { generateFollowUps } from "./followUpGenerator";

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
  "abdoun", "sweifieh", "sweifiyeh", "shmeisani", "khalda", "dabouq", "deir ghbar",
  "um uthaina", "umm uthaina", "um utheina", "tla' ali", "tlaa ali",
  "rabia", "rabieh", "al rabieh", "gardens", "al gardens",
  // Circles (landmark references)
  "1st circle", "2nd circle", "3rd circle", "4th circle",
  "5th circle", "6th circle", "7th circle", "8th circle",
  "first circle", "second circle", "third circle", "fourth circle",
  "fifth circle", "sixth circle", "seventh circle", "eighth circle",
  // Central / commercial
  "downtown amman", "downtown", "city centre", "rainbow street",
  "rainbow", "garden street", "mecca street", "wasfi tal", "wasfi el tal",
  "weibdeh", "luweibdeh",
  // East Amman / other
  "zarqa road", "sports city", "sport city", "jubeiha", "sweileh",
  "bayader wadi seer", "wadi seer", "nakheel", "marj el hamam", "sahab",
  "muqabalein", "marka", "ader", "abu nsair", "abu nseir", "naour",
  // Aqaba districts
  "aqaba marina", "aqaba port", "tala bay",
  // ── Arabic district names ─────────────────────────────────────────────────
  // Jabal areas
  "جبل عمان", "جبل الحسين", "جبل اللويبدة", "جبل النزهة", "جبل",
  // West Amman
  "الصويفية", "صويفية", "عبدون", "الشميساني", "شميساني",
  "خلدا", "دابوق", "دير غبار", "أم أذينة", "ام اذينة", "تلاع العلي",
  "الرابية", "رابية", "الحدائق",
  // Circles
  "الدوار الأول", "الدوار الثاني", "الدوار الثالث", "الدوار الرابع",
  "الدوار الخامس", "الدوار السادس", "الدوار السابع", "الدوار الثامن",
  "دوار الأول", "دوار ثاني", "دوار ثالث", "دوار رابع",
  // Central
  "وسط البلد", "البلد", "شارع الرينبو", "شارع المدينة", "وسط عمان",
  "اللويبدة", "ويبدة",
  // East Amman / other
  "الجبيهة", "جبيهة", "السويلح", "سويلح", "ماركا", "النزهة",
  "الرصيفة", "أبو نصير", "ناعور", "المقابلين", "الصحاب", "صحاب",
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

  // ── Entertainment ──────────────────────────────────────────────────────────
  cinema:           ["Cinema", "Movie Theater"],
  cinemas:          ["Cinema", "Movie Theater"],
  movie:            ["Cinema", "Movie Theater"],
  movies:           ["Cinema", "Movie Theater"],
  theater:          ["Theater", "Cinema"],
  theatre:          ["Theater", "Cinema"],
  "movie theater":  ["Cinema", "Movie Theater"],
  "سينما":          ["Cinema", "Movie Theater"],
  "سينمات":         ["Cinema", "Movie Theater"],
  "أفلام":          ["Cinema", "Movie Theater"],
  "مسرح":          ["Theater"],
  "ترفيه":          ["Cinema", "Entertainment"],

  // ── Laundry & Dry Cleaning ──────────────────────────────────────────────────
  laundry:          ["Laundry", "Dry Cleaning"],
  "dry cleaning":   ["Dry Cleaning", "Laundry"],
  "dry cleaner":    ["Dry Cleaning", "Laundry"],
  "مغسلة":          ["Laundry", "Dry Cleaning"],
  "تنظيف ملابس":    ["Laundry", "Dry Cleaning"],
  "كوي":            ["Laundry"],
  "تنظيف جاف":      ["Dry Cleaning"],

  // ── Nursery & Childcare ────────────────────────────────────────────────────
  nursery:          ["Nursery", "Daycare", "Kindergarten"],
  daycare:          ["Nursery", "Daycare"],
  kindergarten:     ["Kindergarten", "Nursery"],
  "child care":     ["Nursery", "Daycare"],
  "حضانة":          ["Nursery", "Daycare"],
  "حضانات":         ["Nursery", "Daycare"],
  "روضة":           ["Kindergarten"],
  "رياض أطفال":     ["Kindergarten", "Nursery"],
  "رياض اطفال":     ["Kindergarten", "Nursery"],

  // ── Car Rental ─────────────────────────────────────────────────────────────
  "car rental":     ["Car Rental"],
  "rent a car":     ["Car Rental"],
  "car hire":       ["Car Rental"],
  "تأجير سيارة":    ["Car Rental"],
  "تأجير سيارات":   ["Car Rental"],
  "إيجار سيارة":    ["Car Rental"],
  "ايجار سيارة":    ["Car Rental"],

  // ── Embassy & Consulate ────────────────────────────────────────────────────
  embassy:          ["Embassy", "Consulate"],
  consulate:        ["Consulate", "Embassy"],
  embassies:        ["Embassy", "Consulate"],
  visa:             ["Embassy", "Consulate"],
  "سفارة":          ["Embassy", "Consulate"],
  "سفارات":         ["Embassy", "Consulate"],
  "قنصلية":         ["Consulate", "Embassy"],
  "تأشيرة":         ["Embassy", "Consulate"],

  // ── Co-working & Office ────────────────────────────────────────────────────
  "co-working":     ["Coworking Space"],
  coworking:        ["Coworking Space"],
  "co working":     ["Coworking Space"],
  "shared office":  ["Coworking Space"],
  "business center":["Business Center", "Coworking Space"],
  "مساحة عمل":      ["Coworking Space"],
  "مكتب مشترك":     ["Coworking Space"],
  "بيزنس سنتر":     ["Business Center"],

  // ── Event Venue ────────────────────────────────────────────────────────────
  "event venue":    ["Event Venue", "Wedding Hall"],
  "wedding hall":   ["Wedding Hall", "Event Venue"],
  "banquet hall":   ["Wedding Hall", "Event Venue"],
  "function hall":  ["Event Venue", "Wedding Hall"],
  events:           ["Event Venue"],
  "قاعة مناسبات":   ["Event Venue", "Wedding Hall"],
  "قاعة أفراح":     ["Wedding Hall", "Event Venue"],
  "قاعة افراح":     ["Wedding Hall", "Event Venue"],
  "قاعة حفلات":     ["Wedding Hall", "Event Venue"],
  "قاعة":           ["Event Venue", "Wedding Hall"],
  "أعراس":          ["Wedding Hall"],
  "حفل زفاف":       ["Wedding Hall"],

  // ── Camping / Outdoor Activities ─────────────────────────────────────────
  // NOTE: bare "camping" intentionally omitted — it is too ambiguous.
  // "camping equipment", "camping gear", "camping table" are product queries.
  // Only compound forms that signal a *location* intent are included below.
  campsite:          ["Campsite", "Outdoor Area"],
  "camping site":    ["Campsite", "Outdoor Area"],
  "camping spot":    ["Campsite", "Outdoor Area", "Nature Reserve"],
  "camping spots":   ["Campsite", "Outdoor Area", "Nature Reserve"],
  "outdoor activity":["Outdoor Area", "Park", "Nature Reserve"],
  "nature reserve":  ["Nature Reserve"],
  hike:              ["Nature Reserve", "Park", "Outdoor Area"],
  hiking:            ["Nature Reserve", "Park", "Outdoor Area"],
  "hiking trail":    ["Nature Reserve", "Park"],
  bbq:               ["Park", "Outdoor Area"],
  "تخييم":           ["Campsite", "Outdoor Area"],
  "معسكر":           ["Campsite", "Outdoor Area"],
  "مخيم":            ["Campsite", "Outdoor Area"],
  "مخيمات":          ["Campsite", "Outdoor Area", "Nature Reserve"],
  "تنزه":            ["Park", "Outdoor Area"],
  "رحلة طبيعية":     ["Nature Reserve", "Park"],

  // ── Tailor & Alterations ───────────────────────────────────────────────────
  tailor:           ["Tailor"],
  tailoring:        ["Tailor"],
  alterations:      ["Tailor"],
  "خياط":           ["Tailor"],
  "خياطة":          ["Tailor"],
  "تعديل ملابس":    ["Tailor"],

  // ── Parking ────────────────────────────────────────────────────────────────
  parking:          ["Parking"],
  "car park":       ["Parking"],
  "parking lot":    ["Parking"],
  "موقف سيارات":    ["Parking"],
  "موقف":           ["Parking"],
  "باركينج":        ["Parking"],

  // ── Real Estate ────────────────────────────────────────────────────────────
  "real estate":    ["Real Estate"],
  "property":       ["Real Estate"],
  "estate agent":   ["Real Estate"],
  realtor:          ["Real Estate"],
  "عقارات":         ["Real Estate"],
  "عقار":           ["Real Estate"],
  "وكيل عقاري":     ["Real Estate"],
  "مكتب عقاري":     ["Real Estate"],

  // ── Travel Agency ──────────────────────────────────────────────────────────
  "travel agency":  ["Travel Agency"],
  "travel agent":   ["Travel Agency"],
  "tour operator":  ["Travel Agency", "Tour Operator"],
  "وكالة سفر":      ["Travel Agency"],
  "وكالة سياحية":   ["Travel Agency", "Tour Operator"],
  "حجز تذاكر":      ["Travel Agency"],
  "سفريات":         ["Travel Agency"],

  // ── Printing & Stationery ──────────────────────────────────────────────────
  printing:         ["Printing"],
  "print shop":     ["Printing"],
  stationery:       ["Stationery"],
  "طباعة":          ["Printing"],
  "طابعة":          ["Printing"],
  "قرطاسية":        ["Stationery"],
  "مكتبة قرطاسية":  ["Stationery"],

  // ── Electronics Repair ────────────────────────────────────────────────────
  "phone repair":   ["Electronics Repair"],
  "mobile repair":  ["Electronics Repair"],
  "laptop repair":  ["Electronics Repair"],
  "electronics repair": ["Electronics Repair"],
  "تصليح هاتف":     ["Electronics Repair"],
  "تصليح موبايل":   ["Electronics Repair"],
  "تصليح لابتوب":   ["Electronics Repair"],
  "تصليح إلكترونيات": ["Electronics Repair"],
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
    // Arabic terms don't use \b word boundaries — use whitespace anchors instead
    const pattern = containsArabicChar(d)
      ? new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`)
      : new RegExp(`\\b${escaped}\\b`);
    if (pattern.test(lower)) return d;
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
  if (/\b(where|place|places|spot|spots|visit|go to|open now)\b/i.test(query)) s += 1;
  // "near X" / "around X" generic — strong location indicator even without "me"
  if (/\b(near|around|close to)\s+\w/i.test(query)) s += 1;
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
  const poolSize = opts.poolSize ?? 250;
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
      similarity((p.name || ' ' || coalesce(p.search_text, '')), ${queryText}) AS "txtSim"
    FROM places p
    WHERE ${whereClause}
    ORDER BY (1 - (p.embedding <=> ${vecLit}::vector)) * 3.0
           + similarity((p.name || ' ' || coalesce(p.search_text, '')), ${queryText}) DESC
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

/**
 * Try to detect a canonical Amman neighbourhood from an address or search_text
 * string. jordan_places has city='Amman' hardcoded — this extracts the real
 * neighbourhood so location scoring works correctly.
 * Returns the canonical neighbourhood name, or "Amman" as fallback.
 */
function detectCityFromText(address: string | null, searchText: string | null): string {
  const hay = [address, searchText].filter(Boolean).join(" ").toLowerCase();
  if (!hay) return "Amman";
  for (const [alias, canonical] of Object.entries(NEIGHBORHOOD_CANONICAL)) {
    if (hay.includes(alias)) return canonical;
  }
  return "Amman";
}

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
  // Always query jordan_places (Google Maps) — it has higher-quality data for many
  // categories including malls, cinemas, gyms, and even restaurants.
  // Previously this was disabled for food+category queries, which silently blocked
  // Google Maps data for the most popular query type.
  const wantPlace = true;

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
          similarity((p.name || ' ' || coalesce(p.search_text, '')), ${queryText}) AS "txtSim"
        FROM jordan_places p
        WHERE p.embedding IS NOT NULL
        ORDER BY (1 - (p.embedding <=> ${vecLit}::vector)) * 3.0
               + similarity((p.name || ' ' || coalesce(p.search_text, '')), ${queryText}) DESC
        LIMIT ${limit}
      `)) as unknown as Record<string, unknown>[];

      for (const r of rows) {
        const addr = (r.address as string) ?? null;
        const sText = (r.searchText as string) ?? null;
        all.push({
          id: Number(r.id),
          name: String(r.name),
          nameAr: null,
          category: String(r.category ?? "Place"),
          subcategory: null,
          governorate: "Amman",
          // Extract real neighbourhood from address/searchText — jordan_places
          // hardcodes city='Amman' but Google Maps addresses contain district names.
          city: detectCityFromText(addr, sText),
          address: addr,
          phone: (r.phone as string) ?? null,
          website: (r.website as string) ?? null,
          openingHours: null,
          lat: null,
          lng: null,
          sourceUrl: null,
          searchText: sText,
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
          similarity((r.name || ' ' || coalesce(r.search_text, '')), ${queryText}) AS "txtSim"
        FROM jordan_restaurants r
        WHERE r.embedding IS NOT NULL
        ORDER BY (1 - (r.embedding <=> ${vecLit}::vector)) * 3.0
               + similarity((r.name || ' ' || coalesce(r.search_text, '')), ${queryText}) DESC
        LIMIT ${limit}
      `)) as unknown as Record<string, unknown>[];

      for (const r of rows) {
        const delivery = r.deliveryTime ? `Delivery: ${r.deliveryTime}` : null;
        const sText = (r.searchText as string) ?? null;
        all.push({
          id: Number(r.id),
          name: String(r.name),
          nameAr: null,
          category: String(r.cuisine ?? "Restaurant"),
          subcategory: "Restaurant",
          governorate: "Amman",
          city: detectCityFromText(null, sText),
          address: null,
          phone: null,
          website: (r.url as string) ?? null,
          openingHours: delivery,
          lat: null,
          lng: null,
          sourceUrl: (r.url as string) ?? null,
          searchText: sText,
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
          similarity((p.name || ' ' || coalesce(p.search_text, '')), ${queryText}) AS "txtSim"
        FROM jordan_people p
        WHERE p.embedding IS NOT NULL
        ORDER BY (1 - (p.embedding <=> ${vecLit}::vector)) * 3.0
               + similarity((p.name || ' ' || coalesce(p.search_text, '')), ${queryText}) DESC
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

function rescaleVec(cos: number): number {
  return Math.max(0, Math.min(1, (cos - 0.15) / 0.5));
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
  const nameIsArabic = ARABIC_CHAR_RE.test(c.name);
  const ratingStr = c.rating != null
    ? (queryLang === "ar" ? ` · تقييم ${c.rating.toFixed(1)}/5` : `. Rated ${c.rating.toFixed(1)}/5`)
    : "";
  const contactStr = c.phone
    ? (queryLang === "ar" ? " · يمكن الحجز" : ". Contact available")
    : "";

  if (queryLang === "ar") {
    const where = c.city ? ` في ${c.city}` : c.governorate ? ` في ${c.governorate}` : "";
    const label = isBest ? "الخيار الأمثل" : "خيار بديل";
    return `${label}: ${c.category}${where}${ratingStr}${contactStr}.`.replace(/\s+/g, " ");
  }

  const where = c.city ? ` in ${c.city}` : c.governorate ? ` in ${c.governorate}` : "";
  const lead = isBest ? "Top pick" : "Alternative";
  // Omit raw Arabic name from English text — card heading renders it correctly
  const namePart = !nameIsArabic ? ` — ${c.name}` : "";
  return `${lead}${namePart}, a ${c.category.toLowerCase()}${where}${ratingStr}${contactStr}.`.replace(/\s+/g, " ");
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
    return `أفضل خيار هو ${best.name}${loc}.${alts}`;
  }
  const loc = where ? ` in ${where}` : "";
  const alts = altCount > 0 ? ` I've also found ${altCount} other option${altCount > 1 ? "s" : ""} worth considering.` : "";
  return `${best.name}${loc} is the top match for your search.${alts}`;
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

  // ── Cache check ─────────────────────────────────────────────────────────────
  const cacheKey = buildCacheKey(input.query, { memoryBlock: input.memoryBlock, limit });
  if (cacheKey) {
    const cached = getCachedPlaceResponse<PlaceRecommendationResponse>(cacheKey);
    if (cached) return { ...cached, meta: { ...cached.meta, tookMs: Date.now() - started } };
  }

  const categories = await getPlaceCategories();

  const queryLang: "en" | "ar" = /[؀-ۿ]/.test(input.query) ? "ar" : "en";

  // Use static hint categories when the OSM places table is still empty —
  // this lets scraped sources (jordan_places, jordan_restaurants) serve results
  // immediately without waiting for the full OSM ingest to complete.
  const intent = parsePlaceIntent(input.query, categories);
  // Enrich with 7-dimension rich intent (budget, occasion, recipient, etc.)
  // Pass conversation history so follow-up queries inherit prior location/occasion context.
  const richIntent = extractRichIntent(intent, input.query, input.history);

  // ── Tier 1: inject client context location when query doesn't specify one ──
  // GPS > IP geolocation > history-inferred neighbourhood.
  // Only inject when the query itself has no explicit neighbourhood signal.
  if (input.context?.location) {
    const ctxLoc = input.context.location;
    if (!richIntent.location.neighborhood && ctxLoc.neighborhood) {
      richIntent.location.neighborhood = ctxLoc.neighborhood;
      richIntent.location.explicit = false; // context-derived, not query-stated
    }
    if (!richIntent.location.governorate && ctxLoc.governorate) {
      richIntent.location.governorate = ctxLoc.governorate;
      (richIntent as { governorate?: string | null }).governorate = ctxLoc.governorate;
    }
  }

  // ── Tier 2: inject learned preferences from memory when nothing else sets them ──
  // Memory is a soft signal — never overrides user-stated or GPS-derived location.
  if (input.memoryBlock && !richIntent.location.neighborhood) {
    const areaMatch = input.memoryBlock.match(/Preferred area:\s*([^\n]+)/i);
    if (areaMatch) {
      const preferredArea = (areaMatch[1] ?? "").trim();
      const canonical =
        NEIGHBORHOOD_CANONICAL[preferredArea.toLowerCase()] ?? null;
      if (canonical) {
        richIntent.location.neighborhood = canonical;
        richIntent.location.raw = preferredArea.toLowerCase();
        // explicit stays false — memory is a soft preference, not a hard constraint
      }
    }
  }

  const embedText = [input.query, ...intent.categories, ...intent.keywords].filter(Boolean).join(" ");

  // Direct name lookup + vector embedding run in parallel — zero added latency.
  // The name search finds specific places by ILIKE even when vector similarity is
  // weak (e.g. "taj mall" → exact name match beats all semantic alternatives).
  // Run unconditionally — even long queries like "best brunch near city mall amman"
  // contain named places that should always surface at the top.
  const [queryVecResult, nameMatches] = await Promise.all([
    embedder.embed([embedText]),
    directNameSearch(input.query, 4),
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
  // Give the ranker a real candidate pool per scraped source: at least 60, at most 120.
  // Previously this was limit*2 (8–16 total) — too small to surface the best result.
  const scraped = await fetchScrapedCandidates(intent, queryVec, input.query, Math.min(Math.max(limit * 15, 60), 120));
  // Name matches go FIRST — their txtSim=1.0 / vecSim=0.95 will naturally win
  // in rankPlacesRich, ensuring the specifically-named place beats generic category results.
  const merged  = deduplicateCandidates([...nameMatches, ...candidates, ...scraped]);

  const ranked = rankPlacesRich(merged, richIntent).slice(0, limit);

  // Build code-based why/pros as fallback, then enrich with Claude + web search if available.
  const whyMap  = new Map<number, string>(ranked.map((c, i) => [c.id, placeWhy(c, i === 0, queryLang)]));
  const tagsMap = new Map<number, string[]>();
  let llmSummary:   string | null   = null;
  let llmConnector: string | null   = null;
  let llmInsight:   string | null   = null;
  let llmFollowUps: string[]        = [];
  if (!provider.isMock && ranked.length > 0) {
    // ── Web search (best-effort — Claude runs even if this fails) ─────────────
    let webContext = "";
    const hasTrendSignal = /trending|this week|new\b|open(ed|ing)|pop.?up|latest|recent|what.?s/i.test(input.query);
    // Always anchor the web search on the original query — reconstructing from
    // intent tokens (category + district + governorate) loses nuance like occasion,
    // requirements, and the user's own phrasing which drives better results.
    const locationSuffix = richIntent.location.neighborhood
      ? ` ${richIntent.location.neighborhood} Amman Jordan`
      : ` ${intent.governorate ?? "Amman"} Jordan`;
    const webSearchQuery = `${input.query}${hasTrendSignal ? "" : locationSuffix}`;
    try {
      const webResults = await webSearch(webSearchQuery, { maxResults: 3, searchDepth: "basic" });
      webContext = formatWebResults(webResults, "LIVE WEB INFO");
    } catch (webErr) {
      console.error("[places] webSearch failed — continuing without web context:", webErr);
    }

    // ── LLM enrichment ────────────────────────────────────────────────────────
    try {

      // Rich place context — include rating and address so the LLM can write
      // a genuinely informative summary, not just a template.
      const placeItems = ranked.map((c, i) => ({
        id: c.id,
        name: ARABIC_CHAR_RE.test(c.name) ? (c.nameAr ?? c.name) : c.name,
        category: c.category,
        subcategory: c.subcategory ?? null,
        neighborhood: c.city ?? null,
        governorate: c.governorate ?? null,
        address: c.address ? c.address.slice(0, 80) : null,
        rating: c.rating != null ? `${c.rating}/5` : null,
        phone: c.phone ? "yes" : "no",
        website: c.website ? "yes" : "no",
        openingHours: c.openingHours ?? null,
        role: i === 0 ? "best" : "alternative",
        // Expose key search_text snippets (first 120 chars) so LLM can pick up features
        features: c.searchText ? c.searchText.slice(0, 120) : null,
      }));
      const langInstruction = queryLang === "ar"
        ? "IMPORTANT: Write both the 'summary' and all 'why' values in Arabic only."
        : "Write both the 'summary' and all 'why' values in English.";
      const memCtx = input.memoryBlock ? `\nUSER CONTEXT (use to personalise):\n${input.memoryBlock}` : "";
      // Build context signals for the LLM
      const occasionCtx = richIntent.occasion.type !== "none"
        ? ` Occasion: ${richIntent.occasion.type}${richIntent.occasion.formality ? ` (${richIntent.occasion.formality})` : ""}.`
        : "";
      const recipientCtx = richIntent.recipient.who
        ? ` For: ${richIntent.recipient.who}.`
        : "";
      const budgetCtx = richIntent.budget.max !== null
        ? ` Budget: under ${richIntent.budget.max} JOD (${richIntent.budget.sensitivity}).`
        : richIntent.budget.tier
        ? ` Budget preference: ${richIntent.budget.tier}.`
        : "";
      const neighborhoodCtx = richIntent.location.neighborhood
        ? ` Location: ${richIntent.location.neighborhood}.`
        : "";
      const reqCtx = richIntent.requirements.length > 0
        ? ` Requirements: ${richIntent.requirements.join(", ")}.`
        : "";
      // Temporal context from client (Jordan timezone, Ramadan, holidays)
      const t = input.context?.temporal;
      const _dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
      const temporalCtx = t
        ? ` Time: ${_dayNames[t.localDay] ?? "today"} ${t.timeOfDay}${t.isRamadan ? " — Ramadan" : ""}${t.isEid ? " — Eid" : ""}${t.isFriday ? " (Friday)" : ""}${t.holiday ? ` (${t.holiday})` : ""}.`
        : "";

      const contextLine = [occasionCtx, recipientCtx, budgetCtx, neighborhoodCtx, reqCtx, temporalCtx]
        .filter(Boolean).join("") || "";

      const placeRes = await provider.complete({
        system:
          "You are ChatSouq — write as a seasoned Amman local journalist, not a chatbot.\n\n" +
          "FORBIDDEN WORDS: great, amazing, perfect, wonderful, excellent, fantastic, delightful, lovely. Use specific adjectives instead.\n\n" +
          "OUTPUT FORMAT — return JSON with these exact keys:\n" +
          "  intro: 2–3 sentence editorial paragraph. First sentence MUST open with a specific local insight — a trend, a neighbourhood detail, a contrast, or a seasonal fact. Never start with 'Looking for a...'\n" +
          "  connector: one italic bridge sentence (max 22 words) linking top pick to the alternatives.\n" +
          "  insight: 1–2 sentences of actionable local knowledge — best time to go, how to book, what to order, parking, dress code.\n" +
          "  followUps: exactly 4 follow-up queries the user might want next (max 9 words each).\n" +
          "  items: array where each entry has:\n" +
          "    id: number (must match the provided place id)\n" +
          "    why: max 18 words. Structure:\n" +
          "      - If budget context exists: open with price signal ('Around X–Y JOD' or 'Budget-friendly option').\n" +
          "      - Then: location/occasion fit ('In [neighbourhood]', 'Good for [occasion]', 'Walking distance from...').\n" +
          "      - End with one specific quality signal (rating, cuisine style, unique feature, what it's known for).\n" +
          "    tags: up to 5 short tags (e.g. Rooftop, Walk-in OK, Private rooms, Delivery, Valet, Ladies section, Open late).\n\n" +
          `Use ONLY facts from the provided data — no invented prices, dishes, or phone numbers. ${langInstruction}` +
          (contextLine ? `\nQUERY CONTEXT:${contextLine}` : "") +
          memCtx +
          (webContext ? `\n${webContext}` : "") +
          '\nReturn JSON: {"intro":"...","connector":"...","insight":"...","followUps":["...","...","...","..."],"items":[{"id":number,"why":"...","tags":["..."]}]}',
        messages: [{
          role: "user",
          content: `User asked for: "${input.query}"\nPlaces: ${JSON.stringify(placeItems)}`,
        }],
        json: true,
        temperature: 0.4,
        maxTokens: 1100,
      });
      const raw: unknown = JSON.parse(placeRes.text);
      const parsed: {
        intro?: string; connector?: string; insight?: string; followUps?: string[];
        summary?: string; items?: { id: number; why: string; tags?: string[] }[];
      } = Array.isArray(raw) ? { items: raw as { id: number; why: string }[] } : (raw as typeof parsed);

      if (typeof parsed.intro === "string" && parsed.intro.trim()) llmSummary = parsed.intro.trim();
      else if (typeof parsed.summary === "string" && parsed.summary.trim()) llmSummary = parsed.summary.trim();
      if (typeof parsed.connector === "string" && parsed.connector.trim()) llmConnector = parsed.connector.trim();
      if (typeof parsed.insight === "string" && parsed.insight.trim()) llmInsight = parsed.insight.trim();
      if (Array.isArray(parsed.followUps)) llmFollowUps = parsed.followUps.filter((s): s is string => typeof s === "string").slice(0, 4);

      if (Array.isArray(parsed.items)) {
        for (const p of parsed.items) {
          if (typeof p.why === "string" && p.why.trim()) whyMap.set(p.id, p.why.trim());
          if (Array.isArray(p.tags) && p.tags.length) tagsMap.set(p.id, p.tags.slice(0, 5));
        }
      }
    } catch (llmErr) {
      console.error("[places] LLM enrichment failed:", llmErr);
      // keep code-generated whys and fallback summary
    }
  }

  const items: PlaceResultItem[] = ranked.map((c, i) => ({
    place: toResultPlace(c),
    // Normalise score from 0–100 to 0–1 so the API contract stays consistent
    score: Number((c.score / 100).toFixed(4)),
    isBest: i === 0,
    why: whyMap.get(c.id) ?? placeWhy(c, i === 0, queryLang),
    pros: placePros(c, intent, queryLang),
    tags: tagsMap.get(c.id),
  }));

  const response: PlaceRecommendationResponse = {
    kind: "places",
    query: input.query,
    intent,
    summary: llmSummary ?? buildPlaceCodeSummary(ranked, intent, queryLang),
    connectorText: llmConnector ?? undefined,
    insightText: llmInsight ?? undefined,
    followUpPrompts: llmFollowUps.length
      ? llmFollowUps
      : generateFollowUps(richIntent, ranked[0]?.name),
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

  // ── Cache store ─────────────────────────────────────────────────────────────
  if (cacheKey) setCachedPlaceResponse(cacheKey, response);

  return response;
}
