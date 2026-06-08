import { config } from "dotenv";
config({ path: "../../.env" });

import { sql } from "drizzle-orm";
import { overpass, jordanQuery, polite, type OsmElement } from "./lib/overpass";
import { toPlace, type PlaceInput } from "./lib/normalize";
import { SITE_ADAPTERS } from "./lib/site";

// Imported AFTER dotenv so the DB client sees DATABASE_URL.
const { getEmbedder } = await import("@chatsouq/ai");
const { db, schema } = await import("../src/index");

const embedder = getEmbedder();

// OSM keys that describe real, named places worth recommending in Jordan.
const KEYS = ["amenity", "shop", "tourism", "leisure", "healthcare", "office"];

async function collectFromOsm(): Promise<Map<string, PlaceInput>> {
  const byId = new Map<string, PlaceInput>();
  for (const key of KEYS) {
    const ql = jordanQuery(`nwr["${key}"]["name"](area.jo);`);
    const els: OsmElement[] = await overpass(ql);
    let kept = 0;
    for (const el of els) {
      const place = toPlace(el);
      if (!place) continue;
      byId.set(`${place.osmType}/${place.osmId}`, place); // later keys refine
      kept++;
    }
    console.log(`  ${key}: ${els.length} elements -> ${kept} named places`);
    await polite(1500);
  }
  return byId;
}

async function loadPlaces(rows: PlaceInput[]): Promise<number> {
  const BATCH = 500;
  let total = 0;
  for (let start = 0; start < rows.length; start += BATCH) {
    const batch = rows.slice(start, start + BATCH);
    const vectors = await embedder.embed(batch.map((r) => r.searchText));
    const values = batch.map((r, i) => ({ ...r, embedding: vectors[i] }));
    await db
      .insert(schema.places)
      .values(values)
      .onConflictDoUpdate({
        target: [schema.places.osmType, schema.places.osmId],
        set: {
          name: sql`excluded.name`,
          category: sql`excluded.category`,
          subcategory: sql`excluded.subcategory`,
          governorate: sql`excluded.governorate`,
          city: sql`excluded.city`,
          phone: sql`excluded.phone`,
          website: sql`excluded.website`,
          searchText: sql`excluded.search_text`,
          embedding: sql`excluded.embedding`,
        },
      });
    total += batch.length;
    process.stdout.write(`  loaded: ${total}/${rows.length}\r`);
  }
  process.stdout.write("\n");
  return total;
}

async function buildIndexes() {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS places_searchtext_trgm_idx ON places USING gin (search_text gin_trgm_ops);`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS places_embedding_idx ON places USING hnsw (embedding vector_cosine_ops);`
  );
}

async function main() {
  console.log(`Ingesting Jordan places from OpenStreetMap (ODbL)`);
  console.log(`Embedder: ${embedder.name} (${embedder.dimensions}d)\n`);

  const byId = await collectFromOsm();
  const rows = [...byId.values()];

  // Pluggable site adapters (your own rights-cleared sources).
  for (const adapter of SITE_ADAPTERS) {
    let n = 0;
    for await (const place of adapter.scrape()) {
      rows.push(place);
      n++;
    }
    console.log(`  ${adapter.source}: ${n} places`);
  }

  console.log(`\nTotal unique places: ${rows.length}`);
  const loaded = await loadPlaces(rows);
  console.log(`✓ places loaded: ${loaded}`);

  console.log("Building indexes (trigram + HNSW)…");
  await buildIndexes();
  console.log("✓ indexes built\n");

  const counts = await db.execute<{ count: number }>(
    sql`SELECT count(*)::int AS count FROM places;`
  );
  console.log(`Done. places in DB: ${counts[0]?.count ?? 0}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
