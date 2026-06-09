import type { AIProvider } from "@chatsouq/ai";
import type { Constraints, ConvMessage, UserProfileInput } from "./types";

const CURRENCY_WORDS = /\b(jod|jd|dinars?|دينار|دنانير|د\.?ا)\b/i;

/**
 * Curated query-term -> canonical category hints. Values MUST be canonical
 * department names (see packages/db/scripts/lib/taxonomy.ts) — they are matched
 * (case-insensitively) against the real categories stored in the DB at runtime.
 */
const CATEGORY_HINTS: Record<string, string[]> = {
  // Beauty & skincare
  skincare:     ["beauty & skincare"],
  skin:         ["beauty & skincare"],
  serum:        ["beauty & skincare"],
  moisturizer:  ["beauty & skincare"],
  moisturiser:  ["beauty & skincare"],
  cleanser:     ["beauty & skincare"],
  cream:        ["beauty & skincare"],
  lotion:       ["beauty & skincare"],
  sunscreen:    ["beauty & skincare"],
  toner:        ["beauty & skincare"],
  spf:          ["beauty & skincare"],
  retinol:      ["beauty & skincare"],
  // Makeup
  makeup:       ["makeup"],
  lipstick:     ["makeup"],
  mascara:      ["makeup"],
  foundation:   ["makeup"],
  eyeshadow:    ["makeup"],
  concealer:    ["makeup"],
  blush:        ["makeup"],
  eyeliner:     ["makeup"],
  primer:       ["makeup"],
  bronzer:      ["makeup"],
  highlighter:  ["makeup"],
  // Hair
  hair:         ["hair care"],
  shampoo:      ["hair care"],
  conditioner:  ["hair care"],
  hairdryer:    ["hair care"],
  "hair dryer": ["hair care"],
  straightener: ["hair care"],
  curler:       ["hair care"],
  // Fragrance
  perfume:      ["perfume & fragrance"],
  fragrance:    ["perfume & fragrance"],
  cologne:      ["perfume & fragrance"],
  scent:        ["perfume & fragrance"],
  "oud":        ["perfume & fragrance"],
  "attar":      ["perfume & fragrance"],
  // Health
  vitamin:      ["health & wellness"],
  vitamins:     ["health & wellness"],
  supplement:   ["health & wellness"],
  wellness:     ["health & wellness"],
  protein:      ["health & wellness"],
  collagen:     ["health & wellness"],
  probiotic:    ["health & wellness"],
  // Phones / tablets / computers
  phone:        ["mobile phones"],
  iphone:       ["mobile phones"],
  smartphone:   ["mobile phones"],
  android:      ["mobile phones"],
  samsung:      ["mobile phones"],
  pixel:        ["mobile phones"],
  tablet:       ["tablets"],
  ipad:         ["tablets"],
  laptop:       ["computers & laptops"],
  notebook:     ["computers & laptops"],
  computer:     ["computers & laptops"],
  macbook:      ["computers & laptops"],
  monitor:      ["computers & laptops"],
  keyboard:     ["computers & laptops"],
  desktop:      ["computers & laptops"],
  // Audio
  headphones:   ["audio & headphones"],
  headphone:    ["audio & headphones"],
  headset:      ["audio & headphones"],
  earbuds:      ["audio & headphones"],
  earphones:    ["audio & headphones"],
  earphone:     ["audio & headphones"],
  airpods:      ["audio & headphones"],
  earpods:      ["audio & headphones"],
  tws:          ["audio & headphones"],
  // Speakers (separate from headphones)
  speaker:      ["speakers"],
  speakers:     ["speakers"],
  soundbar:     ["speakers"],
  subwoofer:    ["speakers"],
  "jbl":        ["speakers", "audio & headphones"],
  // TV / cameras / gaming
  audio:        ["audio & headphones"],
  tv:           ["tvs & displays"],
  television:   ["tvs & displays"],
  projector:    ["tvs & displays"],
  screen:       ["tvs & displays"],
  camera:       ["cameras"],
  lens:         ["cameras"],
  gopro:        ["cameras"],
  dslr:         ["cameras"],
  mirrorless:   ["cameras"],
  gaming:       ["gaming"],
  console:      ["gaming"],
  playstation:  ["gaming"],
  xbox:         ["gaming"],
  nintendo:     ["gaming"],
  "ps5":        ["gaming"],
  "ps4":        ["gaming"],
  // Electronics accessories
  charger:      ["electronics & accessories"],
  cable:        ["electronics & accessories"],
  powerbank:    ["electronics & accessories"],
  "power bank": ["electronics & accessories"],
  adapter:      ["electronics & accessories"],
  router:       ["electronics & accessories"],
  // Home appliances
  blender:      ["home appliances"],
  microwave:    ["home appliances"],
  fridge:       ["home appliances"],
  refrigerator: ["home appliances"],
  vacuum:       ["home appliances"],
  kettle:       ["home appliances"],
  toaster:      ["home appliances"],
  "air fryer":  ["home appliances"],
  oven:         ["home appliances"],
  washer:       ["home appliances"],
  // Home & living
  vase:         ["home & living"],
  plant:        ["home & living"],
  flower:       ["home & living"],
  candle:       ["home & living"],
  lamp:         ["home & living"],
  furniture:    ["home & living"],
  decor:        ["home & living"],
  pillow:       ["home & living"],
  duvet:        ["home & living"],
  bedding:      ["home & living"],
  // Watches / jewelry / bags
  watch:        ["watches & accessories"],
  watches:      ["watches & accessories"],
  smartwatch:   ["watches & accessories"],
  jewelry:      ["jewelry"],
  jewellery:    ["jewelry"],
  necklace:     ["jewelry"],
  ring:         ["jewelry"],
  bracelet:     ["jewelry"],
  earring:      ["jewelry"],
  earrings:     ["jewelry"],
  bag:          ["bags & luggage"],
  backpack:     ["bags & luggage"],
  handbag:      ["bags & luggage"],
  luggage:      ["bags & luggage"],
  suitcase:     ["bags & luggage"],
  wallet:       ["bags & luggage"],
  purse:        ["bags & luggage"],
  // Toys / baby
  toy:          ["toys & games"],
  toys:         ["toys & games"],
  lego:         ["toys & games"],
  puzzle:       ["toys & games"],
  baby:         ["baby & kids"],
  kids:         ["baby & kids"],
  stroller:     ["baby & kids"],
  "car seat":   ["baby & kids"],
  // Food / sports / stationery
  chocolate:    ["food & gourmet"],
  chocolates:   ["food & gourmet"],
  sweets:       ["food & gourmet"],
  coffee:       ["food & gourmet"],
  tea:          ["food & gourmet"],
  camping:      ["sports & outdoors"],
  tent:         ["sports & outdoors"],
  outdoor:      ["sports & outdoors"],
  fitness:      ["sports & outdoors"],
  yoga:         ["sports & outdoors"],
  bicycle:      ["sports & outdoors"],
  treadmill:    ["sports & outdoors"],
  gym:          ["sports & outdoors"],
  game:         ["gaming", "toys & games"],
  games:        ["gaming", "toys & games"],
  "board game": ["toys & games"],
  "card game":  ["toys & games"],
  office:       ["stationery & office"],
  "office supplies": ["stationery & office"],
  pen:          ["stationery & office"],
  stationery:   ["stationery & office"],

  // ── Arabic terms ─────────────────────────────────────────────────────────────
  // Audio
  "سماعات":        ["audio & headphones"],
  "سماعة":         ["audio & headphones"],
  "سماعات لاسلكية":["audio & headphones"],
  "سماعات بلوتوث": ["audio & headphones"],
  "إيربودز":       ["audio & headphones"],
  "ايربودز":       ["audio & headphones"],
  "سبيكر":         ["speakers"],
  "مكبر صوت":      ["speakers"],
  "مكبر":          ["speakers"],
  // Phones / tablets / computers
  "موبايل":        ["mobile phones"],
  "جوال":          ["mobile phones"],
  "هاتف":          ["mobile phones"],
  "هواتف":         ["mobile phones"],
  "آيفون":         ["mobile phones"],
  "ايفون":         ["mobile phones"],
  "لابتوب":        ["computers & laptops"],
  "حاسوب":         ["computers & laptops"],
  "كمبيوتر":       ["computers & laptops"],
  "لاب توب":       ["computers & laptops"],
  "تابلت":         ["tablets"],
  "لوح ذكي":       ["tablets"],
  // TV / cameras / gaming
  "تلفزيون":       ["tvs & displays"],
  "تلفاز":         ["tvs & displays"],
  "شاشة":          ["tvs & displays", "computers & laptops"],
  "كاميرا":        ["cameras"],
  "البلايستيشن":   ["gaming"],
  "بلايستيشن":     ["gaming"],
  "العاب":         ["gaming"],
  // Electronics accessories
  "شاحن":          ["electronics & accessories"],
  "باور بنك":      ["electronics & accessories"],
  // Watches
  "ساعة":          ["watches & accessories"],
  "ساعات":         ["watches & accessories"],
  "ساعة ذكية":     ["watches & accessories"],
  "ساعات ذكية":    ["watches & accessories"],
  // Beauty / makeup / hair / fragrance / health
  "بشرة":          ["beauty & skincare"],
  "كريم":          ["beauty & skincare"],
  "سيروم":         ["beauty & skincare"],
  "واقي شمس":      ["beauty & skincare"],
  "مكياج":         ["makeup"],
  "احمر شفاه":     ["makeup"],
  "أحمر شفاه":     ["makeup"],
  "ماسكرا":        ["makeup"],
  "فاونديشن":      ["makeup"],
  "شامبو":         ["hair care"],
  "بلسم":          ["hair care"],
  "عطر":           ["perfume & fragrance"],
  "عطور":          ["perfume & fragrance"],
  "بخاخ":          ["perfume & fragrance"],
  "عود":           ["perfume & fragrance"],
  "فيتامين":       ["health & wellness"],
  "مكمل":          ["health & wellness"],
  "بروتين":        ["health & wellness"],
  // Home appliances
  "خلاط":          ["home appliances"],
  "غسالة":         ["home appliances"],
  "ثلاجة":         ["home appliances"],
  "مكيف":          ["home appliances"],
  "مكنسة":         ["home appliances"],
  "ميكرويف":       ["home appliances"],
  "غلاية":         ["home appliances"],
  "غلاية ماء":     ["home appliances"],
  "مكواة":         ["home appliances"],
  "فرن":           ["home appliances"],
  "مروحة":         ["home appliances"],
  "سخان":          ["home appliances"],
  // Home & living
  "ديكور":         ["home & living"],
  "مفرش":          ["home & living"],
  "شمعة":          ["home & living"],
  "لحاف":          ["home & living"],
  "وسادة":         ["home & living"],
  // Bags / jewelry
  "حقيبة":         ["bags & luggage"],
  "شنطة":          ["bags & luggage"],
  "حقائب":         ["bags & luggage"],
  "حقيبة سفر":     ["bags & luggage"],
  "مجوهرات":       ["jewelry"],
  "خاتم":          ["jewelry"],
  "قلادة":         ["jewelry"],
  "سوار":          ["jewelry"],
  "حلق":           ["jewelry"],
  // Toys / baby / kids
  "لعبة":          ["toys & games"],
  "ألعاب":         ["toys & games"],
  "أطفال":         ["baby & kids"],
  "رضيع":          ["baby & kids"],
  "مواليد":        ["baby & kids"],
  "عربية أطفال":   ["baby & kids"],
  // Food
  "قهوة":          ["food & gourmet"],
  "شوكولاتة":      ["food & gourmet"],
  "شوكولا":        ["food & gourmet"],
  "حلويات":        ["food & gourmet"],
  // Sports
  "رياضة":         ["sports & outdoors"],
  "دراجة":         ["sports & outdoors"],
  "جيم":           ["sports & outdoors"],
  "ألعاب لوحية":    ["toys & games"],
  "مستلزمات مكتب":  ["stationery & office"],
};

