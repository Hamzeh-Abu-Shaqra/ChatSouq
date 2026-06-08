import type { Candidate, Constraints } from "./types";

export interface ScoredCandidate extends Candidate {
  score: number;
  keywordHits: number;
  components: {
    vec: number;
    txt: number;
    keyword: number;
    category: number;
    budgetFit: number;
    value: number;
    brand: number;
  };
}

// Relevance (vec + txt + keyword + category = 0.88) dominates; price/brand are
// only tiebreakers (0.12). This is what stops cheap-but-irrelevant items winning.
const WEIGHTS = {
  vec: 0.42,
  txt: 0.12,
  keyword: 0.22,
  category: 0.12,
  budgetFit: 0.04,
  value: 0.04,
  brand: 0.04,
};

/**
 * MiniLM cosine for a strong match sits around 0.4–0.6 and unrelated near 0.
 * Rescale that band into [0,1] so semantic differences actually discriminate.
 */
function rescaleVec(cos: number): number {
  return Math.max(0, Math.min(1, (cos - 0.15) / 0.5));
}

function keywordHitRatio(c: Candidate, keywords: string[]): { ratio: number; hits: number } {
  if (keywords.length === 0) return { ratio: 0, hits: 0 };
  // Use || not ?? so empty-string searchText falls back to the listing name.
  const hay = (c.searchText || c.name).toLowerCase();
  let hits = 0;
  for (const k of keywords) if (hay.includes(k)) hits++;
  return { ratio: hits / keywords.length, hits };
}

/**
 * Score + sort candidates. Exactly one winner emerges (index 0). Numbers used in
 * scoring come straight from the DB; the LLM never participates in ranking.
 */
export function rankCandidates(
  candidates: Candidate[],
  constraints: Constraints
): ScoredCandidate[] {
  const priced = candidates.filter((c) => c.price !== null).map((c) => c.price as number);
  const minPrice = priced.length ? Math.min(...priced) : 0;
  const maxPrice = priced.length ? Math.max(...priced) : 0;
  const span = maxPrice - minPrice;
  const preferredBrands = new Set(constraints.brands.map((b) => b.toLowerCase()));
  const wantedCategories = new Set(constraints.categories.map((c) => c.toLowerCase()));

  const scored = candidates.map((c) => {
    const { ratio: keyword, hits } = keywordHitRatio(c, constraints.keywords);

    let budgetFit = 0.5;
    if (constraints.budgetMax !== null && c.price !== null) {
      budgetFit = c.price <= constraints.budgetMax ? 1 : 0;
    }

    // Cheaper-within-pool = better value (gentle nudge, never overrides relevance).
    let value = 0.5;
    if (c.price !== null && span > 0) {
      value = 1 - (c.price - minPrice) / span;
    }

    const brand = c.brand && preferredBrands.has(c.brand.toLowerCase()) ? 1 : 0;
    // Primary category (first in the constraints list) scores 1.0; secondary categories
    // score 0.4 so a broad umbrella match doesn't outrank a specific category hit.
    const primaryCategory = constraints.categories[0]?.toLowerCase() ?? null;
    const category =
      wantedCategories.size === 0 || !c.category
        ? 0
        : c.category.toLowerCase() === primaryCategory
        ? 1
        : wantedCategories.has(c.category.toLowerCase())
        ? 0.4
        : 0;

    const components = {
      vec: rescaleVec(c.vecSim),
      txt: Math.max(0, Math.min(1, c.txtSim)),
      keyword,
      category,
      budgetFit,
      value,
      brand,
    };

    const score =
      WEIGHTS.vec * components.vec +
      WEIGHTS.txt * components.txt +
      WEIGHTS.keyword * components.keyword +
      WEIGHTS.category * components.category +
      WEIGHTS.budgetFit * components.budgetFit +
      WEIGHTS.value * components.value +
      WEIGHTS.brand * components.brand;

    return { ...c, score, keywordHits: hits, components };
  });

  scored.sort((a, b) => b.score - a.score || b.vecSim - a.vecSim);
  return scored;
}
