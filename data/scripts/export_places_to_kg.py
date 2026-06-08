"""
Export PostgreSQL places table → knowledge-graph/raw/places.json
Run after ingest-places.ts completes.
"""
import json, os, subprocess
from pathlib import Path

RAW = Path("/Users/Hamzeh23/Desktop/chatsouq/data/knowledge-graph/raw")
RAW.mkdir(parents=True, exist_ok=True)

DB = "postgresql://Hamzeh23@localhost:5432/chatsouq"

SQL = """
COPY (
  SELECT json_build_object(
    'name_en',     name,
    'name_ar',     name_ar,
    'category',    category,
    'subcategory', subcategory,
    'city',        city,
    'governorate', governorate,
    'address',     address,
    'phone',       phone,
    'website',     website,
    'opening_hours',opening_hours,
    'lat',         lat,
    'lng',         lng,
    'source_url',  source_url,
    'confidence',  'high'
  )
  FROM places
  WHERE name IS NOT NULL
) TO STDOUT;
"""

env = os.environ.copy()
env["PATH"] = "/opt/homebrew/opt/postgresql@17/bin:/opt/homebrew/bin:" + env.get("PATH","")

result = subprocess.run(
    ["psql", DB, "-At", "-c", SQL],
    capture_output=True, text=True, env=env
)

if result.returncode != 0:
    print(f"Error: {result.stderr}")
    exit(1)

lines = [l.strip() for l in result.stdout.strip().split("\n") if l.strip()]
places = [json.loads(l) for l in lines]

# Normalize categories for knowledge graph
CAT_MAP = {
    "Cafe": "Food & Beverage",
    "Coffee Shop": "Food & Beverage",
    "Restaurant": "Food & Beverage",
    "Fast Food": "Food & Beverage",
    "Bakery": "Food & Beverage",
    "Hotel": "Tourism",
    "Guest House": "Tourism",
    "Hostel": "Tourism",
    "Resort": "Tourism",
    "Attraction": "Tourism",
    "Museum": "Tourism",
    "Historical Site": "Tourism",
    "Hospital": "Healthcare",
    "Clinic": "Healthcare",
    "Pharmacy": "Healthcare",
    "Dentist": "Healthcare",
    "Gym": "Services",
    "Salon": "Services",
    "Spa": "Services",
    "University": "Education",
    "School": "Education",
    "Bank": "Services",
    "Supermarket": "Retail",
    "Market": "Retail",
    "Shopping Mall": "Retail",
}

for p in places:
    raw_cat = p.get("category","")
    mapped = CAT_MAP.get(raw_cat, "Services")
    p["top_category"] = mapped
    p["source"] = "openstreetmap"

out = RAW / "places.json"
out.write_text(json.dumps(places, ensure_ascii=False, indent=2))
print(f"Exported {len(places)} places → {out}")
