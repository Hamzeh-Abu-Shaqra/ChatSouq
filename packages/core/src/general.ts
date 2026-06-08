import { getProvider, type AIProvider } from "@chatsouq/ai";
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
const GENERAL_INFO_EN = /\b(how\s+(much|many|do|does|can|to)|what\s+is|what\s+are|tell\s+me|explain|why\s+is|population|economy|language|religion)\b/i;

// Arabic patterns (no \b — Arabic chars are not ASCII word chars)
const RENTAL_AR = /إيجار|شقة|سكن|مناطق|منطقة|أسكن|للإيجار|أين\s+أسكن|أفضل\s+مناطق/;
const TOURISM_AR = /سياحة|زيارة|معالم|سياحي|أماكن\s+سياحية/;
const LIFESTYLE_AR = /مدارس|آمن|أمان|مناسب\s+للعائلة|حركة\s+المرور/;
const WEATHER_AR = /طقس|مناخ|درجة\s+الحرارة/;
const GOVERNMENT_AR = /حكومة|وزارة|تسجيل|تأشيرة|جواز/;
const HISTORY_AR = /تاريخ|حضارة|تراث|أثري/;
const GENERAL_INFO_AR = /ما\s+هي|ما\s+هو|كيف|ماذا|لماذا|أخبرني|اشرح/;

const RENTAL_RE   = (q: string) => RENTAL_EN.test(q)     || RENTAL_AR.test(q);
const TOURISM_RE  = (q: string) => TOURISM_EN.test(q)    || TOURISM_AR.test(q);
const LIFESTYLE_RE = (q: string) => LIFESTYLE_EN.test(q) || LIFESTYLE_AR.test(q);
const WEATHER_RE  = (q: string) => WEATHER_EN.test(q)    || WEATHER_AR.test(q);
const GOVERNMENT_RE = (q: string) => GOVERNMENT_EN.test(q) || GOVERNMENT_AR.test(q);
const HISTORY_RE  = (q: string) => HISTORY_EN.test(q)    || HISTORY_AR.test(q);
const GENERAL_INFO_RE = (q: string) => GENERAL_INFO_EN.test(q) || GENERAL_INFO_AR.test(q);

export type GeneralIntentType = "rental" | "tourism" | "lifestyle" | "weather" | "government" | "history" | "general";

export function detectGeneralIntent(query: string): GeneralIntentType {
  if (RENTAL_RE(query)) return "rental";
  if (LIFESTYLE_RE(query)) return "lifestyle";
  if (TOURISM_RE(query)) return "tourism";
  if (WEATHER_RE(query)) return "weather";
  if (GOVERNMENT_RE(query)) return "government";
  if (HISTORY_RE(query)) return "history";
  return "general";
}

/** Returns true when query should be routed to the general answer engine. */
export function isGeneralQuery(query: string): boolean {
  return (
    RENTAL_RE(query) ||
    LIFESTYLE_RE(query) ||
    TOURISM_RE(query) ||
    WEATHER_RE(query) ||
    GOVERNMENT_RE(query) ||
    HISTORY_RE(query) ||
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
  if (/\b(irbid)\b/i.test(query) || /إربد/.test(query)) return "Irbid";
  if (/\b(zarqa)\b/i.test(query) || /الزرقاء/.test(query)) return "Zarqa";
  if (/\b(aqaba)\b/i.test(query) || /العقبة/.test(query)) return "Aqaba";
  if (/\b(salt)\b/i.test(query) || /السلط/.test(query)) return "Salt";
  return "Amman";
}

const CITY_AR: Record<string, string> = {
  Amman: "عمان",
  Irbid: "إربد",
  Zarqa: "الزرقاء",
  Aqaba: "العقبة",
  Salt: "السلط",
};

// ── Jordan neighborhood reference data (used as grounding context for Claude) ─

const AMMAN_NEIGHBORHOODS: NeighborhoodCard[] = [
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
];

function filterByBudget(neighborhoods: NeighborhoodCard[], budget: number | null): NeighborhoodCard[] {
  if (!budget) return neighborhoods;
  return neighborhoods.filter((n) => n.avgRentMin <= budget).sort((a, b) => b.avgRentMin - a.avgRentMin);
}

// ── Claude-powered general answer ─────────────────────────────────────────────

async function callClaude(
  provider: AIProvider,
  query: string,
  history: ConvMessage[],
  intentType: GeneralIntentType,
  budget: number | null,
  city: string
): Promise<{ answer: string; cards: NeighborhoodCard[] | InfoCard[] }> {

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
  const refNeighborhoods = city === "Amman" ? AMMAN_NEIGHBORHOODS : null;
  const eligibleRef = refNeighborhoods
    ? (budget ? refNeighborhoods.filter((n) => n.avgRentMin <= budget) : refNeighborhoods)
    : null;
  const neighborhoodRefBlock = eligibleRef && eligibleRef.length > 0
    ? `\nVERIFIED ${city.toUpperCase()} NEIGHBORHOOD REFERENCE DATA (use these exact numbers):\n` +
      eligibleRef.map((n) =>
        `- ${n.name} (${n.nameAr}): ${n.avgRentMin}–${n.avgRentMax} JOD/month [${n.tier}] — ${n.characteristics.join(", ")}`
      ).join("\n")
    : "";

  const systemPrompt = isRental
    ? `You are ChatSouq, Jordan's expert AI assistant for real estate and neighborhoods.
${langNote}
${neighborhoodRefBlock}
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
    : `You are ChatSouq, Jordan's expert AI assistant with deep, specific knowledge of Jordan — its cities, culture, tourism, weather, government services, daily life, and economy.
${langNote}
${history.length > 0 ? "Use the conversation history for context and continuity — do not repeat what was already said." : ""}

Answer with depth and specificity. Avoid generic statements. Give practical, actionable, Jordan-specific information that a local expert would give.

Return ONLY valid JSON (no markdown fences):
{
  "answer": "3-5 sentences, detailed and specific to Jordan. Plain text, no markdown. Warm and informative tone.",
  "cards": [
    {
      "title": "Specific, descriptive title (not generic like 'Overview')",
      "body": "1-2 sentences with concrete, specific information",
      "icon": "one of: info|map|star|building|calendar|phone"
    }
  ]
}

Limit to 4 cards. Each card must add new, specific information — no repetition.`;

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

  if (provider.isMock) {
    // Deterministic fallback for when no API key is configured
    if (intentType === "rental" || intentType === "lifestyle") {
      const filtered = filterByBudget(AMMAN_NEIGHBORHOODS, budget);
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
    } else {
      answer = arabic
        ? `يمكن لـ ChatSouq الإجابة على الأسئلة العامة حول الأردن عند الاتصال بمحرك الذكاء الاصطناعي. جرّب السؤال عن منتج للشراء أو مكان لزيارته.`
        : `ChatSouq can answer general questions about Jordan when connected to its AI reasoning engine. Try asking about a product to buy or a place to visit instead.`;
    }
  } else {
    const result = await callClaude(provider, input.query, history, intentType, budget, city);
    answer = result.answer;
    cards = result.cards as NeighborhoodCard[] | InfoCard[];

    // If Claude returned no cards for rental, fall back to curated data
    if ((intentType === "rental" || intentType === "lifestyle") && (!cards || cards.length === 0)) {
      cards = filterByBudget(AMMAN_NEIGHBORHOODS, budget).slice(0, 6);
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
