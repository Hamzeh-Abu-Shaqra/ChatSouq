/**
 * Canonical product taxonomy for the Jordan catalogue.
 *
 * The raw source categories are vendor-specific and noisy (e.g. five separate
 * "faux plant" buckets, scattered electronics accessories). Messy categories hurt
 * both browsing and the category-match signal in ranking. We collapse them into a
 * clean, shopper-facing department set with deterministic reasoning:
 *
 *   1. map the raw category to a canonical department, then
 *   2. when the raw category is generic/ambiguous, reason from the product name
 *      to pick a better department.
 *
 * Accuracy-first: this is pure code (no LLM), so categorisation is reproducible.
 */

export const PRODUCT_CATEGORIES = [
  "Beauty & Skincare",
  "Makeup",
  "Hair Care",
  "Perfume & Fragrance",
  "Health & Wellness",
  "Mobile Phones",
  "Tablets",
  "Computers & Laptops",
  "Audio & Headphones",
  "TVs & Displays",
  "Cameras",
  "Gaming",
  "Electronics & Accessories",
  "Home Appliances",
  "Home & Living",
  "Watches & Accessories",
  "Jewelry",
  "Bags & Luggage",
  "Toys & Games",
  "Baby & Kids",
  "Food & Gourmet",
  "Sports & Outdoors",
  "Stationery & Office",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

const OTHER: ProductCategory = "Home & Living";

/** Raw source category (lower-cased) -> canonical department. */
const RAW_TO_CANONICAL: Record<string, ProductCategory> = {
  "beauty & skincare": "Beauty & Skincare",
  "personal care": "Beauty & Skincare",
  "nail care": "Beauty & Skincare",
  makeup: "Makeup",
  "hair & beauty": "Hair Care",
  "perfume & fragrance": "Perfume & Fragrance",
  "health & wellness": "Health & Wellness",
  "mobile phones": "Mobile Phones",
  tablets: "Tablets",
  "computers & laptops": "Computers & Laptops",
  "audio & sound": "Audio & Headphones",
  "tvs & displays": "TVs & Displays",
  cameras: "Cameras",
  gaming: "Gaming",
  "electronics accessories": "Electronics & Accessories",
  networking: "Electronics & Accessories",
  "printers & scanners": "Electronics & Accessories",
  "smart home & security": "Electronics & Accessories",
  accessories: "Electronics & Accessories",
  "home appliances": "Home Appliances",
  "home & living": "Home & Living",
  lighting: "Home & Living",
  "vases & planters": "Home & Living",
  "faux flowers & plants": "Home & Living",
  "faux stems": "Home & Living",
  "faux plants": "Home & Living",
  "bouquets & arrangements": "Home & Living",
  "watches & accessories": "Watches & Accessories",
  jewelry: "Jewelry",
  "bags & backpacks": "Bags & Luggage",
  "toys & games": "Toys & Games",
  "baby & kids": "Baby & Kids",
  "belgian chocolates": "Food & Gourmet",
  "coffee & beverages": "Food & Gourmet",
  "sports & fitness": "Sports & Outdoors",
  stationery: "Stationery & Office",
};

// Raw categories too generic to trust — reason from the product name instead.
const GENERIC_RAW = new Set(["accessories", "home & living", "other", "", "general"]);

/**
 * High-confidence name overrides — fire BEFORE the raw category mapping.
 * Only add patterns that are unambiguous: a Samsonite is always luggage
 * regardless of what the vendor tagged it as.
 */
const STRONG_NAME_RULES: { re: RegExp; cat: ProductCategory }[] = [
  // Luggage brands that vendors sometimes tag under wrong departments.
  { re: /\b(samsonite|rimowa|delsey|american tourister|carlton|antler|briggs|tumi)\b/i, cat: "Bags & Luggage" },
  // Unambiguous product types that can't be anything else.
  { re: /\b(suitcase|trolley\s+(bag|luggage)?|spinner\s+(luggage|suitcase|bag|\d+))\b/i, cat: "Bags & Luggage" },
  // Planners/agendas from beauty vendors (e.g. Fairuzy/Mofkera on beautyboxjo).
  { re: /\b(mofkera|agenda|planner|day\s*planner)\b/i, cat: "Stationery & Office" },
  // Bath/home textiles sold on beauty sites.
  { re: /\b(bath\s+towel|guest\s+towel|bath\s+sheet|bath\s+mat|face\s+cloth)\b/i, cat: "Home & Living" },
  // Baby consumables with "baby" + specific type (avoids Maybelline "Baby Skin" primer).
  { re: /\bbaby\s+(wipes?|bottle|formula|powder|food|soap|diaper|nappy|lotion|shampoo)\b/i, cat: "Baby & Kids" },
  { re: /\b(feeding\s+bottle|nappy|baby\s+rash)\b/i, cat: "Baby & Kids" },
  // Gift cards and gift-wrap services — utilities, not shoppable products.
  { re: /\bgift\s*(cards?|vouchers?|wrap(ping)?|certificates?|blocks?)\b/i, cat: "Home & Living" },
  // Dental / oral care — tagged under beauty on multi-category beauty sites.
  { re: /\b(toothbrush(\s+head)?|toothpaste|dental floss|mouthwash|oral-b|oral b)\b/i, cat: "Health & Wellness" },
  // Medicines and supplements are never Beauty & Skincare.
  { re: /\b(vitamin|supplement|capsule|tablet|syrup|antibiotic|paracetamol|ibuprofen)\b/i, cat: "Health & Wellness" },
];

// Ordered name-keyword -> department rules. First match wins; specific first.
const NAME_RULES: { re: RegExp; cat: ProductCategory }[] = [
  { re: /\b(iphone|samsung galaxy|smartphone|mobile phone|phone case)\b/i, cat: "Mobile Phones" },
  { re: /\b(ipad|tablet|galaxy tab)\b/i, cat: "Tablets" },
  { re: /\b(macbook|laptop|notebook|desktop pc|monitor|keyboard|mouse)\b/i, cat: "Computers & Laptops" },
  { re: /\b(headphone|earbud|earphone|airpods|speaker|soundbar|headset)\b/i, cat: "Audio & Headphones" },
  { re: /\b(playstation|ps5|xbox|nintendo|console|controller|game pad)\b/i, cat: "Gaming" },
  { re: /\b(camera|lens|gopro|dslr|mirrorless)\b/i, cat: "Cameras" },
  { re: /\b(tv|television|smart tv|projector)\b/i, cat: "TVs & Displays" },
  { re: /\b(charger|cable|power bank|adapter|usb|hdmi|router|memory card|sd card)\b/i, cat: "Electronics & Accessories" },
  { re: /\b(watch|smartwatch)\b/i, cat: "Watches & Accessories" },
  { re: /\b(necklace|ring|bracelet|earring|pendant|gold|silver)\b/i, cat: "Jewelry" },
  { re: /\b(bag|backpack|handbag|luggage|suitcase|trolley|wallet|purse)\b/i, cat: "Bags & Luggage" },
  { re: /\b(perfume|fragrance|cologne|eau de|edt|edp)\b/i, cat: "Perfume & Fragrance" },
  { re: /\b(lipstick|mascara|foundation|eyeshadow|concealer|makeup)\b/i, cat: "Makeup" },
  { re: /\b(shampoo|conditioner|hair (dryer|oil|mask|serum))\b/i, cat: "Hair Care" },
  { re: /\b(serum|moisturizer|cleanser|skincare|cream|lotion|sunscreen)\b/i, cat: "Beauty & Skincare" },
  { re: /\b(chocolate|coffee|tea|sweets|honey|dates|gourmet)\b/i, cat: "Food & Gourmet" },
  { re: /\b(toy|lego|puzzle|doll|board game)\b/i, cat: "Toys & Games" },
  { re: /\b(baby|infant|stroller|diaper|nursery)\b/i, cat: "Baby & Kids" },
  { re: /\b(dumbbell|yoga|treadmill|fitness|tent|camping|bicycle)\b/i, cat: "Sports & Outdoors" },
  { re: /\b(notebook|pen|pencil|stationery|planner|agenda|office)\b/i, cat: "Stationery & Office" },
  { re: /\b(blender|microwave|fridge|refrigerator|vacuum|kettle|toaster|iron|fan|heater|air conditioner)\b/i, cat: "Home Appliances" },
  { re: /\b(vase|plant|flower|cushion|candle|lamp|decor|rug|curtain|towel|bedding)\b/i, cat: "Home & Living" },
];

function fromNameStrong(name: string): ProductCategory | null {
  for (const { re, cat } of STRONG_NAME_RULES) if (re.test(name)) return cat;
  return null;
}

function fromName(name: string): ProductCategory | null {
  for (const { re, cat } of NAME_RULES) if (re.test(name)) return cat;
  return null;
}

/**
 * Resolve the canonical department for a product.
 *
 * Priority order:
 *   1. STRONG_NAME_RULES — high-confidence name patterns that override bad vendor tags.
 *   2. RAW_TO_CANONICAL — vendor's raw category (trusted when not generic).
 *   3. NAME_RULES fallback — for generic/missing raw categories.
 *   4. OTHER ("Home & Living") as last resort.
 */
export function canonicalProductCategory(rawCategory: string | null, name: string): ProductCategory {
  // Strong name override fires first — corrects vendor miscategorization.
  const strong = fromNameStrong(name);
  if (strong) return strong;

  const raw = (rawCategory ?? "").trim().toLowerCase();
  const mapped = RAW_TO_CANONICAL[raw];

  if (!mapped || GENERIC_RAW.has(raw)) {
    const byName = fromName(name);
    if (byName) return byName;
  }
  return mapped ?? OTHER;
}
