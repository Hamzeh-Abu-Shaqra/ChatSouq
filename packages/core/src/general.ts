import { getProvider, type AIProvider } from "@chatsouq/ai";
import { sql } from "drizzle-orm";
import { db } from "@chatsouq/db";
import { webSearch, formatWebResults } from "./web-search";
import type { GeneralAnswerResponse, NeighborhoodCard, InfoCard, RecommendInput, ConvMessage } from "./types";

// ── Language detection ────────────────────────────────────────────────────────

const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿ]/;

function isArabic(query: string): boolean {
  return ARABIC_RE.test(query);
}

// ── Intent detection ─────────────────────────────────────────────────────────

// English word-boundary patterns
const RENTAL_EN = /\b(rent|renting|rental|apartment|flat|housing|live\s+in|move\s+to|relocat|neighborhood|neighbourhood|district|where\s+to\s+stay|monthly\s+budget|afford|area[s]?\s+to\s+(live|rent|stay)|area[s]?\s+can\s+i|what\s+area[s]?)\b/i;
const TOURISM_EN = /\b(visit|tourism|tourist|attraction|sightseeing|things\s+to\s+do|places\s+to\s+(visit|see)|landmark|day\s+trip|itinerary)\b/i;
const LIFESTYLE_EN = /\b(family.friendly|best\s+area\s+to\s+live|schools?\s+near|safety|safe\s+area|crime|traffic|commute|walkab)\b/i;
const WEATHER_EN = /\b(weather|climate|temperature|rain|hot|cold|season|best\s+time\s+to\s+visit)\b/i;
const GOVERNMENT_EN = /\b(ministry|government\s+service|register|residency|visa|permit|license|passport)\b/i;
const HISTORY_EN = /\b(history|historical|ancient|heritage|culture|civilization)\b/i;
// Today digest — must be checked BEFORE NEWS_EN since it overlaps
const TODAY_EN = /\b(today|this\s+morning|what'?s\s+happening|daily\s+digest|morning\s+briefing|amman\s+today|city\s+update|what'?s\s+new|catch\s+me\s+up|what'?s\s+going\s+on|summary|summarize\s+amman|amman\s+now)\b/i;
const TODAY_AR = /اليوم|ملخص|ماذا يحدث|أخبار اليوم|ما الجديد|عمان الآن/;

const NEWS_EN = /\b(news|latest|headlines|current\s+events|update[s]?|recent\s+news|breaking)\b/i;
const COMPANY_EN = /\b(compan(y|ies)|business(es)?|startup[s]?|firm[s]?|employer[s]?|work\s+at|job[s]?\s+at|corporate|industry)\b/i;
const GENERAL_INFO_EN = /\b(how\s+(much|many|do|does|can|to)|what\s+is|what\s+are|tell\s+me|explain|why\s+is|population|economy|language|religion)\b/i;

// Arabic patterns (no \b — Arabic chars are not ASCII word chars)
const RENTAL_AR = /إيجار|شقة|سكن|مناطق|منطقة|أسكن|للإيجار|أين\s+أسكن|أفضل\s+مناطق/;
const TOURISM_AR = /سياحة|زيارة|معالم|سياحي|أماكن\s+سياحية/;
const LIFESTYLE_AR = /مدارس|آمن|أمان|مناسب\s+للعائلة|حركة\s+المرور/;
const WEATHER_AR = /طقس|مناخ|درجة\s+الحرارة/;
const GOVERNMENT_AR = /حكومة|وزارة|تسجيل|تأشيرة|جواز/;
const HISTORY_AR = /تاريخ|حضارة|تراث|أثري/;
const NEWS_AR = /أخبار|عاجل|آخر\s+الأخبار|مستجدات/;
const COMPANY_AR = /شركة|شركات|أعمال|مؤسسة|توظيف|وظائف/;
const GENERAL_INFO_AR = /ما\s+هي|ما\s+هو|كيف|ماذا|لماذا|أخبرني|اشرح/;

const RENTAL_RE     = (q: string) => RENTAL_EN.test(q)     || RENTAL_AR.test(q);
const TOURISM_RE    = (q: string) => TOURISM_EN.test(q)    || TOURISM_AR.test(q);
const LIFESTYLE_RE  = (q: string) => LIFESTYLE_EN.test(q)  || LIFESTYLE_AR.test(q);
const WEATHER_RE    = (q: string) => WEATHER_EN.test(q)    || WEATHER_AR.test(q);
const GOVERNMENT_RE = (q: string) => GOVERNMENT_EN.test(q) || GOVERNMENT_AR.test(q);
const HISTORY_RE    = (q: string) => HISTORY_EN.test(q)    || HISTORY_AR.test(q);
const NEWS_RE       = (q: string) => NEWS_EN.test(q)       || NEWS_AR.test(q);
const COMPANY_RE    = (q: string) => COMPANY_EN.test(q)    || COMPANY_AR.test(q);
const GENERAL_INFO_RE = (q: string) => GENERAL_INFO_EN.test(q) || GENERAL_INFO_AR.test(q);
const TODAY_RE      = (q: string) => TODAY_EN.test(q)      || TODAY_AR.test(q);

export type GeneralIntentType = "rental" | "tourism" | "lifestyle" | "weather" | "government" | "history" | "news" | "companies" | "general" | "today";

export function detectGeneralIntent(query: string): GeneralIntentType {
  // Check "today" FIRST — it overlaps with news keywords
  if (TODAY_RE(query))      return "today";
  if (RENTAL_RE(query))     return "rental";
  if (LIFESTYLE_RE(query))  return "lifestyle";
  if (TOURISM_RE(query))    return "tourism";
  if (WEATHER_RE(query))    return "weather";
  if (GOVERNMENT_RE(query)) return "government";
  if (HISTORY_RE(query))    return "history";
  if (NEWS_RE(query))       return "news";
  if (COMPANY_RE(query))    return "companies";
  return "general";
}

/** Returns true when query should be routed to the general answer engine. */
export function isGeneralQuery(query: string): boolean {
  return (
    TODAY_RE(query) ||
    RENTAL_RE(query) ||
    LIFESTYLE_RE(query) ||
    TOURISM_RE(query) ||
    WEATHER_RE(query) ||
    GOVERNMENT_RE(query) ||
    HISTORY_RE(query) ||
    NEWS_RE(query) ||
    COMPANY_RE(query) ||
    GENERAL_INFO_RE(query)
  );
}

// ── Budget detection ─────────────────────────────────────────────────────────

function detectBudget(query: string): number | null {
  // Match "800 JOD", "800 dinar", "800 دينار", "٨٠٠ دينار", etc.
  const m = query.match(/(\d[\d,]*)\s*(?:jod|jd|dinars?|دينار|د\.?ا)/i);
  if (m) return Number(m[1]!.replace(/,/g, ""));
  // Arabic-Eastern numerals with دينار
  const arNum = query.match(/([٠-٩]+)\s*دينار/);
  if (arNum) {
    const normalized = arNum[1]!.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));
    return Number(normalized);
  }
  const around = query.match(/(?:around|about|بميزانية|حوالي)\s+(\d[\d,]*)/i);
  if (around) return Number(around[1]!.replace(/,/g, ""));
  return null;
}

