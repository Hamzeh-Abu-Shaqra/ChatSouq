"""
Collect additional Jordan product listings from e-commerce APIs and structured feeds.
Outputs to data/knowledge-graph/raw/products_supplement.ndjson
(one JSON object per line, picked up by the KG builder's product count).
"""
import json, urllib.request, urllib.parse, time, re
from pathlib import Path

OUT = Path("/Users/Hamzeh23/Desktop/chatsouq/data/seed/products_supplement.ndjson")
OUT.parent.mkdir(parents=True, exist_ok=True)

# ── Helpers ───────────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; ChatSouqBot/1.0; educational research)",
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
}

def get_json(url: str, params: dict = None, timeout: int = 30):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8", errors="replace"))
    except Exception as e:
        print(f"    Error: {e}")
        return None

def get_html(url: str, timeout: int = 30) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"    Error: {e}")
        return ""

# ── Source 1: OpenFoodFacts Jordan products ───────────────────────────────────

def collect_openfoodfacts() -> list[dict]:
    """Open Food Facts has Jordan-labeled products — free, structured API."""
    print("Fetching OpenFoodFacts Jordan products...")
    products = []
    page = 1
    while page <= 20:  # max 20 pages × 100 = 2000 products
        data = get_json(
            "https://world.openfoodfacts.org/cgi/search.pl",
            params={
                "action": "process",
                "countries_tags": "jordan",
                "json": 1,
                "page": page,
                "page_size": 100,
            },
            timeout=45,
        )
        if not data:
            break
        items = data.get("products", [])
        if not items:
            break
        for item in items:
            name = (item.get("product_name_en") or item.get("product_name") or "").strip()
            if not name or len(name) < 2:
                continue
            brand = item.get("brands", "").split(",")[0].strip()
            cat   = item.get("categories_tags", [""])[0].replace("en:", "").replace("-", " ").title() if item.get("categories_tags") else "Food & Gourmet"
            products.append({
                "name":        name,
                "name_ar":     item.get("product_name_ar") or None,
                "category":    "Food & Gourmet",
                "subcategory": cat[:60],
                "description": f"{name} by {brand}" if brand else name,
                "brand":       brand,
                "barcode":     item.get("code"),
                "url":         f"https://world.openfoodfacts.org/product/{item.get('code')}/",
                "city":        "Amman",
                "governorate": "Jordan",
                "vendor":      brand or "Jordan Market",
                "source":      "openfoodfacts.org",
                "confidence":  "high",
            })
        print(f"  Page {page}: {len(items)} items ({len(products)} total)")
        page += 1
        time.sleep(1.5)  # polite delay
    return products


# ── Source 2: Open Beauty Facts Jordan products ───────────────────────────────

def collect_openbeautyfacts() -> list[dict]:
    """Open Beauty Facts — cosmetics/beauty products available in Jordan."""
    print("Fetching OpenBeautyFacts Jordan products...")
    products = []
    page = 1
    while page <= 10:
        data = get_json(
            "https://world.openbeautyfacts.org/cgi/search.pl",
            params={
                "action": "process",
                "countries_tags": "jordan",
                "json": 1,
                "page": page,
                "page_size": 100,
            },
            timeout=45,
        )
        if not data:
            break
        items = data.get("products", [])
        if not items:
            break
        for item in items:
            name = (item.get("product_name_en") or item.get("product_name") or "").strip()
            if not name or len(name) < 2:
                continue
            brand = item.get("brands", "").split(",")[0].strip()
            cat = item.get("categories_tags", [""])[0].replace("en:", "").replace("-", " ").title() if item.get("categories_tags") else "Beauty & Skincare"
            products.append({
                "name":        name,
                "name_ar":     item.get("product_name_ar") or None,
                "category":    "Beauty & Skincare",
                "subcategory": cat[:60],
                "description": f"{name} by {brand}" if brand else name,
                "brand":       brand,
                "barcode":     item.get("code"),
                "url":         f"https://world.openbeautyfacts.org/product/{item.get('code')}/",
                "city":        "Amman",
                "governorate": "Jordan",
                "vendor":      brand or "Jordan Beauty",
                "source":      "openbeautyfacts.org",
                "confidence":  "high",
            })
        print(f"  Page {page}: {len(items)} items ({len(products)} total)")
        page += 1
        time.sleep(1.5)
    return products


# ── Source 3: Wikidata Jordan products/brands ─────────────────────────────────

def collect_wikidata_jordan_brands() -> list[dict]:
    """SPARQL query Wikidata for Jordan-origin products and brands."""
    print("Fetching Wikidata Jordan brands/products...")
    SPARQL = """
SELECT DISTINCT ?item ?name ?nameAr ?category ?website WHERE {
  { ?item wdt:P17 wd:Q810. }  # country = Jordan
  UNION
  { ?item wdt:P495 wd:Q810. }  # country of origin = Jordan
  ?item rdfs:label ?name.
  FILTER(LANG(?name) = "en")
  OPTIONAL { ?item rdfs:label ?nameAr. FILTER(LANG(?nameAr) = "ar") }
  OPTIONAL { ?item wdt:P31 ?typeItem. ?typeItem rdfs:label ?category. FILTER(LANG(?category) = "en") }
  OPTIONAL { ?item wdt:P856 ?website. }
  FILTER(STRLEN(?name) > 1)
}
LIMIT 2000
"""
    url = "https://query.wikidata.org/sparql"
    params = {"query": SPARQL, "format": "json"}
    data = get_json(url, params=params, timeout=60)
    if not data:
        return []

    products = []
    for b in data.get("results", {}).get("bindings", []):
        name = b.get("name", {}).get("value", "")
        if not name: continue
        products.append({
            "name":        name,
            "name_ar":     b.get("nameAr", {}).get("value") or None,
            "category":    b.get("category", {}).get("value", "Services"),
            "subcategory": "",
            "description": f"Jordan-origin: {name}",
            "website":     b.get("website", {}).get("value") or None,
            "city":        "Amman",
            "governorate": "Jordan",
            "source":      "wikidata.org",
            "confidence":  "medium",
        })
    print(f"  Wikidata: {len(products)} items")
    return products


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    all_products = []
    seen_names = set()

    sources = [
        ("OpenFoodFacts", collect_openfoodfacts),
        ("OpenBeautyFacts", collect_openbeautyfacts),
        ("Wikidata", collect_wikidata_jordan_brands),
    ]

    for label, fn in sources:
        try:
            items = fn()
            for item in items:
                name_key = (item.get("name") or "").lower().strip()
                if not name_key or name_key in seen_names:
                    continue
                seen_names.add(name_key)
                all_products.append(item)
            print(f"  {label}: {len(items)} collected, running total: {len(all_products)}")
        except Exception as e:
            print(f"  {label} failed: {e}")
        time.sleep(2)

    with open(OUT, "w", encoding="utf-8") as f:
        for p in all_products:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    print(f"\nTotal supplement products: {len(all_products)}")
    print(f"Written to: {OUT}")


if __name__ == "__main__":
    main()
