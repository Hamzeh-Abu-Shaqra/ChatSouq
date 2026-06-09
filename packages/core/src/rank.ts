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
    typeMatch: number;
    dataQuality: number;
  };
}

// Keyword + vector dominate (0.76). Category adds structure (0.10).
// typeMatch guards against product-type confusion (wireless vs wired etc.).
// dataQuality weight reduced (0.07→0.02): 85%+ of listings now have all fields
// so it barely discriminates anything — redistributed to vec and keyword.
// Value/brand are micro tiebreakers only.
const WEIGHTS = {
  vec:         0.33,  // semantic meaning — bumped since data quality is uniformly high
  txt:         0.06,  // trigram text match (noisy for short queries, kept low)
  keyword:     0.37,  // exact term match — PRIMARY intent signal
  category:    0.10,  // right department
  typeMatch:   0.08,  // product-type discrimination (wireless, ANC, perfume vs mist, etc.)
  dataQuality: 0.02,  // listing completeness — still penalises truly empty stubs
  budgetFit:   0.02,  // within budget
  value:       0.01,  // cheapest in pool — gentle tiebreaker only
  brand:       0.01,  // preferred brand — gentle tiebreaker only
};

/**
 * Attribute markers that must appear in the item when the user requested them,
 * and must NOT appear when the user specifically excluded them.
 */
const TYPE_ATTRIBUTES: { required: RegExp; absent?: RegExp; marker: string }[] = [
  { marker: "wireless",    required: /\b(wireless|bluetooth|bt\b|tws|wifi|wi-fi)\b/i },
  { marker: "wired",       required: /\b(wired|cable|usb|type-c|lightning|3\.5mm)\b/i },
  { marker: "noise-cancelling", required: /\b(anc|noise.cancel|active.noise)\b/i },
  { marker: "over-ear",    required: /\b(over.ear|on.ear|circum.aural|full.size|full-size)\b/i },
  { marker: "in-ear",      required: /\b(in.ear|earbud|earbuds|tws|inner.ear)\b/i },
  { marker: "gaming",      required: /\b(gaming|gamer|game)\b/i },
  { marker: "smartwatch",   required: /\b(smart.?watch|fitness.track|activity.track|health.watch)\b/i },
  { marker: "4k",           required: /\b(4k|uhd|2160p|ultra.hd)\b/i },
  { marker: "oled",         required: /\b(oled|amoled|super.amoled)\b/i },
  // Watches — movement type
  { marker: "automatic",    required: /\b(automatic|self.?winding|mechanical|skeleton|tourbillon|chronograph)\b/i },
  { marker: "quartz",       required: /\b(quartz|battery.?powered|solar.?watch)\b/i },
  // Keyboards
  { marker: "mechanical",   required: /\b(mechanical|mech|cherry.?mx|clicky|tactile|linear.?switch)\b/i },
  // Monitors / TVs
  { marker: "curved",       required: /\b(curved|ultrawide|ultra.?wide|curve)\b/i },
  // Speakers / audio
  { marker: "portable",     required: /\b(portable|compact|handheld|travel|waterproof.?speaker|outdoor.?speaker|bluetooth.?speaker)\b/i },
  // Cameras
  { marker: "mirrorless",   required: /\b(mirrorless|ilce|alpha|eos.?r|z-?series|om.?system|x-?series)\b/i },
  { marker: "dslr",         required: /\b(dslr|reflex|digital.?slr)\b/i },
  // Fragrance product form — "perfume" must not return hair/body mists
  {
    marker: "perfume",
    required: /\b(perfume|eau.?de.?parfum|eau.?de.?toilette|edp|edt|parfum|cologne|edc)\b/i,
    absent:   /\b(hair.?mist|body.?mist|hair.?spray)\b/i,
  },
];

/**
 * MiniLM cosine for a strong match sits around 0.4–0.7 and unrelated near 0.
 * Rescale that band into [0,1] so semantic differences actually discriminate.
 *
 * Old band [0.15, 0.65] was too narrow — all good matches collapsed to 1.0,
 * losing the ability to distinguish "good" from "excellent" within the top pool.
 * New band [0.10, 0.70] gives more room at both ends.
 */
function rescaleVec(cos: number): number {
  return Math.max(0, Math.min(1, (cos - 0.10) / 0.60));
}

/**
 * Data-quality score [0..1]: rewards listings that have all the fields a user
 * needs to make a real buying decision — price, image, a link to buy, brand,
 * and a meaningful description. Stubs with missing fields score lower.
 *
 * Points (max 8):
 *   price present        +2  (most important — can't budget without it)
 *   image present        +2  (visual trust / product recognition)
 *   sourceUrl present    +2  (can actually click through and buy)
 *   brand present        +1  (brand clarity)
 *   description ≥ 30ch   +1  (meaningful description, not a stub)
 */
function dataQualityScore(c: Candidate): number {
  let pts = 0;
  if (c.price !== null)                              pts += 2;
  if (c.imageUrl)                                    pts += 2;
  if (c.sourceUrl)                                   pts += 2;
  if (c.brand)                                       pts += 1;
  if (c.description && c.description.length >= 30)  pts += 1;
  return pts / 8;
}

