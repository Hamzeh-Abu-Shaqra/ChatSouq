/**
 * Rich 7-dimension intent extraction for ChatSouq place queries.
 *
 * Extends the basic PlaceIntent with: budget, occasion, recipient, requirements,
 * urgency and inferred_signals — giving the ranking engine and LLM far more
 * context to work with than a flat keyword list.
 */

import type { PlaceIntent } from "./types";

// ── Re-export canonical neighborhood lists ──────────────────────────────────

/**
 * Maps any spelling / Arabic alias of an Amman neighbourhood to its canonical
 * display name. Used for DB-level `city` field matching and adjacency scoring.
 */
export const NEIGHBORHOOD_CANONICAL: Record<string, string> = {
  // Abdoun
  abdoun: "Abdoun",
  عبدون: "Abdoun",

  // Sweifieh
  sweifieh: "Sweifieh",
  sweifiyeh: "Sweifieh",
  sweifyeh: "Sweifieh",
  الصويفية: "Sweifieh",
  صويفية: "Sweifieh",

  // Shmeisani
  shmeisani: "Shmeisani",
  shmesani: "Shmeisani",
  شميساني: "Shmeisani",
  الشميساني: "Shmeisani",

  // Weibdeh / Luweibdeh
  weibdeh: "Weibdeh",
  luweibdeh: "Weibdeh",
  "jabal luweibdeh": "Weibdeh",
  اللويبدة: "Weibdeh",
  لويبدة: "Weibdeh",
  ويبدة: "Weibdeh",

  // Jabal Amman
  "jabal amman": "Jabal Amman",
  "جبل عمان": "Jabal Amman",

  // Jabal Hussein (distinct from Jabal Amman)
  "jabal hussein": "Jabal Hussein",
  "جبل الحسين": "Jabal Hussein",

  // Rainbow Street
  "rainbow street": "Rainbow Street",
  rainbow: "Rainbow Street",
  "شارع الرينبو": "Rainbow Street",

  // Downtown
  downtown: "Downtown Amman",
  "downtown amman": "Downtown Amman",
  "وسط البلد": "Downtown Amman",
  البلد: "Downtown Amman",
  "وسط عمان": "Downtown Amman",

  // Khalda
  khalda: "Khalda",
  خلدا: "Khalda",

  // Rabieh / Gardens area
  rabieh: "Rabieh",
  rabia: "Rabieh",
  "al rabieh": "Rabieh",
  الرابية: "Rabieh",
  رابية: "Rabieh",
  gardens: "Gardens",
  "al gardens": "Gardens",
  الحدائق: "Gardens",

  // Dabouq
  dabouq: "Dabouq",
  دابوق: "Dabouq",

  // Tlaa Ali
  "tla' ali": "Tlaa Ali",
  "tlaa ali": "Tlaa Ali",
  "تلاع العلي": "Tlaa Ali",

  // Deir Ghbar
  "deir ghbar": "Deir Ghbar",
  "دير غبار": "Deir Ghbar",

  // Um Uthaina
  "um uthaina": "Um Uthaina",
  "umm uthaina": "Um Uthaina",
  "um utheina": "Um Uthaina",
  "أم أذينة": "Um Uthaina",
  "ام اذينة": "Um Uthaina",

  // Jubeiha
  jubeiha: "Jubeiha",
  الجبيهة: "Jubeiha",
  جبيهة: "Jubeiha",

  // Wadi Seer
  "wadi seer": "Wadi Seer",
  "bayader wadi seer": "Wadi Seer",

  // Sweileh
  sweileh: "Sweileh",
  السويلح: "Sweileh",
  سويلح: "Sweileh",

  // Marj El Hamam
  "marj el hamam": "Marj El Hamam",

  // Circles — landmark refs that double as neighbourhood signals
  "1st circle": "1st Circle",
  "first circle": "1st Circle",
  "الدوار الأول": "1st Circle",
  "دوار الأول": "1st Circle",
  "2nd circle": "2nd Circle",
  "second circle": "2nd Circle",
  "الدوار الثاني": "2nd Circle",
  "3rd circle": "3rd Circle",
  "third circle": "3rd Circle",
  "الدوار الثالث": "3rd Circle",
  "4th circle": "4th Circle",
  "fourth circle": "4th Circle",
  "الدوار الرابع": "4th Circle",
  "5th circle": "5th Circle",
  "fifth circle": "5th Circle",
  "الدوار الخامس": "5th Circle",
  "6th circle": "6th Circle",
  "sixth circle": "6th Circle",
  "الدوار السادس": "6th Circle",
  "7th circle": "7th Circle",
  "seventh circle": "7th Circle",
  "الدوار السابع": "7th Circle",
  "8th circle": "8th Circle",
  "eighth circle": "8th Circle",
  "الدوار الثامن": "8th Circle",
};

