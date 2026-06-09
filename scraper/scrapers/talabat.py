"""
Talabat Jordan Scraper — Smart API Discovery

Strategy:
1. Open talabat.com/jordan with Playwright
2. Intercept network traffic to discover:
   a. The REAL area list (not guessed IDs)
   b. The restaurant listing API endpoint + auth headers
3. Replicate the discovered API calls with requests library + pagination
4. Filter strictly to Amman areas
5. Match results with Google Maps data
"""
import os
import re
import time
import json
import difflib
import psycopg2
import requests as http
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

# Amman area keyword filter — any area whose name contains one of these is Amman
AMMAN_KEYWORDS = {
    "amman", "عمان", "abdali", "abdoun", "shmeisani", "swefieh",
    "medina street", "gardens", "jubeiha", "khalda", "tlaa al ali",
    "rabiyeh", "shmaisani", "um uthaina", "marj el hamam", "bayader",
    "wadi seer", "sports city", "jabal amman", "marka", "airport road",
    "zarqa road", "7th circle", "6th circle", "5th circle", "8th circle",
    "downtown", "west amman", "east amman", "al rabiyeh", "al shmaisani",
    "ابدلي", "عبدون", "شميساني", "صويفية", "الجاردنز", "جبيهة",
    "خلدا", "تلاع العلي", "الرابية", "أم أذينة", "مرج الحمام",
    "بيادر", "وادي السير", "المدينة الرياضية", "جبل عمان", "ماركا",
}


def is_amman(area_name: str) -> bool:
    if not area_name:
        return False
    n = area_name.lower()
    return any(kw in n for kw in AMMAN_KEYWORDS)


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


# ── Name normalization for fuzzy matching ─────────────────────────────────────

def normalize(name: str) -> str:
    if not name:
        return ""
    n = name.lower().strip()
    for w in ["restaurant", "مطعم", "cafe", "كافيه", "cafeteria", "كافيتيريا",
              "amman", "عمان", "jordan", "الأردن", " the", "the "]:
        n = n.replace(w, "")
    n = re.sub(r"[^\w\s]", "", n)
    return re.sub(r"\s+", " ", n).strip()


# ── Google Maps matching ──────────────────────────────────────────────────────

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
    matched = 0
    for r in restaurants:
        norm = normalize(r.get("name", ""))
        if not norm or not maps_index:
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


# ── JSON extraction ───────────────────────────────────────────────────────────