const RECIPIENTS: Record<string, string> = {
  // English
  mother: "mother", mom: "mother", mum: "mother", mama: "mother",
  wife: "wife", husband: "husband",
  girlfriend: "girlfriend", boyfriend: "boyfriend",
  father: "father", dad: "father",
  sister: "sister", brother: "brother",
  son: "son", daughter: "daughter",
  kid: "kids", kids: "kids", child: "kids", children: "kids",
  friend: "friend", colleague: "colleague", boss: "boss",
  // Gender/generic references
  man: "him", guy: "him", gentleman: "him",
  woman: "her", girl: "her", lady: "her",
  // Extended family
  nephew: "nephew", niece: "niece",
  grandma: "grandmother", grandmother: "grandmother", nana: "grandmother", granny: "grandmother",
  grandpa: "grandfather", grandfather: "grandfather",
  fiance: "partner", fiancee: "partner",
  teacher: "colleague",
  family: "family",
  // Arabic
  "أمي": "mother", "امي": "mother", "أمه": "mother", "ماما": "mother",
  "أبي": "father", "ابي": "father", "بابا": "father", "ابوي": "father",
  "زوجتي": "wife", "زوجي": "husband",
  "حبيبتي": "girlfriend", "حبيبي": "boyfriend",
  "أختي": "sister", "اختي": "sister",
  "أخي": "brother", "اخي": "brother",
  "ابني": "son", "ابنتي": "daughter", "بنتي": "daughter",
  "صديقي": "friend", "صديقتي": "friend",
  "طفلي": "kids", "ولدي": "son",
  "خطيبي": "partner", "خطيبتي": "partner",
  "عريسي": "partner", "عروستي": "partner",
  "جدتي": "grandmother", "جدي": "grandfather",
  "عمتي": "aunt", "خالتي": "aunt",
  "عمي": "uncle", "خالي": "uncle",
  "عيلتي": "family", "أهلي": "family",
};

