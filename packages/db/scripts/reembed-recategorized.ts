/**
 * reembed-recategorized.ts
 *
 * Re-embeds the ~400 listings that were re-categorized in the data quality fix
 * (June 2026). Their embeddings were built from the old (wrong) category context,
 * e.g. a duvet cover whose vector says "audio & headphones".
 *
 * Identifies affected rows by the same SQL patterns used during re-categorization,
 * rebuilds search_text in the canonical "name — brand — category — description"
 * format, and updates the embedding column.
 *
 * Safe to re-run (idempotent — only touches items that match the patterns).
 *
 * Usage:
 *   DATABASE_URL=<neon_url> pnpm --filter @chatsouq/db reembed-recategorized
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

/** Same canonical search_text format used by seed.ts */
function buildSearchText(name: string, brand: string | null, category: string, description: string | null): string {
  const rawCat = null; // no longer needed — category is already correct
  return [name, brand, category, rawCat, description].filter(Boolean).join(" — ");
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
  console.log("=== Re-embedding re-categorized listings ===\n");

  // ── 1. Earbuds / headphones moved from Electronics & Accessories → Audio & Headphones ──
  await reembedGroup(
    "Earbuds/headphones (Electronics → Audio & Headphones)",
    `category = 'Audio & Headphones'
     AND name ~* '(earbuds?|earphones?|headphones?|headset|airpods?|tws|wireless.ear|wired.ear|in.ear|over.ear|noise.cancel|neckband|neck.band)'
     AND name !~* '(cable|adapter|case|cover|charging|charger|stand|holder|clip)'`
  );

  // ── 2. Speakers moved from Audio & Headphones → Speakers ──────────────────────────────
  await reembedGroup(
    "JBL Party Box / portable speakers (Audio → Speakers)",
    `category = 'Speakers'
     AND name ~* '(party.box|partybox|party box|portable.speaker|bluetooth.speaker|tower.speaker|floor.speaker|studio.monitor|bookshelf.speaker|party.light|soundbar|subwoofer)'`
  );

  // ── 3. Home appliances moved from Electronics & Accessories → Home Appliances ──────────
  await reembedGroup(
    "Home appliances (Electronics → Home Appliances)",
    `category = 'Home Appliances'
     AND name ~* '(stand.mixer|hand.mixer|kettle|toaster|vacuum|microwave|dishwasher|washing.machine|rice.cooker|coffee.maker|juicer|food.processor|deep.fryer|air.fryer|slow.cooker|electric.grill|waffle|bread.maker|espresso|milk.frother|window.fan|tower.fan|desk.fan|space.heater|dehumidifier|humidifier|air.purifier|water.dispenser|water.filter)'`
  );

  // ── 4. Bedding / home items moved from Electronics & Accessories → Home & Living ────────
  await reembedGroup(
    "Bedding/home items (Electronics → Home & Living)",
    `category = 'Home & Living'
     AND name ~* '(duvet|pillow.cover|bed.sheet|quilt|coverlet|comforter|blanket|throw|bedspread|sofa.cover|curtain|rug|carpet|doormat|tablecloth|vase|candle|picture.frame|photo.frame|wall.art|mirror|clock|plant.pot|flower.pot)'`
  );

  // ── 5. Baby items moved from Electronics & Accessories → Baby & Kids ─────────────────
  await reembedGroup(
    "Baby items (Electronics → Baby & Kids)",
    `category = 'Baby & Kids'
     AND name ~* '(stroller|baby.car|car.seat|pushchair|pram|baby.monitor|baby.walker|nappy|diaper|baby.bottle|pacifier|teether|baby.swing|bouncer|baby.carrier)'`
  );

  // ── 6. Non-audio items moved from Audio & Headphones → Electronics & Accessories ───────
  await reembedGroup(
    "Non-audio items (Audio → Electronics & Accessories)",
    `category = 'Electronics & Accessories'
     AND name ~* '(power.station|portable.power|presenter.pointer|remote.pointer|guitar.bag|instrument.bag|hdmi.*capture|capture.*hdmi)'
     AND name !~* '(audio|speaker|sound|mic|head|ear|listen|music)'`
  );

  console.log("\n✓ Done. All re-categorized listings have fresh embeddings.");
  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