def parse_restaurant(obj, area_name=""):
    """Extract a restaurant dict from any API object shape."""
    try:
        name = (obj.get("name") or obj.get("nameEn") or obj.get("name_en") or
                (obj.get("names") or {}).get("en") or
                (obj.get("name_translations") or {}).get("en") or "")
        name_ar = (obj.get("nameAr") or obj.get("name_ar") or
                   (obj.get("names") or {}).get("ar") or
                   (obj.get("name_translations") or {}).get("ar") or "")
        if not name and not name_ar:
            return None

        # Rating
        r = obj.get("rating") or {}
        rating = (obj.get("stars") or obj.get("rating_value") or obj.get("averageRating") or
                  (r.get("value") if isinstance(r, dict) else r) or None)
        rating_count = (obj.get("reviewsCount") or obj.get("review_count") or
                        (r.get("count") if isinstance(r, dict) else None) or None)

        # Delivery
        d = obj.get("deliveryInfo") or obj.get("delivery") or {}
        delivery_time = (obj.get("deliveryTime") or obj.get("estimated_delivery_time") or
                         d.get("time") or d.get("duration") or None)
        min_order = (obj.get("minimumOrder") or obj.get("minimum_order_amount") or
                     d.get("minimumOrder") or None)
        delivery_fee = (obj.get("deliveryFee") or obj.get("delivery_cost") or
                        d.get("fee") or None)

        # Cuisine
        cuisines = obj.get("cuisines") or obj.get("categories") or obj.get("cuisine") or []
        cuisine = None
        if isinstance(cuisines, list) and cuisines:
            first = cuisines[0]
            cuisine = (first.get("name") or first.get("nameEn") if isinstance(first, dict) else str(first))
        elif isinstance(cuisines, str):
            cuisine = cuisines

        # Area — prefer from object, fall back to what we know
        obj_area = (obj.get("area") or obj.get("areaName") or obj.get("zone") or
                    (obj.get("location") or {}).get("area") or area_name or "")

        # ID & URL
        branch_id = (obj.get("id") or obj.get("branchId") or obj.get("vendorId") or
                     obj.get("branch_id") or obj.get("vendor_id"))
        slug = obj.get("slug") or obj.get("urlKey") or obj.get("url_key") or obj.get("link")
        url = None
        if slug:
            url = slug if slug.startswith("http") else f"https://www.talabat.com/jordan/restaurant/{slug}"
        elif branch_id:
            url = f"https://www.talabat.com/jordan/restaurant/{branch_id}"

        is_open = obj.get("isOpen") or obj.get("is_open") or obj.get("open")

        return {
            "name":          (name or name_ar).strip(),
            "name_ar":       name_ar.strip() or None,
            "cuisine":       cuisine,
            "rating":        float(rating) if rating is not None else None,
            "rating_count":  int(rating_count) if rating_count is not None else None,
            "delivery_time": str(delivery_time) if delivery_time else None,
            "min_order":     str(min_order) if min_order else None,
            "delivery_fee":  str(delivery_fee) if delivery_fee else None,
            "area":          str(obj_area).strip() or None,
            "is_open":       bool(is_open) if is_open is not None else None,
            "talabat_id":    str(branch_id) if branch_id else None,
            "url":           url,
            "maps_place_id": None,
            "address":       None,
        }
    except Exception:
        return None


def dig_for_restaurants(obj, area_name, results, seen, depth=0):
    """Recursively find restaurant objects anywhere in a JSON payload."""
    if depth > 10:
        return
    if isinstance(obj, list):
        for item in obj:
            if isinstance(item, dict):
                r = parse_restaurant(item, area_name)
                uid = (r.get("talabat_id") or r.get("url") or r.get("name")) if r else None
                if r and uid and uid not in seen:
                    seen.add(uid)
                    results.append(r)
                else:
                    dig_for_restaurants(item, area_name, results, seen, depth + 1)
            else:
                dig_for_restaurants(item, area_name, results, seen, depth + 1)
    elif isinstance(obj, dict):
        for v in obj.values():
            dig_for_restaurants(v, area_name, results, seen, depth + 1)


def dig_for_areas(obj, areas, depth=0):
    """Find area/city objects in API responses — returns list of (id, name) tuples."""
    if depth > 8:
        return
    if isinstance(obj, list):
        for item in obj:
            dig_for_areas(item, areas, depth + 1)
    elif isinstance(obj, dict):
        area_id   = obj.get("id") or obj.get("areaId") or obj.get("area_id")
        area_name = (obj.get("name") or obj.get("nameEn") or obj.get("area_name") or
                     (obj.get("names") or {}).get("en") or "")
        area_slug = obj.get("slug") or obj.get("urlKey") or obj.get("seo_url") or ""

        if area_id and area_name and len(area_name) > 1:
            areas.append((str(area_id), area_name.strip(), str(area_slug)))
        else:
            for v in obj.values():
                dig_for_areas(v, areas, depth + 1)


# ── Playwright scraping ───────────────────────────────────────────────────────

BROWSER_ARGS = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"]
CONTEXT_OPTS = dict(
    user_agent=(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    ),
    locale="en-US",
    viewport={"width": 390, "height": 844},
    extra_http_headers={
        "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
        "Accept": "application/json, */*",
    },
)


