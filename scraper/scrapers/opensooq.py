"""
OpenSooq Jordan Scraper — Direct __NEXT_DATA__ approach (no Playwright)

OpenSooq is a Next.js SSR app. Every listing page embeds its full data
in <script id="__NEXT_DATA__">. We fetch that HTML with requests, parse
serpApiResponse.listings.items, and paginate with ?page=N.

Correct URL format (discovered Jun 2026):
    https://jo.opensooq.com/en/amman/{category-slug}?page={n}

Old format /en/real-estate/rent/amman returns HTTP 410.
"""
import os
import re
import time
import json
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
}

BASE = "https://jo.opensooq.com"

# Category slug → display name. All scoped to Amman.
CATEGORIES = [
    ("property/apartments-for-sale",    "real_estate_sale"),
    ("property/apartments-for-rent",    "real_estate_rent"),
    ("property/land-and-farms-for-sale","real_estate_land"),
    ("cars",                            "cars"),
    ("jobs",                            "jobs"),
    ("mobiles-tablets",                 "mobiles"),
    ("computers-networking",            "computers"),
    ("electronics-home-appliances",     "electronics"),
    ("furniture-decor",                 "furniture"),
    ("clothing-accessories",            "fashion"),
    ("animals-pets",                    "animals"),
    ("services",                        "services"),
    ("baby-kids",                       "kids"),
    ("sports-outdoors",                 "sports"),
]

MAX_PAGES = 5   # 30 listings/page × 5 pages = 150 per category


# ── Database ──────────────────────────────────────────────────────────────────

def get_db():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def setup_table():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS jordan_listings (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            price TEXT,
            location TEXT,
            category TEXT,
            description TEXT,
            url TEXT UNIQUE NOT NULL,
            search_text TEXT,
            scraped_at TIMESTAMP DEFAULT NOW()
        )
    """)
    for stmt in [
        "ALTER TABLE jordan_listings ADD COLUMN IF NOT EXISTS description TEXT",
        "ALTER TABLE jordan_listings ADD COLUMN IF NOT EXISTS search_text TEXT",
    ]:
        try:
            cur.execute(stmt)
            conn.commit()
        except Exception:
            conn.rollback()
    conn.commit()
    cur.close()
    conn.close()


# ── Fetching & parsing ────────────────────────────────────────────────────────

def fetch_page(slug: str, page: int) -> list:
    """Fetch one page of listings. Returns list of raw item dicts."""
    url = f"{BASE}/en/amman/{slug}?page={page}"
    try:
        r = http.get(url, headers=HEADERS, timeout=20)
        if r.status_code not in (200, 201):
            return []
        match = re.search(
            r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
            r.text, re.DOTALL
        )
        if not match:
            return []
        data = json.loads(match.group(1))
        items = (
            data.get("props", {})
                .get("pageProps", {})
                .get("serpApiResponse", {})
                .get("listings", {})
                .get("items", [])
        )
        return items
    except Exception:
        return []


def parse_listing(item: dict, category: str) -> dict | None:
    title = (item.get("title") or "").strip()
    if not title or len(title) < 5:
        return None

    post_url = item.get("post_url") or ""
    listing_id = item.get("id") or ""
    url = f"{BASE}/search/{listing_id}" if listing_id else (
        f"{BASE}{post_url}" if post_url.startswith("/") else post_url
    )
    if not url or "opensooq" not in url:
        return None

    price = (
        item.get("price_amount") or
        item.get("price") or ""
    )
    if price:
        currency = item.get("price_currency_iso") or ""
        price = f"{str(price).strip()} {currency}".strip()

    nhood = item.get("nhood_label") or ""
    city  = item.get("city_label") or "Amman"
    location = f"{nhood}, {city}".strip(", ") if nhood else city

    description = (item.get("highlights") or item.get("masked_description") or "")
    if isinstance(description, str):
        description = description.strip()[:300] or None

    return {
        "title":       title,
        "price":       str(price).strip() or None,
        "location":    location,
        "category":    category,
        "description": description,
        "url":         url,
    }


# ── Database save ─────────────────────────────────────────────────────────────

def save_listings(listings: list) -> int:
    if not listings:
        return 0

    for l in listings:
        l["search_text"] = " ".join(filter(None, [
            l.get("title"), l.get("category"),
            l.get("location"), l.get("price"), "jordan amman opensooq"
        ])).strip()

    conn = get_db()
    cur = conn.cursor()
    saved = 0
    for l in listings:
        try:
            cur.execute("""
                INSERT INTO jordan_listings
                    (title, price, location, category, description, url, search_text)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (url) DO UPDATE SET
                    price       = COALESCE(EXCLUDED.price,       jordan_listings.price),
                    location    = COALESCE(EXCLUDED.location,    jordan_listings.location),
                    description = COALESCE(EXCLUDED.description, jordan_listings.description),
                    search_text = EXCLUDED.search_text,
                    scraped_at  = NOW()
            """, (
                l["title"], l.get("price"), l.get("location"),
                l["category"], l.get("description"), l["url"],
                l.get("search_text"),
            ))
            conn.commit()
            saved += 1
        except Exception:
            conn.rollback()

    cur.close()
    conn.close()
    return saved


# ── Entry point ───────────────────────────────────────────────────────────────

def scrape_category(slug: str, category: str, global_seen: set) -> list:
    results = []
    for page in range(1, MAX_PAGES + 1):
        items = fetch_page(slug, page)
        if not items:
            break

        new_this_page = 0
        for item in items:
            url = f"{BASE}/search/{item.get('id')}" if item.get("id") else ""
            if not url or url in global_seen:
                continue
            global_seen.add(url)
            parsed = parse_listing(item, category)
            if parsed:
                results.append(parsed)
                new_this_page += 1

        if new_this_page == 0:
            break   # all duplicates — no point continuing

        time.sleep(0.3)

    return results


def run():
    print("Setting up jordan_listings table...", flush=True)
    setup_table()

    global_seen: set = set()
    total_saved = 0

    for slug, category in CATEGORIES:
        print(f"  Scraping OpenSooq: {category}...", flush=True)
        listings = scrape_category(slug, category, global_seen)
        saved = save_listings(listings)
        total_saved += saved
        print(f"    [{category}] {len(listings)} found → {saved} saved  (total: {total_saved})", flush=True)
        time.sleep(0.5)

    print(f"\nOpenSooq done. Total saved: {total_saved}", flush=True)


if __name__ == "__main__":
    run()
