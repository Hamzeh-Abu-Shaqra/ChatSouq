"""
ChatSouq Jordan Knowledge Graph Builder
Merges all data sources into a unified, scored entity database.

Sources:
  1. ChatSouq SERVICES.xlsx    — 50 verified service businesses
  2. ChatSouq RETAIL.xlsx      — 64 retail vendors
  3. ChatSouq CLOTHING.xlsx    — 50 clothing brands with Jordan presence
  4. ChatSouq FOOD.xlsx        — 36 food & restaurant businesses
  5. data/seed/vendors.ndjson  — 64 vendors with full metadata
  6. PostgreSQL places table   — OpenStreetMap Jordan places (when populated)
  7. data/knowledge-graph/raw/ — Agent-discovered web entities (JSON drops)

Output:
  data/knowledge-graph/output/
    Master.json        — all entities unified
    Master.csv         — flat CSV for spreadsheet use
    Retail.xlsx        — retail sector
    Food.xlsx          — food & beverage sector
    Services.xlsx      — services sector
    Healthcare.xlsx    — healthcare sector
    Tourism.xlsx       — tourism sector
    Education.xlsx     — education sector
    Technology.xlsx    — technology sector
    Government.xlsx    — government entities
"""

import json, csv, uuid, re, os, sys
from datetime import datetime
from pathlib import Path

try:
    import pandas as pd
    import openpyxl
except ImportError:
    print("Installing dependencies...")
    os.system(f"{sys.executable} -m pip install pandas openpyxl -q")
    import pandas as pd
    import openpyxl

# ── Paths ────────────────────────────────────────────────────────────────────

ROOT     = Path("/Users/Hamzeh23/Desktop/chatsouq")
DESKTOP  = Path("/Users/Hamzeh23/Desktop")
DATA     = ROOT / "data"
KG       = DATA / "knowledge-graph"
RAW      = KG / "raw"
OUT      = KG / "output"
OUT.mkdir(parents=True, exist_ok=True)
RAW.mkdir(parents=True, exist_ok=True)

NOW = datetime.utcnow().isoformat() + "Z"

# ── Canonical entity schema ───────────────────────────────────────────────────

def make_entity(overrides: dict) -> dict:
    base = {
        "id":               str(uuid.uuid4()),
        "name_en":          "",
        "name_ar":          None,
        "category":         "",
        "subcategory":      "",
        "description":      "",
        "website":          None,
        "instagram":        None,
        "facebook":         None,
        "tiktok":           None,
        "linkedin":         None,
        "youtube":          None,
        "phone":            None,
        "whatsapp":         None,
        "email":            None,
        "address":          None,
        "city":             None,
        "governorate":      None,
        "lat":              None,
        "lng":              None,
        "opening_hours":    None,
        "products_services":[],
        "brands":           [],
        "ordering_url":     None,
        "booking_url":      None,
        "menu_url":         None,
        "price_level":      None,
        "keywords":         [],
        "search_tags":      [],
        "intent_keywords":  [],
        "budget_range":     None,
        "location_tags":    [],
        "audience_tags":    [],
        "gift_suitability": False,
        "occasion_tags":    [],
        "luxury_score":     None,
        "family_score":     None,
        "tourist_score":    None,
        "student_score":    None,
        "corporate_score":  None,
        "rating":           None,
        "review_count":     None,
        "source_urls":      [],
        "source":           "",
        "confidence":       "medium",
        "last_updated":     NOW,
    }
    base.update({k: v for k, v in overrides.items() if v is not None and v != ""})
    return base

# ── Helpers ───────────────────────────────────────────────────────────────────

GOVERNORATE_MAP = {
    "amman": "Amman", "عمان": "Amman",
    "irbid": "Irbid", "إربد": "Irbid",
    "zarqa": "Zarqa", "الزرقاء": "Zarqa",
    "aqaba": "Aqaba", "العقبة": "Aqaba",
    "balqa": "Balqa", "البلقاء": "Balqa",
    "salt":  "Balqa",
    "karak": "Karak", "الكرك": "Karak",
    "madaba":"Madaba","مادبا": "Madaba",
    "jerash":"Jerash","جرش":  "Jerash",
    "ajloun":"Ajloun","عجلون":"Ajloun",
    "mafraq":"Mafraq","المفرق":"Mafraq",
    "tafilah":"Tafilah","الطفيلة":"Tafilah",
    "maan":  "Ma'an", "معان": "Ma'an",
}