/**
 * Adjacency map: which canonical neighbourhoods are considered "nearby".
 * Used to give partial location_fit credit (12/20) when exact match (20/20)
 * is not possible.
 */
export const NEIGHBORHOOD_ADJACENCY: Record<string, string[]> = {
  Abdoun: ["4th Circle", "Sweifieh", "Deir Ghbar", "Um Uthaina"],
  Sweifieh: ["Abdoun", "Khalda", "4th Circle", "5th Circle", "Um Uthaina"],
  Khalda: ["Sweifieh", "Tlaa Ali", "5th Circle"],
  "Tlaa Ali": ["Khalda", "Sweifieh", "5th Circle"],
  Shmeisani: ["Gardens", "Rabieh", "6th Circle"],
  Gardens: ["Shmeisani", "Rabieh", "6th Circle"],
  Rabieh: ["Shmeisani", "Gardens", "6th Circle"],
  Weibdeh: ["Jabal Amman", "Rainbow Street", "Downtown Amman", "2nd Circle"],
  "Jabal Amman": ["Weibdeh", "Rainbow Street", "2nd Circle", "3rd Circle"],
  "Rainbow Street": ["Weibdeh", "Jabal Amman", "3rd Circle"],
  "Downtown Amman": ["Weibdeh", "1st Circle", "Jabal Amman"],
  "1st Circle": ["Downtown Amman", "Jabal Amman", "2nd Circle"],
  "2nd Circle": ["1st Circle", "3rd Circle", "Weibdeh", "Jabal Amman"],
  "3rd Circle": ["2nd Circle", "4th Circle", "Jabal Amman", "Rainbow Street"],
  "4th Circle": ["3rd Circle", "5th Circle", "Abdoun", "Sweifieh"],
  "5th Circle": ["4th Circle", "6th Circle", "Sweifieh", "Khalda"],
  "6th Circle": ["5th Circle", "7th Circle", "Shmeisani", "Rabieh"],
  "7th Circle": ["6th Circle", "8th Circle", "Dabouq"],
  "8th Circle": ["7th Circle", "Dabouq"],
  "Deir Ghbar": ["Abdoun", "Sweifieh", "4th Circle"],
  "Um Uthaina": ["Sweifieh", "4th Circle", "Abdoun"],
  Dabouq: ["7th Circle", "8th Circle"],
  Jubeiha: ["Sweileh"],
  Sweileh: ["Jubeiha"],
  "Wadi Seer": [],
  "Marj El Hamam": [],
  "Jabal Hussein": ["Downtown Amman", "1st Circle"],
};

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface BudgetSignal {
  min: number | null;
  max: number | null;
  currency: "JOD";
  /** strict → hard limit; flexible → prefer within range; none → no preference */
  sensitivity: "strict" | "flexible" | "none";
  /** Inferred quality tier from budget level */
  tier: "budget" | "mid_range" | "upscale" | "luxury" | null;
}

