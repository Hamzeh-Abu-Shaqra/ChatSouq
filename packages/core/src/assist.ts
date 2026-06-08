import type { AIProvider, Embedder } from "@chatsouq/ai";
import { recommend } from "./engine";
import { recommendPlaces, placeSignal, getPlaceCategories } from "./places";
import { generalAnswer, isGeneralQuery } from "./general";
import { getCategories } from "./retrieve";
import { parseConstraints } from "./intent";
import type { AssistResponse, RecommendInput } from "./types";

interface Deps {
  provider?: AIProvider;
  embedder?: Embedder;
}

/** 0..N "this is a product-shopping query" signal. */
function productSignal(query: string, productCategories: string[]): number {
  const c = parseConstraints(query, productCategories);
  let s = c.categories.length * 2;
  // Budget alone doesn't make it a product query — need product category too
  if ((c.budgetMax !== null || c.budgetMin !== null) && c.categories.length > 0) s += 2;
  if (/\b(buy|gift|present|cheap|price)\b/i.test(query)) s += 1;
  if (c.brands.length) s += 1;
  return s;
}

/**
 * Top-level router. Priority order:
 * 1. General knowledge queries (rental, neighborhoods, tourism info, Jordan facts)
 * 2. Places / services (restaurants, gyms, hospitals, etc.)
 * 3. Product catalogue (e-commerce listings)
 */
export async function assist(input: RecommendInput, deps: Deps = {}): Promise<AssistResponse> {
  // Check general intent FIRST before product/place scoring
  if (isGeneralQuery(input.query)) {
    // Only override if it's not also a strong places query
    const [placeCategories] = await Promise.all([getPlaceCategories()]);
    const pSig = placeSignal(input.query, placeCategories);
    // General wins unless there's a strong place signal (cafe, hospital, etc.)
    if (pSig < 3) {
      return generalAnswer(input, { provider: deps.provider });
    }
  }

  const [productCategories, placeCategories] = await Promise.all([
    getCategories(),
    getPlaceCategories(),
  ]);

  const pSig = placeSignal(input.query, placeCategories);
  const prodSig = productSignal(input.query, productCategories);

  if (pSig > prodSig && pSig > 0) return recommendPlaces(input, deps);
  return recommend(input, deps);
}