CITY_GOV_MAP = {
    "amman":   "Amman",  "abdoun": "Amman", "jabal amman": "Amman",
    "sweifieh":"Amman",  "jubeiha":"Amman",  "gardens":     "Amman",
    "irbid":   "Irbid",  "aqaba":  "Aqaba",  "zarqa":       "Zarqa",
    "salt":    "Balqa",  "madaba": "Madaba", "karak":       "Karak",
    "jerash":  "Jerash", "ajloun": "Ajloun", "mafraq":      "Mafraq",
    "petra":   "Ma'an",  "wadi rum":"Aqaba",
}

def infer_governorate(city: str | None, address: str | None) -> str | None:
    text = " ".join(filter(None, [city, address])).lower()
    for k, v in CITY_GOV_MAP.items():
        if k in text: return v
    for k, v in GOVERNORATE_MAP.items():
        if k in text: return v
    return None

def clean_url(u: str | None) -> str | None:
    if not u or str(u).lower() in ("nan", "none", "n/a", "#"): return None
    u = str(u).strip()
    if u.startswith("@"): return "https://www.instagram.com/" + u[1:].split("/")[0]
    if not u.startswith("http"): u = "https://" + u
    return u

def clean_str(s) -> str | None:
    if s is None: return None
    s = str(s).strip()
    return None if s.lower() in ("nan","none","n/a","","#") else s

def tags_from_str(s: str | None) -> list[str]:
    if not s: return []
    s = clean_str(s)
    if not s: return []
    return [t.strip() for t in re.split(r"[,،;|]", s) if t.strip()]

def score_entity(e: dict) -> dict:
    """Assign ChatSouq intent/scoring fields based on category/subcategory/keywords."""
    cat  = (e.get("category")    or "").lower()
    sub  = (e.get("subcategory") or "").lower()
    desc = (e.get("description") or "").lower()
    name = (e.get("name_en")     or "").lower()
    text = f"{name} {cat} {sub} {desc}"

    # Luxury score
    luxury_kw = ["luxury","four seasons","ritz","kempinski","grand","premium","high-end","vip","exclusive","rolex","cartier","gucci","prada"]
    e["luxury_score"] = min(5, sum(1 for k in luxury_kw if k in text))

    # Family score
    family_kw = ["family","kids","children","playground","baby","mothers","fathers","family-friendly"]
    e["family_score"] = min(5, sum(1 for k in family_kw if k in text))

    # Tourist score
    tourist_kw = ["tourist","tourism","tour","hotel","resort","petra","wadi rum","dead sea","historical","attraction","sightseeing","guide","excursion"]
    e["tourist_score"] = min(5, sum(1 for k in tourist_kw if k in text))

    # Student score
    student_kw = ["student","university","education","school","training","learning","course","affordable","budget"]
    e["student_score"] = min(5, sum(1 for k in student_kw if k in text))

    # Corporate score
    corporate_kw = ["corporate","business","professional","b2b","enterprise","office","conference","meeting","consulting"]
    e["corporate_score"] = min(5, sum(1 for k in corporate_kw if k in text))

    # Gift suitability
    gift_kw = ["gift","present","wedding","birthday","celebration","occasion","flowers","perfume","jewelry","watch","box","set"]
    e["gift_suitability"] = any(k in text for k in gift_kw)

    # Occasion tags
    occasions = []
    if any(k in text for k in ["wedding","bride"]): occasions.append("wedding")
    if any(k in text for k in ["birthday","celebration"]): occasions.append("birthday")
    if any(k in text for k in ["romantic","date","couple"]): occasions.append("date-night")
    if any(k in text for k in ["ramadan","eid"]): occasions.append("ramadan")
    if any(k in text for k in ["graduation"]): occasions.append("graduation")
    if any(k in text for k in ["corporate","business"]): occasions.append("corporate")
    e["occasion_tags"] = occasions

    # Audience tags
    audience = []
    if "women" in text or "ladies" in text: audience.append("women")
    if "men" in text or "gents" in text: audience.append("men")
    if "kids" in text or "children" in text or "baby" in text: audience.append("kids")
    if "tourist" in text or "travel" in text: audience.append("tourists")
    if "student" in text: audience.append("students")
    if "corporate" in text or "business" in text: audience.append("corporate")
    if not audience: audience = ["general"]
    e["audience_tags"] = audience

    # Price level inference
    if not e.get("price_level"):
        if e["luxury_score"] and e["luxury_score"] >= 3: e["price_level"] = "luxury"
        elif any(k in text for k in ["affordable","cheap","budget","value"]): e["price_level"] = "budget"
        elif any(k in text for k in ["premium","high-end","exclusive"]): e["price_level"] = "premium"

    return e

