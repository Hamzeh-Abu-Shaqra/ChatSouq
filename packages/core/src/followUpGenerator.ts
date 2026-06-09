/**
 * Deterministic follow-up prompt generator for ChatSouq place responses.
 *
 * Produces 4 contextual follow-up queries from the 8 canonical types without
 * requiring an LLM — used as a fallback when the LLM call fails or is mocked,
 * and to validate / augment LLM-generated follow-ups.
 *
 * Types
 * ─────
 *   REFINE    — add a feature/requirement not already in the query
 *   NARROW    — tighten budget or rating threshold
 *   COMPARE   — compare top results head-to-head
 *   ADJACENT  — explore a related category in the same location
 *   BOOK      — reservation / contact / logistics question
 *   OCCASION  — same category but for a different occasion
 *   CATEGORY  — pivot to a nearby category the user might also want
 *   TIME      — time/day/opening-hours variant
 */

import type { RichPlaceIntent } from "./placeIntent";

// ── Types ────────────────────────────────────────────────────────────────────

export type FollowUpType =
  | "REFINE"
  | "NARROW"
  | "COMPARE"
  | "ADJACENT"
  | "BOOK"
  | "OCCASION"
  | "CATEGORY"
  | "TIME";

export interface FollowUpCandidate {
  type: FollowUpType;
  prompt: string;
  /** Higher = more relevant given this specific intent (0–10). */
  priority: number;
}

// ── Adjacent category map ─────────────────────────────────────────────────────

const ADJACENT: Record<string, { en: string; ar: string }[]> = {
  restaurant:   [{ en: "cafes",            ar: "كافيهات"       }, { en: "rooftop bars",     ar: "روفتوب بارز"     }, { en: "dessert shops",    ar: "محلات حلويات"   }],
  cafe:         [{ en: "restaurants",      ar: "مطاعم"          }, { en: "bakeries",         ar: "مخابز"           }, { en: "co-working spaces",ar: "مساحات عمل"      }],
  "coffee shop":[{ en: "cafes",            ar: "كافيهات"       }, { en: "bakeries",         ar: "مخابز"           }, { en: "restaurants",      ar: "مطاعم"          }],
  gym:          [{ en: "spas",             ar: "سبا"            }, { en: "swimming pools",   ar: "مسابح"           }, { en: "yoga studios",     ar: "استوديوهات يوغا"}],
  salon:        [{ en: "spas",             ar: "سبا"            }, { en: "nail bars",        ar: "نايل بارز"       }, { en: "beauty centers",   ar: "مراكز تجميل"    }],
  spa:          [{ en: "gyms",             ar: "جيمات"          }, { en: "salons",           ar: "صالونات"         }, { en: "massage centers",  ar: "مراكز مساج"     }],
  hotel:        [{ en: "restaurants",      ar: "مطاعم"          }, { en: "spas",             ar: "سبا"             }, { en: "cafes",            ar: "كافيهات"        }],
  "fast food":  [{ en: "restaurants",      ar: "مطاعم"          }, { en: "dessert shops",    ar: "محلات حلويات"   }, { en: "cafes",            ar: "كافيهات"        }],
  bakery:       [{ en: "cafes",            ar: "كافيهات"       }, { en: "dessert shops",    ar: "محلات حلويات"   }, { en: "restaurants",      ar: "مطاعم"          }],
  dessert:      [{ en: "cafes",            ar: "كافيهات"       }, { en: "bakeries",         ar: "مخابز"           }, { en: "restaurants",      ar: "مطاعم"          }],
  cinema:       [{ en: "restaurants",      ar: "مطاعم"          }, { en: "cafes",            ar: "كافيهات"        }, { en: "shopping malls",   ar: "مولات"          }],
  pharmacy:     [{ en: "clinics",          ar: "عيادات"         }, { en: "hospitals",        ar: "مستشفيات"       }],
  clinic:       [{ en: "pharmacies",       ar: "صيدليات"        }, { en: "hospitals",        ar: "مستشفيات"       }],
  hospital:     [{ en: "pharmacies",       ar: "صيدليات"        }, { en: "clinics",          ar: "عيادات"         }],
  "shopping mall":[{ en: "restaurants",    ar: "مطاعم"          }, { en: "cafes",            ar: "كافيهات"        }, { en: "cinemas",          ar: "سينمات"         }],
  bar:          [{ en: "restaurants",      ar: "مطاعم"          }, { en: "rooftop cafes",    ar: "كافيهات روفتوب" }],
  park:         [{ en: "cafes",            ar: "كافيهات"       }, { en: "restaurants",      ar: "مطاعم"          }],
};

