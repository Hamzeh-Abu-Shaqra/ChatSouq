import type {
  AssistResponse,
  PlaceRecommendationResponse,
  RecommendationResponse,
} from "@chatsouq/core";

// ── Core vendor type ──────────────────────────────────────────────────────────

export interface Vendor {
  rank: number;
  id: number;
  name: string;
  nameAr?: string;
  category: string;
  subcategory?: string;
  location: string;
  neighborhood?: string;
  governorate?: string;
  lat?: number;
  lng?: number;
  priceRange?: string;
  minPrice?: number;
  maxPrice?: number;
  currency: "JOD";
  rating?: number;
  reviewCount?: number;
  tags: string[];
  whyItFits: string;
  whatsapp?: string;
  website?: string;
  instagram?: string;
  phone?: string;
  imageUrl?: string;
  sourceUrl?: string;
  isTopPick: boolean;
  openNow?: boolean;
  hours?: string;
  address?: string;
  /** Tavily confirmed this place exists online with positive/neutral signals */
  tavilyValidated?: boolean;
  /** Human-readable warnings from Tavily: "Permanently closed", "Has moved", etc. */
  warningFlags?: string[];
}

// ── Chat response type ────────────────────────────────────────────────────────

export interface ChatResponse {
  query: string;
  category: string;
  location: string;
  totalResults: number;
  editorialIntro: string;
  connectorText?: string;
  insightText?: string;
  featuredVendor: Vendor | null;
  gridVendors: Vendor[];
  allVendors: Vendor[];
  followUpPrompts: string[];
  isArabic: boolean;
  responseTimeMs: number;
  kind: "products" | "places";
}

// ── Adapter: PlaceRecommendationResponse → ChatResponse ──────────────────────

function placeToVendor(item: PlaceRecommendationResponse["best"], rank: number): Vendor | null {
  if (!item) return null;
  const p = item.place;
  const loc = [p.city, p.governorate].filter(Boolean).join(", ") || "Jordan";
  // Build price range from pros that mention JOD, or leave undefined
  const pricePro = item.pros.find((pro) => pro.includes("JOD") || pro.includes("دينار"));
  // Build tags from item.tags (LLM-generated) or fall back to pros-based tags
  const tags: string[] = item.tags?.length
    ? item.tags
    : item.pros
        .filter((p) => !p.startsWith("Located") && !p.startsWith("موجود") && !p.startsWith("Contact:") && !p.startsWith("للتواصل"))
        .slice(0, 4);

  const sig = item.tavilySignal;

  return {
    rank,
    id: p.id,
    name: p.name,
    nameAr: p.nameAr ?? undefined,
    category: p.category,
    subcategory: p.subcategory ?? undefined,
    location: loc,
    neighborhood: p.city ?? undefined,
    governorate: p.governorate ?? undefined,
    lat: p.lat ?? undefined,
    lng: p.lng ?? undefined,
    priceRange: pricePro,
    currency: "JOD",
    rating: p.rating ?? undefined,
    tags,
    whyItFits: item.why,
    phone: p.phone ?? undefined,
    website: p.website ?? undefined,
    sourceUrl: p.sourceUrl ?? undefined,
    address: p.address ?? undefined,
    hours: p.openingHours ?? undefined,
    isTopPick: rank === 1,
    // Tavily validation — show badge when confirmed, pass through warnings
    tavilyValidated: sig?.validated === true && sig.warningFlags.length === 0,
    warningFlags: sig?.warningFlags?.length ? sig.warningFlags : undefined,
  };
}

function productToVendor(item: RecommendationResponse["best"], rank: number): Vendor | null {
  if (!item) return null;
  const l = item.listing;
  const tags: string[] = item.tags?.length
    ? item.tags
    : item.pros.filter((p) => p.length < 40).slice(0, 4);
  return {
    rank,
    id: l.id,
    name: l.name,
    category: l.category ?? "Product",
    subcategory: l.brand ?? undefined,
    location: l.vendor.location ?? "Jordan",
    neighborhood: l.vendor.location ?? undefined,
    priceRange: l.price != null ? `${l.price} JOD` : undefined,
    minPrice: l.price ?? undefined,
    maxPrice: l.price ?? undefined,
    currency: "JOD",
    tags,
    whyItFits: item.why,
    website: l.vendor.websiteUrl ?? undefined,
    sourceUrl: l.sourceUrl ?? undefined,
    imageUrl: l.imageUrl ?? undefined,
    isTopPick: rank === 1,
  };
}

export function adaptResponse(res: AssistResponse, tookMs: number): ChatResponse | null {
  if (res.kind === "general") return null;

  const isArabic = /[؀-ۿ]/.test(res.query);

  if (res.kind === "places") {
    const allItems = [res.best, ...res.alternatives].filter(Boolean) as NonNullable<typeof res.best>[];
    const allVendors = allItems.map((item, i) => placeToVendor(item, i + 1)).filter(Boolean) as Vendor[];
    const category = res.intent.categories[0] ?? "Places";
    const location = res.intent.district ?? res.intent.city ?? res.intent.governorate ?? "Jordan";
    return {
      kind: "places",
      query: res.query,
      category,
      location,
      totalResults: allVendors.length,
      editorialIntro: res.summary,
      connectorText: res.connectorText,
      insightText: res.insightText,
      featuredVendor: allVendors[0] ?? null,
      gridVendors: allVendors.slice(1, 4),
      allVendors,
      followUpPrompts: res.followUpPrompts ?? [],
      isArabic,
      responseTimeMs: tookMs,
    };
  }

  // products
  const allItems = [res.best, ...res.alternatives].filter(Boolean) as NonNullable<typeof res.best>[];
  const allVendors = allItems.map((item, i) => productToVendor(item, i + 1)).filter(Boolean) as Vendor[];
  const category = res.constraints.categories[0] ?? "Products";
  const location = res.constraints.keywords.slice(0, 2).join(", ") || "Jordan";
  return {
    kind: "products",
    query: res.query,
    category,
    location,
    totalResults: allVendors.length,
    editorialIntro: res.summary,
    connectorText: res.connectorText,
    insightText: res.insightText,
    featuredVendor: allVendors[0] ?? null,
    gridVendors: allVendors.slice(1, 4),
    allVendors,
    followUpPrompts: res.followUpPrompts ?? [],
    isArabic,
    responseTimeMs: tookMs,
  };
}