function keywordHitRatio(c: Candidate, keywords: string[]): { ratio: number; hits: number } {
  if (keywords.length === 0) return { ratio: 0, hits: 0 };
  // Search name + searchText + description so attributes buried in long descriptions are found.
  const hay = ((c.searchText || "") + " " + c.name + " " + (c.description || "")).toLowerCase();
  let hits = 0;
  for (const k of keywords) if (hay.includes(k)) hits++;
  const rawRatio = hits / keywords.length;

  // Non-linear penalty: matching 1/3 keywords scores much lower than 3/3.
  // This prevents a cheap item that hits one minor keyword from outranking
  // a relevant item that hits all keywords.
  // 3/3 → 1.0,  2/3 → 0.55,  1/3 → 0.20,  0/3 → 0.0
  const boostedRatio = keywords.length <= 1
    ? rawRatio
    : Math.pow(rawRatio, 1.6);

  return { ratio: boostedRatio, hits };
}

/**
 * Product-type match score [0..1]:
 * - 1.0 if all requested attributes are present in the item
 * - 0.5 if no specific attributes requested (neutral)
 * - 0.0 if a required attribute is completely absent from the item
 *
 * This prevents wired headphones from winning when the user asks for "wireless",
 * or over-ear headphones from winning when the user says "earbuds".
 */
function typeMatchScore(c: Candidate, keywords: string[]): number {
  if (keywords.length === 0) return 0.5;
  const hay = ((c.searchText || "") + " " + c.name + " " + (c.description || "")).toLowerCase();
  const queryAttrs = keywords.map((k) => k.toLowerCase());

  let requestedCount = 0;
  let matchedCount = 0;

  for (const attr of TYPE_ATTRIBUTES) {
    // Check if user requested this attribute
    const userWants = queryAttrs.some((k) => attr.required.test(k) || k === attr.marker);
    if (!userWants) continue;
    // Hard exclude: item is definitively the WRONG product form (e.g. hair mist when
    // user asked for perfume, wired-only when user asked for wireless).
    if (attr.absent && attr.absent.test(hay)) return 0;
    requestedCount++;
    if (attr.required.test(hay)) matchedCount++;
  }

  if (requestedCount === 0) return 0.5; // no specific type requested
  return matchedCount / requestedCount;
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
    const typeMatch = typeMatchScore(c, constraints.keywords);

    // Budget fit: 1.0 = in range, 0.0 = well over budget, 0.25 = price unknown when budget specified.
    // Soft boundary: slightly over budget still scores rather than hard-zero.
    const budgetRequested = constraints.budgetMax !== null || constraints.budgetMin !== null;
    let budgetFit = 0.5;
    if (c.price === null) {
      budgetFit = budgetRequested ? 0.25 : 0.5;
    } else {
      const overMin = constraints.budgetMin === null || c.price >= constraints.budgetMin;
      if (!overMin) {
        // Under minimum: hard zero — wrong tier entirely
        budgetFit = 0;
      } else if (constraints.budgetMax === null) {
        budgetFit = 1.0;
      } else if (c.price <= constraints.budgetMax) {
        budgetFit = 1.0;                                           // in range
      } else if (c.price <= constraints.budgetMax * 1.10) {
        budgetFit = 0.5;                                           // within 10% over — acceptable
      } else if (c.price <= constraints.budgetMax * 1.30) {
        budgetFit = 0.2;                                           // within 30% over — stretch
      } else {
        budgetFit = 0;                                             // way over budget
      }
    }

    // Cheaper-within-pool = better value (gentle nudge, never overrides relevance).
    let value = 0.5;
    if (c.price !== null && span > 0) {
      value = 1 - (c.price - minPrice) / span;
    }

    const brand =
      c.brand && preferredBrands.size > 0 && preferredBrands.has(c.brand.toLowerCase()) ? 1 : 0;

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

    const vec = rescaleVec(c.vecSim);
    const dataQuality = dataQualityScore(c);

    const components = {
      vec,
      txt: Math.max(0, Math.min(1, c.txtSim)),
      keyword,
      category,
      typeMatch,
      dataQuality,
      budgetFit,
      value,
      brand,
    };

    const score =
      WEIGHTS.vec         * components.vec +
      WEIGHTS.txt         * components.txt +
      WEIGHTS.keyword     * components.keyword +
      WEIGHTS.category    * components.category +
      WEIGHTS.typeMatch   * components.typeMatch +
      WEIGHTS.dataQuality * components.dataQuality +
      WEIGHTS.budgetFit   * components.budgetFit +
      WEIGHTS.value       * components.value +
      WEIGHTS.brand       * components.brand;

    return { ...c, score, keywordHits: hits, components };
  });

  // Hard-exclude items where the user requested a specific type attribute
  // (e.g. "wireless") but the item is definitively the OPPOSITE type (e.g. wired-only).
  // typeMatch === 0 means NOT A SINGLE requested attribute matched the item.
  const typeRequested = TYPE_ATTRIBUTES.some((attr) =>
    constraints.keywords.some((k) => attr.required.test(k) || k === attr.marker)
  );
  const filtered = typeRequested
    ? scored.filter((c) => c.components.typeMatch > 0)
    : scored;

  // Fall back to all candidates if filtering removed everything
  const result = filtered.length > 0 ? filtered : scored;
  result.sort((a, b) => b.score - a.score || b.vecSim - a.vecSim);
  return result;
}