function getAdjacent(
  categories: string[],
  lang: "en" | "ar" | "mixed"
): string | null {
  for (const cat of categories) {
    const key = cat.toLowerCase();
    const opts = ADJACENT[key];
    if (opts?.length) {
      const picked = opts[0]!;
      return lang === "ar" ? picked.ar : picked.en;
    }
  }
  return null;
}

// ── Refinement options ────────────────────────────────────────────────────────

interface Refinement {
  req:  string;
  en:   string;
  ar:   string;
  /** Category keys this refinement is most relevant for. Empty = all. */
  cats: string[];
}

const REFINEMENTS: Refinement[] = [
  { req: "outdoor_seating", en: "outdoor seating",  ar: "جلوس خارجي",    cats: ["restaurant","cafe","coffee shop","bar"] },
  { req: "private_room",    en: "private dining",   ar: "غرفة خاصة",     cats: ["restaurant","cafe"] },
  { req: "delivery",        en: "delivery",         ar: "توصيل",          cats: ["restaurant","cafe","fast food","bakery","dessert"] },
  { req: "parking",         en: "free parking",     ar: "مواقف مجانية",  cats: [] },
  { req: "wifi",            en: "WiFi",             ar: "واي فاي",        cats: ["cafe","coffee shop","restaurant"] },
  { req: "pool",            en: "a pool",           ar: "مسبح",           cats: ["gym","hotel","spa"] },
  { req: "ladies_only",     en: "a ladies section", ar: "قسم نساء",       cats: ["salon","spa","gym","restaurant"] },
  { req: "late_night",      en: "late-night opening",ar: "دوام ليلي",     cats: ["restaurant","cafe","bar"] },
  { req: "reservation",     en: "online booking",   ar: "حجز أونلاين",   cats: ["restaurant","hotel"] },
];

function pickRefinement(
  intent: RichPlaceIntent
): Refinement | null {
  const cats = intent.categories.map((c) => c.toLowerCase());
  const existing = new Set(intent.requirements);

  // Prefer category-specific refinements first
  const categorySpecific = REFINEMENTS.filter(
    (r) => !existing.has(r.req) && r.cats.some((c) => cats.includes(c))
  );
  if (categorySpecific.length > 0) return categorySpecific[0]!;

  // Fall back to generic ones
  return REFINEMENTS.find((r) => !existing.has(r.req)) ?? null;
}

// ── Occasion labels ────────────────────────────────────────────────────────────

const OCCASION_LABELS: Record<string, { en: string; ar: string }> = {
  romantic:    { en: "a romantic dinner",    ar: "عشاء رومانسي"      },
  birthday:    { en: "a birthday dinner",    ar: "عشاء عيد ميلاد"   },
  anniversary: { en: "an anniversary",       ar: "ذكرى سنوية"        },
  business:    { en: "a business lunch",     ar: "غداء عمل"          },
  family:      { en: "a family outing",      ar: "تجمع عائلي"        },
  celebration: { en: "a celebration",        ar: "احتفال"            },
  graduation:  { en: "a graduation dinner",  ar: "عشاء تخرج"         },
  casual:      { en: "a casual catch-up",    ar: "لقاء غير رسمي"     },
  none:        { en: "a date night",         ar: "سهرة"              },
};

/** Pick an occasion the user did NOT already specify. */
function pickAlternativeOccasion(
  intent: RichPlaceIntent
): { en: string; ar: string } | null {
  const current = intent.occasion.type;
  const order: Array<keyof typeof OCCASION_LABELS> = [
    "romantic", "birthday", "family", "business", "celebration", "graduation", "casual",
  ];
  const alt = order.find((o) => o !== current);
  return alt ? (OCCASION_LABELS[alt] ?? null) : null;
}