/**
 * Extract budget from current query first; if not found, scan prior user turns.
 * This lets follow-ups like "reduce to 400 JOD" or "what about 300?" work correctly.
 */
function resolveBudget(query: string, history: ConvMessage[]): number | null {
  const current = detectBudget(query);
  if (current !== null) return current;
  // Scan history newest-first for any prior budget mention
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg && msg.role === "user") {
      const b = detectBudget(msg.content);
      if (b !== null) return b;
    }
  }
  return null;
}

function detectCity(query: string): string {
  // Check all 12 governorates + common city aliases
  if (/\b(irbid|arbid)\b/i.test(query)      || /إربد/.test(query))           return "Irbid";
  if (/\b(zarqa|zerqa)\b/i.test(query)       || /الزرقاء|زرقاء/.test(query)) return "Zarqa";
  if (/\b(aqaba|aquaba|akaba)\b/i.test(query)|| /العقبة|عقبة/.test(query))   return "Aqaba";
  if (/\b(salt|al.salt)\b/i.test(query)      || /السلط|سلط/.test(query))     return "Salt";
  if (/\b(madaba)\b/i.test(query)            || /مادبا|ماداب/.test(query))   return "Madaba";
  if (/\b(karak|kerak)\b/i.test(query)       || /الكرك|كرك/.test(query))     return "Karak";
  if (/\b(jerash|jarash|gerasa)\b/i.test(query)|| /جرش/.test(query))         return "Jerash";
  if (/\b(ajloun|ajlun)\b/i.test(query)      || /عجلون/.test(query))         return "Ajloun";
  if (/\b(mafraq)\b/i.test(query)            || /المفرق|مفرق/.test(query))   return "Mafraq";
  if (/\b(tafilah|tafila)\b/i.test(query)    || /الطفيلة|طفيلة/.test(query))return "Tafilah";
  if (/\b(maan|ma.?an)\b/i.test(query)       || /معان/.test(query))          return "Ma'an";
  if (/\b(petra|wadi\s*musa)\b/i.test(query) || /البتراء|وادي موسى/.test(query)) return "Petra";
  if (/\b(balqa)\b/i.test(query)             || /البلقاء/.test(query))       return "Salt";
  if (/\b(russeifa|russaifa)\b/i.test(query) || /رصيفة/.test(query))        return "Zarqa";
  if (/\b(wadi\s*rum)\b/i.test(query)        || /وادي رم/.test(query))       return "Aqaba";
  return "Amman";
}

const CITY_AR: Record<string, string> = {
  Amman:   "عمان",
  Irbid:   "إربد",
  Zarqa:   "الزرقاء",
  Aqaba:   "العقبة",
  Salt:    "السلط",
  Madaba:  "مادبا",
  Karak:   "الكرك",
  Jerash:  "جرش",
  Ajloun:  "عجلون",
  Mafraq:  "المفرق",
  Tafilah: "الطفيلة",
  "Ma'an": "معان",
  Petra:   "البتراء",
};

// ── Jordan neighborhood reference data (used as grounding context for Claude) ─
// Covers all major cities. Claude is instructed to use these exact numbers.

