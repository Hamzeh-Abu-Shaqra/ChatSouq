import type { AIProvider, Embedder } from "@chatsouq/ai";
import { recommend } from "./engine";
import { recommendPlaces, placeSignal, getPlaceCategories } from "./places";
import { generalAnswer, isGeneralQuery } from "./general";
import { getCategories } from "./retrieve";
import { parseConstraints } from "./intent";
import type { AssistResponse, ConvMessage, RecommendInput } from "./types";

interface Deps {
  provider?: AIProvider;
  embedder?: Embedder;
}

/**
 * If the current query is a bare location refinement — "in X", "near X",
 * "around X" — with no standalone intent, prepend the previous user turn so
 * context carries over.
 *
 * Example:  "Best restaurants in Amman" → "in deir ghbar"
 *   becomes: "Best restaurants in Amman in deir ghbar"
 *
 * This prevents follow-up queries from being re-routed as product searches
 * because they happen to contain two generic keywords.
 */
function resolveFollowUp(query: string, history?: ConvMessage[]): string {
  if (!history?.length) return query;
  const trimmed = query.trim();
  // A pure location refinement: starts with a preposition and is short (≤ 8 words)
  // Supports both English and Arabic prepositions: في، قرب، بالقرب من، حول، عند، ب
  const isLocRefinement =
    /^(in|near|around|at|close to|by)\s+\S/i.test(trimmed) ||
    /^(في|قرب|بالقرب من|حول|عند|بجانب|ب)\s*\S/.test(trimmed);
  if (!isLocRefinement) return query;
  if (trimmed.split(/\s+/).length > 8) return query; // too long — has own intent

  // Look further back than just the last user turn: find the last user turn that
  // has meaningful content (> 3 words), not another bare location refinement.
  // This ensures "best restaurants in Amman" → "in Sweifieh" → "in Abdoun" all
  // chain back to the original intent, not to the second "in Sweifieh" stub.
  const reversed = [...history].reverse();
  const anchor = reversed.find((m) => {
    if (m.role !== "user") return false;
    const words = m.content.trim().split(/\s+/).length;
    if (words <= 3) return false; // skip previous stubs like "in Sweifieh"
    // Skip if this user turn is itself a bare location refinement
    const isStub =
      /^(in|near|around|at|close to|by)\s+\S/i.test(m.content.trim()) ||
      /^(في|قرب|بالقرب من|حول|عند|بجانب|ب)\s*\S/.test(m.content.trim());
    return !isStub;
  });
  if (!anchor) return query;
  return `${anchor.content} ${trimmed}`;
}

