import {
  pgTable,
  integer,
  bigint,
  boolean,
  doublePrecision,
  text,
  numeric,
  timestamp,
  jsonb,
  uuid,
  varchar,
  vector,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Embedding dimensionality. Matches the local MiniLM embedder (all-MiniLM-L6-v2).
 * If you switch to a different embedding model, change this and re-embed.
 */
export const EMBEDDING_DIM = 384;

// --- Jordan knowledge layer: businesses + their catalogue ---------------------

export const vendors = pgTable("vendors", {
  id: integer("id").primaryKey(),
  userId: integer("user_id"),
  businessName: text("business_name").notNull(),
  category: text("category"),
  description: text("description"),
  location: text("location"),
  websiteUrl: text("website_url"),
  instagramUrl: text("instagram_url"),
  status: text("status").default("approved").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const listings = pgTable(
  "listings",
  {
    id: integer("id").primaryKey(),
    vendorId: integer("vendor_id")
      .notNull()
      .references(() => vendors.id),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    // Canonical numeric price — the source of truth for all budget math.
    price: numeric("price", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 8 }).default("JOD").notNull(),
    imageUrl: text("image_url"),
    brand: text("brand"),
    sourceUrl: text("source_url"),
    searchText: text("search_text"),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    categoryIdx: index("listings_category_idx").on(t.category),
    priceIdx: index("listings_price_idx").on(t.price),
    vendorIdx: index("listings_vendor_idx").on(t.vendorId),
    brandIdx: index("listings_brand_idx").on(t.brand),
  })
);

// --- Jordan knowledge graph: geography + places/services ----------------------

/**
 * Administrative + populated-place geography (governorates, districts, cities,
 * towns). Sourced from OpenStreetMap (ODbL). Gives geo-context to every place.
 */
export const regions = pgTable(
  "regions",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    osmId: bigint("osm_id", { mode: "number" }),
    name: text("name").notNull(),
    nameAr: text("name_ar"),
    kind: text("kind").notNull(), // country | governorate | district | city | town | village | suburb
    adminLevel: integer("admin_level"),
    parentId: integer("parent_id"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    population: integer("population"),
    source: text("source").default("osm").notNull(),
    raw: jsonb("raw").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    kindIdx: index("regions_kind_idx").on(t.kind),
    nameIdx: index("regions_name_idx").on(t.name),
    osmIdx: uniqueIndex("regions_osm_idx").on(t.osmId),
  })
);

/**
 * Real Jordan businesses / points-of-interest: restaurants, cafes, gyms, salons,
 * clinics, pharmacies, hotels, shops, services. Sourced from OpenStreetMap (ODbL)
 * and pluggable site adapters. Embedded + trigram-indexed for semantic search.
 */
export const places = pgTable(
  "places",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    osmType: text("osm_type"), // node | way | relation
    osmId: bigint("osm_id", { mode: "number" }),
    name: text("name").notNull(),
    nameAr: text("name_ar"),
    category: text("category").notNull(), // normalized: restaurant | cafe | gym | salon | pharmacy | ...
    subcategory: text("subcategory"), // raw OSM value (e.g. amenity=fast_food)
    governorate: text("governorate"),
    city: text("city"),
    address: text("address"),
    phone: text("phone"),
    website: text("website"),
    openingHours: text("opening_hours"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    source: text("source").default("osm").notNull(),
    sourceUrl: text("source_url"),
    raw: jsonb("raw").$type<Record<string, unknown>>().default({}),
    searchText: text("search_text"),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    categoryIdx: index("places_category_idx").on(t.category),
    governorateIdx: index("places_governorate_idx").on(t.governorate),
    cityIdx: index("places_city_idx").on(t.city),
    osmIdx: uniqueIndex("places_osm_idx").on(t.osmType, t.osmId),
  })
);