const OCCASIONS: Record<string, string> = {
  // English
  birthday: "birthday", anniversary: "anniversary", wedding: "wedding",
  engagement: "engagement", graduation: "graduation",
  ramadan: "ramadan", eid: "eid", christmas: "christmas",
  valentine: "valentine", valentines: "valentine",
  housewarming: "housewarming", newborn: "new baby",
  // Arabic
  "عيد الميلاد": "birthday", "عيد ميلاد": "birthday",
  "رمضان": "ramadan",
  "عيد الفطر": "eid", "عيد الأضحى": "eid", "العيد": "eid", "عيد": "eid",
  "خطوبة": "engagement", "الخطوبة": "engagement",
  "زفاف": "wedding", "الزفاف": "wedding", "فرح": "wedding",
  "تخرج": "graduation", "التخرج": "graduation",
  "الفلانتاين": "valentine", "فلانتاين": "valentine",
  "أم": "mother", // Mother's Day — لعيد الأم
};

const STOPWORDS = new Set([
  // English
  "a","an","the","for","to","of","in","on","under","below","less","than","my","me","i",
  "want","need","looking","find","get","buy","with","and","or","best",
  "good","nice","jod","jd","dinar","dinars","around","about","budget","price","cheap",
  "between","max","maximum","up","at","is","that","she","he","her","his","likes","like",
  "show","give","some","top","quality","recommend","recommendations","something",
  "new","latest","using","use","type","kind","which","what","how",
  // Generic filler — no product signal
  "ideas","idea","him","option","options","choice","choices",
  // Arabic function words & filler
  "اريد","أريد","ابغى","أبغى","ابي","أبي","محتاج","محتاجة","ابحث","أبحث",
  "عن","من","إلى","الى","في","على","عن","هل","ماذا","كيف","ايش","وش",
  "لي","لك","له","لها","لهم","لنا","عندي","عندك",
  "أنا","انا","انت","أنت","هو","هي",
  "دينار","دنانير","أردني","الأردني",
  "اريد","بغيت","حابب","حابة","محتاج","محتاجه",
  "مثل","زي","نوع","نوعية","افضل","أفضل","أحسن","احسن",
  "اقترح","اقترحلي","وصي","وصيلي","عطني","عطيني",
  "شوفلي","دورلي","فين","وين","منين",
  "يسوى","يساوي","بكم","بكم","قيمته","سعره",
]);

