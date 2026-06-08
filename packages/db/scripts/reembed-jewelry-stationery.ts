/**
 * reembed-jewelry-stationery.ts
 *
 * Re-embeds 782 items moved in the June 2026 Watches audit:
 *   - 772 jewelry-branded items (Tommy Hilfiger Jewelry, Maserati Jewelry,
 *     Calvin Klein Jewelry, GUESS JEWELRY, KARL LAGERFELD JEWELRY, Gucci Jewelry,
 *     ADORE JEWELRY) moved from Watches & Accessories → Jewelry
 *   - 10 A.T. CROSS pens moved from Watches & Accessories → Stationery & Office
 *
 * Their embeddings still encode "Watches & Accessories" context after the category move.
 *
 * Usage:
 *   DATABASE_URL=<neon_url> pnpm --filter @chatsouq/db reembed-jewelry-stationery
 */

import { config } from "dotenv";
config({ path: "../../.env" });

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const sql = postgres(DATABASE_URL, { max: 3, ssl: "require" });

const { getEmbedder } = await import("@chatsouq/ai");
const embedder = getEmbedder();
console.log(`Embedder: ${embedder.name} (${embedder.dimensions}d)\n`);

const BATCH = 32;

function vecLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

function buildSearchText(name: string, brand: string | null, category: string, description: string | null): string {
  return [name, brand, category, description].filter(Boolean).join(" — ");
}

async function reembedGroup(label: string, whereClause: string) {
  const rows = await sql.unsafe<{ id: number; name: string; brand: string | null; category: string; description: string | null }[]>(
    `SELECT id, name, brand, category, description FROM listings WHERE ${whereClause} ORDER BY id`
  );

  if (rows.length === 0) {
    console.log(`  ${label}: 0 rows — skipped.`);
    return;
  }
  console.log(`  ${label}: re-embedding ${rows.length} rows...`);

  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const texts = batch.map((r) => buildSearchText(r.name, r.brand, r.category, r.description));
    const vecs = await embedder.embed(texts);

    for (let j = 0; j < batch.length; j++) {
      await sql.unsafe(
        `UPDATE listings SET search_text = $1, embedding = $2::vector WHERE id = $3`,
        [texts[j]!, vecLiteral(vecs[j]!), batch[j]!.id]
      );
    }
    done += batch.length;
    process.stdout.write(`    ${done} / ${rows.length}\r`);
  }
  process.stdout.write(`    ${rows.length} / ${rows.length} ✓\n`);
}

async function main() {
  console.log("=== Re-embedding Watches audit recategorizations ===\n");

  await reembedGroup(
    "Jewelry-branded items (Watches → Jewelry)",
    `category = 'Jewelry'
     AND (brand ILIKE '%jewelry%' OR brand ILIKE '%jewellery%' OR brand ILIKE '%jewel%')`
  );

  await reembedGroup(
    "A.T. CROSS pens (Watches → Stationery & Office)",
    `category = 'Stationery & Office' AND brand = 'A. T. CROSS'`
  );

  console.log("\n✓ Done. Jewelry and stationery items have fresh embeddings.");
  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