// --- User profile + long-term memory layer -----------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  // Structured JSON now (flexible while the schema is young); normalize later.
  financial: jsonb("financial").$type<Record<string, unknown>>().default({}),
  lifestyle: jsonb("lifestyle").$type<Record<string, unknown>>().default({}),
  geographic: jsonb("geographic").$type<Record<string, unknown>>().default({}),
  shopping: jsonb("shopping").$type<Record<string, unknown>>().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userMemory = pgTable(
  "user_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    kind: text("kind").notNull(), // 'preference' | 'fact' | 'event'
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("user_memory_user_idx").on(t.userId),
  })
);

// --- Session tracking: one row per browser session ---------------------------

/**
 * Tracks every unique browser session. Created/updated on first request.
 * sessionId matches the UUID stored in the user's localStorage.
 * Captures device context, UTM attribution, and session-level aggregates.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The UUID stored in the user's localStorage — the stable anonymous identity
    sessionId: text("session_id").notNull().unique(),
    // Set if the user is authenticated
    userId: uuid("user_id").references(() => users.id),

    // ── Device & browser context ──────────────────────────────────────────────
    deviceType: text("device_type"), // 'mobile' | 'tablet' | 'desktop'
    os: text("os"),                  // 'iOS' | 'Android' | 'macOS' | 'Windows' | 'Linux'
    browser: text("browser"),        // 'Chrome' | 'Safari' | 'Firefox' | 'Edge' | ...
    userAgent: text("user_agent"),   // full UA string
    screenWidth: integer("screen_width"),
    screenHeight: integer("screen_height"),

    // ── Geographic & language context ─────────────────────────────────────────
    // ipHash: SHA-256 of the request IP — privacy-safe, no PII stored
    ipHash: text("ip_hash"),
    country: text("country"),        // 'JO' | 'SA' | 'AE' | ...
    city: text("city"),              // 'Amman' | 'Irbid' | ...
    language: text("language"),      // 'ar' | 'en' — detected from first query
    timezone: text("timezone"),      // e.g. 'Asia/Amman'

    // ── Attribution / marketing ───────────────────────────────────────────────
    referrer: text("referrer"),          // HTTP Referer header
    landingPage: text("landing_page"),   // first URL path visited
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),

    // ── Session-level aggregates (updated in place) ───────────────────────────
    queryCount: integer("query_count").default(0).notNull(),
    pageViews: integer("page_views").default(0).notNull(),
    clickCount: integer("click_count").default(0).notNull(),
    thumbsUpCount: integer("thumbs_up_count").default(0).notNull(),
    thumbsDownCount: integer("thumbs_down_count").default(0).notNull(),
    // Total AI response time across all queries in this session (for avg calc)
    totalResponseTimeMs: integer("total_response_time_ms").default(0).notNull(),

    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sessionIdIdx: uniqueIndex("sessions_session_id_idx").on(t.sessionId),
    userIdx: index("sessions_user_idx").on(t.userId),
    countryIdx: index("sessions_country_idx").on(t.country),
    firstSeenIdx: index("sessions_first_seen_idx").on(t.firstSeenAt),
  })
);

// --- Conversation threads (persistent per-session chat history) ---------------

/**
 * Every chat session is stored as a thread. sessionId is generated client-side
 * (UUID in localStorage). Messages are appended on every turn. The AI extracts
 * structured preferences after each exchange and stores them in extractedPrefs
 * so future turns get personalized context automatically.
 */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: text("session_id").notNull(),
    userId: uuid("user_id").references(() => users.id),

    // ── Message history ───────────────────────────────────────────────────────
    // Full message history: [{role:"user"|"assistant", content:"..."}]
    messages: jsonb("messages").$type<{ role: string; content: string }[]>().default([]),
    // AI-extracted facts: budget, area, preferences, interests
    extractedPrefs: jsonb("extracted_prefs").$type<Record<string, unknown>>().default({}),
    // Short summary Claude generates after every 4 turns (for long-thread recall)
    summary: text("summary"),
    turnCount: integer("turn_count").default(0).notNull(),
    lastQuery: text("last_query"),

    // ── First query (useful for quick pattern analysis without parsing messages) ─
    firstQuery: text("first_query"),

    // ── Language & device context ─────────────────────────────────────────────
    // 'ar' | 'en' — detected from first user message
    language: text("language"),
    // 'mobile' | 'tablet' | 'desktop' — from session context
    deviceType: text("device_type"),

    // ── Engagement aggregates ─────────────────────────────────────────────────
    // Count of distinct queries (= turnCount for most threads, but tracks re-asks)
    queryCount: integer("query_count").default(0).notNull(),
    // Total results shown across all turns (products + places)
    totalResultsShown: integer("total_results_shown").default(0).notNull(),
    // Total explicit clicks across all turns
    totalClicks: integer("total_clicks").default(0).notNull(),
    // Total thumbs-up/down across all turns
    thumbsUpCount: integer("thumbs_up_count").default(0).notNull(),
    thumbsDownCount: integer("thumbs_down_count").default(0).notNull(),

    // ── AI provider metadata ──────────────────────────────────────────────────
    // Which AI provider handled the last turn ('claude' | 'openai' | 'mock')
    lastProvider: text("last_provider"),
    // Rolling average response latency across all turns in ms
    avgResponseTimeMs: integer("avg_response_time_ms"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("conversations_session_idx").on(t.sessionId),
    userIdx: index("conversations_user_idx").on(t.userId),
    updatedIdx: index("conversations_updated_idx").on(t.updatedAt),
    languageIdx: index("conversations_language_idx").on(t.language),
  })
);