export interface LocationSignal {
  /** Original text mention (e.g. "near weibdeh", "في عبدون") */
  raw: string | null;
  /** Canonical neighbourhood name (e.g. "Weibdeh", "Abdoun") */
  neighborhood: string | null;
  governorate: string | null;
  /** When true, user explicitly named a neighbourhood → hard location preference */
  explicit: boolean;
}

export interface OccasionSignal {
  type:
    | "romantic"
    | "birthday"
    | "business"
    | "family"
    | "anniversary"
    | "celebration"
    | "graduation"
    | "casual"
    | "none";
  formality: "formal" | "casual" | "intimate" | null;
  time_of_day: "morning" | "afternoon" | "evening" | "night" | null;
  day: "friday" | "weekend" | "weekday" | null;
}

export interface RecipientSignal {
  who: "solo" | "couple" | "family" | "friends" | "business" | "kids" | null;
  gender: "female" | "male" | null;
  interests: string[];
}

export interface RichPlaceIntent extends PlaceIntent {
  language: "en" | "ar" | "mixed";
  budget: BudgetSignal;
  location: LocationSignal;
  occasion: OccasionSignal;
  recipient: RecipientSignal;
  /** Detected feature requirements (e.g. ["outdoor_seating", "delivery"]) */
  requirements: string[];
  urgency: "now" | "today" | "tonight" | "this_weekend" | "soon" | null;
  /** High-level signals inferred from the combination of all dimensions */
  inferred_signals: string[];
}

// ── Utility ──────────────────────────────────────────────────────────────────