# ── Source 1: SERVICES.xlsx ───────────────────────────────────────────────────

def load_services() -> list[dict]:
    path = DESKTOP / "ChatSouq SERVICES.xlsx"
    if not path.exists(): print(f"MISSING: {path}"); return []
    df = pd.read_excel(path, sheet_name="Verified Jordan Services")
    entities = []
    for _, row in df.iterrows():
        city_raw = clean_str(row.get("Area / City"))
        e = make_entity({
            "name_en":     clean_str(row.get("Business / Provider")),
            "category":    "Services",
            "subcategory": clean_str(row.get("Service Type")),
            "city":        city_raw,
            "governorate": infer_governorate(city_raw, None),
            "website":     clean_url(row.get("Booking / Buy Link")),
            "booking_url": clean_url(row.get("Booking / Buy Link")),
            "keywords":    tags_from_str(row.get("ChatSouq Search Tags")),
            "search_tags": tags_from_str(row.get("ChatSouq Search Tags")),
            "description": clean_str(row.get("What Users Can Book / Buy")),
            "source_urls": [s for s in [clean_url(row.get("Verification Source URL"))] if s],
            "source":      "ChatSouq SERVICES.xlsx",
            "confidence":  "high",
        })
        entities.append(score_entity(e))
    print(f"  SERVICES: {len(entities)} entities")
    return entities

# ── Source 2: RETAIL.xlsx (vendors sheet) ─────────────────────────────────────

def load_retail() -> list[dict]:
    path = DESKTOP / "ChatSouq RETAIL.xlsx"
    if not path.exists(): print(f"MISSING: {path}"); return []
    df = pd.read_excel(path, sheet_name="vendors")
    entities = []
    for _, row in df.iterrows():
        e = make_entity({
            "name_en":     clean_str(row.get("business_name")),
            "category":    "Retail",
            "subcategory": clean_str(row.get("category")),
            "description": clean_str(row.get("description")),
            "website":     clean_url(row.get("website_url")),
            "instagram":   clean_url(row.get("instagram_url")),
            "city":        "Amman",
            "governorate": "Amman",
            "address":     clean_str(row.get("location")),
            "source_urls": [s for s in [clean_url(row.get("website_url"))] if s],
            "source":      "ChatSouq RETAIL.xlsx",
            "confidence":  "high",
        })
        entities.append(score_entity(e))
    print(f"  RETAIL: {len(entities)} entities")
    return entities

# ── Source 3: CLOTHING.xlsx ───────────────────────────────────────────────────

def load_clothing() -> list[dict]:
    path = DESKTOP / "ChatSouq CLOTHING.xlsx"
    if not path.exists(): print(f"MISSING: {path}"); return []
    df = pd.read_excel(path, sheet_name="Top 50 Clothing Jordan")
    entities = []
    for _, row in df.iterrows():
        area = clean_str(row.get("Jordan Presence / Area"))
        e = make_entity({
            "name_en":     clean_str(row.get("Shop / Brand")),
            "category":    "Retail",
            "subcategory": clean_str(row.get("Category")) or "Fashion",
            "city":        "Amman",
            "governorate": infer_governorate(area, None) or "Amman",
            "website":     clean_url(row.get("Website URL")),
            "instagram":   clean_url(row.get("Instagram / Social")),
            "audience_tags": tags_from_str(row.get("Audience")),
            "keywords":    tags_from_str(row.get("ChatSouq Search Tags")),
            "search_tags": tags_from_str(row.get("ChatSouq Search Tags")),
            "source_urls": [s for s in [clean_url(row.get("Source URL"))] if s],
            "source":      "ChatSouq CLOTHING.xlsx",
            "confidence":  "high",
        })
        entities.append(score_entity(e))
    print(f"  CLOTHING: {len(entities)} entities")
    return entities