// ── Category display name ─────────────────────────────────────────────────────

function categoryLabel(
  intent: RichPlaceIntent,
  lang: "en" | "ar" | "mixed"
): string {
  const cat = intent.categories[0];
  if (!cat) return lang === "ar" ? "أماكن" : "places";
  if (lang !== "ar") return cat.toLowerCase() + "s";
  // Simple Arabic plural heuristic — use the raw category name
  return cat;
}

// ── Location label ────────────────────────────────────────────────────────────

function locationLabel(intent: RichPlaceIntent, lang: "en" | "ar" | "mixed"): string {
  const loc = intent.location.neighborhood ?? intent.governorate;
  if (!loc) return lang === "ar" ? "عمان" : "Amman";
  return loc;
}

// ── Individual generators ────────────────────────────────────────────────────

function genRefine(intent: RichPlaceIntent, lang: "en" | "ar" | "mixed"): FollowUpCandidate | null {
  const r = pickRefinement(intent);
  if (!r) return null;
  const loc = locationLabel(intent, lang);
  const cat = categoryLabel(intent, lang);
  if (lang === "ar") {
    return {
      type: "REFINE",
      prompt: `نفس البحث لكن مع ${r.ar} في ${loc}`,
      priority: 7,
    };
  }
  return {
    type: "REFINE",
    prompt: `${cat.charAt(0).toUpperCase() + cat.slice(1)} in ${loc} with ${r.en}`,
    priority: 7,
  };
}

function genNarrow(intent: RichPlaceIntent, lang: "en" | "ar" | "mixed"): FollowUpCandidate | null {
  const loc = locationLabel(intent, lang);
  const cat = categoryLabel(intent, lang);

  // Budget-based narrowing
  if (intent.budget.max === null && intent.budget.min === null) {
    // No budget stated — suggest an affordable option
    if (lang === "ar") {
      return {
        type: "NARROW",
        prompt: `نفس ${cat} في ${loc} تحت ٣٠ دينار`,
        priority: 6,
      };
    }
    return {
      type: "NARROW",
      prompt: `Budget-friendly ${cat} in ${loc} under 30 JOD`,
      priority: 6,
    };
  }

  // Rating-based narrowing (always useful)
  if (lang === "ar") {
    return {
      type: "NARROW",
      prompt: `نفس ${cat} في ${loc} بتقييم ٤.٥ فأكثر`,
      priority: 5,
    };
  }
  return {
    type: "NARROW",
    prompt: `Top-rated ${cat} in ${loc} — 4.5 stars and above`,
    priority: 5,
  };
}

function genCompare(
  intent: RichPlaceIntent,
  lang: "en" | "ar" | "mixed",
  topResultName?: string
): FollowUpCandidate | null {
  const loc = locationLabel(intent, lang);
  const cat = categoryLabel(intent, lang);
  if (topResultName) {
    if (lang === "ar") {
      return {
        type: "COMPARE",
        prompt: `مقارنة ${topResultName} مع بدائل في ${loc}`,
        priority: 8,
      };
    }
    return {
      type: "COMPARE",
      prompt: `How does ${topResultName} compare to the alternatives?`,
      priority: 8,
    };
  }
  if (lang === "ar") {
    return {
      type: "COMPARE",
      prompt: `مقارنة أفضل ${cat} في ${loc}`,
      priority: 5,
    };
  }
  return {
    type: "COMPARE",
    prompt: `Compare the top ${cat} in ${loc}`,
    priority: 5,
  };
}

function genAdjacent(intent: RichPlaceIntent, lang: "en" | "ar" | "mixed"): FollowUpCandidate | null {
  const adj = getAdjacent(intent.categories, lang);
  if (!adj) return null;
  const loc = locationLabel(intent, lang);
  if (lang === "ar") {
    return {
      type: "ADJACENT",
      prompt: `${adj} في ${loc}`,
      priority: 6,
    };
  }
  // Capitalise first letter
  const label = adj.charAt(0).toUpperCase() + adj.slice(1);
  return {
    type: "ADJACENT",
    prompt: `${label} near ${loc}`,
    priority: 6,
  };
}