// --- Recommendations: one row per AI response --------------------------------

/**
 * Every query that produces a recommendation (product, place, or general answer)
 * gets a row here. This is the central fact table — everything else references it.
 */
export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: text("session_id"),
    userId: uuid("user_id"),
    // Link to the conversation thread this turn belongs to
    conversationId: uuid("conversation_id").references(() => conversations.id),

    // ── Query details ─────────────────────────────────────────────────────────
    query: text("query").notNull(),
    // If the query was a bare follow-up (e.g. "in deir ghbar"), the expanded version
    resolvedQuery: text("resolved_query"),
    // Which turn number in the conversation (0-indexed)
    turnNumber: integer("turn_number"),
    // Detected language of the query
    language: text("language"), // 'ar' | 'en'

    // ── Routing & engine metadata ─────────────────────────────────────────────
    // Which engine handled this: 'products' | 'places' | 'general'
    resultKind: text("result_kind"),
    // Internal routing path for debugging: e.g. 'prodSig=5,pSig=1 → products'
    routingPath: text("routing_path"),
    // Was user memory/preference context injected into this request?
    memoryInjected: boolean("memory_injected").default(false),

    // ── Parsed intent / constraints ───────────────────────────────────────────
    constraints: jsonb("constraints").$type<Record<string, unknown>>(),

    // ── Results ───────────────────────────────────────────────────────────────
    bestListingId: integer("best_listing_id"),
    // Relevance/confidence score of the best pick (0–1)
    bestScore: doublePrecision("best_score"),
    // How many candidates were considered before selecting best + alts
    totalCandidates: integer("total_candidates"),
    // IDs of all results shown (best + alternatives)
    results: jsonb("results").$type<Record<string, unknown>>(),

    // ── Performance ───────────────────────────────────────────────────────────
    // End-to-end API latency in milliseconds
    responseTimeMs: integer("response_time_ms"),
    // Which AI provider generated the response
    provider: text("provider"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("recommendations_session_idx").on(t.sessionId),
    convIdx: index("recommendations_conv_idx").on(t.conversationId),
    kindIdx: index("recommendations_kind_idx").on(t.resultKind),
    langIdx: index("recommendations_lang_idx").on(t.language),
    createdIdx: index("recommendations_created_idx").on(t.createdAt),
  })
);

// --- Query feedback (click + rating signals for learning) ---------------------

/**
 * Every time a user clicks a result, rates an answer, or explicitly dismisses,
 * we record it here. Positive signals (clicks, thumbs-up) are the training data
 * for the embedding fine-tuning pipeline. Negative signals identify gaps.
 */
