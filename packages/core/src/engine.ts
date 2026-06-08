import { getProvider, getEmbedder, type AIProvider, type Embedder } from "@chatsouq/ai";
import { parseConstraints, applyProfile, enrichWithLLM } from "./intent";
import { getCategories, retrieve } from "./retrieve";
import { rankCandidates, type ScoredCandidate } from "./rank";
import { explainItems } from "./explain";
import { getCtrBoosts } from "./memory";
import type {
  Candidate,
  Constraints,
  RecommendInput,
  RecommendationResponse,
  ResultItem,
} from "./types";

interface Deps {
  provider?: AIProvider;
  embedder?: Embedder;
}

function noResultSummary(constraints: Constraints): string {
  return `I couldn't find a match for "${constraints.rawQuery}" in the current catalogue.`;
}

function toResultItem(c: ScoredCandidate, isBest: boolean): ResultItem {
  return {
    listing: {
      id: c.id,
      name: c.name,
      brand: c.brand,
      price: c.price,
      currency: c.currency,
      category: c.category,
      imageUrl: c.imageUrl,
      sourceUrl: c.sourceUrl,
      vendor: {
        id: c.vendorId,
        name: c.vendorName,
        location: c.vendorLocation,
        websiteUrl: c.vendorWebsite,
      },
    },
    score: Number(c.score.toFixed(4)),
    isBest,
    why: "",
    pros: [],
    cons: [],
  };
}

/** Minimum quality score to be shown as an alternative (but not to filter out the best). */
const MIN_ALT_SCORE = 0.15;

/**
 * The reasoning recommendation engine.
 *   query -> deterministic constraints -> (optional LLM enrichment) -> retrieval
 *   (SQL hard-filter + vector + trigram) -> weighted ranking + type-match filter
 *   -> exactly one best + ranked alternatives -> fact-grounded explanations.
 * All numeric values come from the database; the LLM never produces numbers.
 */
export async function recommend(
  input: RecommendInput,
  deps: Deps = {}
): Promise<RecommendationResponse> {
  const started = Date.now();
  const provider = deps.provider ?? getProvider();
  const embedder = deps.embedder ?? getEmbedder();
  const limit = Math.max(1, Math.min(input.limit ?? 4, 8));

  const categories = await getCategories();
  let constraints = parseConstraints(input.query, categories);
  constraints = applyProfile(constraints, input.profile);
  constraints = await enrichWithLLM(constraints, provider, categories);

  // Build a rich embed text: query + categories + keywords (deduplicated)
  const embedText = [...new Set([
    input.query,
    ...constraints.categories,
    ...constraints.keywords,
    ...constraints.brands,
  ])].filter(Boolean).join(" ");

  const [queryVec] = await embedder.embed([embedText]);
  if (!queryVec) throw new Error("Failed to embed the query.");

  const requestedCat = constraints.categories.length > 0;
  const requestedBudget = constraints.budgetMax !== null || constraints.budgetMin !== null;
  const hasKeywords = constraints.keywords.length > 0;
  // Use strict (AND) keyword filter when 2+ specific keywords — prevents
  // cross-type contamination (wireless ≠ wired, headphones ≠ cable, etc.)
  const useStrict = hasKeywords && constraints.keywords.length >= 2;

  // Plan sequence: try strictest first, relax progressively until we have enough results.
  // s = strict AND keywords, k = OR keywords, c = category, b = budget
  type Plan = { c: boolean; b: boolean; k: boolean; s: boolean };
  const plans: Plan[] = [
    { c: true,  b: true,  k: false, s: useStrict  }, // AND keywords + cat + budget (strictest)
    { c: true,  b: true,  k: hasKeywords, s: false }, // OR keywords + cat + budget
    { c: true,  b: false, k: hasKeywords, s: false }, // OR keywords + cat, no budget
    { c: false, b: true,  k: hasKeywords, s: false }, // OR keywords + budget, no cat
    { c: true,  b: false, k: false, s: false },       // category only, no budget
    { c: false, b: false, k: hasKeywords, s: false }, // OR keywords, no filters
    { c: false, b: false, k: false, s: false },       // no filter (last resort)
  ];

  let candidates: Candidate[] = [];
  let chosen: Plan = plans[0]!;
  for (const p of plans) {
    const got = await retrieve(constraints, queryVec, input.query, {
      useCategoryFilter: p.c,
      useBudgetFilter: p.b,
      useKeywordFilter: p.k,
      useStrictKeywords: p.s,
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

  const relaxedCategory = requestedCat && !chosen.c;
  const relaxedBudget = requestedBudget && !chosen.b;

  // ── CTR boost: results previously clicked for similar queries get +bonus ──
  const ctrBoosts = await getCtrBoosts(
    input.query,
    candidates.map((c) => c.id),
    "products"
  );
  const boostedCandidates = candidates.map((c) => {
    const boost = ctrBoosts.get(c.id) ?? 0;
    return boost > 0 ? { ...c, vecSim: Math.min(1, c.vecSim + boost) } : c;
  });

  const allRanked = rankCandidates(boostedCandidates, constraints).slice(0, limit * 2);

  // ── Keyword-hit guardian: top pick must match at least one keyword ──────
  // Prevents off-category items (e.g. vinyl record for headphones) from winning.
  if (constraints.keywords.length > 0 && allRanked.length > 1) {
    const hasKeywordHit = (c: (typeof allRanked)[0]) => {
      const hay = ((c.searchText || "") + " " + c.name).toLowerCase();
      return constraints.keywords.some((k) => hay.includes(k));
    };
    if (!hasKeywordHit(allRanked[0]!)) {
      const firstHit = allRanked.findIndex(hasKeywordHit);
      if (firstHit > 0) {
        const [best] = allRanked.splice(firstHit, 1);
        allRanked.unshift(best!);
      }
    }
  }

  const bestCategory = allRanked[0]?.category ?? null;

  // ── Quality filter for alternatives ─────────────────────────────────────
  const ranked = allRanked
    .filter((c, i) => {
      if (i === 0) return true; // always keep the top pick
      if (c.score < MIN_ALT_SCORE) return false; // too weak
      // When category was relaxed, only keep alternatives that are genuinely relevant
      if (relaxedCategory && c.keywordHits === 0 && c.category !== bestCategory) return false;
      return true;
    })
    .slice(0, limit);

  const { summary: chatSummary, explanations } = await explainItems(
    provider, input.query, ranked, constraints, input.memoryBlock
  );

  const items = ranked.map((c, i) => {
    const item = toResultItem(c, i === 0);
    const ex = explanations.get(c.id);
    if (ex) {
      item.why = ex.why;
      item.pros = ex.pros;
      item.cons = ex.cons;
    }
    return item;
  });

  const finalSummary = items.length === 0
    ? noResultSummary(constraints)
    : chatSummary;

  return {
    kind: "products",
    query: input.query,
    constraints,
    summary: finalSummary,
    best: items[0] ?? null,
    alternatives: items.slice(1),
    meta: {
      provider: provider.name,
      embedder: embedder.name,
      candidateCount: candidates.length,
      tookMs: Date.now() - started,
      relaxedBudget,
      relaxedCategory,
    },
  };
}
