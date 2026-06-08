import os
import re
import time
import json
import difflib
import psycopg2
import requests
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))


# Talabat Jordan area slugs — covers all major cities and delivery zones
AMMAN_AREA_URLS = [
    # ── Amman ─────────────────────────────────────────────────────────────────
    "https://www.talabat.com/jordan/restaurants",
    "https://www.talabat.com/jordan/restaurants/822/abdali",
    "https://www.talabat.com/jordan/restaurants/823/abdoun",
    "https://www.talabat.com/jordan/restaurants/824/shmeisani",
    "https://www.talabat.com/jordan/restaurants/825/swefieh",
    "https://www.talabat.com/jordan/restaurants/826/medina-street",
    "https://www.talabat.com/jordan/restaurants/827/gardens",
    "https://www.talabat.com/jordan/restaurants/828/jubeiha",
    "https://www.talabat.com/jordan/restaurants/829/marka",
    "https://www.talabat.com/jordan/restaurants/830/zarqa-road",
    "https://www.talabat.com/jordan/restaurants/831/jabal-amman",
    "https://www.talabat.com/jordan/restaurants/832/sports-city",
    "https://www.talabat.com/jordan/restaurants/833/bayader-wadi-seer",
    "https://www.talabat.com/jordan/restaurants/834/khalda",
    "https://www.talabat.com/jordan/restaurants/835/tlaa-al-ali",
    "https://www.talabat.com/jordan/restaurants/836/al-rabiyeh",
    "https://www.talabat.com/jordan/restaurants/837/al-shmaisani",
    "https://www.talabat.com/jordan/restaurants/838/um-uthaina",
    "https://www.talabat.com/jordan/restaurants/839/marj-el-hamam",
    "https://www.talabat.com/jordan/restaurants/840/airport-road",
    # ── Irbid ─────────────────────────────────────────────────────────────────
    "https://www.talabat.com/jordan/restaurants/irbid",
    "https://www.talabat.com/jordan/restaurants/841/irbid-city",
    "https://www.talabat.com/jordan/restaurants/842/al-hussein-camp",
    "https://www.talabat.com/jordan/restaurants/843/yarmouk-university",
    # ── Zarqa ─────────────────────────────────────────────────────────────────
    "https://www.talabat.com/jordan/restaurants/zarqa",
    "https://www.talabat.com/jordan/restaurants/844/zarqa-city",
    "https://www.talabat.com/jordan/restaurants/845/russeifa",
    # ── Aqaba ─────────────────────────────────────────────────────────────────
    "https://www.talabat.com/jordan/restaurants/aqaba",
    "https://www.talabat.com/jordan/restaurants/846/aqaba-city",
    # ── Salt ──────────────────────────────────────────────────────────────────
    "https://www.talabat.com/jordan/restaurants/847/salt",
    # ── Madaba ────────────────────────────────────────────────────────────────
    "https://www.talabat.com/jordan/restaurants/848/madaba",
    # ── Jerash ────────────────────────────────────────────────────────────────
    "https://www.talabat.com/jordan/restaurants/849/jerash",
    # ── Ajloun ────────────────────────────────────────────────────────────────
    "https://www.talabat.com/jordan/restaurants/850/ajloun",
]


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
    # Add new columns if table existed before
    for col in [
        "ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS name_ar TEXT",
        "ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS rating_count INT",
        "ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS address TEXT",
        "ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS area TEXT",
        "ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS is_open BOOLEAN",
        "ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS talabat_id TEXT",
        "ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS maps_place_id TEXT",
        "ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS search_text TEXT",
    ]:
        try:
            cur.execute(col)
        except Exception:
            pass
    conn.commit()
    cur.close()
    conn.close()