/**
 * Product attribute markers that must be preserved as keywords even when short.
 * These help discriminate product sub-types (wireless vs wired, ANC vs non-ANC, etc.)
 */
const IMPORTANT_ATTRIBUTES = new Set([
  "wireless", "wired", "bluetooth", "wifi", "4g", "5g",
  "anc", "tws", "usb", "hdmi", "rgb", "uhd", "hdr", "4k", "8k",
  "oled", "amoled", "ips", "lcd", "qled",
  "refurbished", "new", "original", "genuine",
  "mini", "pro", "plus", "max", "lite", "ultra",
  "over-ear", "on-ear", "in-ear", "neckband",
  "noise-cancelling", "noise-canceling", "water-resistant", "waterproof",
  "fast-charging", "quick-charge",
]);

/**
 * Common brand names — extracted for the `brands` constraint instead of treating
 * as generic keywords. Prevents "apple" appearing in food search results etc.
 */
const BRAND_NAMES = new Set([
  "apple","samsung","sony","lg","huawei","xiaomi","oppo","oneplus","realme","nokia","motorola",
  "asus","lenovo","hp","dell","acer","msi","microsoft","google","amazon",
  "jbl","bose","sennheiser","sony","skullcandy","beats","anker","jabra","plantronics",
  "casio","seiko","citizen","tissot","fossil","michael kors","guess","tommy hilfiger",
  "nike","adidas","puma","gucci","louis vuitton","chanel","dior","versace",
  "panasonic","philips","bosch","siemens","miele","dyson","kitchenaid","nespresso",
  "iphone","macbook","ipad","airpods","apple watch","galaxy","surface",
]);