const JORDAN_NEIGHBORHOODS: Record<string, NeighborhoodCard[]> = {

Amman: [
  // ─ Luxury / Upscale ──────────────────────────────────────────────────────────
  {
    name: "Dabouq", nameAr: "دابوق", city: "Amman", governorate: "Amman",
    avgRentMin: 1000, avgRentMax: 3500, tier: "luxury",
    characteristics: ["Quiet villa district", "Far west Amman", "Lush greenery", "Very private"],
    pros: ["Most spacious & private", "Large villas with gardens", "Very low density", "Excellent air quality"],
    cons: ["Far from city center (30+ min)", "Car absolutely essential", "Limited nearby shops"],
    bestFor: ["High-budget families", "Executives", "Those wanting maximum space & privacy"],
  },
  {
    name: "Abdoun", nameAr: "عبدون", city: "Amman", governorate: "Amman",
    avgRentMin: 900, avgRentMax: 2500, tier: "luxury",
    characteristics: ["Embassy district", "Tree-lined streets", "Villas & upscale apartments", "Near 5th Circle"],
    pros: ["Prestige address", "Extremely safe & secure", "Near best restaurants in Amman", "International community"],
    cons: ["Car essential", "Very high cost of living", "Limited public transit"],
    bestFor: ["Expats", "Senior executives", "Diplomatic families"],
  },
  {
    name: "Deir Ghbar", nameAr: "دير غبار", city: "Amman", governorate: "Amman",
    avgRentMin: 800, avgRentMax: 2000, tier: "luxury",
    characteristics: ["Quiet hilltop", "Upscale residential", "Private community feel", "Near 5th Circle"],
    pros: ["Panoramic city views", "Very secure", "Modern buildings", "Close to Abdoun amenities"],
    cons: ["Car essential", "Limited walkability", "Higher service charges"],
    bestFor: ["Families", "Expats", "Professionals seeking quiet luxury"],
  },
  {
    name: "Rabieh", nameAr: "الرابية", city: "Amman", governorate: "Amman",
    avgRentMin: 700, avgRentMax: 1800, tier: "upscale",
    characteristics: ["Quiet suburban", "Upscale housing", "Near 4th & 5th circles", "Green spaces"],
    pros: ["Very peaceful & quiet", "High-quality buildings", "Good international schools nearby", "Safe & secure"],
    cons: ["Need a car", "Limited walkability", "Fewer cafes & shops"],
    bestFor: ["Families with children", "Expats", "Professionals"],
  },
  {
    name: "Um Uthaina", nameAr: "أم أذينة", city: "Amman", governorate: "Amman",
    avgRentMin: 550, avgRentMax: 1200, tier: "upscale",
    characteristics: ["Residential & commercial mix", "Near 4th Circle", "Well-connected", "Many amenities"],
    pros: ["Central-west location", "Walkable to shops", "Good schools & hospitals", "Less traffic than Sweifieh"],
    cons: ["Getting denser", "Moderate traffic", "Mixed commercial-residential"],
    bestFor: ["Young professionals", "Couples", "Families who want convenience"],
  },
  // ─ Mid-Range ─────────────────────────────────────────────────────────────────
  {
    name: "Sweifieh", nameAr: "الصويفية", city: "Amman", governorate: "Amman",
    avgRentMin: 500, avgRentMax: 1100, tier: "upscale",
    characteristics: ["Major shopping district", "Cafes & restaurants", "Active nightlife", "Central-west Amman"],
    pros: ["Everything within walking distance", "Excellent transport", "Great dining & entertainment", "Lively atmosphere"],
    cons: ["Heavy traffic congestion", "Noisy", "Parking nightmare", "Higher rents for size"],
    bestFor: ["Young singles & couples", "Expats who like city energy", "Those who don't need a car"],
  },
  {
    name: "Shmeisani", nameAr: "الشميساني", city: "Amman", governorate: "Amman",
    avgRentMin: 450, avgRentMax: 900, tier: "mid-range",
    characteristics: ["Business & financial district", "Banks & corporate offices", "Central location", "Good infrastructure"],
    pros: ["Most central location in Amman", "Walking distance to offices & banks", "Great connectivity", "Diverse amenities"],
    cons: ["Commercial feel", "Heavy peak-hour traffic", "Less residential charm", "Noisy on weekdays"],
    bestFor: ["Business professionals", "Singles", "Those who work in the area"],
  },
  {
    name: "Jabal Amman", nameAr: "جبل عمان", city: "Amman", governorate: "Amman",
    avgRentMin: 400, avgRentMax: 850, tier: "mid-range",
    characteristics: ["Historic trendy district", "1st–4th Circles", "Rainbow Street", "Cafes & boutiques"],
    pros: ["Cultural & artsy vibe", "Walkable neighbourhood", "Best café & dining scene in Amman", "Historic character"],
    cons: ["Hilly terrain (hard on older people)", "Older buildings", "Very limited parking"],
    bestFor: ["Creatives & artists", "Young professionals", "Culture & food lovers"],
  },
  {
    name: "Khalda", nameAr: "خلدا", city: "Amman", governorate: "Amman",
    avgRentMin: 380, avgRentMax: 780, tier: "mid-range",
    characteristics: ["Established residential", "Near University of Jordan", "Family-oriented", "Quieter pace"],
    pros: ["Peaceful atmosphere", "Family-friendly community", "Reasonably priced for quality", "Good schools & uni nearby"],
    cons: ["Needs a car for most errands", "Less entertainment & nightlife"],
    bestFor: ["Families", "Students at UJ", "Those seeking quiet family life"],
  },
  {
    name: "Tlaa Al-Ali", nameAr: "تلاع العلي", city: "Amman", governorate: "Amman",
    avgRentMin: 320, avgRentMax: 700, tier: "mid-range",
    characteristics: ["Residential suburb", "Newer developments", "Family-focused", "Quieter"],
    pros: ["Modern apartments with good finishes", "Spacious for the price", "Family community feel", "Less congested"],
    cons: ["Further from city center (20+ min)", "Car essential", "Less entertainment"],
    bestFor: ["Young families", "Those seeking space at reasonable cost"],
  },
  {
    name: "Wadi Saqra / 3rd Circle", nameAr: "وادي صقرة / الدوار الثالث", city: "Amman", governorate: "Amman",
    avgRentMin: 350, avgRentMax: 800, tier: "mid-range",
    characteristics: ["Central-west Amman", "Near 3rd Circle", "Mix of residential & offices", "Convenient location"],
    pros: ["Very central", "Good connectivity to all areas", "Walkable to many services", "Character neighbourhood"],
    cons: ["Traffic at circles", "Parking limited", "Older building stock"],
    bestFor: ["Young professionals", "Singles", "Couples who value central location"],
  },
  {
    name: "Sweileh", nameAr: "سويلح", city: "Amman", governorate: "Amman",
    avgRentMin: 250, avgRentMax: 550, tier: "mid-range",
    characteristics: ["Near University of Jordan", "Active area", "Mixed residential-commercial", "Affordable"],
    pros: ["Very affordable for west Amman", "Busy local scene", "Good transport options", "Near university"],
    cons: ["Can be chaotic", "Heavy traffic on main roads", "Less polished environment"],
    bestFor: ["Students", "Budget-conscious professionals", "University staff"],
  },
  {
    name: "Jubeiha", nameAr: "الجبيهة", city: "Amman", governorate: "Amman",
    avgRentMin: 220, avgRentMax: 480, tier: "budget",
    characteristics: ["University student hub", "Affordable", "Lively local cafes", "Near UJ & JUST"],
    pros: ["Lowest-cost option in west Amman", "Lively student atmosphere", "Many cheap eats & cafes", "Near University of Jordan"],
    cons: ["Noisier & busier", "Less polished", "Can feel overcrowded in student season"],
    bestFor: ["University students", "Young budget renters", "Those on tight budgets near campus"],
  },
  // ─ East Amman / Budget ───────────────────────────────────────────────────────
  {
    name: "Jabal Hussein", nameAr: "جبل الحسين", city: "Amman", governorate: "Amman",
    avgRentMin: 180, avgRentMax: 400, tier: "budget",
    characteristics: ["Central east Amman", "Dense residential", "Affordable", "Local markets"],
    pros: ["Very central location", "Affordable rents", "Good public transport", "Strong local community"],
    cons: ["Dense & crowded", "Older buildings", "Limited amenities"],
    bestFor: ["Budget renters", "Those needing central location on tight budget", "Local families"],
  },
  {
    name: "Marka", nameAr: "ماركا", city: "Amman", governorate: "Amman",
    avgRentMin: 130, avgRentMax: 320, tier: "budget",
    characteristics: ["East Amman", "Working-class area", "Very affordable", "Near airport road"],
    pros: ["Cheapest rents in Amman", "Near Queen Alia Highway", "Strong local community"],
    cons: ["Far from west Amman amenities", "Older housing stock", "Less infrastructure"],
    bestFor: ["Very tight budgets", "Those working near the airport or east Amman"],
  },
  {
    name: "Sahab", nameAr: "سحاب", city: "Amman", governorate: "Amman",
    avgRentMin: 110, avgRentMax: 280, tier: "budget",
    characteristics: ["South-east Amman suburb", "Industrial area", "Very affordable", "Spacious"],
    pros: ["Lowest rents in greater Amman area", "Larger apartments for price", "Quiet residential streets"],
    cons: ["Very far from city center (30+ min drive)", "Limited local services", "Far from top schools"],
    bestFor: ["Extremely tight budgets", "Those working in industrial areas", "Large families needing space"],
  },
  {
    name: "Jabal Al-Nuzha", nameAr: "جبل النزهة", city: "Amman", governorate: "Amman",
    avgRentMin: 150, avgRentMax: 350, tier: "budget",
    characteristics: ["East Amman residential", "Affordable", "Family neighbourhood", "Local community"],
    pros: ["Affordable family apartments", "Good community feel", "Accessible public transport"],
    cons: ["Limited modern amenities", "Older building stock", "Distance from west Amman"],
    bestFor: ["Families on tight budgets", "Local Jordanians", "Those working in east Amman"],
  },
],

// ── Irbid ─────────────────────────────────────────────────────────────────────
Irbid: [
  {
    name: "University District", nameAr: "منطقة الجامعة", city: "Irbid", governorate: "Irbid",
    avgRentMin: 150, avgRentMax: 350, tier: "budget",
    characteristics: ["Near Yarmouk University", "Student hub", "Lively cafes & shops", "Affordable"],
    pros: ["Very affordable rents", "Lively student scene", "Good transport", "Many cheap restaurants"],
    cons: ["Crowded & noisy", "Parking difficult", "Busy during term time"],
    bestFor: ["University students", "Young professionals", "Budget renters"],
  },
  {
    name: "Al-Husn", nameAr: "الحصن", city: "Irbid", governorate: "Irbid",
    avgRentMin: 130, avgRentMax: 280, tier: "budget",
    characteristics: ["North Irbid suburb", "Quiet residential", "Family-oriented", "Affordable"],
    pros: ["Very affordable", "Quiet neighbourhood", "Good schools nearby", "Family atmosphere"],
    cons: ["Car needed", "Limited nightlife", "Fewer modern amenities"],
    bestFor: ["Families", "Budget renters", "Those who want quiet life"],
  },
  {
    name: "City Centre", nameAr: "وسط البلد", city: "Irbid", governorate: "Irbid",
    avgRentMin: 160, avgRentMax: 380, tier: "mid-range",
    characteristics: ["Central Irbid", "Commercial district", "Well-connected", "All amenities nearby"],
    pros: ["Everything walking distance", "Good transport links", "Markets & shops", "Central location"],
    cons: ["Traffic congestion", "Noisy", "Older building stock"],
    bestFor: ["Working professionals", "Singles", "Those who want city convenience"],
  },
  {
    name: "Al-Rahebah", nameAr: "الراهبة", city: "Irbid", governorate: "Irbid",
    avgRentMin: 200, avgRentMax: 450, tier: "mid-range",
    characteristics: ["Upscale Irbid district", "Modern apartments", "Good schools", "Quiet"],
    pros: ["Best quality housing in Irbid", "Safe & quiet", "Good schools nearby", "Modern buildings"],
    cons: ["Higher rents for Irbid", "Car essential", "Limited entertainment"],
    bestFor: ["Families", "Professionals", "Those wanting best Irbid has to offer"],
  },
],

// ── Zarqa ─────────────────────────────────────────────────────────────────────
Zarqa: [
  {
    name: "New Zarqa", nameAr: "الزرقاء الجديدة", city: "Zarqa", governorate: "Zarqa",
    avgRentMin: 120, avgRentMax: 280, tier: "budget",
    characteristics: ["Newer residential area", "More modern buildings", "Quieter", "Affordable"],
    pros: ["More modern than old city", "Affordable rents", "Decent infrastructure", "Family-friendly"],
    cons: ["Car essential", "Far from Amman (30 min)", "Limited upscale amenities"],
    bestFor: ["Families on budget", "Workers in Zarqa industrial area", "Budget renters"],
  },
  {
    name: "Old Zarqa", nameAr: "الزرقاء القديمة", city: "Zarqa", governorate: "Zarqa",
    avgRentMin: 90, avgRentMax: 220, tier: "budget",
    characteristics: ["Historic city centre", "Cheap", "Dense", "Working-class area"],
    pros: ["Cheapest rents in Zarqa", "Good transport to Amman", "Strong local market"],
    cons: ["Older buildings", "Dense & noisy", "Less modern infrastructure"],
    bestFor: ["Extremely tight budgets", "Those working in Zarqa", "Local families"],
  },
  {
    name: "Russeifa", nameAr: "رصيفة", city: "Zarqa", governorate: "Zarqa",
    avgRentMin: 100, avgRentMax: 250, tier: "budget",
    characteristics: ["Between Amman & Zarqa", "Affordable suburb", "Good access to both cities"],
    pros: ["Easy access to both Amman and Zarqa", "Very affordable", "Growing area"],
    cons: ["Crowded main road", "Traffic on highway", "Industrial feel in parts"],
    bestFor: ["Budget renters", "Those working in either city", "Young families"],
  },
],

// ── Aqaba ─────────────────────────────────────────────────────────────────────
Aqaba: [
  {
    name: "City Centre", nameAr: "وسط البلد", city: "Aqaba", governorate: "Aqaba",
    avgRentMin: 200, avgRentMax: 500, tier: "mid-range",
    characteristics: ["Central Aqaba", "Near beach & port", "Walkable", "Lively"],
    pros: ["Walking distance to beach", "All amenities close", "Good restaurants", "Sea breeze"],
    cons: ["Tourist-heavy in season", "Traffic near port", "Limited parking"],
    bestFor: ["Young professionals", "Expats", "Those who love the sea"],
  },
  {
    name: "Al-Razi / Al-Zaher", nameAr: "الرازي / الزاهر", city: "Aqaba", governorate: "Aqaba",
    avgRentMin: 150, avgRentMax: 350, tier: "budget",
    characteristics: ["Residential neighbourhoods", "Away from tourist areas", "Quieter", "Local feel"],
    pros: ["More affordable than seafront", "Quiet residential streets", "Good for families"],
    cons: ["Need a car for beach", "Less walkable", "Far from tourist amenities"],
    bestFor: ["Local families", "Long-term residents", "Budget renters"],
  },
  {
    name: "Tala Bay / South Beach", nameAr: "تالا باي", city: "Aqaba", governorate: "Aqaba",
    avgRentMin: 500, avgRentMax: 1500, tier: "luxury",
    characteristics: ["Luxury beach resort area", "Private beaches", "International community", "5-star hotels"],
    pros: ["Private beach access", "High security", "Stunning sea views", "International standards"],
    cons: ["Very expensive", "Far from city centre (15 min)", "Isolated from local life"],
    bestFor: ["Expats", "High-income professionals", "Those wanting luxury beach lifestyle"],
  },
  {
    name: "Al-Sakanah", nameAr: "السكنة", city: "Aqaba", governorate: "Aqaba",
    avgRentMin: 120, avgRentMax: 300, tier: "budget",
    characteristics: ["Affordable suburb", "Local working-class area", "Family-oriented"],
    pros: ["Cheapest rents in Aqaba", "Strong local community", "Good for large families"],
    cons: ["Far from beach (15-20 min walk)", "Limited modern amenities"],
    bestFor: ["Families on tight budget", "Local workers", "Long-term residents"],
  },
],

// ── Salt (Balqa) ──────────────────────────────────────────────────────────────
Salt: [
  {
    name: "Old Salt", nameAr: "السلط القديمة", city: "Salt", governorate: "Balqa",
    avgRentMin: 130, avgRentMax: 300, tier: "budget",
    characteristics: ["Historic centre", "UNESCO heritage area", "Ottoman architecture", "Hilly"],
    pros: ["Unique historic character", "Very affordable", "Strong community feel", "Near Amman (30 min)"],
    cons: ["Old buildings", "Hilly terrain", "Limited modern amenities", "Traffic in narrow streets"],
    bestFor: ["History lovers", "Budget renters", "Those who commute to Amman"],
  },
  {
    name: "Al-Salhieh", nameAr: "الصالحية", city: "Salt", governorate: "Balqa",
    avgRentMin: 150, avgRentMax: 320, tier: "budget",
    characteristics: ["Residential suburb", "Quiet", "Modern apartments", "Families"],
    pros: ["More modern buildings", "Quiet residential", "Good schools nearby", "Affordable"],
    cons: ["Car essential", "Limited entertainment", "Smaller city feel"],
    bestFor: ["Families", "Those commuting to Amman", "Budget renters wanting quiet life"],
  },
],

// ── Madaba ────────────────────────────────────────────────────────────────────
Madaba: [
  {
    name: "City Centre", nameAr: "وسط البلد", city: "Madaba", governorate: "Madaba",
    avgRentMin: 120, avgRentMax: 280, tier: "budget",
    characteristics: ["Historic Christian city", "Mosaic art centre", "Near Dead Sea & Amman", "Quiet"],
    pros: ["Very affordable", "Charming historic city", "Close to Amman (30 min)", "Tourist attractions nearby"],
    cons: ["Small city", "Limited job market", "Car essential for most trips"],
    bestFor: ["Budget renters", "Families", "Those who commute to Amman", "Tourism workers"],
  },
],

// ── Karak ─────────────────────────────────────────────────────────────────────
Karak: [
  {
    name: "Karak City", nameAr: "مدينة الكرك", city: "Karak", governorate: "Karak",
    avgRentMin: 80, avgRentMax: 220, tier: "budget",
    characteristics: ["Crusader castle city", "South Jordan", "Affordable", "Traditional community"],
    pros: ["Cheapest rents in Jordan", "Strong community", "Historic setting", "Quiet life"],
    cons: ["Far from Amman (2 hrs)", "Limited jobs & amenities", "Very small city feel"],
    bestFor: ["Locals", "Extreme budget renters", "Those working in south Jordan"],
  },
],

// ── Petra area ────────────────────────────────────────────────────────────────
Petra: [
  {
    name: "Wadi Musa", nameAr: "وادي موسى", city: "Petra", governorate: "Ma'an",
    avgRentMin: 100, avgRentMax: 300, tier: "budget",
    characteristics: ["Gateway to Petra", "Tourist town", "Guesthouses & hotels", "Scenic views"],
    pros: ["Unique location next to Petra", "Tourism economy", "Stunning desert scenery", "Affordable rents"],
    cons: ["Very small town", "Limited amenities", "Seasonal economy", "Far from major cities"],
    bestFor: ["Tourism workers", "Adventure seekers", "Those working in the Petra hospitality sector"],
  },
],

// ── Jerash ────────────────────────────────────────────────────────────────────
Jerash: [
  {
    name: "Jerash City", nameAr: "مدينة جرش", city: "Jerash", governorate: "Jerash",
    avgRentMin: 90, avgRentMax: 230, tier: "budget",
    characteristics: ["Roman ruins city", "North Jordan", "Quiet", "Traditional"],
    pros: ["Very affordable", "Quiet lifestyle", "Historic Roman ruins", "Close to Irbid & Amman"],
    cons: ["Small city", "Limited job market", "Car essential"],
    bestFor: ["Budget renters", "Families", "Tourism workers", "Those commuting to Irbid"],
  },
],

}; // end JORDAN_NEIGHBORHOODS