def normalize_name(name):
    """Normalize a restaurant name for fuzzy matching."""
    if not name:
        return ""
    n = name.lower().strip()
    # Remove common words that don't help matching
    for word in ["restaurant", "مطعم", "cafe", "كافيه", "كافيتيريا", "cafeteria",
                 "amman", "عمان", "jordan", "الأردن", "the ", " the"]:
        n = n.replace(word, "")
    # Remove special chars
    n = re.sub(r"[^\w\s]", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def match_with_maps(restaurants):
    """
    For each Talabat restaurant, try to find a matching record in jordan_places.
    Adds maps_place_id and address to the restaurant dict if a match is found.
    """
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT place_id, name, address
            FROM jordan_places
            WHERE category IN ('restaurant', 'cafe', 'bakery', 'food')
        """)
        maps_rows = cur.fetchall()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"  [match] Could not load Maps data: {e}")
        return restaurants

    # Build normalized map for O(1) lookup candidates
    maps_index = [(pid, normalize_name(name), name, addr) for pid, name, addr in maps_rows]

    matched = 0
    for r in restaurants:
        norm_talabat = normalize_name(r.get("name", ""))
        if not norm_talabat:
            continue

        best_score = 0.0
        best_pid = None
        best_addr = None

        for pid, norm_maps, orig_maps, addr in maps_index:
            score = difflib.SequenceMatcher(None, norm_talabat, norm_maps).ratio()
            if score > best_score:
                best_score = score
                best_pid = pid
                best_addr = addr

        if best_score >= 0.80:
            r["maps_place_id"] = best_pid
            if not r.get("address"):
                r["address"] = best_addr
            matched += 1

    print(f"  [match] Matched {matched}/{len(restaurants)} Talabat restaurants with Google Maps")
    return restaurants


def parse_restaurant_from_api(data, area_name=""):
    """Parse a restaurant object from Talabat's internal API response."""
    try:
        # Talabat uses different response shapes — handle both known formats
        name = (
            data.get("name") or
            data.get("nameEn") or
            data.get("name_en") or
            (data.get("names") or {}).get("en") or ""
        )
        name_ar = (
            data.get("nameAr") or
            data.get("name_ar") or
            (data.get("names") or {}).get("ar") or ""
        )
        if not name and not name_ar:
            return None

        # Rating
        rating_obj = data.get("rating") or {}
        rating = (
            data.get("stars") or
            rating_obj.get("value") or
            rating_obj.get("stars") or
            data.get("averageRating")
        )
        rating_count = (
            data.get("reviewsCount") or
            rating_obj.get("count") or
            data.get("numberOfReviews")
        )

        # Delivery info
        delivery = data.get("deliveryInfo") or data.get("delivery") or {}
        delivery_time = (
            data.get("deliveryTime") or
            delivery.get("time") or
            delivery.get("duration") or
            data.get("estimatedDeliveryTime")
        )
        min_order = (
            data.get("minimumOrder") or
            delivery.get("minimumOrder") or
            data.get("minOrderAmount")
        )
        delivery_fee = (
            data.get("deliveryFee") or
            delivery.get("fee") or
            data.get("deliveryCost")
        )

        # Cuisine
        cuisines = data.get("cuisines") or data.get("categories") or []
        cuisine = None
        if isinstance(cuisines, list) and cuisines:
            first = cuisines[0]
            if isinstance(first, dict):
                cuisine = first.get("name") or first.get("nameEn")
            elif isinstance(first, str):
                cuisine = first

        # URL / ID
        branch_id = data.get("id") or data.get("branchId") or data.get("restaurantId")
        slug = data.get("slug") or data.get("urlKey") or data.get("link")
        url = None
        if slug:
            if slug.startswith("http"):
                url = slug
            else:
                url = f"https://www.talabat.com/jordan/restaurant/{slug}"
        elif branch_id:
            url = f"https://www.talabat.com/jordan/restaurant/{branch_id}"

        is_open = data.get("isOpen") or data.get("open") or None

        return {
            "name": name.strip() if name else name_ar.strip(),
            "name_ar": name_ar.strip() if name_ar else None,
            "cuisine": cuisine,
            "rating": float(rating) if rating is not None else None,
            "rating_count": int(rating_count) if rating_count is not None else None,
            "delivery_time": str(delivery_time) if delivery_time else None,
            "min_order": str(min_order) if min_order else None,
            "delivery_fee": str(delivery_fee) if delivery_fee else None,
            "area": area_name or None,
            "is_open": bool(is_open) if is_open is not None else None,
            "talabat_id": str(branch_id) if branch_id else None,
            "url": url,
            "maps_place_id": None,
            "address": None,
        }
    except Exception:
        return None


def extract_restaurants_from_json(payload, area_name=""):
    """Recursively dig through any JSON payload to find restaurant arrays."""
    found = []

    def dig(obj):
        if isinstance(obj, list):
            for item in obj:
                if isinstance(item, dict):
                    r = parse_restaurant_from_api(item, area_name)
                    if r and r.get("name"):
                        found.append(r)
                    else:
                        dig(item)
                else:
                    dig(item)
        elif isinstance(obj, dict):
            for v in obj.values():
                dig(v)

    dig(payload)
    return found


def scrape_talabat_area(page, url, area_name):
    """
    Navigate to a Talabat area page and intercept all JSON API responses
    that look like restaurant listings.
    """
    restaurants = []
    seen_ids = set()
    api_hits = []

    def handle_response(response):
        try:
            ct = response.headers.get("content-type", "")
            if "json" not in ct:
                return
            # Only capture calls that look like restaurant data
            u = response.url
            if not any(k in u for k in ["restaurant", "listing", "vendor", "food", "branch"]):
                return
            if response.status != 200:
                return
            body = response.json()
            api_hits.append((u, body))
        except Exception:
            pass

    page.on("response", handle_response)

    try:
        page.goto(url, timeout=45000, wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle", timeout=20000)
        page.wait_for_timeout(3000)

        # Scroll to trigger lazy loading
        for _ in range(8):
            page.evaluate("window.scrollBy(0, 1200)")
            page.wait_for_timeout(800)

        page.wait_for_timeout(2000)
    except Exception as e:
        print(f"    Navigation error for {area_name}: {e}")

    page.remove_listener("response", handle_response)

    # Parse all intercepted API responses
    for api_url, body in api_hits:
        extracted = extract_restaurants_from_json(body, area_name)
        for r in extracted:
            tid = r.get("talabat_id") or r.get("url") or r.get("name")
            if tid and tid not in seen_ids:
                seen_ids.add(tid)
                restaurants.append(r)

    print(f"    [{area_name}] Intercepted {len(api_hits)} API calls → {len(restaurants)} restaurants")
    return restaurants


def scrape_talabat():
    """Scrape all Talabat Amman restaurants by intercepting their internal API."""
    all_restaurants = []
    seen_ids = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                "Version/17.0 Mobile/15E148 Safari/604.1"
            ),
            locale="en-US",
            viewport={"width": 390, "height": 844},
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
                "Accept": "application/json, text/plain, */*",
            },
        )

        # Map city-level slugs to friendly names
        CITY_LABELS = {
            "irbid": "Irbid", "zarqa": "Zarqa", "aqaba": "Aqaba",
            "salt": "Salt", "madaba": "Madaba", "jerash": "Jerash", "ajloun": "Ajloun",
        }
        for area_url in AMMAN_AREA_URLS:
            slug = area_url.rstrip("/").split("/")[-1]
            area_name = CITY_LABELS.get(slug.lower(), slug.replace("-", " ").title())
            print(f"  Scraping area: {area_name}...")
            page = context.new_page()

            try:
                restaurants = scrape_talabat_area(page, area_url, area_name)
                for r in restaurants:
                    uid = r.get("talabat_id") or r.get("url") or r.get("name")
                    if uid and uid not in seen_ids:
                        seen_ids.add(uid)
                        all_restaurants.append(r)
            except Exception as e:
                print(f"    Error on {area_name}: {e}")
            finally:
                page.close()

            time.sleep(2)

        browser.close()

    print(f"  Total unique Talabat restaurants found: {len(all_restaurants)}")
    return all_restaurants


def save_restaurants(restaurants):
    if not restaurants:
        return 0

    for r in restaurants:
        parts = [r.get("name"), r.get("cuisine"), r.get("area"), "restaurant food delivery amman jordan"]
        r["search_text"] = " ".join(p for p in parts if p).replace("  ", " ").strip()

    conn = get_db()
    cur = conn.cursor()
    saved = 0
    for r in restaurants:
        try:
            # Use talabat_id as unique key; fall back to url
            unique_key = r.get("talabat_id") or r.get("url")
            if not unique_key:
                continue

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
            print(f"    Error saving {r.get('name')}: {e}")
    conn.commit()
    cur.close()
    conn.close()
    return saved


def run():
    print("Setting up jordan_restaurants table...")
    setup_table()

    print("Scraping Talabat Amman (all areas)...")
    restaurants = scrape_talabat()

    if restaurants:
        print("Matching with Google Maps data...")
        restaurants = match_with_maps(restaurants)

    saved = save_restaurants(restaurants)
    print(f"Talabat done. Saved {saved} restaurants.")


if __name__ == "__main__":
    run()