def discover_areas(browser) -> list:
    """
    Load the Talabat Jordan homepage and intercept API responses
    to find the real list of areas with their IDs.
    """
    found_areas = []
    captured = []

    ctx  = browser.new_context(**CONTEXT_OPTS)
    page = ctx.new_page()

    def capture(response):
        try:
            if response.status != 200:
                return
            ct = response.headers.get("content-type", "")
            if "json" not in ct:
                return
            u = response.url.lower()
            if any(k in u for k in ["area", "city", "region", "location", "zone", "district"]):
                captured.append(response.json())
        except Exception:
            pass

    page.on("response", capture)
    try:
        page.goto("https://www.talabat.com/jordan/restaurants", timeout=45000, wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle", timeout=20000)
        page.wait_for_timeout(4000)

        # Try clicking the area/location selector if present
        for sel in ["[data-testid='area-selector']", "[data-testid='location-btn']",
                    ".area-selector", "#area-dropdown", "button[aria-label*='area']"]:
            try:
                el = page.query_selector(sel)
                if el:
                    el.click()
                    page.wait_for_timeout(2000)
                    break
            except Exception:
                pass

        page.wait_for_timeout(2000)
    except Exception as e:
        print(f"  [discover] page warning: {e}")

    page.remove_listener("response", capture)
    page.close()
    ctx.close()

    for body in captured:
        dig_for_areas(body, found_areas)

    # Deduplicate
    seen_ids = set()
    unique = []
    for aid, aname, aslug in found_areas:
        if aid not in seen_ids:
            seen_ids.add(aid)
            unique.append((aid, aname, aslug))

    print(f"  [discover] Found {len(unique)} areas from API")
    return unique


def scrape_area(ctx, area_id: str, area_name: str, area_slug: str) -> list:
    """
    Load a single Talabat area page and capture all restaurant data
    by intercepting JSON responses.
    """
    results, seen = [], set()
    captured = []

    page = ctx.new_page()

    def capture(response):
        try:
            if response.status != 200:
                return
            ct = response.headers.get("content-type", "")
            if "json" not in ct:
                return
            body = response.json()
            captured.append(body)
        except Exception:
            pass

    page.on("response", capture)

    # Try slug URL first, fall back to ID-based URL
    urls_to_try = []
    if area_slug:
        urls_to_try.append(f"https://www.talabat.com/jordan/restaurants/{area_slug}")
    urls_to_try.append(f"https://www.talabat.com/jordan/restaurants/{area_id}/{area_name.lower().replace(' ', '-')}")
    urls_to_try.append(f"https://www.talabat.com/jordan/restaurants")

    for url in urls_to_try:
        try:
            page.goto(url, timeout=40000, wait_until="domcontentloaded")
            page.wait_for_load_state("networkidle", timeout=15000)
            page.wait_for_timeout(2000)
            # Scroll to trigger lazy loading
            for _ in range(6):
                page.evaluate("window.scrollBy(0, 1200)")
                page.wait_for_timeout(600)
            page.wait_for_timeout(1500)
            break
        except Exception as e:
            print(f"    [{area_name}] url {url} failed: {e}")
            continue

    page.remove_listener("response", capture)
    page.close()

    for body in captured:
        dig_for_restaurants(body, area_name, results, seen)

    return results


def scrape_talabat_jordan() -> list:
    """Full scrape: discover areas → filter to Amman → scrape each area."""
    all_restaurants = []
    global_seen = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=BROWSER_ARGS)

        # ── Step 1: Discover real areas ───────────────────────────────────────
        print("  [talabat] Discovering areas...")
        areas = discover_areas(browser)

        # Filter to Amman
        amman_areas = [(aid, aname, aslug) for aid, aname, aslug in areas if is_amman(aname)]
        print(f"  [talabat] Amman areas found: {len(amman_areas)}")

        # If discovery failed, fall back to known area slugs
        if not amman_areas:
            print("  [talabat] Discovery returned 0 Amman areas — using known slugs fallback")
            amman_areas = [
                ("1",  "Abdali",         "abdali"),
                ("2",  "Abdoun",         "abdoun"),
                ("3",  "Shmeisani",      "shmeisani"),
                ("4",  "Swefieh",        "swefieh"),
                ("5",  "Gardens",        "gardens"),
                ("6",  "Khalda",         "khalda"),
                ("7",  "Tlaa Al Ali",    "tlaa-al-ali"),
                ("8",  "Jubeiha",        "jubeiha"),
                ("9",  "Medina Street",  "medina-street"),
                ("10", "Sports City",    "sports-city"),
                ("11", "Bayader",        "bayader-wadi-seer"),
                ("12", "Um Uthaina",     "um-uthaina"),
                ("13", "Marj El Hamam",  "marj-el-hamam"),
                ("14", "Al Rabiyeh",     "al-rabiyeh"),
                ("15", "Airport Road",   "airport-road"),
                ("16", "Jabal Amman",    "jabal-amman"),
                ("17", "Marka",          "marka"),
                ("18", "Zarqa Road",     "zarqa-road"),
            ]

        # ── Step 2: Scrape each Amman area ────────────────────────────────────
        ctx = browser.new_context(**CONTEXT_OPTS)

        for area_id, area_name, area_slug in amman_areas:
            print(f"  [talabat] Scraping: {area_name}...")
            restaurants = scrape_area(ctx, area_id, area_name, area_slug)

            new = 0
            for r in restaurants:
                uid = r.get("talabat_id") or r.get("url") or r.get("name")
                if uid and uid not in global_seen:
                    global_seen.add(uid)
                    all_restaurants.append(r)
                    new += 1

            print(f"    → {len(restaurants)} found, {new} new (total: {len(all_restaurants)})")
            time.sleep(2)

        ctx.close()
        browser.close()

    return all_restaurants


