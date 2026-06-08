/**
 * embed-scraped.ts
 *
 * Adds embedding + search_text columns to the scraped jordan_* tables
 * (jordan_places, jordan_restaurants, jordan_listings) and fills them using
 * the same local MiniLM embedder used everywhere else.
 *
 * Run once (safe to re-run — skips already-embedded rows):
 *   pnpm --filter @chatsouq/db embed-scraped
 */
import { config } from "dotenv";
config({ path: "../../.env" });

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const sql = postgres(DATABASE_URL, { max: 5 });

const { getEmbedder } = await import("@chatsouq/ai");
const embedder = getEmbedder();
console.log(`Embedder: ${embedder.name} (${embedder.dimensions}d)\n`);

const BATCH = 32;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function columnExists(table: string, col: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${col}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_name = ${table} LIMIT 1
  `;
  return rows.length > 0;
}

function vecLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

async function addColumnsIfMissing(table: string) {
  const hasTxt = await columnExists(table, "search_text");
  const hasVec = await columnExists(table, "embedding");
  if (!hasTxt) {
    console.log(`  Adding search_text to ${table}...`);
    await sql.unsafe(`ALTER TABLE ${table} ADD COLUMN search_text TEXT`);
  }
  if (!hasVec) {
    console.log(`  Adding embedding vector(384) to ${table}...`);
    await sql.unsafe(`ALTER TABLE ${table} ADD COLUMN embedding vector(384)`);
  }
}

async function buildIndexes(table: string) {
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS ${table}_trgm_idx
    ON ${table} USING gin (search_text gin_trgm_ops)
  `);
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS ${table}_vec_idx
    ON ${table} USING hnsw (embedding vector_cosine_ops)
  `);
  console.log(`  Indexes ready for ${table}.`);
}

// ── jordan_places (Google Maps) ───────────────────────────────────────────────

async function embedPlaces() {
  if (!(await tableExists("jordan_places"))) {
    console.log("  jordan_places table not found — skipping.");
    return;
  }
  await addColumnsIfMissing("jordan_places");

  const rows = await sql`
    SELECT id, name, category, address
    FROM jordan_places
    WHERE embedding IS NULL
    ORDER BY id
  ` as { id: number; name: string; category: string | null; address: string | null }[];

  if (rows.length === 0) {
    console.log("  jordan_places: all rows already embedded.");
    return;
  }
  console.log(`  Embedding ${rows.length} jordan_places rows...`);

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const texts = batch.map(
      (r) =>
        `${r.name} ${r.category ?? "place"} ${r.address ?? ""} amman jordan`
          .replace(/\s+/g, " ")
          .trim()
    );
    const vecs = await embedder.embed(texts);
    for (let j = 0; j < batch.length; j++) {
      await sql.unsafe(
        `UPDATE jordan_places SET search_text = $1, embedding = $2::vector WHERE id = $3`,
        [texts[j]!, vecLiteral(vecs[j]!), batch[j]!.id]
      );
    }
    process.stdout.write(`    ${Math.min(i + BATCH, rows.length)} / ${rows.length}\r`);
  }
  process.stdout.write("\n");

  await buildIndexes("jordan_places");
}

// ── jordan_restaurants (Talabat) ──────────────────────────────────────────────

async function embedRestaurants() {
  if (!(await tableExists("jordan_restaurants"))) {
    console.log("  jordan_restaurants table not found — skipping.");
    return;
  }
  await addColumnsIfMissing("jordan_restaurants");

  const rows = await sql`
    SELECT id, name, cuisine
    FROM jordan_restaurants
    WHERE embedding IS NULL
    ORDER BY id
  ` as { id: number; name: string; cuisine: string | null }[];

  if (rows.length === 0) {
    console.log("  jordan_restaurants: all rows already embedded.");
    return;
  }
  console.log(`  Embedding ${rows.length} jordan_restaurants rows...`);

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const texts = batch.map(
      (r) =>
        `${r.name} ${r.cuisine ?? "restaurant"} restaurant food delivery amman jordan`
          .replace(/\s+/g, " ")
          .trim()
    );
    const vecs = await embedder.embed(texts);
    for (let j = 0; j < batch.length; j++) {
      await sql.unsafe(
        `UPDATE jordan_restaurants SET search_text = $1, embedding = $2::vector WHERE id = $3`,
        [texts[j]!, vecLiteral(vecs[j]!), batch[j]!.id]
      );
    }
    process.stdout.write(`    ${Math.min(i + BATCH, rows.length)} / ${rows.length}\r`);
  }
  process.stdout.write("\n");

  await buildIndexes("jordan_restaurants");
}

// ── jordan_listings (OpenSooq — rentals/classifieds) ─────────────────────────

async function embedListings() {
  if (!(await tableExists("jordan_listings"))) {
    console.log("  jordan_listings table not found — skipping.");
    return;
  }
  await addColumnsIfMissing("jordan_listings");

  const rows = await sql`
    SELECT id, title, location, category, price
    FROM jordan_listings
    WHERE embedding IS NULL
    ORDER BY id
  ` as {
    id: number;
    title: string | null;
    location: string | null;
    category: string | null;
    price: string | null;
  }[];

  if (rows.length === 0) {
    console.log("  jordan_listings: all rows already embedded.");
    return;
  }
  console.log(`  Embedding ${rows.length} jordan_listings rows...`);

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const texts = batch.map(
      (r) =>
        `${r.title ?? ""} ${r.category ?? ""} ${r.location ?? ""} jordan ${r.price ? r.price + " JOD" : ""}`
          .replace(/\s+/g, " ")
          .trim()
    );
    const vecs = await embedder.embed(texts);
    for (let j = 0; j < batch.length; j++) {
      await sql.unsafe(
        `UPDATE jordan_listings SET search_text = $1, embedding = $2::vector WHERE id = $3`,
        [texts[j]!, vecLiteral(vecs[j]!), batch[j]!.id]
      );
    }
    process.stdout.write(`    ${Math.min(i + BATCH, rows.length)} / ${rows.length}\r`);
  }
  process.stdout.write("\n");

  await buildIndexes("jordan_listings");
}

// ── jordan_people (professionals / notable people) ────────────────────────────

async function embedPeople() {
  if (!(await tableExists("jordan_people"))) {
    console.log("  jordan_people table not found — skipping.");
    return;
  }
  await addColumnsIfMissing("jordan_people");

  const rows = await sql`
    SELECT id, name, name_ar, title, subcategory, specialty, organization, address
    FROM jordan_people
    WHERE embedding IS NULL
    ORDER BY id
  ` as {
    id: number;
    name: string | null;
    name_ar: string | null;
    title: string | null;
    subcategory: string | null;
    specialty: string | null;
    organization: string | null;
    address: string | null;
  }[];

  if (rows.length === 0) {
    console.log("  jordan_people: all rows already embedded.");
    return;
  }
  console.log(`  Embedding ${rows.length} jordan_people rows...`);

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const texts = batch.map((r) =>
      [r.name, r.name_ar, r.title, r.subcategory, r.specialty, r.organization, r.address, "amman jordan professional"]
        .filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
    );
    // Also update search_text if not already set
    const vecs = await embedder.embed(texts);
    for (let j = 0; j < batch.length; j++) {
      await sql.unsafe(
        `UPDATE jordan_people SET search_text = COALESCE(search_text, $1), embedding = $2::vector WHERE id = $3`,
        [texts[j]!, vecLiteral(vecs[j]!), batch[j]!.id]
      );
    }
    process.stdout.write(`    ${Math.min(i + BATCH, rows.length)} / ${rows.length}\r`);
  }
  process.stdout.write("\n");

  await buildIndexes("jordan_people");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Embedding scraped Jordan data ===\n");

  console.log("jordan_places (Google Maps):");
  await embedPlaces();

  console.log("\njordan_restaurants (Talabat):");
  await embedRestaurants();

  console.log("\njordan_listings (OpenSooq):");
  await embedListings();

  console.log("\njordan_people (Professionals):");
  await embedPeople();

  console.log("\n✓ Done. Scraped tables are now embedded and indexed.");
  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