function genBook(
  intent: RichPlaceIntent,
  lang: "en" | "ar" | "mixed",
  topResultName?: string
): FollowUpCandidate | null {
  // Only relevant for bookable categories
  const bookable = ["restaurant", "cafe", "hotel", "spa", "gym", "salon", "coffee shop"];
  const isBookable = intent.categories.some((c) =>
    bookable.includes(c.toLowerCase())
  ) || intent.categories.length === 0;
  if (!isBookable) return null;

  if (topResultName) {
    if (lang === "ar") {
      return {
        type: "BOOK",
        prompt: `كيف أحجز طاولة في ${topResultName}؟`,
        priority: 7,
      };
    }
    return {
      type: "BOOK",
      prompt: `How do I make a reservation at ${topResultName}?`,
      priority: 7,
    };
  }
  const cat = categoryLabel(intent, lang);
  const loc = locationLabel(intent, lang);
  if (lang === "ar") {
    return {
      type: "BOOK",
      prompt: `هل يحتاج الحجز المسبق في ${cat} بـ${loc}؟`,
      priority: 5,
    };
  }
  return {
    type: "BOOK",
    prompt: `Do ${cat} in ${loc} require reservations?`,
    priority: 5,
  };
}

function genOccasion(intent: RichPlaceIntent, lang: "en" | "ar" | "mixed"): FollowUpCandidate | null {
  const alt = pickAlternativeOccasion(intent);
  if (!alt) return null;
  const loc = locationLabel(intent, lang);
  const cat = categoryLabel(intent, lang);
  const occasionLabel = lang === "ar" ? alt.ar : alt.en;
  if (lang === "ar") {
    return {
      type: "OCCASION",
      prompt: `${cat} في ${loc} مناسبة لـ${occasionLabel}`,
      priority: intent.occasion.type === "none" ? 8 : 5,
    };
  }
  return {
    type: "OCCASION",
    prompt: `Best ${cat} in ${loc} for ${occasionLabel}`,
    priority: intent.occasion.type === "none" ? 8 : 5,
  };
}

function genCategory(intent: RichPlaceIntent, lang: "en" | "ar" | "mixed"): FollowUpCandidate | null {
  // Suggest a useful complementary category based on context
  const loc = locationLabel(intent, lang);
  const hasCat = intent.categories.length > 0;

  if (!hasCat) {
    if (lang === "ar") {
      return { type: "CATEGORY", prompt: `مطاعم في ${loc}`, priority: 4 };
    }
    return { type: "CATEGORY", prompt: `Restaurants in ${loc}`, priority: 4 };
  }

  // For food/drink → suggest cafes as a daytime alternative
  const cat = intent.categories[0]!.toLowerCase();
  if (["restaurant", "fast food", "bakery", "dessert"].includes(cat)) {
    if (lang === "ar") {
      return { type: "CATEGORY", prompt: `كافيهات في ${loc}`, priority: 5 };
    }
    return { type: "CATEGORY", prompt: `Cafes in ${loc}`, priority: 5 };
  }
  if (cat === "gym") {
    if (lang === "ar") {
      return { type: "CATEGORY", prompt: `سبا ومراكز تدليك في ${loc}`, priority: 5 };
    }
    return { type: "CATEGORY", prompt: `Spas and wellness centers in ${loc}`, priority: 5 };
  }
  if (cat === "cafe" || cat === "coffee shop") {
    if (lang === "ar") {
      return { type: "CATEGORY", prompt: `مطاعم غداء في ${loc}`, priority: 5 };
    }
    return { type: "CATEGORY", prompt: `Lunch restaurants in ${loc}`, priority: 5 };
  }
  if (cat === "salon") {
    if (lang === "ar") {
      return { type: "CATEGORY", prompt: `سبا للسيدات في ${loc}`, priority: 5 };
    }
    return { type: "CATEGORY", prompt: `Ladies spas in ${loc}`, priority: 5 };
  }
  // Generic fallback — suggest exploring the whole neighbourhood
  if (lang === "ar") {
    return { type: "CATEGORY", prompt: `أفضل أماكن في ${loc}`, priority: 4 };
  }
  return { type: "CATEGORY", prompt: `Best places to visit in ${loc}`, priority: 4 };
}