# ── Source 4: FOOD.xlsx ───────────────────────────────────────────────────────

def load_food() -> list[dict]:
    path = DESKTOP / "ChatSouq FOOD.xlsx"
    if not path.exists(): print(f"MISSING: {path}"); return []
    df = pd.read_excel(path, sheet_name="Master")
    entities = []
    for _, row in df.iterrows():
        area = clean_str(row.get("Area"))
        e = make_entity({
            "name_en":     clean_str(row.get("Restaurant")),
            "category":    "Food & Beverage",
            "subcategory": clean_str(row.get("Category")),
            "city":        "Amman" if area and "amman" in area.lower() else area,
            "governorate": infer_governorate(area, None) or "Amman",
            "website":     clean_url(row.get("Direct URL")),
            "ordering_url":clean_url(row.get("Direct URL")),
            "instagram":   clean_url(row.get("Instagram")),
            "source_urls": [s for s in [clean_url(row.get("Direct URL"))] if s],
            "source":      "ChatSouq FOOD.xlsx",
            "confidence":  "high",
        })
        entities.append(score_entity(e))
    print(f"  FOOD: {len(entities)} entities")
    return entities

# ── Source 5: vendors.ndjson ──────────────────────────────────────────────────

def load_vendors_ndjson() -> list[dict]:
    path = DATA / "seed" / "vendors.ndjson"
    if not path.exists(): print(f"MISSING: {path}"); return []
    entities = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line: continue
            v = json.loads(line)
            e = make_entity({
                "name_en":     v.get("businessName"),
                "category":    "Retail",
                "subcategory": v.get("category"),
                "description": v.get("description"),
                "website":     clean_url(v.get("websiteUrl")),
                "instagram":   clean_url(v.get("instagramUrl")),
                "address":     v.get("location"),
                "city":        "Amman",
                "governorate": infer_governorate(v.get("location"), None) or "Amman",
                "source":      "vendors.ndjson",
                "confidence":  "high",
            })
            entities.append(score_entity(e))
    print(f"  VENDORS NDJSON: {len(entities)} entities")
    return entities

# ── Source 6: Product catalog from listings.ndjson ───────────────────────────

def load_and_export_products_catalog() -> int:
    """
    Loads product listings from listings.ndjson and writes them to Products.xlsx separately.
    Products are NOT merged into the main entity dedup flow (they'd collapse on vendor URLs).
    Returns the number of unique products exported.
    """
    listings_path = DATA / "seed" / "listings.ndjson"
    vendors_path  = DATA / "seed" / "vendors.ndjson"
    if not listings_path.exists():
        print(f"  PRODUCTS CATALOG: MISSING {listings_path}")
        return 0

    vendors = {}
    if vendors_path.exists():
        with open(vendors_path) as f:
            for line in f:
                line = line.strip()
                if not line: continue
                v = json.loads(line)
                vid = str(v.get("id") or v.get("vendorId", ""))
                vendors[vid] = v

    rows = []
    seen_names = set()
    with open(listings_path) as f:
        for line in f:
            line = line.strip()
            if not line: continue
            p = json.loads(line)
            name = p.get("name") or p.get("name_en") or ""
            if not name: continue
            name_key = name.lower().strip()
            if name_key in seen_names: continue
            seen_names.add(name_key)

            vendor_id = str(p.get("vendorId", ""))
            vendor = vendors.get(vendor_id, {})
            rows.append({
                "id":          str(uuid.uuid4()),
                "name_en":     name,
                "category":    p.get("category") or "Retail",
                "subcategory": p.get("subcategory") or "",
                "description": p.get("description") or "",
                "website":     clean_url(p.get("url")),
                "price":       p.get("price"),
                "price_level": (
                    "budget" if (p.get("price") or 0) < 20
                    else "premium" if (p.get("price") or 0) > 200
                    else "mid"
                ),
                "vendor":      vendor.get("businessName", vendor_id),
                "vendor_site": clean_url(vendor.get("websiteUrl")),
                "city":        "Amman",
                "governorate": "Amman",
                "source":      f"catalog:{vendor.get('businessName', vendor_id)}",
                "confidence":  "high",
                "last_updated": NOW,
            })

    xl_path = OUT / "Products.xlsx"
    df = pd.DataFrame(rows)
    df.to_excel(xl_path, index=False, sheet_name="Products")
    print(f"  PRODUCTS CATALOG: {len(rows)} unique products → {xl_path}")
    return len(rows)