# ── Database ──────────────────────────────────────────────────────────────────

def save_restaurants(restaurants):
    if not restaurants:
        return 0

    for r in restaurants:
        r["search_text"] = " ".join(filter(None, [
            r.get("name"), r.get("cuisine"), r.get("area"),
            "restaurant food delivery amman jordan"
        ])).strip()

    conn = get_db()
    cur  = conn.cursor()
    saved = 0
    for r in restaurants:
        uid = r.get("talabat_id") or r.get("url")
        if not uid:
            continue
        try:
            cur.execute("""
                INSERT INTO jordan_restaurants
                    (name, name_ar, cuisine, rating, rating_count, delivery_time,
                     min_order, delivery_fee, address, area, is_open,
                     talabat_id, url, maps_place_id, search_text)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (talabat_id) DO UPDATE SET
                    rating        = COALESCE(EXCLUDED.rating,        jordan_restaurants.rating),
                    rating_count  = COALESCE(EXCLUDED.rating_count,  jordan_restaurants.rating_count),
                    delivery_time = COALESCE(EXCLUDED.delivery_time, jordan_restaurants.delivery_time),
                    cuisine       = COALESCE(EXCLUDED.cuisine,       jordan_restaurants.cuisine),
                    maps_place_id = COALESCE(EXCLUDED.maps_place_id, jordan_restaurants.maps_place_id),
                    address       = COALESCE(EXCLUDED.address,       jordan_restaurants.address),
                    area          = COALESCE(EXCLUDED.area,          jordan_restaurants.area),
                    is_open       = EXCLUDED.is_open,
                    search_text   = EXCLUDED.search_text
            """, (
                r.get("name"), r.get("name_ar"), r.get("cuisine"),
                r.get("rating"), r.get("rating_count"), r.get("delivery_time"),
                r.get("min_order"), r.get("delivery_fee"), r.get("address"),
                r.get("area"), r.get("is_open"), r.get("talabat_id"),
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

    print("Scraping Talabat Jordan (Amman only)...")
    restaurants = scrape_talabat_jordan()
    print(f"  Total found: {len(restaurants)}")

    if restaurants:
        print("Matching with Google Maps...")
        maps_index = load_maps_index()
        restaurants = match_with_maps(restaurants, maps_index)

    saved = save_restaurants(restaurants)
    print(f"Talabat done. Saved {saved} restaurants.")


if __name__ == "__main__":
    run()