// Convenience getter — falls back to Amman data if city not yet covered
function getNeighborhoods(city: string): NeighborhoodCard[] {
  return JORDAN_NEIGHBORHOODS[city] ?? JORDAN_NEIGHBORHOODS["Amman"] ?? [];
}

function filterByBudget(neighborhoods: NeighborhoodCard[], budget: number | null): NeighborhoodCard[] {
  if (!budget) return neighborhoods;
  return neighborhoods.filter((n) => n.avgRentMin <= budget).sort((a, b) => b.avgRentMin - a.avgRentMin);
}

// ── Live scraped data fetchers ────────────────────────────────────────────────

interface NewsItem {
  title: string;
  source: string;
  url: string | null;
  scraped_at: string | null;
}

/** Fetch the most recent Jordan news headlines from the scraped jordan_news table. */
async function fetchRecentNews(limit = 10): Promise<NewsItem[]> {
  try {
    const rows = (await db.execute(sql`
      SELECT title, source, url, scraped_at::text AS scraped_at
      FROM jordan_news
      ORDER BY scraped_at DESC
      LIMIT ${limit}
    `)) as unknown as NewsItem[];
    return rows;
  } catch {
    return [];
  }
}

interface CompanyItem {
  name: string;
  industry: string | null;
  location: string | null;
  url: string | null;
}