export const queryFeedback = pgTable(
  "query_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: text("session_id"),
    userId: uuid("user_id").references(() => users.id),
    conversationId: uuid("conversation_id").references(() => conversations.id),
    // Direct link to the recommendation that triggered this feedback
    recommendationId: uuid("recommendation_id").references(() => recommendations.id),

    // ── Query context ─────────────────────────────────────────────────────────
    query: text("query").notNull(),
    resultKind: text("result_kind"), // 'products' | 'places' | 'general'
    // Detected language of the query
    queryLanguage: text("query_language"), // 'ar' | 'en'
    // Device type at time of feedback
    deviceType: text("device_type"), // 'mobile' | 'tablet' | 'desktop'

    // ── Result interaction ────────────────────────────────────────────────────
    // IDs of results shown to the user
    shownIds: jsonb("shown_ids").$type<number[]>().default([]),
    // ID the user clicked / engaged with (null = no click = implicit negative)
    clickedId: integer("clicked_id"),
    // Position of clicked result: 0 = best pick, 1 = first alt, etc.
    clickedRank: integer("clicked_rank"),
    // Milliseconds from response shown to click (engagement speed signal)
    timeToClickMs: integer("time_to_click_ms"),

    // ── Explicit rating ───────────────────────────────────────────────────────
    // 1 = thumbs-up, -1 = thumbs-down, null = no explicit rating
    rating: integer("rating"),
    // Optional free-text from user ("this is wrong", "perfect!")
    feedbackText: text("feedback_text"),
    // Whether the user flagged the result as irrelevant
    irrelevant: boolean("irrelevant").default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx:  index("qfeedback_session_idx").on(t.sessionId),
    queryIdx:    index("qfeedback_query_idx").on(t.query),
    ratingIdx:   index("qfeedback_rating_idx").on(t.rating),
    recIdx:      index("qfeedback_rec_idx").on(t.recommendationId),
    convIdx:     index("qfeedback_conv_idx").on(t.conversationId),
  })
);

// --- Learning analytics: aggregated signal for ranking improvement ------------

/**
 * Aggregated per-(query, resultId) click stats. Updated by a nightly job.
 * Used to boost results that consistently get clicked for similar queries.
 */
export const clickStats = pgTable(
  "click_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queryNorm: text("query_norm").notNull(), // lowercased, stripped query
    resultId: integer("result_id").notNull(),
    resultKind: text("result_kind").notNull(),

    // ── Volume signals ────────────────────────────────────────────────────────
    impressions: integer("impressions").default(0).notNull(),
    clicks: integer("clicks").default(0).notNull(),
    // Times shown with zero clicks (missed opportunity signal)
    noClickCount: integer("no_click_count").default(0).notNull(),

    // ── Quality signals ───────────────────────────────────────────────────────
    thumbsUp: integer("thumbs_up").default(0).notNull(),
    thumbsDown: integer("thumbs_down").default(0).notNull(),
    // Rolling average explicit rating (-1 to 1)
    avgRating: doublePrecision("avg_rating").default(0),

    // ── Derived metrics ───────────────────────────────────────────────────────
    ctr: doublePrecision("ctr").default(0), // clicks / impressions
    // Average milliseconds from result shown to user click
    avgTimeToClickMs: integer("avg_time_to_click_ms"),

    // ── Timestamps ───────────────────────────────────────────────────────────
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastClickedAt: timestamp("last_clicked_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    queryResultIdx: uniqueIndex("click_stats_qr_idx").on(t.queryNorm, t.resultId, t.resultKind),
    ctrIdx: index("click_stats_ctr_idx").on(t.ctr),
    resultIdx: index("click_stats_result_idx").on(t.resultId),
  })
);

// --- Behavioral event stream: every interaction --------------------------------