/** Normalise Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) → Western digits */
function normaliseDigits(s: string): string {
  return s.replace(/[٠١٢٣٤٥٦٧٨٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
}

/** True when string contains at least one Arabic character */
function containsArabic(s: string): boolean {
  return /[؀-ۿ]/.test(s);
}

// ── Budget extraction ────────────────────────────────────────────────────────

function parseBudget(q: string): Pick<BudgetSignal, "min" | "max" | "sensitivity"> {
  const text = normaliseDigits(q.toLowerCase());
  const num = (s: string | undefined) => Number((s ?? "").replace(/,/g, ""));

  // Arabic range: "بين X و Y"
  const arBetween = text.match(/بين\s+(\d[\d,]*)\s+(?:و|إلى|الى)\s+(\d[\d,]*)/);
  if (arBetween) return { min: num(arBetween[1]), max: num(arBetween[2]), sensitivity: "flexible" };

  // English range: "between X and Y"
  const between = text.match(/between\s+(\d[\d,]*)\s+(?:and|to|-)\s+(\d[\d,]*)/);
  if (between) return { min: num(between[1]), max: num(between[2]), sensitivity: "flexible" };

  // Hyphen range with currency: "30-50 JOD"
  const range = text.match(/(\d[\d,]*)\s*-\s*(\d[\d,]*)\s*(?:jod|jd|dinars?)?/);
  if (range && /(jod|jd|dinar|budget|price)/.test(text)) {
    return { min: num(range[1]), max: num(range[2]), sensitivity: "flexible" };
  }

  // "around/about X"
  const arAround = text.match(/(?:حول|تقريبا|تقريباً|ما يقارب|قريب من)\s+(\d[\d,]*)/);
  if (arAround) {
    const n = num(arAround[1]);
    return { min: Math.floor(n * 0.8), max: Math.ceil(n * 1.2), sensitivity: "flexible" };
  }
  const around = text.match(/(?:around|about|approximately|roughly|~|circa)\s+(\d[\d,]*)/);
  if (around) {
    const n = num(around[1]);
    return { min: Math.floor(n * 0.8), max: Math.ceil(n * 1.2), sensitivity: "flexible" };
  }

  // Arabic under: "أقل من X" / "تحت X"
  const arUnder = text.match(/(?:أقل من|اقل من|تحت|ما يتجاوز|بحدود|لحد)\s+(\d[\d,]*)/);
  if (arUnder) return { min: null, max: num(arUnder[1]), sensitivity: "strict" };

  // English under: "under/below/less than/max/up to"
  const under = text.match(/(?:under|below|less than|max|maximum|up to|within)\s+(\d[\d,]*)/);
  if (under) return { min: null, max: num(under[1]), sensitivity: "strict" };

  // Arabic over
  const arOver = text.match(/(?:أكثر من|اكثر من|فوق|ابتداء من)\s+(\d[\d,]*)/);
  if (arOver) return { min: num(arOver[1]), max: null, sensitivity: "flexible" };

  const over = text.match(/(?:over|above|more than|at least|from)\s+(\d[\d,]*)/);
  if (over) return { min: num(over[1]), max: null, sensitivity: "flexible" };

  // Bare "50 JOD" / "٥٠ دينار"
  const withCurrency = text.match(/(\d[\d,]*)\s*(?:jod|jd|dinars?|دينار|دنانير)/);
  if (withCurrency) return { min: null, max: num(withCurrency[1]), sensitivity: "strict" };

  // Qualitative: "affordable" / "cheap" / "رخيص"
  if (/\b(affordable|cheap|budget|inexpensive|value|رخيص|رخيصة|اقتصادي|سعر مناسب|بسعر مناسب)\b/i.test(q)) {
    return { min: null, max: 30, sensitivity: "flexible" };
  }
  if (/\b(luxury|high.?end|upscale|premium|fancy|فخم|فخمة|راقي|راقية)\b/i.test(q)) {
    return { min: 50, max: null, sensitivity: "flexible" };
  }

  return { min: null, max: null, sensitivity: "none" };
}

function inferBudgetTier(b: Pick<BudgetSignal, "min" | "max">): BudgetSignal["tier"] {
  const max = b.max;
  if (max === null && b.min === null) return null;
  if (max !== null && max <= 25) return "budget";
  if (max !== null && max <= 50) return "mid_range";
  if (max !== null && max <= 100) return "upscale";
  if (max !== null && max > 100) return "luxury";
  if (b.min !== null && b.min >= 100) return "luxury";
  if (b.min !== null && b.min >= 50) return "upscale";
  return "mid_range";
}

// ── Neighbourhood extraction ─────────────────────────────────────────────────

/** Returns the canonical neighbourhood name if the query mentions one. */
function detectNeighborhood(q: string): string | null {
  const lower = q.toLowerCase();
  // Check multi-word entries first (longer matches win)
  const entries = Object.entries(NEIGHBORHOOD_CANONICAL).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [alias, canonical] of entries) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pat = containsArabic(alias)
      ? new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`)
      : new RegExp(`\\b${escaped}\\b`, "i");
    if (pat.test(lower)) return canonical;
  }
  return null;
}

// ── Occasion extraction ──────────────────────────────────────────────────────

type OccasionType = OccasionSignal["type"];

const OCCASION_PATTERNS: Array<{ type: OccasionType; patterns: RegExp[] }> = [
  {
    type: "romantic",
    patterns: [
      /\b(romantic|date night|date|anniversary|valentine|candle.?lit|intimate)\b/i,
      /رومانسي|رومانسية|سهرة رومانسية|موعد غرامي|حبيبتي|حبيبي|ذكرى سنوية/,
    ],
  },
  {
    type: "birthday",
    patterns: [
      /\b(birthday|birth.?day)\b/i,
      /عيد الميلاد|عيد ميلاد|عيدك|عيدها|عيده|عيد ميلادي/,
    ],
  },
  {
    type: "anniversary",
    patterns: [
      /\b(anniversary|years together)\b/i,
      /ذكرى سنوية|ذكرى زواج|مناسبة سنوية/,
    ],
  },
  {
    type: "business",
    patterns: [
      /\b(business|meeting|work lunch|client|corporate|professional|colleagues)\b/i,
      /اجتماع|عمل|زبون|شغل|لانش بزنس|غداء عمل/,
    ],
  },
  {
    type: "family",
    patterns: [
      /\b(family|kids|children|parents|grandparents|family-friendly)\b/i,
      /عيلة|عائلة|أطفال|اولاد|ولاد|الاهل|مع العيلة|للعيلة/,
    ],
  },
  {
    type: "celebration",
    patterns: [
      /\b(celebration|celebrate|party|graduation|special occasion|eid)\b/i,
      /احتفال|حفلة|حفل|تخرج|عيد|العيد|فرح|مناسبة/,
    ],
  },
  {
    type: "graduation",
    patterns: [
      /\b(graduation|graduate|grad)\b/i,
      /تخرج|التخرج|تخرجي|تخرجها|تخرجه/,
    ],
  },
];

function detectOccasion(q: string): OccasionType {
  for (const { type, patterns } of OCCASION_PATTERNS) {
    if (patterns.some((p) => p.test(q))) return type;
  }
  return "none";
}

function detectFormality(q: string, occasion: OccasionType): OccasionSignal["formality"] {
  if (/\b(formal|upscale|fine.?dining|dress.?code|black.?tie)\b/i.test(q)) return "formal";
  if (/\b(casual|relaxed|laid.?back|chill|informal)\b/i.test(q)) return "casual";
  if (/\b(intimate|cozy|cosy|quiet|romantic|private)\b/i.test(q)) return "intimate";
  if (occasion === "romantic" || occasion === "anniversary") return "intimate";
  if (occasion === "business") return "formal";
  return null;
}

function detectTimeOfDay(q: string): OccasionSignal["time_of_day"] {
  if (/\b(morning|breakfast|brunch|صباح|فطور|صبح)\b/i.test(q)) return "morning";
  if (/\b(lunch|afternoon|noon|غداء|ظهر)\b/i.test(q)) return "afternoon";
  if (/\b(dinner|evening|night|tonight|سهرة|عشاء|مساء|الليل|ليلة)\b/i.test(q)) return "evening";
  // "late night"
  if (/\b(late.?night|midnight|بعد منتصف الليل)\b/i.test(q)) return "night";
  return null;
}

function detectDay(q: string): OccasionSignal["day"] {
  if (/\b(friday|يوم الجمعة|الجمعة|جمعة)\b/i.test(q)) return "friday";
  if (/\b(weekend|saturday|الويك.?اند|السبت|الأحد)\b/i.test(q)) return "weekend";
  if (/\b(weekday|weekdays|أيام الأسبوع)\b/i.test(q)) return "weekday";
  return null;
}

// ── Recipient extraction ─────────────────────────────────────────────────────

type RecipientWho = RecipientSignal["who"];

function detectRecipient(q: string): RecipientWho {
  // Solo / single
  if (/\b(alone|by myself|solo|لوحدي|وحدي|منفرد)\b/i.test(q)) return "solo";
  // Kids / family
  if (/\b(kids|children|child|toddler|baby|أطفال|اولاد|ولاد|عيال|رضيع|طفل)\b/i.test(q)) return "kids";
  // Couple / date
  if (/\b(date|couple|two of us|partner|girlfriend|boyfriend|wife|husband|spouse|زوجتي|زوجي|حبيبتي|حبيبي|شريكي)\b/i.test(q)) return "couple";
  // Family
  if (/\b(family|parents|مع العيلة|للعيلة|الاهل|عائلة|عيلة)\b/i.test(q)) return "family";
  // Business
  if (/\b(business|client|colleagues|clients|team|coworkers|colleagues|زبون|زبائن|شغل|فريق)\b/i.test(q)) return "business";
  // Friends
  if (/\b(friends|crew|group|gang|أصحاب|صحاب|رفقة|شلة)\b/i.test(q)) return "friends";
  return null;
}

function detectGender(q: string): RecipientSignal["gender"] {
  if (/\b(ladies|women|female|girls|للنساء|للبنات|حريم|نساء|بنات|لادي)\b/i.test(q)) return "female";
  if (/\b(men only|gentlemen|للرجال|رجال)\b/i.test(q)) return "male";
  return null;
}

// ── Requirements extraction ──────────────────────────────────────────────────

const REQUIREMENT_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  {
    id: "outdoor_seating",
    pattern:
      /\b(outdoor|outside|open.?air|terrace|rooftop|roof.?top|garden.?seating|outdoor.?seating|alfresco|balcony)\b|روفتوب|تراس|خارجي|حديقة|في الخارج/i,
  },
  {
    id: "delivery",
    pattern: /\b(delivery|deliver|order online|home delivery)\b|توصيل|توصل|دليفري/i,
  },
  {
    id: "pool",
    pattern: /\b(pool|swimming|swim|حمام سباحة|مسبح)\b/i,
  },
  {
    id: "ladies_only",
    pattern:
      /\b(ladies only|women only|female only|ladies section|ladies room|ladies floor)\b|قسم حريم|قسم نساء|للنساء فقط|بنات فقط|لادي/i,
  },
  {
    id: "parking",
    pattern: /\b(parking|car park|valet)\b|مواقف|باركينج|موقف سيارات|فاليه/i,
  },
  {
    id: "wifi",
    pattern: /\b(wifi|wi-fi|internet|free wifi)\b|واي فاي|إنترنت/i,
  },
  {
    id: "private_room",
    pattern:
      /\b(private room|private area|private dining|private section|semi.?private)\b|غرفة خاصة|جلسة خاصة|قسم خاص|حجرة خاصة/i,
  },
  {
    id: "reservation",
    pattern: /\b(reservation|reserve|book ahead|booking|table booking)\b|حجز|احجز|حجز مسبق/i,
  },
  {
    id: "open_friday",
    pattern: /\b(open on friday|open friday|open weekends|open.?24|يوم الجمعة مفتوح)\b|مفتوح الجمعة|مفتوح الويكند/i,
  },
  {
    id: "late_night",
    pattern: /\b(late night|open late|24.?hours|24\/7|night owl)\b|سهر|ليلة|يسهر|مفتوح ليلاً|طول الليل/i,
  },
  {
    id: "takeaway",
    pattern: /\b(takeaway|take.?away|takeout|take.?out|to.?go|carry.?out)\b|سفري|تيك اواي|تيكاواي/i,
  },
];

function detectRequirements(q: string): string[] {
  return REQUIREMENT_PATTERNS.filter(({ pattern }) => pattern.test(q)).map(({ id }) => id);
}

// ── Urgency extraction ───────────────────────────────────────────────────────

type Urgency = RichPlaceIntent["urgency"];

function detectUrgency(q: string): Urgency {
  if (/\b(right now|open now|الحين|الآن|الان|هلق|هلأ|هلا|now)\b/i.test(q)) return "now";
  if (/\b(tonight|this evening|الليلة|هالليلة|الليل)\b/i.test(q)) return "tonight";
  if (/\b(today|اليوم|هاليوم|هذا اليوم)\b/i.test(q)) return "today";
  if (/\b(this friday|this weekend|the weekend|هالجمعة|هالويكند|الجمعة|الويك.?اند)\b/i.test(q)) return "this_weekend";
  if (/\b(soon|قريب|قريباً|في القريب العاجل)\b/i.test(q)) return "soon";
  return null;
}

// ── Language detection ───────────────────────────────────────────────────────

function detectLanguage(q: string): "en" | "ar" | "mixed" {
  const hasAr = /[؀-ۿ]/.test(q);
  const hasEn = /[a-zA-Z]{3,}/.test(q);
  if (hasAr && hasEn) return "mixed";
  if (hasAr) return "ar";
  return "en";
}

// ── Inferred signals ─────────────────────────────────────────────────────────

function buildInferredSignals(
  intent: Omit<RichPlaceIntent, "inferred_signals">
): string[] {
  const signals: string[] = [];

  // Budget tier signals
  if (intent.budget.tier === "budget") signals.push("budget_conscious");
  if (intent.budget.tier === "upscale" || intent.budget.tier === "luxury") signals.push("upscale_preference");
  if (intent.budget.tier === "luxury") signals.push("luxury_preference");

  // Location zone signals
  const westAmmanNeighborhoods = new Set([
    "Abdoun", "Sweifieh", "Weibdeh", "Shmeisani", "Rabieh", "Gardens",
    "Khalda", "Dabouq", "Tlaa Ali", "Deir Ghbar", "Um Uthaina",
    "4th Circle", "5th Circle", "6th Circle", "7th Circle", "Rainbow Street",
  ]);
  const eastAmmanNeighborhoods = new Set([
    "Downtown Amman", "1st Circle", "2nd Circle", "Jabal Hussein",
    "Jubeiha", "Sweileh", "Wadi Seer", "Marj El Hamam",
  ]);
  if (intent.location.neighborhood) {
    if (westAmmanNeighborhoods.has(intent.location.neighborhood)) signals.push("west_amman");
    if (eastAmmanNeighborhoods.has(intent.location.neighborhood)) signals.push("east_amman");
  }

  // Occasion signals
  if (intent.occasion.type === "romantic" || intent.occasion.type === "anniversary") {
    signals.push("romantic_occasion");
  }
  if (intent.occasion.type === "birthday" || intent.occasion.type === "celebration") {
    signals.push("celebratory_occasion");
  }
  if (intent.occasion.type === "business") signals.push("business_setting");

  // Recipient signals
  if (intent.recipient.who === "kids" || intent.recipient.who === "family") {
    signals.push("family_friendly");
  }
  if (intent.recipient.gender === "female") signals.push("ladies_friendly");

  // Time signals
  if (intent.occasion.time_of_day === "evening" || intent.occasion.time_of_day === "night") {
    signals.push("evening_venue");
  }
  if (intent.urgency === "now" || intent.urgency === "tonight") {
    signals.push("open_now");
  }

  // Feature signals
  if (intent.requirements.includes("outdoor_seating")) signals.push("has_outdoor");
  if (intent.requirements.includes("delivery")) signals.push("offers_delivery");
  if (intent.requirements.includes("pool")) signals.push("has_pool");

  return signals;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Extract a rich 7-dimension intent from a place query.
 *
 * Builds on top of the basic `PlaceIntent` fields (categories, keywords,
 * governorate, district) and adds budget, occasion, recipient, requirements,
 * urgency, and inferred signals.
 *
 * @param base - The basic PlaceIntent already parsed by `parsePlaceIntent()`
 * @param rawQuery - The original query string
 */
export function extractRichIntent(
  base: PlaceIntent,
  rawQuery: string
): RichPlaceIntent {
  const q = rawQuery;

  const language = detectLanguage(q);

  // Budget
  const { min, max, sensitivity } = parseBudget(q);
  const budget: BudgetSignal = {
    min,
    max,
    currency: "JOD",
    sensitivity,
    tier: inferBudgetTier({ min, max }),
  };

  // Location
  const neighborhood = detectNeighborhood(q);
  const location: LocationSignal = {
    raw: neighborhood ? neighborhood.toLowerCase() : null,
    neighborhood,
    governorate: base.governorate,
    explicit: neighborhood !== null,
  };

  // Occasion
  const occasionType = detectOccasion(q);
  const occasion: OccasionSignal = {
    type: occasionType,
    formality: detectFormality(q, occasionType),
    time_of_day: detectTimeOfDay(q),
    day: detectDay(q),
  };

  // Recipient
  const recipient: RecipientSignal = {
    who: detectRecipient(q),
    gender: detectGender(q),
    interests: [],
  };

  // Requirements
  const requirements = detectRequirements(q);

  // Urgency
  const urgency = detectUrgency(q);

  // Assemble partial intent for signal inference
  const partial = {
    ...base,
    language,
    budget,
    location,
    occasion,
    recipient,
    requirements,
    urgency,
  };

  const inferred_signals = buildInferredSignals(partial);

  return {
    ...partial,
    inferred_signals,
  };
}