/** 0..N "this is a product-shopping query" signal. */
function productSignal(query: string, productCategories: string[]): number {
  const c = parseConstraints(query, productCategories);
  let s = c.categories.length * 2;

  // Budget + category together: strong purchase signal
  if ((c.budgetMax !== null || c.budgetMin !== null) && c.categories.length > 0) s += 2;
  // Budget alone (no category yet): mild shopping signal
  if ((c.budgetMax !== null || c.budgetMin !== null) && c.categories.length === 0) s += 1;

  // Gifting intent — strong signal even without an explicit product category.
  // Must score ≥ 3 on its own so gift queries beat a bare governorate pSig.
  // EXCEPTION: "من محل / from a shop" phrases indicate the user wants a PLACE (gift shop),
  // not a product from the catalogue — cancel the gift boost in that case.
  const hasGiftIntent = /\b(gift|gifts|present|presents|gifting|هدية|هدايا|هديه)\b/i.test(query);
  const wantsGiftPlace = /\bfrom\s+(a|the)\s+\w+\s*(shop|store|center|place|boutique)\b/i.test(query) ||
    /من\s+(محل|متجر|دكان|مركز)\s*(هدايا|هدية)?/.test(query);
  if (hasGiftIntent && !wantsGiftPlace) s += 3;

  // Occasion-based shopping (birthday, Eid, Valentine, graduation…) — people
  // buying something for an occasion, not looking for a place to celebrate.
  // EXCEPTION: "ramadan" alone is usually a schedule/general query ("Ramadan timings",
  // "what's open during Ramadan") — only boost prodSig when paired with a shopping keyword.
  if (
    /\b(birthday|anniversary|valentine|valentines|eid|graduation|wedding|christmas|mother.?s\s+day|father.?s\s+day|new\s+year)\b/i.test(query) ||
    /\b(عيد|خطوبة|زفاف|تخرج|الفلانتاين)\b/.test(query)
  ) s += 2;
  if (
    (/\b(ramadan)\b/i.test(query) || /رمضان/.test(query)) &&
    /\b(gift|buy|shop|price|cheap|offer|discount|special|deal|هدية|هدايا|تسوق|اشتري|عروض|تخفيض|خاص)\b/i.test(query)
  ) s += 2;

  // Explicit purchase / browse intent: +1 (English + Arabic)
  if (/\b(buy|cheap|price|best\s+\w+\s+under|i\s+want|show\s+me|find\s+me|looking\s+for|shop\s+for|shopping\s+for|purchase)\b/i.test(query)) s += 1;
  // Arabic purchase intent (اشتري / أشتري / بدي أشتري / حابب أشتري)
  if (/اشتري|أشتري|بدي\s+أشتري|بدي\s+اشتري|حابب\s+أشتري|حابب\s+اشتري|أبي\s+أشتري|أبغى\s+أشتري/.test(query)) s += 1;

  if (c.brands.length) s += 1;
  if (c.keywords.length >= 2) s += 1;

  // ── Service-intent deductions ─────────────────────────────────────────────
  // All of the patterns below describe wanting a SERVICE at a PLACE, not buying
  // a physical product. Each match subtracts 3 so the router falls through to
  // places/general instead of the product catalogue.

  // Grooming — "cut my hair", "trim my beard", "do my nails"
  if (
    /\b(cut|trim|wash|dry|style|dye|color|do|get|fix|wax)\s+(my\s+|a\s+)?(hair|beard|nails|brows|eyebrows|lashes)\b/i.test(query) ||
    /\b(haircut|hair\s+cut|blowout|blow\s+dry|manicure|pedicure)\b/i.test(query)
  ) s -= 3;

  // Food/drink consumption → restaurant/café, not a product to buy
  if (
    /\b(eat\s+out|go\s+out\s+to\s+eat|grab\s+(a\s+)?(coffee|bite|food|drink|snack)|have\s+(a\s+)?(meal|bite|coffee|tea|juice|dessert|sweets?|lunch|dinner|breakfast|brunch)|i\s+want\s+to\s+(eat|drink)|dine\s+out|order\s+food)\b/i.test(query) ||
    /\b(أريد\s+(آكل|أكل|أشرب)|بدي\s+(آكل|أكل|أشرب)|حابب\s+(آكل|أشرب))\b/.test(query)
  ) s -= 3;

  // Fitness service → gym/studio, not a product to buy
  if (
    /\b(join\s+(a\s+)?(gym|fitness|yoga|pilates|crossfit|club)|sign\s+up\s+(for|to)\s+\w+\s*class(es)?|go\s+(to\s+the\s+)?(gym|swim(ming)?|yoga|pilates|boxing)|take\s+a\s+(yoga|pilates|spin|boxing|fitness|zumba)\s+class(es)?|book\s+a\s+(class|session|training\s+session))\b/i.test(query) ||
    // Arabic: "بدي جيم" / "بدي روح جيم" / "أريد جيم" — want a gym, not gym gear
    /\b(بدي\s+(روح\s+)?جيم|أريد\s+(أروح\s+)?جيم|نادي\s+رياضي)\b/.test(query)
  ) s -= 3;

  // Car service → garage/car wash, not a product to buy
  if (
    /\b(fix\s+(my\s+)?car|repair\s+(my\s+)?car|wash\s+(my\s+)?car|service\s+(my\s+)?car|oil\s+change|change\s+(the\s+|my\s+)?oil|change\s+(my\s+)?tires?|rotate\s+tires?|wheel\s+alignment|car\s+maintenance|my\s+car\s+(needs?|broke|is\s+broken|won'?t\s+start)|flat\s+tyre|flat\s+tire|tyre\s+puncture|tire\s+puncture)\b/i.test(query) ||
    // Arabic car service — covers both غسيل (noun form) and غسل (verb form) plus breakdown phrases
    /أصلح\s+سيارت|غسيل?\s+سيارت|صيانة\s+سيارت|تغيير\s+زيت|سيارتي\s+(خربانة|خربان|واقفة|وقفت|مش\s+شاغلة|مكسورة|تعطلت)|بنشر\s+سيارتي|إطار\s+مثقوب/.test(query)
  ) s -= 3;

  // Medical service → clinic/doctor, not a product to buy
  if (
    /\b(see\s+a\s+(doctor|dentist|specialist|physician|therapist|psychiatrist|dermatologist|cardiologist)|visit\s+a?\s*(doctor|clinic|hospital|dentist)|book\s+(a\s+)?(doctor|appointment|medical\s+appointment|check.?up)|need\s+a\s+(doctor|dentist|check.?up)|consult\s+(a\s+)?(doctor|specialist)|go\s+to\s+(the\s+)?(doctor|clinic|hospital|dentist|pharmacy))\b/i.test(query) ||
    // Arabic medical: "أريد/بدي/أحتاج دكتور" + pain expressions
    /أريد\s+أروح\s+دكتور|أريد\s+دكتور|بدي\s+دكتور|أحتاج\s+دكتور|زيارة\s+طبيب|عندي\s+ألم|ظهري\s+بيوجعني|بيوجعني\s+\S+|يؤلمني/.test(query)
  ) s -= 3;

  // Entertainment venue → cinema/activity/stadium, not a product to buy
  if (
    /\b(watch\s+a?\s*(movie|film|show|match|game)(\s+in\s+a?\s*cinema|\s+at\s+the\s+cinema)?|go\s+(bowling|karting|kart\s+racing|paintball|laser\s*tag|skating|ice\s+skating|to\s+an?\s+escape\s+room)|play\s+(bowling|billiards|pool|snooker)|catch\s+a\s+movie|watch\s+(football|a\s+live|live\s+match))\b/i.test(query) ||
    /أريد\s+أشوف\s+فيلم|مشاهدة\s+فيلم|مشاهدة\s+مباراة|روح\s+سينما|بدي\s+ألعب|بدي\s+أشوف\s+مباراة/.test(query)
  ) s -= 3;

  // Massage/spa/beauty treatment → beauty place, not a product to buy
  if (
    /\b(get\s+a?\s*(massage|facial|wax(ing)?|threading|spa\s+treatment|body\s+scrub|hammam)|book\s+a?\s*(massage|facial|spa|beauty\s+treatment|salon\s+appointment))\b/i.test(query) ||
    /أريد\s+مساج|بدي\s+مساج|حجز\s+مساج|حمام\s+مغربي|حمام\s+تركي/.test(query)
  ) s -= 3;

  // Laundry / dry cleaning service → laundromat, not a product to buy
  if (
    /\b(wash\s+my\s+clothes|drop\s+off\s+(my\s+)?laundry|dry\s+clean(ing)?|take\s+(my\s+)?clothes\s+to\s+the\s+laundry)\b/i.test(query) ||
    /أغسل\s+ملابسي|غسيل\s+ملابس|مغسلة|تنظيف\s+جاف/.test(query)
  ) s -= 3;

  // Tailoring / alterations service → tailor, not a product to buy
  if (
    /\b(fix\s+my\s+(suit|dress|shirt|pants|trousers)|tailor\s+my\s+\w+|get\s+(alterations?|my\s+clothes?\s+altered|my\s+(suit|dress)\s+fitted)|take\s+(it|them)\s+to\s+(a\s+)?tailor)\b/i.test(query) ||
    /أخيط|خياط|تعديل\s+ملابس|تفصيل/.test(query)
  ) s -= 3;

  // Printing / photocopying service → print shop, not a product to buy
  if (
    /\b(print\s+(my\s+)?(documents?|cv|resume|files?|photos?|pages?)|photocopy|need\s+to\s+print|i\s+want\s+to\s+print)\b/i.test(query) ||
    /أطبع\s+أوراق|أطبع\s+مستند|طباعة\s+أوراق|تصوير\s+مستندات/.test(query)
  ) s -= 3;

  return Math.max(0, s);
}

/**
 * Top-level router. Priority order:
 * 1. Strong product signal overrides general — "best headphones" is NOT general
 * 2. General knowledge queries (rental, neighborhoods, tourism info, Jordan facts)
 * 3. Places / services (restaurants, gyms, hospitals, etc.)
 * 4. Product catalogue (e-commerce listings)
 */
export async function assist(input: RecommendInput, deps: Deps = {}): Promise<AssistResponse> {
  // Resolve bare follow-ups like "in deir ghbar" → "best restaurants in Amman in deir ghbar"
  const resolvedQuery = resolveFollowUp(input.query, input.history);
  const effectiveInput: RecommendInput = resolvedQuery !== input.query
    ? { ...input, query: resolvedQuery }
    : input;

  const [productCategories, placeCategories] = await Promise.all([
    getCategories(),
    getPlaceCategories(),
  ]);

  const prodSig = productSignal(effectiveInput.query, productCategories);
  const pSig    = placeSignal(effectiveInput.query, placeCategories);

  // Events / "what's on today" queries: route directly to generalAnswer regardless
  // of prodSig noise. Arabic queries like "إيش في عمان اليوم؟ فعاليات" have 2+
  // keywords → prodSig=1, which would normally block the general route. These are
  // never product searches, so we check first before any product routing.
  //
  // EXCEPTION: Entertainment-venue queries like "watch a movie tonight" or
  // "go bowling tonight" describe wanting to visit a place, not a news/digest query.
  // These must NOT be swallowed by the today/events bypass — they belong in places.
  const isEntertainmentVenueQuery =
    /\b(watch\s+a?\s*(movie|film|show|match|game|live\s+match)|go\s+(bowling|karting|kart\s+racing|paintball|laser\s*tag|skating|ice\s+skating|to\s+an?\s+escape\s+room)|catch\s+a\s+movie|play\s+(bowling|billiards|pool|snooker))\b/i.test(effectiveInput.query) ||
    /مشاهدة\s+فيلم|روح\s+سينما|مشاهدة\s+مباراة/.test(effectiveInput.query);

  const isEventOrTodayQuery =
    /اليوم|فعاليات|ماذا يحدث|ايش في|ايش صاير|وجهة|أين أذهب/i.test(effectiveInput.query) ||
    /\b(today|tonight|this\s+week|events?|activities|what.?s\s+(in|happening|going\s+on)|things\s+to\s+do)\b/i.test(effectiveInput.query);

  if (isEventOrTodayQuery && !isEntertainmentVenueQuery && isGeneralQuery(effectiveInput.query)) {
    return generalAnswer(effectiveInput, { provider: deps.provider });
  }

  // Rental / housing / neighbourhood queries beat the place signal.
  // "average rent in Jabal Amman 3 bedroom" scores pSig=3 because "Jabal Amman"
  // is a recognised district, but the user wants a rental answer not a place listing.
  // These fire before the pSig check so general wins regardless of location keywords.
  const isRentalOrHousingQuery =
    /\b(rent|rental|renting|apartment|flat|housing|bedroom|1\s*br|2\s*br|3\s*br|average\s+rent|monthly\s+rent|find\s+an?\s+apartment|looking\s+to\s+rent|move\s+to|relocat|afford|neighborhood|neighbourhood)\b/i.test(effectiveInput.query) ||
    /إيجار|شقة|سكن|للإيجار|أين\s+أسكن|أفضل\s+مناطق|إيجار\s+شهري/.test(effectiveInput.query);
  if (isRentalOrHousingQuery && prodSig < 3) {
    return generalAnswer(effectiveInput, { provider: deps.provider });
  }

  // Entertainment-venue queries (watch a movie, go bowling, escape room) always
  // route to places even when "tonight" has fired isGeneralQuery via TODAY_EN.
  // The PLACE_HINTS additions for cinema/movie push pSig≥2 for most of these,
  // but this guard is a belt-and-suspenders for any that slip through.
  if (isEntertainmentVenueQuery && prodSig < 3) {
    return recommendPlaces(effectiveInput, deps);
  }

  // Strong product signal → go product, BUT only when product signal is strictly
  // stronger than place signal. This prevents "best coffee in Jabal Amman" (which
  // scores prodSig=3 via food category but pSig=4+ via PLACE_HINTS + governorate)
  // from being misrouted to the product catalogue.
  if (prodSig >= 3 && prodSig > pSig) return recommend(effectiveInput, deps);

  // Strong place signal → go places.
  // On a tie (prodSig === pSig) we favour places — "best cafes in Abdoun" is a
  // place query even though it technically has product-category keywords.
  if (pSig >= 2 && pSig >= prodSig) return recommendPlaces(effectiveInput, deps);

  // General queries (today digest, news, rental, tourism, etc.) win over weak product signals.
  // Only a genuinely product-specific signal (prodSig ≥ 3, e.g. "buy NEUHAUS chocolate") overrides.
  if (isGeneralQuery(effectiveInput.query) && prodSig < 3) {
    return generalAnswer(effectiveInput, { provider: deps.provider });
  }

  // Weak product signal or keyword-only
  if (prodSig > 0) return recommend(effectiveInput, deps);

  // Moderate place signal
  if (pSig > 0) return recommendPlaces(effectiveInput, deps);

  // Default: try product search
  return recommend(effectiveInput, deps);
}
