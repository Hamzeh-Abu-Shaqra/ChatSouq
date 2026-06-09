"""
Talabat Jordan Scraper — Direct __NEXT_DATA__ approach (no Playwright)

How it works:
  Talabat is a Next.js SSR app. Every area listing page embeds its full
  restaurant data in <script id="__NEXT_DATA__"> in the HTML.
  We fetch that HTML with requests (fast, no browser), parse the JSON,
  paginate through all pages, and de-duplicate by branchId.

Real Amman area IDs were discovered by scanning talabat.com/jordan/restaurants/{id}/area
and checking city=Amman in the response. IDs 4892-4964 = all Amman delivery zones.
"""
import os
import re
import time
import json
import difflib
import psycopg2
import requests as http
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

# All real Amman delivery areas (city=Amman, countryId=8)
# Discovered by scanning talabat.com/jordan/restaurants/{id}/area
AMMAN_AREAS = [
    (4892, "Tabarbour",                    "tabarbour"),
    (4893, "Jubaiha",                      "jubaiha"),
    (4894, "Al Baraka",                    "al-baraka"),
    (4895, "Al Rawnaq",                    "al-rawnaq"),
    (4896, "Jabal Amman",                  "jabal-amman"),
    (4897, "Abu Nseir",                    "abu-nseir"),
    (4898, "Shmaisani",                    "shmaisani"),
    (4899, "Al Amir Hassan",               "al-amir-hassan"),
    (4900, "Al Kursi",                     "al-kursi"),
    (4901, "Mahes",                        "mahes"),
    (4902, "Jabal Al Weibdeh",             "jabal-al-weibdeh"),
    (4903, "Wadi El Seer",                 "wadi-el-seer"),
    (4904, "Naour",                        "naour"),
    (4905, "Abu Alanda",                   "abu-alanda"),
    (4906, "Marka",                        "marka"),
    (4907, "Swelieh",                      "swelieh"),
    (4908, "Downtown",                     "downtown"),
    (4909, "Al Diyar",                     "al-diyar"),
    (4910, "Al Salhien",                   "al-salhien"),
    (4911, "Mecca Street",                 "mecca-street"),
    (4912, "Al Swaifyeh",                  "al-swaifyeh"),
    (4913, "Wadi Saqra",                   "wadi-saqra"),
    (4914, "Al Jandaweel",                 "al-jandaweel"),
    (4915, "Daheit Al Aqsa",               "daheit-al-aqsa"),
    (4916, "Al Sahel",                     "al-sahel"),
    (4917, "Shafa Badran",                 "shafa-badran"),
    (4918, "Hay Alkhaledeen",              "hay-alkhaledeen"),
    (4919, "Dahiyet Al Rashid",            "dahiyet-al-rashid"),
    (4920, "Dabouq - Baccaloria",          "dabouq-baccaloria"),
    (4921, "Al Ridwan",                    "al-ridwan"),
    (4922, "Madinat Al Hussein",           "madinat-al-hussein"),
    (4923, "Daheit Al Yasmeen",            "daheit-al-yasmeen"),
    (4924, "Al Sahabah",                   "al-sahabah"),
    (4925, "Al Gardens",                   "al-gardens"),
    (4926, "Dahiet Al Hussain",            "dahiet-al-hussain"),
    (4927, "Ras El Ain",                   "ras-el-ain"),
    (4928, "Al Kamaliya",                  "al-kamaliya"),
    (4929, "Al Qwaismeh",                  "al-qwaismeh"),
    (4930, "Marj El Hamam",                "marj-el-hamam"),
    (4931, "Al Hummar",                    "al-hummar"),
    (4932, "Airport Road - Manaseer Gs",   "airport-road-manaseer-gs"),
    (4933, "Medina Street",                "medina-street"),
    (4934, "Al Zohour",                    "al-zohour"),
    (4935, "Dabouq - Ferdous",             "dabouq-ferdous"),
    (4936, "Um El Summaq",                 "um-el-summaq"),
    (4937, "Dahiet Al Ameer Rashed",       "dahiet-al-ameer-rashed"),
    (4938, "Hay Al Rahmanieh",             "hay-al-rahmanieh"),
    (4939, "University Street",            "university-street"),
    (4940, "Basman",                       "basman"),
    (4941, "Khalda",                       "khalda"),
    (4942, "Airport Road - Dunes Bridge",  "airport-road-dunes-bridge"),
    (4943, "Jabal Al Hussain",             "jabal-al-hussain"),
    (4944, "Al Sinaa",                     "al-sinaa"),
    (4945, "Al Rawabi",                    "al-rawabi"),
    (4946, "Al Hashmi Al Shamali",         "al-hashmi-al-shamali"),
    (4947, "Tla Ali",                      "tla-ali"),
    (4948, "Bader Al Jadeda",              "bader-al-jadeda"),
    (4949, "Um Uthaiena",                  "um-uthaiena"),
    (4950, "Abdoun",                       "abdoun"),
    (4951, "Al Hashmi Al Janobi",          "al-hashmi-al-janobi"),
    (4952, "Arjan",                        "arjan"),
    (4953, "Iraq Al Ameer",                "iraq-al-ameer"),
    (4954, "Al Fuhais",                    "al-fuhais"),
    (4955, "Gardens Street",               "gardens-street"),
    (4956, "Dabouq",                       "dabouq"),
    (4957, "Al Bnayyat",                   "al-bnayyat"),
    (4958, "Al Bayader",                   "al-bayader"),
    (4959, "Abdali",                       "abdali"),
    (4960, "Al Rabieh - Al Salam",         "al-rabieh-al-salam"),
    (4961, "Al Madinah Al Tabyeh",         "al-madinah-al-tabyeh"),
    (4962, "Airport Road - Madaba Bridge", "airport-road-madaba-bridge"),
    (4963, "Al Mghaba Al Gharbi",          "al-mghaba-al-gharbi"),
    (4964, "Al Muqabalain",               "al-muqabalain"),
]

