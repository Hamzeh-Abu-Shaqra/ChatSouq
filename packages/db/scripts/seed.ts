import { config } from "dotenv";
config({ path: "../../.env" });

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { sql } from "drizzle-orm";

import { canonicalProductCategory } from "./lib/taxonomy";

// Imported dynamically AFTER dotenv runs, so the DB client sees DATABASE_URL.
const { getEmbedder } = await import("@chatsouq/ai");
const { db, schema } = await import("../src/index");

const SEED_DIR = path.resolve(process.cwd(), "../../data/seed");
const embedder = getEmbedder();

interface VendorRow {
  id: number;
  userId: number | null;
  businessName: string;
  category: string | null;
  description: string | null;
  location: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  status: string;
}

interface ListingRow {
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
}

async function* readNdjson<T>(file: string): AsyncGenerator<T> {
  const rl = createInterface({
    input: createReadStream(file, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed) yield JSON.parse(trimmed) as T;
  }
}

/**
 * Embedded text. Includes the canonical department AND the original raw category
 * so collapsing buckets (e.g. "Faux Stems" -> "Home & Living") never loses recall:
 * a search for "faux stems" still matches via the preserved raw term.
 */
function searchTextFor(l: ListingRow, canonical: string): string {
  const rawCat = l.category && l.category.toLowerCase() !== canonical.toLowerCase() ? l.category : null;
  return [l.name, l.brand, canonical, rawCat, l.description].filter(Boolean).join(" — ");
}

async function seedVendors(): Promise<number> {
  const rows: VendorRow[] = [];
  for await (const v of readNdjson<VendorRow>(path.join(SEED_DIR, "vendors.ndjson"))) {
    rows.push(v);
  }
  if (rows.length === 0) return 0;
  await db
    .insert(schema.vendors)
    .values(rows)
    .onConflictDoUpdate({
      target: schema.vendors.id,
      set: {
        businessName: sql`excluded.business_name`,
        category: sql`excluded.category`,
        description: sql`excluded.description`,
        location: sql`excluded.location`,
        websiteUrl: sql`excluded.website_url`,
        instagramUrl: sql`excluded.instagram_url`,
        status: sql`excluded.status`,
      },
    });
  return rows.length;
}

async function seedListings(): Promise<number> {
  const BATCH = 500;
  let batch: ListingRow[] = [];
  let total = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const canonicals = batch.map((l) => canonicalProductCategory(l.category, l.name));
    const texts = batch.map((l, i) => searchTextFor(l, canonicals[i]!));
    const vectors = await embedder.embed(texts);
    const values = batch.map((l, i) => ({
      id: l.id,
      vendorId: l.vendorId,
      name: l.name,
      description: l.description,
      category: canonicals[i],
      price: l.price === null ? null : String(l.price),
      currency: l.currency || "JOD",
      imageUrl: l.imageUrl,
      brand: l.brand,
      sourceUrl: l.sourceUrl,
      searchText: texts[i],
      embedding: vectors[i],
    }));
    await db
      .insert(schema.listings)
      .values(values)
      .onConflictDoUpdate({
        target: schema.listings.id,
        set: {
          name: sql`excluded.name`,
          price: sql`excluded.price`,
          category: sql`excluded.category`,
          brand: sql`excluded.brand`,
          imageUrl: sql`excluded.image_url`,
          searchText: sql`excluded.search_text`,
          embedding: sql`excluded.embedding`,
        },
      });
    total += batch.length;
    process.stdout.write(`  listings: ${total}\r`);
    batch = [];
  };

  for await (const l of readNdjson<ListingRow>(path.join(SEED_DIR, "listings.ndjson"))) {
    batch.push(l);
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  process.stdout.write("\n");
  return total;
}

async function buildIndexes() {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS listings_searchtext_trgm_idx ON listings USING gin (search_text gin_trgm_ops);`
  );
  // Build the vector index AFTER load for better recall and faster ingest.
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS listings_embedding_idx ON listings USING hnsw (embedding vector_cosine_ops);`
  );
}

async function main() {
  console.log(`Seeding from: ${SEED_DIR}`);
  console.log(`Embedder: ${embedder.name} (${embedder.dimensions}d)\n`);

  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);

  const v = await seedVendors();
  console.log(`✓ vendors:  ${v}`);

  const l = await seedListings();
  console.log(`✓ listings: ${l}`);

  console.log("Building indexes (trigram + HNSW)…");
  await buildIndexes();
  console.log("✓ indexes built");

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