/** Fetch Jordan companies from the scraped jordan_companies table. */
async function fetchCompanies(keywords: string[], limit = 12): Promise<CompanyItem[]> {
  try {
    const kwPattern = keywords.length > 0 ? `%${keywords[0]}%` : "%";
    const rows = (await db.execute(sql`
      SELECT name, industry, location, url
      FROM jordan_companies
      WHERE name ILIKE ${kwPattern} OR industry ILIKE ${kwPattern}
      ORDER BY scraped_at DESC
      LIMIT ${limit}
    `)) as unknown as CompanyItem[];
    return rows;
  } catch {
    return [];
  }
}

// ── Today digest — parallel fetch of news, restaurants, places, professionals ──

async function fetchTodayDigest(): Promise<InfoCard[]> {
  const cards: InfoCard[] = [];

  const [news, restaurants, places] = await Promise.all([
    // Latest news with URLs
    db.execute(sql`
      SELECT title, source, url, scraped_at::text AS scraped_at
      FROM jordan_news
      ORDER BY scraped_at DESC
      LIMIT 8
    `).catch(() => []),

    // Top restaurants by rating (with Talabat URLs)
    db.execute(sql`
      SELECT name, cuisine, rating, url
      FROM jordan_restaurants
      WHERE url IS NOT NULL
      ORDER BY COALESCE(rating, 0) DESC
      LIMIT 5
    `).catch(() => []),

    // Featured places — gyms, cafes, hotels, etc. by rating
    db.execute(sql`
      SELECT name, category, address, phone, website
      FROM jordan_places
      WHERE category IN ('Gym','Cafe','Hotel','Restaurant','Mall','Park','Museum','Coffee Shop')
        AND name IS NOT NULL
      ORDER BY COALESCE(rating, 0) DESC
      LIMIT 8
    `).catch(() => []),
  ]);

  // Map news rows (real URLs from jordan_news)
  for (const n of news as Record<string, unknown>[]) {
    const rawDate = n.scraped_at as string | null;
    const dateStr = rawDate
      ? new Date(rawDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      : "";
    cards.push({
      title: String(n.title ?? ""),
      body: `${String(n.source ?? "Jordan News")}${dateStr ? " · " + dateStr : ""}`,
      icon: "calendar",
      section: "news",
      url: (n.url as string | null) ?? undefined,
    });
  }

  // Map restaurant rows (real Talabat URLs)
  for (const r of restaurants as Record<string, unknown>[]) {
    cards.push({
      title: String(r.name ?? ""),
      body: String(r.cuisine ?? "Restaurant"),
      icon: "star",
      section: "restaurant",
      url: (r.url as string | null) ?? undefined,
    });
  }

  // Map place rows — use website or fall back to Google Maps search
  for (const p of places as Record<string, unknown>[]) {
    const placeName = String(p.name ?? "");
    const mapsSearch = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName + " Amman Jordan")}`;
    cards.push({
      title: placeName,
      body: String(p.category ?? "Place"),
      icon: "map",
      section: "place",
      url: (p.website as string | null) ?? mapsSearch,
    });
  }

  return cards;
}

// ── OpenSooq real listings (scraped data) ─────────────────────────────────────

interface OpenSooqListing {
  title: string;
  price: string | null;
  location: string | null;
  category: string | null;
  url: string | null;
}

/**
 * Fetch real rental/property listings from the jordan_listings table (OpenSooq
 * scrape). Falls back gracefully if the table doesn't exist or is empty.
 */
async function fetchOpenSooqListings(
  budget: number | null,
  keywords: string[],
  limit = 12
): Promise<OpenSooqListing[]> {
  try {
    // Filter by price if budget provided, and by keyword if available
    const kwPattern = keywords.length > 0
      ? `%${keywords.slice(0, 3).join("%")}%`
      : "%";

    let rows: Record<string, unknown>[];

    if (budget) {
      rows = (await db.execute(sql`
        SELECT title, price, location, category, url
        FROM jordan_listings
        WHERE
          (price IS NULL OR price::numeric <= ${budget * 1.15})
          AND (title ILIKE ${kwPattern} OR location ILIKE ${kwPattern})
          AND category ILIKE '%rent%'
        ORDER BY
          CASE WHEN price IS NOT NULL THEN price::numeric ELSE 999999 END DESC
        LIMIT ${limit}
      `)) as unknown as Record<string, unknown>[];
    } else {
      rows = (await db.execute(sql`
        SELECT title, price, location, category, url
        FROM jordan_listings
        WHERE category ILIKE '%rent%'
        ORDER BY id DESC
        LIMIT ${limit}
      `)) as unknown as Record<string, unknown>[];
    }

    return rows.map((r) => ({
      title:    (r.title    as string) ?? "",
      price:    (r.price    as string) ?? null,
      location: (r.location as string) ?? null,
      category: (r.category as string) ?? null,
      url:      (r.url      as string) ?? null,
    }));
  } catch {
    return [];
  }
}

// ── Claude-powered general answer ─────────────────────────────────────────────

async function callClaude(
  provider: AIProvider,
  query: string,
  history: ConvMessage[],
  intentType: GeneralIntentType,
  budget: number | null,
  city: string,
  memoryBlock = "",
  todayCards?: InfoCard[]
): Promise<{ answer: string; cards: NeighborhoodCard[] | InfoCard[] }> {

  // Handle "today" digest separately — just need a brief journalist intro
  if (intentType === "today" && todayCards) {
    const newsHeadlines = todayCards
      .filter((c) => c.section === "news")
      .slice(0, 4)
      .map((c) => `"${c.title}"`)
      .join("; ");
    const todaySystemPrompt = `You are ChatSouq's morning editor for Amman, Jordan. Write a warm, journalist-style morning briefing of 2-3 sentences. Reference these actual headlines from today: ${newsHeadlines || "General Amman updates"}. Be specific and local. No markdown.`;
    try {
      const res = await provider.complete({
        system: todaySystemPrompt,
        messages: [{ role: "user", content: query }],
        json: false,
        temperature: 0.4,
        maxTokens: 200,
      });
      return { answer: res.text.trim(), cards: todayCards };
    } catch {
      return { answer: "Good morning, Amman! Here's what's happening in the city today.", cards: todayCards };
    }
  }

  const isRental = intentType === "rental" || intentType === "lifestyle";
  const arabic = isArabic(query);
  const cityDisplay = arabic ? (CITY_AR[city] ?? city) : city;
  const langNote = arabic
    ? "IMPORTANT: Respond in Arabic. All text in the 'answer' field and all string values in cards must be in Arabic. Use Arabic city names (e.g. عمان not Amman)."
    : "Respond in English.";

  // Prior conversation context for contrast & refinement
  const priorRentalContext = history.length > 0
    ? `\nPrior conversation (use to contrast, refine, or continue the recommendation):\n${
        history
          .filter((m) => m.role === "assistant")
          .map((m) => m.content)
          .join("\n")
          .slice(0, 1500)
      }`
    : "";

  // Pass verified neighborhood data as grounding reference — Claude must use these
  // exact numbers instead of guessing from training data.
  const refNeighborhoods = getNeighborhoods(city);
  const eligibleRef = budget
    ? refNeighborhoods.filter((n) => n.avgRentMin <= budget)
    : refNeighborhoods;
  const neighborhoodRefBlock = eligibleRef.length > 0
    ? `\nVERIFIED ${city.toUpperCase()} NEIGHBORHOOD REFERENCE DATA (use these exact numbers):\n` +
      eligibleRef.map((n) =>
        `- ${n.name} (${n.nameAr}): ${n.avgRentMin}–${n.avgRentMax} JOD/month [${n.tier}] — ${n.characteristics.join(", ")}`
      ).join("\n")
    : "";

  // ── Parallel data fetching — DB + web search run at the same time ─────────
  const budgetKeywords = query.toLowerCase().match(/\b(abdoun|jabal|khalda|sweifieh|mecca|gardens|jubaiha|zarqa|irbid|aqaba)\b/g) ?? [];
  const companyKeywords = query.toLowerCase().match(/\b\w{4,}\b/g)?.filter(w =>
    !["what","where","which","best","good","find","show","tell","about","jordan"].includes(w)
  ) ?? [];

  // Decide whether to fire a live web search (skip for rental — we have authoritative DB data)
  const shouldWebSearch = intentType !== "rental" && intentType !== "lifestyle";

  const [
    liveListings,
    newsItems,
    companyItems,
    webResults,
  ] = await Promise.all([
    isRental ? fetchOpenSooqListings(budget, budgetKeywords, 10) : Promise.resolve([]),
    intentType === "news"      ? fetchRecentNews(12)                          : Promise.resolve([]),
    intentType === "companies" ? fetchCompanies(companyKeywords.slice(0, 2), 15) : Promise.resolve([]),
    shouldWebSearch
      ? webSearch(query, {
          maxResults:  5,
          searchDepth: "basic",
          topic:       intentType === "news" ? "news" : "general",
          days:        intentType === "news" ? 3 : undefined,
        })
      : Promise.resolve([]),
  ]);

  const liveListingsBlock = liveListings.length > 0
    ? `\nLIVE OPENSOOQ LISTINGS (real current market data — reference these to validate prices):\n` +
      liveListings.map((l) =>
        `- "${l.title}" | ${l.price ? l.price + " JOD" : "price unlisted"} | ${l.location ?? "Amman"}`
      ).join("\n")
    : "";

  const newsBlock = newsItems.length > 0
    ? `\nLIVE JORDAN NEWS HEADLINES (scraped from Roya News):\n` +
      newsItems.map((n) => `- "${n.title}" (${n.source})`).join("\n")
    : "";

  const companiesBlock = companyItems.length > 0
    ? `\nLIVE JORDAN COMPANIES:\n` +
      companyItems.map((c) =>
        `- ${c.name}${c.industry ? ` | ${c.industry}` : ""}${c.location ? ` | ${c.location}` : ""}${c.url ? ` | ${c.url}` : ""}`
      ).join("\n")
    : "";

  // Web search results — supplement DB data with live internet data
  const webBlock = formatWebResults(webResults);

  const isNews     = intentType === "news";
  const isCompany  = intentType === "companies";

  const systemPrompt = isRental
    ? `You are ChatSouq, Jordan's expert AI assistant for real estate and neighborhoods.
${langNote}
${memoryBlock}
${neighborhoodRefBlock}
${liveListingsBlock}
The user is asking about rental areas${budget ? ` with a monthly budget of ${budget} JOD` : ""} in ${cityDisplay}.
${priorRentalContext}

Rules:
- Use ONLY the verified reference data above for rent prices — do NOT invent numbers.
- If prior history mentions different areas/budgets, explicitly contrast: name which areas from before are now out of reach, then name what IS affordable now.
- Be specific and direct: name the best areas upfront in the "answer" field.
- The "answer" should be 2-4 sentences, warm and practical.

Return ONLY valid JSON (no markdown fences):
{
  "answer": "Direct answer naming the best areas, referencing the budget, and contrasting with prior recommendations if relevant.",
  "cards": [
    {
      "name": "English area name",
      "nameAr": "Arabic area name",
      "city": "${city}",
      "governorate": "${city}",
      "avgRentMin": number (from reference data),
      "avgRentMax": number (from reference data),
      "tier": "budget|mid-range|upscale|luxury",
      "characteristics": ["4 short strings in response language"],
      "pros": ["3 pros in response language"],
      "cons": ["2 cons in response language"],
      "bestFor": ["3 renter types in response language"]
    }
  ]
}

${budget ? `STRICT: Only include areas where avgRentMin <= ${budget} JOD. Sort best value first. Never include areas that exceed the budget.` : ""}
Include 3–6 areas.`
    : isNews
    ? `You are ChatSouq, Jordan's live news assistant. You have access to real-time scraped headlines AND live web search results.
${langNote}
${newsBlock || ""}
${webBlock}
${(!newsBlock && !webBlock) ? "No live data available right now — answer from your training knowledge of Jordan." : ""}

Summarize what is happening in Jordan based on the data above. Be specific. If you have both scraped headlines and web results, combine them — don't duplicate.

Return ONLY valid JSON (no markdown fences):
{
  "answer": "2-3 sentence summary of current events in Jordan.",
  "cards": [
    {
      "title": "Story headline or topic",
      "body": "What this story is about in 1-2 sentences",
      "icon": "one of: info|star|calendar|building|map|phone"
    }
  ]
}
Limit to 5 cards.`

    : isCompany
    ? `You are ChatSouq, Jordan's business intelligence assistant. You have live web search results AND scraped company data.
${langNote}
${companiesBlock || ""}
${webBlock}

Answer the user's question about Jordan businesses and companies. Use both data sources — be specific about company names, industries, locations, and what they do.

Return ONLY valid JSON (no markdown fences):
{
  "answer": "2-4 sentences about the companies or business landscape.",
  "cards": [
    {
      "title": "Company or sector name",
      "body": "What this company does / sector overview in Jordan",
      "icon": "one of: building|info|map|star|phone|calendar"
    }
  ]
}
Limit to 5 cards.`

    : `You are ChatSouq, the smartest AI assistant for anything about Jordan. You have access to:
1. A live database of Jordan places, restaurants, rental listings, companies, and news
2. Real-time web search results pulled right now specifically for this query
3. Deep training knowledge of Jordan — geography, culture, economy, government, daily life

${langNote}
${memoryBlock}
${webBlock}
${history.length > 0 ? "\nConversation history (use for context and continuity — don't repeat what was already said):\n" + history.filter(m => m.role === "user").map(m => `User: ${m.content}`).join("\n") : ""}

Rules:
- Prioritize the live web results and DB data above your training data when they conflict
- Be specific — name exact places, prices, services, and facts
- Give the answer a local expert would give, not a tourist brochure
- If the user asks something conversational or follow-up, respond naturally

Return ONLY valid JSON (no markdown fences):
{
  "answer": "3-5 sentences, detailed, specific, and useful. Plain text only — no markdown, no bullet points.",
  "cards": [
    {
      "title": "Specific and descriptive title",
      "body": "1-2 sentences with concrete, actionable information",
      "icon": "one of: info|map|star|building|calendar|phone"
    }
  ]
}
Limit to 4 cards. Every card must contain NEW information not already in the answer.`;

  // Build messages: prior conversation turns + current question
  const historyMessages = history.map((h) => ({
    role: h.role as "user" | "assistant",
    content: h.content,
  }));

  try {
    const res = await provider.complete({
      system: systemPrompt,
      messages: [...historyMessages, { role: "user", content: query }],
      json: true,
      temperature: 0.2,
      maxTokens: 1800,
    });

    const parsed = JSON.parse(res.text) as { answer?: string; cards?: unknown[] };
    return {
      answer: parsed.answer ?? "",
      cards: (parsed.cards ?? []) as NeighborhoodCard[] | InfoCard[],
    };
  } catch {
    return { answer: "", cards: [] };
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

interface Deps {
  provider?: AIProvider;
}

export async function generalAnswer(
  input: RecommendInput,
  deps: Deps = {}
): Promise<GeneralAnswerResponse> {
  const started = Date.now();
  const provider = deps.provider ?? getProvider();
  const intentType = detectGeneralIntent(input.query);
  const history = input.history ?? [];
  // Budget resolution: use current query first, fall back to conversation history
  const budget = resolveBudget(input.query, history);
  const city = detectCity(input.query);

  let answer = "";
  let cards: NeighborhoodCard[] | InfoCard[] = [];

  const arabic = isArabic(input.query);
  const cityDisplay = arabic ? (CITY_AR[city] ?? city) : city;

  // ── Today digest — parallel DB fetch + Claude briefing ──
  if (intentType === "today") {
    const digestCards = await fetchTodayDigest();
    if (provider.isMock) {
      const newsCount = digestCards.filter((c) => c.section === "news").length;
      return {
        kind: "general",
        query: input.query,
        intentType: "today",
        summary: `Good morning, Amman! Here's your daily digest — ${newsCount} live headlines, top restaurants, featured places, and more from around the city.`,
        cards: digestCards,
        meta: { provider: provider.name, tookMs: Date.now() - started },
      };
    }
    const result = await callClaude(provider, input.query, history, "today", null, city, "", digestCards);
    return {
      kind: "general",
      query: input.query,
      intentType: "today",
      summary: result.answer || "Good morning, Amman! Here's what's happening in the city today.",
      cards: digestCards,
      meta: { provider: provider.name, tookMs: Date.now() - started },
    };
  }

  if (provider.isMock) {
    // Deterministic fallback for when no API key is configured
    if (intentType === "rental" || intentType === "lifestyle") {
      const filtered = filterByBudget(getNeighborhoods(city), budget);
      cards = filtered.slice(0, 6) as NeighborhoodCard[];
      if (arabic) {
        answer = budget
          ? `بميزانية ${budget} دينار أردني شهرياً في ${cityDisplay}، لديك خيارات رائعة. إليك أفضل الأحياء التي تناسب ميزانيتك، من الأكثر فخامة إلى الأكثر اقتصادية.`
          : `تقدم ${cityDisplay} مجموعة واسعة من الأحياء لكل أسلوب حياة وميزانية. إليك أكثر المناطق شعبية للنظر فيها.`;
      } else {
        answer = budget
          ? `With a ${budget} JOD monthly budget in ${cityDisplay}, you have great options. Here are the best neighborhoods that fit your budget, from most premium to most affordable.`
          : `${cityDisplay} offers a wide range of neighborhoods for every lifestyle and budget. Here are the most popular areas to consider.`;
      }
    } else if (intentType === "news") {
      // In mock mode still fetch and show live news headlines from the DB
      const newsItems = await fetchRecentNews(8);
      if (newsItems.length > 0) {
        answer = arabic
          ? `إليك آخر الأخبار من الأردن (مصدر: Roya News).`
          : `Here are the latest headlines from Jordan (source: Roya News).`;
        cards = newsItems.map((n) => ({
          title: n.title,
          body: `${n.source}${n.scraped_at ? ` · ${new Date(n.scraped_at).toLocaleDateString()}` : ""}`,
          icon: "calendar",
        })) as InfoCard[];
      } else {
        answer = arabic ? `لا تتوفر أخبار حديثة حالياً.` : `No recent news available right now.`;
      }
    } else {
      answer = arabic
        ? `يمكن لـ ChatSouq الإجابة على الأسئلة العامة حول الأردن عند الاتصال بمحرك الذكاء الاصطناعي. جرّب السؤال عن منتج للشراء أو مكان لزيارته.`
        : `ChatSouq can answer general questions about Jordan when connected to its AI reasoning engine. Try asking about a product to buy or a place to visit instead.`;
    }
  } else {
    const memoryBlock = input.memoryBlock ?? "";
    const result = await callClaude(provider, input.query, history, intentType, budget, city, memoryBlock);
    answer = result.answer;
    cards = result.cards as NeighborhoodCard[] | InfoCard[];

    // If Claude returned no cards for rental, fall back to curated data
    if ((intentType === "rental" || intentType === "lifestyle") && (!cards || cards.length === 0)) {
      cards = filterByBudget(getNeighborhoods(city), budget).slice(0, 6);
      if (!answer) {
        answer = arabic
          ? (budget ? `إليك أفضل الأحياء في ${cityDisplay} التي تناسب ميزانية ${budget} دينار شهرياً.` : `إليك أبرز الأحياء في ${cityDisplay} للإيجار.`)
          : (budget ? `With a ${budget} JOD monthly budget in ${cityDisplay}, here are the best neighborhoods that fit your needs.` : `Here are the top neighborhoods in ${cityDisplay} to consider for renting.`);
      }
    }
  }

  const isRental = intentType === "rental" || intentType === "lifestyle";

  return {
    kind: "general",
    query: input.query,
    intentType,
    summary: answer,
    cards: isRental ? (cards as NeighborhoodCard[]) : (cards as InfoCard[]),
    meta: {
      provider: provider.name,
      tookMs: Date.now() - started,
    },
  };
}