/** Normalise Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) to Western digits */
function normaliseDigits(s: string): string {
  return s.replace(/[٠١٢٣٤٥٦٧٨٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
}

function parseBudget(q: string): { min: number | null; max: number | null } {
  const text = normaliseDigits(q.toLowerCase());
  const num = (s: string | undefined) => Number((s ?? "").replace(/,/g, ""));

  // Arabic: "بين X و Y" / "بين X إلى Y"
  const arBetween = text.match(/بين\s+(\d[\d,]*)\s+(?:و|إلى|الى)\s+(\d[\d,]*)/);
  if (arBetween) return { min: num(arBetween[1]), max: num(arBetween[2]) };

  // English: "between X and/to Y"
  const between = text.match(/between\s+(\d[\d,]*)\s+(?:and|to|-)\s+(\d[\d,]*)/);
  if (between) return { min: num(between[1]), max: num(between[2]) };

  const range = text.match(/(\d[\d,]*)\s*-\s*(\d[\d,]*)\s*(?:jod|jd|dinars?)?/);
  if (range && /(jod|jd|dinar|budget|price)/.test(text)) {
    return { min: num(range[1]), max: num(range[2]) };
  }

  // Arabic: "حول X" / "تقريباً X" / "ما يقارب X"
  const arAround = text.match(/(?:حول|تقريبا|تقريباً|ما يقارب|قريب من)\s+(\d[\d,]*)/);
  if (arAround) {
    const n = num(arAround[1]);
    return { min: Math.floor(n * 0.7), max: Math.ceil(n * 1.3) };
  }

  // English: "around/about 80"
  const around = text.match(/(?:around|about|approximately|roughly|~|circa)\s+(\d[\d,]*)/);
  if (around) {
    const n = num(around[1]);
    return { min: Math.floor(n * 0.7), max: Math.ceil(n * 1.3) };
  }

  // Arabic: "أقل من X" / "تحت X" / "ما يتجاوز X" / "بحدود X"
  const arUnder = text.match(/(?:أقل من|اقل من|تحت|ما يتجاوز|بحدود|لحد)\s+(\d[\d,]*)/);
  if (arUnder) return { min: null, max: num(arUnder[1]) };

  // English: "under/below/less than/max/up to"
  const under = text.match(/(?:under|below|less than|max|maximum|up to|within)\s+(\d[\d,]*)/);
  if (under) return { min: null, max: num(under[1]) };

  // Arabic: "أكثر من X" / "فوق X" / "من X"
  const arOver = text.match(/(?:أكثر من|اكثر من|فوق|ابتداء من|من)\s+(\d[\d,]*)/);
  if (arOver) return { min: num(arOver[1]), max: null };

  const over = text.match(/(?:over|above|more than|at least|from)\s+(\d[\d,]*)/);
  if (over) return { min: num(over[1]), max: null };

  // "50 jod" / "budget of 50" / "50 دينار"
  const withCurrency = text.match(/(\d[\d,]*)\s*(?:jod|jd|dinars?|دينار|دنانير)/);
  if (withCurrency) return { min: null, max: num(withCurrency[1]) };
  const budgetOf = text.match(/(?:budget|price)\s*(?:of|is|:)?\s*(\d[\d,]*)/);
  if (budgetOf) return { min: null, max: num(budgetOf[1]) };

  return { min: null, max: null };
}

function parseQuantity(q: string): number | null {
  const m = q.toLowerCase().match(/\bfor\s+(two|three|four|2|3|4)\b/);
  const token = m?.[1];
  if (!token) return null;
  const map: Record<string, number> = { two: 2, three: 3, four: 4 };
  return map[token] ?? Number(token);
}

/** True when a string contains at least one Arabic/RTL character */
function containsArabic(s: string): boolean {
  return /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(s);
}

/**
 * Strip common single-character Arabic prefix particles (ل، ب، ك، و، ف) that
 * attach to words without a space. We do this selectively — only when the prefix
 * is followed by an Arabic letter that starts a known word, so we don't corrupt
 * words that genuinely start with ل/ب (e.g. لون = color, بنت = girl).
 *
 * Strategy: strip only from the QUERY string used for recipient/occasion matching,
 * NOT from keyword extraction (where the full token is already a stopword anyway).
 *
 * Examples: "لأمي" → "أمي", "لعيد" → "عيد", "لرمضان" → "رمضان"
 */
function normalizeArabicPrefixes(q: string): string {
  // Strip "ل" (for/to) and "ب" (with/by) prefix particles that attach without a space.
  // Only strip when at start of string or after a space (i.e., at the start of a token).
  // "لأمي" → "أمي", "لعيد" → "عيد", "للعيد" → "العيد"
  // Note: \b doesn't work for Arabic, so we use (^|\s) boundaries.
  return q
    .replace(/(^|\s)لل/g, "$1ال")  // للعيد → العيد
    .replace(/(^|\s)ل(?=[؀-ۿ])/g, "$1")  // ل + Arabic → strip ل
    .replace(/(^|\s)ب(?=[؀-ۿ])/g, "$1");  // ب + Arabic → strip ب
}

/**
 * Build a regex for a category hint term.
 * - Multi-word terms: simple substring match (no word boundaries needed).
 * - Arabic single-word: space/start/end boundaries (JS `\b` doesn't fire on Arabic).
 * - Latin single-word: standard `\b` word boundary.
 */
function hintPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (term.includes(" ")) return new RegExp(escaped, "i");
  if (containsArabic(term)) return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, "i");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

function matchCategories(q: string, dbCategories: string[]): string[] {
  const lower = q.toLowerCase();
  const normalized = normalizeArabicPrefixes(lower);
  const byLower = new Map(dbCategories.map((c) => [c.toLowerCase(), c]));
  const matched = new Set<string>();

  // 1) curated hints — multi-word first (longest first), then single-word
  const multiWordHints = Object.entries(CATEGORY_HINTS)
    .filter(([k]) => k.includes(" "))
    .sort((a, b) => b[0].length - a[0].length);
  const singleWordHints = Object.entries(CATEGORY_HINTS).filter(([k]) => !k.includes(" "));

  for (const [term, cats] of [...multiWordHints, ...singleWordHints]) {
    if (term === "notebook_stationery") continue; // collision guard
    const pat = hintPattern(term);
    if (pat.test(lower) || pat.test(normalized)) {
      for (const c of cats) {
        const real = byLower.get(c.toLowerCase());
        if (real) matched.add(real);
      }
    }
  }

  // 2) direct substring of a real category name appearing in the query
  for (const [lc, real] of byLower) {
    const head = (lc.split(/[&,/]/)[0] ?? "").trim();
    if (head.length > 3 && (lower.includes(head) || normalized.includes(head))) matched.add(real);
  }

  return [...matched];
}

function extractBrands(q: string): string[] {
  const lower = q.toLowerCase();
  const found: string[] = [];
  for (const brand of BRAND_NAMES) {
    if (new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower)) {
      found.push(brand);
    }
  }
  return found;
}