PAGE_SIZE = 15   # Talabat returns 15 vendors per page


# ── Database ──────────────────────────────────────────────────────────────────

def get_db():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def setup_table():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS jordan_restaurants (
            id SERIAL PRIMARY KEY,
            name TEXT,
            name_ar TEXT,
            cuisine TEXT,
            rating FLOAT,
            rating_count INT,
            delivery_time TEXT,
            min_order TEXT,
            delivery_fee TEXT,
            address TEXT,
            area TEXT,
            is_open BOOLEAN,
            talabat_id TEXT UNIQUE,
            url TEXT,
            maps_place_id TEXT,
            search_text TEXT,
            scraped_at TIMESTAMP DEFAULT NOW()
        )
    """)
    for stmt in [
        "ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS name_ar TEXT",
        "ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS rating_count INT",
        "ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS address TEXT",
        "ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS area TEXT",
        "ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS is_open BOOLEAN",
        "ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS maps_place_id TEXT",
        "ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS search_text TEXT",
    ]:
        try:
            cur.execute(stmt)
        except Exception:
            pass
    conn.commit()
    cur.close()
    conn.close()


# ── Parsing ───────────────────────────────────────────────────────────────────

def parse_vendor(v: dict, area_name: str) -> dict:
    """Convert a Talabat vendor object to our schema."""
    name = (v.get("name") or "").strip()
    if not name:
        return None

    cuisine = (v.get("cuisineString") or v.get("cuisine") or "")
    if isinstance(cuisine, list):
        cuisine = ", ".join(str(c) for c in cuisine)
    cuisine = str(cuisine).strip()[:150] or None

    rating = v.get("rate") or v.get("rating")
    try:
        rating = float(rating) if rating is not None else None
    except (ValueError, TypeError):
        rating = None

    branch_id = str(v.get("branchId") or v.get("id") or "").strip()
    slug = (v.get("branchSlug") or v.get("slug") or "").strip()
    url = (f"https://www.talabat.com/jordan/restaurant/{slug}" if slug else None)

    delivery_time = v.get("avgDeliveryTime") or v.get("deliveryTime")
    min_order = v.get("minimumOrderAmount")
    delivery_fee = v.get("deliveryFee")

    # statusCode 0 = open, anything else = closed
    status = v.get("statusCode")
    is_open = (status == 0) if status is not None else None

    # Filter out grocery stores
    if v.get("isGrocery") or v.get("verticalType") == 1:
        return None

    return {
        "name":          name,
        "name_ar":       None,
        "cuisine":       cuisine,
        "rating":        rating,
        "rating_count":  v.get("totalRatings"),
        "delivery_time": str(delivery_time) if delivery_time else None,
        "min_order":     str(min_order) if min_order is not None else None,
        "delivery_fee":  str(delivery_fee) if delivery_fee is not None else None,
        "area":          area_name,
        "is_open":       is_open,
        "talabat_id":    branch_id or None,
        "url":           url,
        "maps_place_id": None,
        "address":       None,
    }


def fetch_page(area_id: int, slug: str, page: int) -> tuple[list, int]:
    """Fetch one page of an area listing. Returns (vendors, total_vendors)."""
    url = f"https://www.talabat.com/jordan/restaurants/{area_id}/{slug}?page={page}"
    try:
        r = http.get(url, headers=HEADERS, timeout=20)
        match = re.search(
            r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
            r.text, re.DOTALL
        )
        if not match:
            return [], 0
        data = json.loads(match.group(1))
        pd = data.get("props", {}).get("pageProps", {}).get("data", {})
        return pd.get("vendors", []), pd.get("totalVendors", 0)
    except Exception as e:
        return [], 0


def scrape_area(area_id: int, area_name: str, slug: str,
                global_seen: set, max_pages: int = 30) -> list:
    """
    Paginate through one Amman area. Adds new branchIds to global_seen
    to avoid cross-area duplicates. Returns list of parsed restaurant dicts.
    """
    results = []
    for page in range(1, max_pages + 1):
        vendors, total = fetch_page(area_id, slug, page)
        if not vendors:
            break

        for v in vendors:
            bid = str(v.get("branchId") or v.get("id") or "").strip()
            if not bid or bid in global_seen:
                continue
            global_seen.add(bid)
            parsed = parse_vendor(v, area_name)
            if parsed:
                results.append(parsed)

        # Stop when we've seen all pages
        total_pages = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)
        if page >= min(total_pages, max_pages):
            break

        time.sleep(0.25)   # polite delay

    return results


# ── Google Maps matching ──────────────────────────────────────────────────────

def normalize(name: str) -> str:
    if not name:
        return ""
    n = name.lower().strip()
    for w in ["restaurant", "مطعم", "cafe", "كافيه", "cafeteria", "كافيتيريا",
              "amman", "عمان", "jordan", "الأردن", " the", "the "]:
        n = n.replace(w, "")
    n = re.sub(r"[^\w\s]", "", n)
    return re.sub(r"\s+", " ", n).strip()


def load_maps_index():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT place_id, name, address FROM jordan_places WHERE category = 'food'")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [(pid, normalize(name), addr) for pid, name, addr in rows]
    except Exception as e:
        print(f"  [match] Could not load Maps index: {e}")
        return []


def match_with_maps(restaurants, maps_index):
    if not maps_index:
        return restaurants
    matched = 0
    for r in restaurants:
        norm = normalize(r.get("name", ""))
        if not norm:
            continue
        best_score, best_pid, best_addr = 0.0, None, None
        for pid, norm_maps, addr in maps_index:
            score = difflib.SequenceMatcher(None, norm, norm_maps).ratio()
            if score > best_score:
                best_score, best_pid, best_addr = score, pid, addr
        if best_score >= 0.80:
            r["maps_place_id"] = best_pid
            if not r.get("address"):
                r["address"] = best_addr
            matched += 1
    print(f"  [match] {matched}/{len(restaurants)} matched to Google Maps")
    return restaurants


# ── Database save ─────────────────────────────────────────────────────────────

def save_restaurants(restaurants: list) -> int:
    if not restaurants:
        return 0

    for r in restaurants:
        r["search_text"] = " ".join(filter(None, [
            r.get("name"), r.get("cuisine"), r.get("area"),
            "restaurant food delivery amman jordan"
        ])).strip()

    conn = get_db()
    cur = conn.cursor()
    saved = 0
    for r in restaurants:
        if not r.get("talabat_id"):
            continue
        try:
            cur.execute("""
                INSERT INTO jordan_restaurants
                    (name, name_ar, cuisine, rating, rating_count, delivery_time,
                     min_order, delivery_fee, address, area, is_open,
                     talabat_id, url, maps_place_id, search_text)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (talabat_id) DO UPDATE SET
                    name          = EXCLUDED.name,
                    rating        = COALESCE(EXCLUDED.rating,        jordan_restaurants.rating),
                    rating_count  = COALESCE(EXCLUDED.rating_count,  jordan_restaurants.rating_count),
                    delivery_time = COALESCE(EXCLUDED.delivery_time, jordan_restaurants.delivery_time),
                    cuisine       = COALESCE(EXCLUDED.cuisine,       jordan_restaurants.cuisine),
                    maps_place_id = COALESCE(EXCLUDED.maps_place_id, jordan_restaurants.maps_place_id),
                    address       = COALESCE(EXCLUDED.address,       jordan_restaurants.address),
                    area          = COALESCE(EXCLUDED.area,          jordan_restaurants.area),
                    is_open       = EXCLUDED.is_open,
                    search_text   = EXCLUDED.search_text,
                    scraped_at    = NOW()
            """, (
                r["name"], r.get("name_ar"), r.get("cuisine"),
                r.get("rating"), r.get("rating_count"), r.get("delivery_time"),
                r.get("min_order"), r.get("delivery_fee"), r.get("address"),
                r.get("area"), r.get("is_open"), r["talabat_id"],
                r.get("url"), r.get("maps_place_id"), r.get("search_text"),
            ))
            saved += 1
        except Exception as e:
            print(f"    DB error for {r.get('name')}: {e}")

    conn.commit()
    cur.close()
    conn.close()
    return saved


# ── Entry point ───────────────────────────────────────────────────────────────

def run():
    print("Setting up jordan_restaurants table...")
    setup_table()

    print(f"Scraping Talabat Jordan — {len(AMMAN_AREAS)} Amman delivery areas...")
    all_restaurants = []
    global_seen: set = set()

    for area_id, area_name, slug in AMMAN_AREAS:
        restaurants = scrape_area(area_id, area_name, slug, global_seen, max_pages=30)
        if restaurants:
            all_restaurants.extend(restaurants)
            print(f"  [{area_name}] +{len(restaurants)} new  (total unique so far: {len(all_restaurants)})")
        else:
            print(f"  [{area_name}] 0 new")
        time.sleep(0.5)

    print(f"\nTotal unique restaurants found: {len(all_restaurants)}")

    if all_restaurants:
        print("Matching with Google Maps...")
        maps_index = load_maps_index()
        all_restaurants = match_with_maps(all_restaurants, maps_index)

    saved = save_restaurants(all_restaurants)
    print(f"Talabat done. Saved {saved} restaurants.")


if __name__ == "__main__":
    run()