function genTime(intent: RichPlaceIntent, lang: "en" | "ar" | "mixed"): FollowUpCandidate | null {
  const loc = locationLabel(intent, lang);
  const cat = categoryLabel(intent, lang);

  // If urgency is already "now" or "tonight", suggest a weekend variant
  if (intent.urgency === "now" || intent.urgency === "tonight") {
    if (lang === "ar") {
      return { type: "TIME", prompt: `${cat} في ${loc} مفتوح الجمعة`, priority: 6 };
    }
    return { type: "TIME", prompt: `${cat.charAt(0).toUpperCase() + cat.slice(1)} in ${loc} open on Friday`, priority: 6 };
  }

  // Suggest "open now" if not already asked
  if (!intent.urgency) {
    if (lang === "ar") {
      return { type: "TIME", prompt: `${cat} في ${loc} مفتوح الآن`, priority: 7 };
    }
    return { type: "TIME", prompt: `${cat.charAt(0).toUpperCase() + cat.slice(1)} in ${loc} open right now`, priority: 7 };
  }

  // Friday lunch is universally relevant in Amman
  if (lang === "ar") {
    return { type: "TIME", prompt: `أفضل ${cat} في ${loc} لغداء الجمعة`, priority: 6 };
  }
  return { type: "TIME", prompt: `Best ${cat} in ${loc} for Friday lunch`, priority: 6 };
}

// ── Priority boosts based on context ─────────────────────────────────────────

function boostPriority(candidate: FollowUpCandidate, intent: RichPlaceIntent): number {
  let p = candidate.priority;
  switch (candidate.type) {
    case "REFINE":
      // Higher when user has already started narrowing (they're in refinement mode)
      if (intent.requirements.length > 0) p += 2;
      break;
    case "NARROW":
      // Higher when no budget was given — they might want to constrain
      if (intent.budget.sensitivity === "none") p += 2;
      break;
    case "COMPARE":
      // Higher when there are likely multiple good options (no very specific occasion)
      if (intent.occasion.type === "none") p += 1;
      break;
    case "BOOK":
      // Higher for evening/romantic occasions where reservations matter
      if (
        intent.occasion.type === "romantic" ||
        intent.occasion.type === "anniversary" ||
        intent.occasion.time_of_day === "evening"
      ) p += 2;
      break;
    case "OCCASION":
      // Higher when no occasion was specified — helps discover use cases
      if (intent.occasion.type === "none") p += 2;
      break;
    case "TIME":
      // Higher for urgent queries
      if (intent.urgency) p += 1;
      break;
    case "ADJACENT":
    case "CATEGORY":
      // Slightly lower — these change the subject
      p -= 1;
      break;
  }
  return Math.max(0, Math.min(10, p));
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate 4 contextual follow-up prompts from a rich place intent.
 *
 * @param intent - The full RichPlaceIntent for this query
 * @param topResultName - Optional name of the #1 ranked place (makes COMPARE/BOOK more specific)
 * @param count - How many prompts to return (default 4)
 */
export function generateFollowUps(
  intent: RichPlaceIntent,
  topResultName?: string,
  count: number = 4
): string[] {
  const lang = intent.language;

  // Generate one candidate per type
  const candidates: (FollowUpCandidate | null)[] = [
    genRefine(intent, lang),
    genNarrow(intent, lang),
    genCompare(intent, lang, topResultName),
    genAdjacent(intent, lang),
    genBook(intent, lang, topResultName),
    genOccasion(intent, lang),
    genCategory(intent, lang),
    genTime(intent, lang),
  ];

  // Filter nulls, apply context boosts, sort by priority desc
  const ranked = candidates
    .filter((c): c is FollowUpCandidate => c !== null)
    .map((c) => ({ ...c, priority: boostPriority(c, intent) }))
    .sort((a, b) => b.priority - a.priority);

  // Deduplicate by type (already guaranteed since one per type) and by prompt
  const seen = new Set<string>();
  const results: string[] = [];
  for (const c of ranked) {
    const key = c.prompt.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      results.push(c.prompt);
    }
    if (results.length >= count) break;
  }

  return results;
}