# ── Source 7: Agent web discovery drops (raw/*.json) ─────────────────────────

def load_web_discoveries() -> list[dict]:
    entities = []
    for f in RAW.glob("*.json"):
        try:
            data = json.loads(f.read_text())
            if isinstance(data, list):
                for item in data:
                    if not isinstance(item, dict): continue
                    e = make_entity({
                        "name_en":     item.get("name_en") or item.get("name"),
                        "name_ar":     item.get("name_ar"),
                        "category":    item.get("category", "Services"),
                        "subcategory": item.get("subcategory"),
                        "description": item.get("description"),
                        "website":     clean_url(item.get("website")),
                        "instagram":   clean_url(item.get("instagram")),
                        "phone":       item.get("phone"),
                        "city":        item.get("city"),
                        "governorate": item.get("governorate") or infer_governorate(item.get("city"), item.get("address")),
                        "address":     item.get("address"),
                        "lat":         item.get("lat"),
                        "lng":         item.get("lng"),
                        "source_urls": [s for s in [item.get("source_url")] if s],
                        "source":      f"web_discovery:{f.stem}",
                        "confidence":  item.get("confidence", "medium"),
                        "tourist_score": item.get("tourist_score"),
                        "audience_tags": item.get("audience_tags", []),
                    })
                    entities.append(score_entity(e))
        except Exception as ex:
            print(f"  Warning: failed to parse {f}: {ex}")
    print(f"  WEB DISCOVERIES: {len(entities)} entities from {len(list(RAW.glob('*.json')))} files")
    return entities

# ── Deduplication ─────────────────────────────────────────────────────────────

def normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", "", (name or "").lower())).strip()

def deduplicate(entities: list[dict]) -> list[dict]:
    seen_names = {}
    seen_websites = {}
    unique = []
    for e in entities:
        name_key = normalize_name(e.get("name_en",""))
        web_key  = (e.get("website") or "").rstrip("/").lower()

        # Merge by website
        if web_key and web_key in seen_websites:
            existing = seen_websites[web_key]
            # Merge fields (keep non-null values from both)
            for k, v in e.items():
                if v and not existing.get(k):
                    existing[k] = v
                elif isinstance(v, list) and isinstance(existing.get(k), list):
                    existing[k] = list(set(existing[k] + v))
            continue

        # Merge by normalized name within same category
        cat_name_key = f"{e.get('category','').lower()}::{name_key}"
        if name_key and cat_name_key in seen_names:
            existing = seen_names[cat_name_key]
            for k, v in e.items():
                if v and not existing.get(k):
                    existing[k] = v
                elif isinstance(v, list) and isinstance(existing.get(k), list):
                    existing[k] = list(set(existing[k] + v))
            continue

        seen_names[cat_name_key] = e
        if web_key: seen_websites[web_key] = e
        unique.append(e)

    return unique

# ── Category mapping ──────────────────────────────────────────────────────────

CATEGORY_TO_SHEET = {
    "retail":        "Retail",
    "fashion":       "Retail",
    "clothing":      "Retail",
    "food & beverage":"Food",
    "food":          "Food",
    "restaurant":    "Food",
    "services":      "Services",
    "service":       "Services",
    "healthcare":    "Healthcare",
    "medical":       "Healthcare",
    "health":        "Healthcare",
    "tourism":       "Tourism",
    "hotel":         "Tourism",
    "travel":        "Tourism",
    "education":     "Education",
    "technology":    "Technology",
    "tech":          "Technology",
    "government":    "Government",
    "non-profit":    "Government",
}