/**
 * Jordanian geographic terms that should NOT become product search keywords.
 * They carry location context but pollute keyword-based product ranking.
 */
const JORDAN_GEO_STOPWORDS = new Set([
  // English governorates / common city names
  "amman", "jordan", "irbid", "zarqa", "aqaba", "jerash", "madaba", "karak",
  "mafraq", "balqa", "ajloun", "tafilah", "tafila", "maan", "salt", "petra",
  // Arabic
  "عمان", "الأردن", "اردن", "إربد", "اربد", "الزرقاء", "زرقاء",
  "العقبة", "عقبة", "جرش", "مادبا", "الكرك", "كرك",
  "المفرق", "مفرق", "البلقاء", "السلط", "عجلون", "الطفيلة", "معان",
]);

function extractKeywords(q: string): string[] {
  const tokens = q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  return tokens.filter((w) => {
    if (w.length < 2) return false;
    if (STOPWORDS.has(w)) return false;
    if (JORDAN_GEO_STOPWORDS.has(w)) return false;
    if (/^\d+$/.test(w)) return false;
    // Keep important attributes even if short (e.g. "4k", "tws")
    if (IMPORTANT_ATTRIBUTES.has(w)) return true;
    // Drop brand names from keyword list (they go into `brands`)
    if (BRAND_NAMES.has(w)) return false;
    // Arabic words are often shorter — keep any Arabic token ≥ 2 chars not in stopwords
    if (containsArabic(w)) return w.length >= 2;
    if (w.length < 3) return false;
    return true;
  });
}

