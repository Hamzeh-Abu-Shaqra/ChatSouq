import { config } from "dotenv";
config({ path: "../../.env" });

import { sql } from "drizzle-orm";
import { overpass, jordanQuery, polite, type OsmElement } from "./lib/overpass";
import { elementCoords } from "./lib/normalize";

const { db, schema } = await import("../src/index");

const ADMIN_KIND: Record<string, string> = { "4": "governorate", "6": "district", "8": "municipality" };
const PLACE_KIND: Record<string, string> = {
  city: "city", town: "town", village: "village", suburb: "suburb", neighbourhood: "neighborhood",
};

interface RegionInput {
  osmId: number;
  name: string;
  nameAr: string | null;
  kind: string;
  adminLevel: number | null;
  lat: number | null;
  lng: number | null;
  population: number | null;
  source: string;
  raw: Record<string, string>;
}

function toRegion(el: OsmElement, kind: string, adminLevel: number | null): RegionInput | null {
  const tags = el.tags ?? {};
  const name = tags.name || tags["name:en"];
  if (!name) return null;
  const coords = elementCoords(el);
  const pop = tags.population ? parseInt(tags.population.replace(/[^\d]/g, ""), 10) : NaN;
  return {
    osmId: el.id,
    name,
    nameAr: tags["name:ar"] ?? null,
    kind,
    adminLevel,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    population: Number.isFinite(pop) ? pop : null,
    source: "osm",
    raw: tags,
  };
}

async function main() {
  console.log("Ingesting Jordan geography from OpenStreetMap (ODbL)\n");
  const byId = new Map<number, RegionInput>();

  const admin = await overpass(
    jordanQuery(`relation["boundary"="administrative"]["admin_level"~"^(4|6|8)$"]["name"](area.jo);`)
  );
  for (const el of admin) {
    const lvl = el.tags?.admin_level ?? "";
    const r = toRegion(el, ADMIN_KIND[lvl] ?? "area", lvl ? parseInt(lvl, 10) : null);
    if (r) byId.set(r.osmId, r);
  }
  console.log(`  admin boundaries: ${admin.length}`);
  await polite(1500);

  const places = await overpass(
    jordanQuery(`node["place"~"^(city|town|village|suburb|neighbourhood)$"]["name"](area.jo);`)
  );
  for (const el of places) {
    const r = toRegion(el, PLACE_KIND[el.tags?.place ?? ""] ?? "place", null);
    if (r && !byId.has(r.osmId)) byId.set(r.osmId, r);
  }
  console.log(`  populated places: ${places.length}`);

  const rows = [...byId.values()];
  await db.execute(sql`TRUNCATE regions RESTART IDENTITY;`);
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(schema.regions).values(rows.slice(i, i + BATCH));
  }
  console.log(`\n✓ regions loaded: ${rows.length}`);

  const byKind = await db.execute<{ kind: string; n: number }>(
    sql`SELECT kind, count(*)::int AS n FROM regions GROUP BY kind ORDER BY n DESC;`
  );
  for (const row of byKind) console.log(`  ${row.kind}: ${row.n}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