def get_sheet(cat: str) -> str:
    return CATEGORY_TO_SHEET.get((cat or "").lower(), "Other")

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("\n=== ChatSouq Jordan Knowledge Graph Builder ===\n")

    print("Loading data sources...")
    all_entities = []
    all_entities += load_services()
    all_entities += load_retail()
    all_entities += load_clothing()
    all_entities += load_food()
    all_entities += load_vendors_ndjson()
    all_entities += load_web_discoveries()
    product_count = load_and_export_products_catalog()

    print(f"\nTotal before dedup: {len(all_entities)}")
    all_entities = deduplicate(all_entities)
    print(f"Total after dedup:  {len(all_entities)}")

    # ── Write Master JSON ──
    master_path = OUT / "Master.json"
    master_path.write_text(json.dumps(all_entities, ensure_ascii=False, indent=2))
    print(f"\nWrote: {master_path}  ({len(all_entities)} entities)")

    # ── Write Master CSV ──
    csv_path = OUT / "Master.csv"
    flat_fields = [
        "id","name_en","name_ar","category","subcategory","description",
        "website","instagram","facebook","phone","email","address","city",
        "governorate","lat","lng","opening_hours","price_level","ordering_url",
        "booking_url","menu_url","rating","source","confidence","last_updated",
        "luxury_score","family_score","tourist_score","student_score","corporate_score",
        "gift_suitability",
    ]
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=flat_fields, extrasaction="ignore")
        w.writeheader()
        for e in all_entities:
            row = {k: ("|".join(v) if isinstance(v, list) else v) for k, v in e.items()}
            w.writerow(row)
    print(f"Wrote: {csv_path}")

    # ── Write category Excel files ──
    category_groups: dict[str, list[dict]] = {}
    for e in all_entities:
        sheet = get_sheet(e.get("category",""))
        category_groups.setdefault(sheet, []).append(e)

    excel_fields = [
        "name_en","name_ar","category","subcategory","description",
        "website","instagram","phone","city","governorate","address",
        "price_level","ordering_url","booking_url","confidence",
        "keywords","search_tags","audience_tags","occasion_tags",
        "luxury_score","family_score","tourist_score","gift_suitability","source",
    ]

    for sheet_name, entities in category_groups.items():
        xl_path = OUT / f"{sheet_name}.xlsx"
        rows = []
        for e in entities:
            rows.append({
                k: ("|".join(str(x) for x in v) if isinstance(v, list) else v)
                for k, v in e.items() if k in excel_fields
            })
        df = pd.DataFrame(rows, columns=[f for f in excel_fields if f in (rows[0] if rows else {})])
        df.to_excel(xl_path, index=False, sheet_name=sheet_name[:31])
        print(f"Wrote: {xl_path}  ({len(entities)} entities)")

    # ── Summary ──
    print("\n=== KNOWLEDGE GRAPH SUMMARY ===")
    print(f"  KG entities (businesses/places):  {len(all_entities):6d}")
    print(f"  Product catalog entries:          {product_count:6d}")
    print(f"  ─────────────────────────────────────────")
    print(f"  TOTAL Jordan-related entities:    {len(all_entities) + product_count:6d}")
    print()
    for sheet, entities in sorted(category_groups.items(), key=lambda x: -len(x[1])):
        print(f"  {sheet:20s} {len(entities):4d}")
    print(f"\n  Output: {OUT}")

    # ── Write search index (for AI RAG) ──
    index = []
    for e in all_entities:
        text_parts = [
            e.get("name_en",""),
            e.get("name_ar","") or "",
            e.get("category",""),
            e.get("subcategory","") or "",
            e.get("description","") or "",
            e.get("city","") or "",
            e.get("governorate","") or "",
            " ".join(e.get("keywords",[]) or []),
            " ".join(e.get("search_tags",[]) or []),
        ]
        index.append({
            "id":       e["id"],
            "name":     e.get("name_en",""),
            "category": e.get("category",""),
            "city":     e.get("city",""),
            "text":     " | ".join(filter(None, text_parts)),
            "website":  e.get("website"),
            "phone":    e.get("phone"),
            "tags":     (e.get("keywords") or []) + (e.get("search_tags") or []),
        })
    index_path = OUT / "search_index.json"
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2))
    print(f"Wrote: {index_path}  ({len(index)} indexed entities)")

    return all_entities

if __name__ == "__main__":
    main()