function firstMatch(q: string, table: Record<string, string>): string | null {
  const lower = q.toLowerCase();
  // Also test a prefix-normalised version for Arabic queries
  const normalized = normalizeArabicPrefixes(lower);
  // Sort by key length descending so multi-word Arabic phrases match before substrings
  const entries = Object.entries(table).sort((a, b) => b[0].length - a[0].length);
  for (const [k, v] of entries) {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = containsArabic(k)
      ? new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`)
      : new RegExp(`\\b${escaped}\\b`);
    if (pattern.test(lower) || pattern.test(normalized)) return v;
  }
  return null;
}

/**
 * Deterministic intent parser. All numeric constraints (budget) are extracted
 * here in code — never from an LLM. Returns a structured Constraints object.
 */
export function parseConstraints(query: string, dbCategories: string[]): Constraints {
  const budget = parseBudget(query);
  const brands = extractBrands(query);
  return {
    rawQuery: query,
    budgetMin: budget.min,
    budgetMax: budget.max,
    currency: CURRENCY_WORDS.test(query) ? "JOD" : "JOD",
    categories: matchCategories(query, dbCategories),
    keywords: extractKeywords(query),
    brands,
    recipient: firstMatch(query, RECIPIENTS),
    occasion: firstMatch(query, OCCASIONS),
    quantity: parseQuantity(query),
  };
}

/** Fold a user profile into constraints (only fills gaps the user didn't state). */
export function applyProfile(c: Constraints, profile?: UserProfileInput): Constraints {
  if (!profile) return c;
  const out = { ...c, brands: [...c.brands] };
  if (out.budgetMax === null) {
    const b = profile.shopping?.shoppingBudget ?? profile.financial?.shoppingBudget;
    if (typeof b === "number") out.budgetMax = b;
  }
  if (profile.shopping?.preferredBrands?.length) {
    out.brands = [...new Set([...out.brands, ...profile.shopping.preferredBrands])];
  }
  return out;
}

/**
 * Optional LLM enrichment: when a real provider is configured, ask it to map the
 * query to additional category names + keywords. Numbers are NOT touched here —
 * budget stays exactly as parsed deterministically. Best-effort; failures ignored.
 */
export async function enrichWithLLM(
  c: Constraints,
  provider: AIProvider,
  dbCategories: string[],
  history?: ConvMessage[]
): Promise<Constraints> {
  if (provider.isMock) return c;
  try {
    const alreadyMapped = c.categories.join(", ");

    // Build user message — prepend last 2 user turns from history as prior context
    const priorUserTurns = (history ?? [])
      .filter((m) => m.role === "user")
      .slice(-2);
    const userContent = priorUserTurns.length > 0
      ? `Prior context:\n${priorUserTurns.map((m) => `- "${m.content}"`).join("\n")}\n\nCurrent query: ${c.rawQuery}\nAlready mapped to: ${alreadyMapped || "none"}\nAvailable categories: ${dbCategories.join(", ")}`
      : `Query: ${c.rawQuery}\nAlready mapped to: ${alreadyMapped || "none"}\nAvailable categories: ${dbCategories.join(", ")}`;

    const res = await provider.complete({
      system:
        "You map a shopping query to specific product categories in a Jordan e-commerce catalogue. " +
        'Return JSON {"categories": string[], "keywords": string[]}. ' +
        "Rules:\n" +
        "1. Only use category names EXACTLY as given in the list.\n" +
        "2. Pick the MOST SPECIFIC matching category — never add a broad umbrella category " +
        "(e.g. 'Electronics & Accessories') when a specific sub-category already matches " +
        "(e.g. 'Audio & Headphones'). Broad categories are only valid when no specific one fits.\n" +
        "3. Add at most 1-2 categories. Do NOT include prices, numbers, or brand names in keywords.\n" +
        "4. For audio queries: 'headphones' → 'Audio & Headphones'; 'speakers' → 'Speakers'.\n" +
        "5. Keywords must be product-type terms, NOT attribute adjectives (e.g. add 'headphones' not 'wireless').\n" +
        "If the current query is a follow-up (uses pronouns like 'it', 'this', 'that', 'one', 'there', 'cheaper', 'better', 'similar'), use the prior context to resolve what it refers to and produce more specific categories + keywords.",
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
      json: true,
      temperature: 0,
      maxTokens: 300,
    });
    const parsed = JSON.parse(res.text) as { categories?: string[]; keywords?: string[] };
    const valid = new Set(dbCategories);
    const llmCats = (parsed.categories ?? []).filter((x) => valid.has(x));
    // Only add LLM categories that are at least as specific as already-mapped ones.
    const existingMin = c.categories.length ? Math.min(...c.categories.map((x) => x.length)) : 0;
    const filteredCats = llmCats.filter(
      (cat) => c.categories.length === 0 || cat.length >= existingMin - 5
    );
    // Deduplicate and filter LLM keywords (no brands, no numbers, no stopwords)
    const llmKeywords = (parsed.keywords ?? [])
      .map((k) => k.toLowerCase().trim())
      .filter((k) => k.length > 2 && !STOPWORDS.has(k) && !/^\d+$/.test(k) && !BRAND_NAMES.has(k));
    return {
      ...c,
      categories: [...new Set([...c.categories, ...filteredCats])],
      keywords: [...new Set([...c.keywords, ...llmKeywords])],
    };
  } catch {
    return c;
  }
}
