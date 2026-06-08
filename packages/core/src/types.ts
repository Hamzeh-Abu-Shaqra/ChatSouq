export interface Constraints {
  rawQuery: string;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  /** DB category names matched from the query. */
  categories: string[];
  /** Free-text tokens used for keyword + vector retrieval. */
  keywords: string[];
  brands: string[];
  recipient: string | null;
  occasion: string | null;
  quantity: number | null;
}

export interface UserProfileInput {
  shopping?: {
    preferredBrands?: string[];
    priceSensitivity?: "value" | "balanced" | "luxury";
    shoppingBudget?: number;
  };
  financial?: { shoppingBudget?: number };
  geographic?: { area?: string };
}

export interface ResultListing {
  id: number;
  name: string;
  brand: string | null;
  price: number | null;
  currency: string;
  category: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  vendor: {
    id: number;
    name: string;
    location: string | null;
    websiteUrl: string | null;
  };
}

export interface ResultItem {
  listing: ResultListing;
  score: number;
  isBest: boolean;
  why: string;
  pros: string[];
  cons: string[];
}

export interface RecommendationResponse {
  kind: "products";
  query: string;
  constraints: Constraints;
  summary: string;
  best: ResultItem | null;
  alternatives: ResultItem[];
  meta: {
    provider: string;
    embedder: string;
    candidateCount: number;
    tookMs: number;
    relaxedBudget: boolean;
    relaxedCategory: boolean;
  };
}

// --- Places / services (Jordan knowledge graph) ------------------------------

export interface ResultPlace {
  id: number;
  name: string;
  nameAr: string | null;
  category: string;
  subcategory: string | null;
  governorate: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  lat: number | null;
  lng: number | null;
  sourceUrl: string | null;
}

export interface PlaceResultItem {
  place: ResultPlace;
  score: number;
  isBest: boolean;
  why: string;
  pros: string[];
  cons: string[];
}

export interface PlaceIntent {
  rawQuery: string;
  /** DB place-category names matched from the query. */
  categories: string[];
  governorate: string | null;
  city: string | null;
  /** Specific Amman neighbourhood/district, e.g. "jabal amman", "abdoun" */
  district: string | null;
  keywords: string[];
}

export interface PlaceRecommendationResponse {
  kind: "places";
  query: string;
  intent: PlaceIntent;
  summary: string;
  best: PlaceResultItem | null;
  alternatives: PlaceResultItem[];
  meta: {
    provider: string;
    embedder: string;
    candidateCount: number;
    tookMs: number;
    relaxedCategory: boolean;
    relaxedGovernorate: boolean;
  };
}

// --- General Q&A (Jordan knowledge, rentals, tourism, lifestyle) ---------------

export type NeighborhoodTier = "budget" | "mid-range" | "upscale" | "luxury";

export interface NeighborhoodCard {
  name: string;
  nameAr: string;
  city: string;
  governorate: string;
  avgRentMin: number;
  avgRentMax: number;
  tier: NeighborhoodTier;
  characteristics: string[];
  pros: string[];
  cons: string[];
  bestFor: string[];
}

export interface InfoCard {
  title: string;
  body: string;
  icon: "info" | "map" | "star" | "building" | "calendar" | "phone";
  /** Real URL from the database — news article, Talabat page, website, etc. */
  url?: string;
  /** Section grouping for the newspaper front layout: "news" | "restaurant" | "place" | "pro" */
  section?: string;
}

export interface GeneralAnswerResponse {
  kind: "general";
  query: string;
  intentType: "rental" | "lifestyle" | "tourism" | "weather" | "government" | "history" | "news" | "companies" | "general" | "today";
  summary: string;
  cards: NeighborhoodCard[] | InfoCard[];
  meta: {
    provider: string;
    tookMs: number;
  };
}

/** Discriminated union returned by the top-level router. */
export type AssistResponse = RecommendationResponse | PlaceRecommendationResponse | GeneralAnswerResponse;

/** Internal place candidate shape returned by place retrieval before ranking. */
export interface PlaceCandidate {
  id: number;
  name: string;
  nameAr: string | null;
  category: string;
  subcategory: string | null;
  governorate: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  lat: number | null;
  lng: number | null;
  sourceUrl: string | null;
  searchText: string | null;
  vecSim: number;
  txtSim: number;
}

/** A single turn in the conversation history (user message or assistant reply). */
export interface ConvMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RecommendInput {
  query: string;
  /** Prior turns in this session — used for context-aware follow-up answers. */
  history?: ConvMessage[];
  profile?: UserProfileInput;
  limit?: number;
}

/** Internal candidate shape returned by retrieval before ranking. */
export interface Candidate {
  id: number;
  vendorId: number;
  name: string;
  description: string | null;
  category: string | null;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  brand: string | null;
  sourceUrl: string | null;
  searchText: string | null;
  vendorName: string;
  vendorLocation: string | null;
  vendorWebsite: string | null;
  vecSim: number;
  txtSim: number;
}
