import {
  pgTable,
  integer,
  bigint,
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

// --- Behavioral data: every interaction strengthens the knowledge graph -------

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id"),
    sessionId: text("session_id"),
    type: text("type").notNull(), // search | recommendation | click | view | save
    query: text("query"),
    listingId: integer("listing_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    typeIdx: index("events_type_idx").on(t.type),
    sessionIdx: index("events_session_idx").on(t.sessionId),
  })
);

export const recommendations = pgTable("recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: text("session_id"),
  userId: uuid("user_id"),
  query: text("query").notNull(),
  constraints: jsonb("constraints").$type<Record<string, unknown>>(),
  bestListingId: integer("best_listing_id"),
  results: jsonb("results").$type<Record<string, unknown>>(),
  provider: text("provider"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Vendor = typeof vendors.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type Region = typeof regions.$inferSelect;
export type NewRegion = typeof regions.$inferInsert;
export type Place = typeof places.$inferSelect;
export type NewPlace = typeof places.$inferInsert;
export type User = typeof users.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