/**
 * Raw event log. Every search, click, view, save, and share lands here.
 * This is the append-only source of truth — analytics are derived from it.
 * type: 'search' | 'click' | 'view' | 'save' | 'share' | 'feedback'
 */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: text("session_id"),
    userId: uuid("user_id"),
    // Links to the conversation thread (for multi-turn context)
    conversationId: uuid("conversation_id").references(() => conversations.id),
    // Links to the specific recommendation that triggered this event
    recommendationId: uuid("recommendation_id").references(() => recommendations.id),

    // ── Event classification ──────────────────────────────────────────────────
    type: text("type").notNull(), // 'search' | 'recommendation' | 'click' | 'view' | 'save' | 'share' | 'feedback'
    // The user's query at event time (populated for search/recommendation events)
    query: text("query"),
    // The listing/place ID involved (populated for click/view/save/share events)
    listingId: integer("listing_id"),
    // 'products' | 'places' | 'general' — what kind of result was involved
    resultKind: text("result_kind"),

    // ── Device context ────────────────────────────────────────────────────────
    deviceType: text("device_type"),  // 'mobile' | 'tablet' | 'desktop'
    // Privacy-safe: SHA-256 of user IP, never the raw IP
    ipHash: text("ip_hash"),

    // ── Timing ────────────────────────────────────────────────────────────────
    // For 'view' events: how many ms the result was visible before scroll-away
    durationMs: integer("duration_ms"),
    // For 'click' events: ms from result shown to click
    timeToActionMs: integer("time_to_action_ms"),

    // ── Arbitrary extra data ──────────────────────────────────────────────────
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    typeIdx:    index("events_type_idx").on(t.type),
    sessionIdx: index("events_session_idx").on(t.sessionId),
    convIdx:    index("events_conv_idx").on(t.conversationId),
    recIdx:     index("events_rec_idx").on(t.recommendationId),
    createdIdx: index("events_created_idx").on(t.createdAt),
  })
);

// --- Search analytics: aggregated per-query stats ----------------------------

/**
 * One row per normalized query. Updated nightly from raw events.
 * Powers the "what are people searching for?" dashboard and surfaces
 * zero-result queries (content gaps) and high-rating queries (strengths).
 */
export const searchAnalytics = pgTable(
  "search_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Lowercased, stripped query (same normalization as click_stats.query_norm)
    queryNorm: text("query_norm").notNull().unique(),
    // Most common raw form of this query (for display)
    queryExample: text("query_example"),
    // How many times this query (or close variant) was submitted
    queryCount: integer("query_count").default(0).notNull(),
    // Which engine handled most of these: 'products' | 'places' | 'general'
    dominantKind: text("dominant_kind"),
    // Detected language of this query cluster
    language: text("language"), // 'ar' | 'en'

    // ── Result quality signals ────────────────────────────────────────────────
    // How many times this query returned zero results
    zeroResultCount: integer("zero_result_count").default(0).notNull(),
    // Average explicit rating across all feedback for this query
    avgRating: doublePrecision("avg_rating"),
    // Average click-through rate across result sets for this query
    avgCtr: doublePrecision("avg_ctr"),
    // Average end-to-end response time in ms
    avgResponseTimeMs: integer("avg_response_time_ms"),

    // ── Temporal signals ──────────────────────────────────────────────────────
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    queryNormIdx: uniqueIndex("search_analytics_qn_idx").on(t.queryNorm),
    kindIdx: index("search_analytics_kind_idx").on(t.dominantKind),
    countIdx: index("search_analytics_count_idx").on(t.queryCount),
    langIdx: index("search_analytics_lang_idx").on(t.language),
  })
);

// --- Type exports -------------------------------------------------------------

export type Vendor = typeof vendors.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type Region = typeof regions.$inferSelect;
export type NewRegion = typeof regions.$inferInsert;
export type Place = typeof places.$inferSelect;
export type NewPlace = typeof places.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type User = typeof users.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Recommendation = typeof recommendations.$inferSelect;
export type NewRecommendation = typeof recommendations.$inferInsert;
export type QueryFeedback = typeof queryFeedback.$inferSelect;
export type NewQueryFeedback = typeof queryFeedback.$inferInsert;
export type ClickStats = typeof clickStats.$inferSelect;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type SearchAnalytics = typeof searchAnalytics.$inferSelect;
