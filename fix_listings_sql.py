import csv
import re
import os

CSV_PATH = "/Users/Hamzeh23/Desktop/ChatSouq_Jordan_Data/06_product_listings.csv"
OUT_CSV  = "/Users/Hamzeh23/Desktop/ChatSouq_Jordan_Data/06_product_listings.csv"
OUT_SQL  = "/Users/Hamzeh23/Desktop/ChatSouq_Jordan_Data/06_product_listings_insert.sql"

# ---------------------------------------------------------------------------
# Canonical-category override rules  (applied AFTER the base mapping)
# When product name contains any of these terms → override to the mapped category
# ---------------------------------------------------------------------------
NAME_OVERRIDES = [
    # Makeup
    (r"\bbrow\b|brow hero|brow kit|brow set|brow trial", "Makeup"),
    (r"\bkabuki\b|\bblush\b|\bbronzer\b|\bhighlighter\b|\bcontour\b", "Makeup"),
    (r"\bmascara\b|\beyeliner\b|\beyeshadow\b|\beyebrow\b|\bconcealer\b", "Makeup"),
    (r"\blipstick\b|\blip gloss\b|\blip liner\b|\blip balm\b|\blip tint\b", "Makeup"),
    (r"\bfoundation\b|\bprimer\b|\bsetting spray\b|\bbb cream\b|\bcc cream\b", "Makeup"),
    (r"\bpowder\b|\bblush\b|\bmineral makeup\b|\bmakeup brush\b|\bpuff\b", "Makeup"),
    # Beauty & Skincare
    (r"\bserum\b|\bmoisturiser\b|\bmoisturizer\b|\btoner\b|\bcleanser\b", "Beauty & Skincare"),
    (r"\bgenifique\b|\babsolue\b|\bprecious cells\b|\beye cream\b|\beye mask\b", "Beauty & Skincare"),
    (r"\bretinol\b|\bhyaluronic\b|\bniacinamide\b|\bvitamin c\b|\bspf\b|\bsunscreen\b", "Beauty & Skincare"),
    (r"\bfacial\b|\bface mask\b|\bface wash\b|\bexfoliant\b|\bexfoliator\b", "Beauty & Skincare"),
    (r"\bmicroneedling\b|\bderma roller\b|\bsheet mask\b|\brose mask\b", "Beauty & Skincare"),
    # Hair Care
    (r"\bshampoo\b|\bconditioner\b|\bhair mask\b|\bhair oil\b|\bhair serum\b", "Hair Care"),
    (r"\bhair mousse\b|\bhair spray\b|\bhair wax\b|\bhair gel\b|\bscalp\b", "Hair Care"),
]

# Compile all patterns
NAME_OVERRIDE_RE = [(re.compile(p, re.IGNORECASE), cat) for p, cat in NAME_OVERRIDES]

def fix_canonical(name: str, raw_cat: str, current_canonical: str) -> str:
    """Apply name-based overrides to fix misclassified canonical categories."""
    for pattern, override_cat in NAME_OVERRIDE_RE:
        if pattern.search(name):
            return override_cat
    return current_canonical

def sql_escape(val):
    if val is None or val == "":
        return "NULL"
    s = str(val).replace("'", "''")
    return f"'{s}'"

def sql_num(val):
    if val is None or val == "":
        return "NULL"
    try:
        f = float(val)
        return str(round(f, 2))
    except Exception:
        return "NULL"

# ---------------------------------------------------------------------------
# Read CSV, fix canonical_category, write back, generate SQL
# ---------------------------------------------------------------------------
rows = []
with open(CSV_PATH, encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for row in reader:
        fixed = fix_canonical(row["name"], row["category"], row["canonical_category"])
        row["canonical_category"] = fixed
        rows.append(row)

# Write fixed CSV
with open(OUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"Fixed CSV written: {len(rows):,} rows")

# ---------------------------------------------------------------------------
# Generate SQL for the actual `listings` table (no canonical_category, no embedding)
# Columns: id, vendor_id, name, description, category, price, currency,
#          image_url, brand, source_url, search_text
# ---------------------------------------------------------------------------
BATCH = 500   # rows per INSERT statement

sql_lines = [
    "-- ChatSouq Jordan · listings table INSERT",
    "-- Generated from 06_product_listings.csv",
    "-- Target: public.listings (schema.ts)",
    "-- Excludes: canonical_category (CSV-only enrichment), embedding (generated at runtime)",
    "",
    "BEGIN;",
    "",
]

cols = "(id, vendor_id, name, description, category, price, currency, image_url, brand, source_url, search_text)"

for batch_start in range(0, len(rows), BATCH):
    batch = rows[batch_start : batch_start + BATCH]
    sql_lines.append(f"INSERT INTO listings {cols} OVERRIDING SYSTEM VALUE VALUES")
    value_lines = []
    for row in batch:
        v = (
            f"  ({sql_escape(row['listing_id'])}, "
            f"{sql_escape(row['vendor_id'])}, "
            f"{sql_escape(row['name'])}, "
            f"{sql_escape(row['description'])}, "
            f"{sql_escape(row['category'])}, "
            f"{sql_num(row['price'])}, "
            f"{sql_escape(row['currency'] or 'JOD')}, "
            f"{sql_escape(row['image_url'])}, "
            f"{sql_escape(row['brand'])}, "
            f"{sql_escape(row['source_url'])}, "
            f"{sql_escape(row['search_text'])})"
        )
        value_lines.append(v)
    sql_lines.append(",\n".join(value_lines) + ";")
    sql_lines.append("")

sql_lines += ["COMMIT;", ""]

with open(OUT_SQL, "w", encoding="utf-8") as f:
    f.write("\n".join(sql_lines))

sql_size = os.path.getsize(OUT_SQL) / 1_048_576
print(f"SQL file written: {OUT_SQL}")
print(f"  Batches: {((len(rows)-1)//BATCH)+1} × {BATCH} rows")
print(f"  File size: {sql_size:.1f} MB")

# Quick spot-check on override fixes
fixed_count = sum(
    1 for r in rows
    if any(p.search(r["name"]) for p, _ in NAME_OVERRIDE_RE)
)
print(f"  Name-override fixes applied: {fixed_count:,} rows")

