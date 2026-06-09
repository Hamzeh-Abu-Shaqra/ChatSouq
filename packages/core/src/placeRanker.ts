/**
 * Multi-dimensional place ranker for ChatSouq.
 *
 * Scores each PlaceCandidate on 5 dimensions that total 100 points:
 *   relevance       0–30  (semantic + keyword + category match)
 *   location_fit    0–20  (exact neighbourhood → adjacent → city zone → anywhere)
 *   rating_quality  0–15  (Google Maps / Talabat stars + review count proxy)
 *   occasion_fit    0–10  (search_text signals vs. detected occasion)
 *   completeness    0–15  (actionable data: phone, address, website, hours)
 *   budget_fit      0–10  (quality-tier alignment with stated budget)
 *
 * The scoring replaces the old flat-weight formula in places.ts and gives the
 * ranking engine far more discrimination power, especially for neighbourhood-
 * and occasion-specific queries.
 */

import type { PlaceCandidate } from "./types";
import type { RichPlaceIntent } from "./placeIntent";
import { NEIGHBORHOOD_CANONICAL, NEIGHBORHOOD_ADJACENCY } from "./placeIntent";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PlaceScore {
  relevance:      number;  // 0–30
  location_fit:   number;  // 0–20
  rating_quality: number;  // 0–15
  occasion_fit:   number;  // 0–10
  completeness:   number;  // 0–15
  budget_fit:     number;  // 0–10
  total:          number;  // 0–100
}

export interface ScoredPlace extends PlaceCandidate {
  score:       number;      // total 0–100
  components:  PlaceScore;
  keywordHits: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * MiniLM cosine rescaled so [0.10, 0.70] → [0, 1].
 * Wider band than the old [0.15, 0.65] — prevents good matches from
 * all collapsing to 1.0 and losing discrimination within the top pool.
 */
function rescaleVec(cos: number): number {
  return Math.max(0, Math.min(1, (cos - 0.10) / 0.60));
}

/** Keyword hit ratio with non-linear power penalty for partial matches. */
function keywordRatio(c: PlaceCandidate, keywords: string[]): { ratio: number; hits: number } {
  if (!keywords.length) return { ratio: 0, hits: 0 };
  const hay = ((c.searchText ?? "") + " " + c.name + " " + (c.address ?? "")).toLowerCase();
  let hits = 0;
  for (const k of keywords) if (hay.includes(k.toLowerCase())) hits++;
  const raw = hits / keywords.length;
  const boosted = keywords.length <= 1 ? raw : Math.pow(raw, 1.4);
  return { ratio: boosted, hits };
}

// ── Dimension scorers ─────────────────────────────────────────────────────────

/** relevance: 0–30 */
function scoreRelevance(
  c: PlaceCandidate,
  intent: RichPlaceIntent,
  kwRatio: number
): number {
  // Semantic similarity (max 12)
  const vecPart = rescaleVec(c.vecSim) * 12;

  // Keyword hit ratio (max 12)
  const kwPart = kwRatio * 12;

  // Category match (max 6)
  const wantedCats = new Set(intent.categories.map((x) => x.toLowerCase()));
  let catPart = 0;
  if (wantedCats.size > 0) {
    const cCat = c.category.toLowerCase();
    if (wantedCats.has(cCat)) {
      catPart = 6;
    } else if (c.subcategory && wantedCats.has(c.subcategory.toLowerCase())) {
      catPart = 4;
    } else {
      // Partial category match — at least the broad umbrella
      for (const wc of wantedCats) {
        if (cCat.includes(wc) || wc.includes(cCat)) { catPart = 2; break; }
      }
    }
  }

  return Math.min(30, vecPart + kwPart + catPart);
}

/** Normalize any neighbourhood alias to its canonical form (lower-cased lookup). */
function canonicalize(name: string | null): string | null {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  return NEIGHBORHOOD_CANONICAL[lower] ?? name;
}

// Generic city values that carry no neighbourhood signal
const GENERIC_CITIES = new Set(["amman", "jordan", "الأردن", "عمّان", "عمان"]);

/**
 * Scan address + searchText for a canonical neighbourhood name.
 * Used as a fallback when c.city is a generic value like "Amman".
 */
function neighborhoodFromText(c: PlaceCandidate): string | null {
  const hay = [c.address, c.searchText].filter(Boolean).join(" ").toLowerCase();
  if (!hay) return null;
  for (const [alias, canonical] of Object.entries(NEIGHBORHOOD_CANONICAL)) {
    if (hay.includes(alias)) return canonical;
  }
  return null;
}

/** location_fit: 0–20 */
function scoreLocation(c: PlaceCandidate, intent: RichPlaceIntent): number {
  const wantedNeighborhood = intent.location.neighborhood;

  // No location constraint → neutral (mid-score)
  if (!wantedNeighborhood && !intent.governorate) return 10;

  // Governorate only (no specific neighbourhood)
  if (!wantedNeighborhood && intent.governorate) {
    if (c.governorate === intent.governorate) return 14;
    return 4;
  }

  // We have a wanted neighbourhood — resolve the place's neighbourhood.
  // Prefer c.city, but fall back to address/searchText mining when city is generic.
  let placeCanonical = canonicalize(c.city);
  if (!placeCanonical || GENERIC_CITIES.has(placeCanonical.toLowerCase())) {
    const fromText = neighborhoodFromText(c);
    if (fromText) placeCanonical = fromText;
  }

  if (!placeCanonical || GENERIC_CITIES.has(placeCanonical.toLowerCase())) {
    // No neighbourhood signal at all → governorate fallback
    if (intent.governorate && c.governorate === intent.governorate) return 6;
    return 2;
  }

  // Exact match
  if (placeCanonical === wantedNeighborhood) return 20;

  // Adjacent neighbourhood
  const adjacent = NEIGHBORHOOD_ADJACENCY[wantedNeighborhood as string] ?? [];
  if (adjacent.includes(placeCanonical)) return 12;

  // Same governorate (Amman, etc.) — at least in the right city zone
  if (c.governorate === "Amman" && intent.governorate === "Amman") return 6;

  // Wrong governorate entirely
  return 2;
}

/** rating_quality: 0–15 */
function scoreRating(c: PlaceCandidate): number {
  if (c.rating === null || c.rating === undefined) return 4; // neutral
  if (c.rating >= 4.5) return 15;
  if (c.rating >= 4.0) return 11;
  if (c.rating >= 3.5) return 7;
  if (c.rating >= 3.0) return 4;
  return 1; // low rating is a mild penalty
}

// Occasion → keywords that should appear in search_text to signal a fit
const OCCASION_SIGNALS: Record<string, string[]> = {
  romantic:    ["romantic", "cozy", "cosy", "intimate", "candle", "view", "quiet", "couple", "date", "rooftop", "garden", "تهيئة رومانسية", "للعشاق"],
  birthday:    ["birthday", "party", "celebrate", "events", "reservation", "private", "cake", "decoration", "عيد ميلاد", "احتفال"],
  anniversary: ["romantic", "intimate", "fine dining", "special occasion", "candle", "quiet", "مناسبات"],
  business:    ["wifi", "meeting", "business", "quiet", "professional", "laptop", "work", "اجتماع", "شغل"],
  family:      ["family", "kids", "children", "playground", "family-friendly", "spacious", "عائلي", "أطفال"],
  celebration: ["party", "events", "booking", "private", "احتفال", "مناسبات"],
  graduation:  ["graduation", "celebration", "events", "party", "private", "تخرج"],
  casual:      ["casual", "relax", "chill", "easy", "comfortable"],
  none:        [],
};

// Recipient → additional signals
const RECIPIENT_SIGNALS: Record<string, string[]> = {
  couple:   ["couple", "romantic", "two", "date", "للزوجين"],
  family:   ["family", "kids", "children", "spacious", "عائلي"],
  kids:     ["kids", "children", "playground", "family-friendly", "ألعاب أطفال"],
  business: ["professional", "meeting", "wifi", "quiet", "business"],
  friends:  ["group", "gathering", "shared", "casual"],
  solo:     ["quiet", "solo", "work", "café", "wifi"],
};

// Requirements → signals in search text
const REQUIREMENT_SIGNALS: Record<string, string[]> = {
  outdoor_seating: ["outdoor", "rooftop", "terrace", "garden", "balcony", "open air", "تراس", "روفتوب"],
  delivery:        ["delivery", "order online", "توصيل", "دليفري"],
  pool:            ["pool", "swimming", "مسبح"],
  ladies_only:     ["ladies", "women", "female only", "حريم", "نساء"],
  parking:         ["parking", "valet", "موقف", "باركينج"],
  wifi:            ["wifi", "wi-fi", "internet"],
  private_room:    ["private", "private dining", "جلسة خاصة", "غرفة خاصة"],
  late_night:      ["late", "24 hours", "overnight", "سهر", "ليلاً"],
};

/** occasion_fit: 0–10 */
function scoreOccasion(c: PlaceCandidate, intent: RichPlaceIntent): number {
  const hay = ((c.searchText ?? "") + " " + c.name + " " + (c.address ?? "")).toLowerCase();

  let score = 5; // neutral baseline

  // Occasion signals
  const occSignals = OCCASION_SIGNALS[intent.occasion.type] ?? [];
  if (occSignals.length > 0) {
    const hits = occSignals.filter((s) => hay.includes(s)).length;
    // Up to +4 for strong occasion match
    score = 2 + Math.min(4, Math.round((hits / Math.max(1, occSignals.length)) * 4));
  }

  // Recipient signals
  const recSignals = intent.recipient.who ? (RECIPIENT_SIGNALS[intent.recipient.who] ?? []) : [];
  if (recSignals.length > 0) {
    const hits = recSignals.filter((s) => hay.includes(s)).length;
    score = Math.min(10, score + Math.min(3, hits));
  }

  // Requirement signals — each matched requirement adds +1 up to +3
  let reqBonus = 0;
  for (const req of intent.requirements) {
    const reqSignals = REQUIREMENT_SIGNALS[req] ?? [];
    if (reqSignals.some((s) => hay.includes(s))) reqBonus++;
  }
  score = Math.min(10, score + Math.min(3, reqBonus));

  return score;
}

/** completeness: 0–15 */
function scoreCompleteness(c: PlaceCandidate): number {
  let pts = 0;
  if (c.phone)                          pts += 4;
  if (c.address)                        pts += 4;
  if (c.website)                        pts += 3;
  if (c.openingHours)                   pts += 2;
  if (c.lat !== null && c.lng !== null) pts += 1;
  if (c.sourceUrl)                      pts += 1;
  return Math.min(15, pts);
}

// Budget tier keywords in search_text
const BUDGET_TIER_SIGNALS: Record<string, string[]> = {
  budget:    ["affordable", "cheap", "budget", "value", "inexpensive", "رخيص", "بسعر مناسب"],
  mid_range: ["moderate", "mid-range", "reasonable"],
  upscale:   ["upscale", "fine dining", "premium", "sophisticated", "elegant", "راقي"],
  luxury:    ["luxury", "fine dining", "five star", "exclusive", "فاخر", "فخم"],
};

/** budget_fit: 0–10 */
function scoreBudget(c: PlaceCandidate, intent: RichPlaceIntent): number {
  if (intent.budget.sensitivity === "none" || intent.budget.tier === null) return 5; // neutral

  const hay = ((c.searchText ?? "") + " " + c.name).toLowerCase();
  const tier = intent.budget.tier;
  const signals = BUDGET_TIER_SIGNALS[tier] ?? [];

  if (signals.some((s) => hay.includes(s))) return 10; // strong match
  // Opposite tier signals → mild penalty
  const oppositeTiers: Record<string, string[]> = {
    budget:    BUDGET_TIER_SIGNALS.upscale ?? [],
    upscale:   BUDGET_TIER_SIGNALS.budget ?? [],
    luxury:    BUDGET_TIER_SIGNALS.budget ?? [],
    mid_range: [],
  };
  const oppositeSignals = oppositeTiers[tier] ?? [];
  if (oppositeSignals.some((s) => hay.includes(s))) return 2;

  return 5; // no signal either way — neutral
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Score and rank a pool of PlaceCandidates using rich multi-dimensional scoring.
 * Returns candidates sorted by total score descending with tiebreaker on rating.
 */
export function rankPlacesRich(
  candidates: PlaceCandidate[],
  intent: RichPlaceIntent
): ScoredPlace[] {
  const wantedCats = new Set(intent.categories.map((x) => x.toLowerCase()));

  const scored = candidates.map((c) => {
    const { ratio: kwRatio, hits: keywordHits } = keywordRatio(c, intent.keywords);

    const relevance      = scoreRelevance(c, intent, kwRatio);
    const location_fit   = scoreLocation(c, intent);
    const rating_quality = scoreRating(c);
    const occasion_fit   = scoreOccasion(c, intent);
    const completeness   = scoreCompleteness(c);
    const budget_fit     = scoreBudget(c, intent);

    const total = relevance + location_fit + rating_quality + occasion_fit + completeness + budget_fit;

    return {
      ...c,
      score: total,
      keywordHits,
      components: { relevance, location_fit, rating_quality, occasion_fit, completeness, budget_fit, total },
    };
  });

  scored.sort((a, b) => {
    // Primary: total score
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreaker 1: rating
    const aR = a.rating ?? 0;
    const bR = b.rating ?? 0;
    if (bR !== aR) return bR - aR;
    // Tiebreaker 2: vector similarity
    return b.vecSim - a.vecSim;
  });

  // ── Hard guards ──────────────────────────────────────────────────────────────

  // Guard 1: when user specified a category, the #1 must match that category.
  if (wantedCats.size > 0 && scored.length > 1) {
    const topCat = scored[0]!.category.toLowerCase();
    const topSubcat = scored[0]!.subcategory?.toLowerCase() ?? "";
    const isMatch = wantedCats.has(topCat) || wantedCats.has(topSubcat);
    if (!isMatch) {
      const firstMatch = scored.findIndex(
        (c) => wantedCats.has(c.category.toLowerCase()) || wantedCats.has(c.subcategory?.toLowerCase() ?? "")
      );
      if (firstMatch > 0) {
        const [best] = scored.splice(firstMatch, 1);
        scored.unshift(best!);
      }
    }
  }

  // Guard 2: #1 must have at least one piece of actionable data.
  if (scored.length > 1 && !hasActionableData(scored[0]!)) {
    const firstWithData = scored.findIndex(hasActionableData);
    if (firstWithData > 0) {
      const [actionable] = scored.splice(firstWithData, 1);
      scored.unshift(actionable!);
    }
  }

  return scored;
}

function hasActionableData(c: PlaceCandidate): boolean {
  return !!(c.phone || c.address || c.website || c.sourceUrl);
}

/**
 * Generates a human-readable breakdown of a score for debugging.
 */
export function debugScore(s: ScoredPlace): string {
  const c = s.components;
  return [
    `"${s.name}" score=${s.score.toFixed(1)}/100`,
    `  relevance=${c.relevance.toFixed(1)}/30`,
    `  location=${c.location_fit.toFixed(1)}/20`,
    `  rating=${c.rating_quality.toFixed(1)}/15`,
    `  completeness=${c.completeness.toFixed(1)}/15`,
    `  occasion=${c.occasion_fit.toFixed(1)}/10`,
    `  budget=${c.budget_fit.toFixed(1)}/10`,
  ].join("\n");
}
