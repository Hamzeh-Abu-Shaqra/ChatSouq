"""
OpenSooq Jordan Scraper
Uses network response interception — captures the JSON API calls
OpenSooq makes as pages load, rather than trying to read JS-rendered HTML.
"""
import os
import re
import time
import psycopg2
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

# All Amman/Jordan categories with their OpenSooq URLs
CATEGORIES = [
    # Real Estate
    ("real_estate_rent",     "https://jo.opensooq.com/en/real-estate/rent/amman"),
    ("real_estate_sale",     "https://jo.opensooq.com/en/real-estate/sale/amman"),
    ("real_estate_land",     "https://jo.opensooq.com/en/real-estate/land/amman"),
    # Cars & Vehicles
    ("cars",                 "https://jo.opensooq.com/en/cars/amman"),
    ("motorcycles",          "https://jo.opensooq.com/en/motorcycles/amman"),
    # Electronics
    ("mobiles",              "https://jo.opensooq.com/en/mobiles-tablets/amman"),
    ("computers",            "https://jo.opensooq.com/en/computers-networking/amman"),
    ("electronics",          "https://jo.opensooq.com/en/electronics-home-appliances/amman"),
    # Jobs
    ("jobs",                 "https://jo.opensooq.com/en/jobs/amman"),
    # Furniture & Home
    ("furniture",            "https://jo.opensooq.com/en/furniture-decor/amman"),
    # Clothing & Fashion
    ("fashion",              "https://jo.opensooq.com/en/clothing-accessories/amman"),
    # Animals & Pets
    ("animals",              "https://jo.opensooq.com/en/animals-pets/amman"),
    # Services
    ("services",             "https://jo.opensooq.com/en/services/amman"),
    # Kids & Baby
    ("kids",                 "https://jo.opensooq.com/en/baby-kids/amman"),
    # Sports
    ("sports",               "https://jo.opensooq.com/en/sports-outdoors/amman"),
]


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
        "ALTER TABLE jordan_listings ADD COLUMN IF NOT EXISTS embedding vector(384)",
    ]:
        try:
            cur.execute(stmt)
        except Exception:
            pass
    try:
        cur.execute("""
            CREATE INDEX IF NOT EXISTS jordan_listings_trgm_idx
            ON jordan_listings USING gin (search_text gin_trgm_ops)
        """)
    except Exception:
        pass
    conn.commit()
    cur.close()
    conn.close()


def extract_listings_from_json(obj, category, found, seen_urls, depth=0):
    """
    Recursively walk any JSON structure to find listing-like objects.
    A listing must have at minimum a title and a URL.
    """
    if depth > 8:
        return
    if isinstance(obj, list):
        for item in obj:
            extract_listings_from_json(item, category, found, seen_urls, depth + 1)
    elif isinstance(obj, dict):
        # Detect if this object looks like a listing
        title = (
            obj.get("title") or obj.get("subject") or obj.get("name") or
            obj.get("ad_title") or obj.get("post_title") or
            obj.get("titleEn") or obj.get("title_en") or ""
        )
        url = (
            obj.get("url") or obj.get("link") or obj.get("permalink") or
            obj.get("ad_url") or obj.get("post_url") or
            obj.get("seoUrl") or obj.get("seo_url") or ""
        )
        price = (
            obj.get("price") or obj.get("price_text") or obj.get("priceText") or
            obj.get("price_label") or obj.get("formatted_price") or ""
        )
        location = (
            obj.get("location") or obj.get("city") or obj.get("area") or
            obj.get("neighborhood") or obj.get("region") or ""
        )
        description = (
            obj.get("description") or obj.get("body") or
            obj.get("short_description") or ""
        )

        title = str(title).strip() if title else ""
        url   = str(url).strip()   if url   else ""

        # Normalize URL
        if url and not url.startswith("http"):
            url = "https://jo.opensooq.com" + url

        if (
            len(title) > 5
            and url.startswith("http")
            and "opensooq" in url
            and url not in seen_urls
        ):
            seen_urls.add(url)
            found.append({
                "title":       title,
                "price":       str(price).strip() if price else None,
                "location":    str(location).strip() if location else None,
                "category":    category,
                "description": str(description).strip()[:300] if description else None,
                "url":         url,
            })
        else:
            # Keep digging
            for v in obj.values():
                extract_listings_from_json(v, category, found, seen_urls, depth + 1)


def scrape_opensooq_category(browser_context, url, category):
    """
    Open OpenSooq category page and intercept ALL JSON responses.
    Extract listing data from any JSON that comes back.
    """
    listings = []
    seen_urls = set()
    api_responses = []

    page = browser_context.new_page()

    def capture(response):
        try:
            if response.status != 200:
                return
            ct = response.headers.get("content-type", "")
            if "json" not in ct:
                return
            body = response.json()
            api_responses.append(body)
        except Exception:
            pass

    page.on("response", capture)

    try:
        page.goto(url, timeout=45000, wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle", timeout=20000)
        page.wait_for_timeout(3000)

        # Scroll to trigger lazy loads
        for _ in range(6):
            page.evaluate("window.scrollBy(0, 1400)")
            page.wait_for_timeout(700)

        page.wait_for_timeout(2000)
    except Exception as e:
        print(f"    [{category}] nav warning: {e}")

    page.remove_listener("response", capture)

    # Parse all captured JSON responses
    for body in api_responses:
        extract_listings_from_json(body, category, listings, seen_urls)

    # If API interception got nothing, fall back to HTML link extraction
    if not listings:
        try:
            links = page.query_selector_all("a[href*='/post/'], a[href*='/ad/'], a[href*='opensooq.com/']")
            for el in links[:80]:
                try:
                    href = el.get_attribute("href") or ""
                    title_text = el.inner_text().strip()
                    if not href.startswith("http"):
                        href = "https://jo.opensooq.com" + href
                    if (
                        len(title_text) > 5
                        and "opensooq.com" in href
                        and href not in seen_urls
                        and any(k in href for k in ["/post/", "/ad/", "-for-sale", "-for-rent"])
                    ):
                        seen_urls.add(href)
                        listings.append({
                            "title":    title_text,
                            "price":    None,
                            "location": "Amman",
                            "category": category,
                            "description": None,
                            "url":      href,
                        })
                except Exception:
                    pass
        except Exception:
            pass

    page.close()
    print(f"    [{category}] {len(api_responses)} API responses → {len(listings)} listings")
    return listings


def save_listings(listings):
    if not listings:
        return 0

    for l in listings:
        l["search_text"] = " ".join(filter(None, [
            l.get("title"), l.get("category"),
            l.get("location"), l.get("price"), "jordan amman"
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
                    price       = COALESCE(EXCLUDED.price,    jordan_listings.price),
                    location    = COALESCE(EXCLUDED.location, jordan_listings.location),
                    description = COALESCE(EXCLUDED.description, jordan_listings.description),
                    search_text = EXCLUDED.search_text
            """, (
                l.get("title"), l.get("price"), l.get("location"),
                l.get("category"), l.get("description"), l.get("url"),
                l.get("search_text"),
            ))
            saved += 1
        except Exception as e:
            pass
    conn.commit()
    cur.close()
    conn.close()
    return saved


def run():
    print("Setting up jordan_listings table...")
    setup_table()
    total = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Linux; Android 13; Pixel 7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/116.0.0.0 Mobile Safari/537.36"
            ),
            locale="en-US",
            viewport={"width": 412, "height": 915},
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
                "Accept": "application/json, text/html, */*",
            },
        )

        for category, url in CATEGORIES:
            print(f"  Scraping OpenSooq: {category}...")
            listings = scrape_opensooq_category(context, url, category)
            saved = save_listings(listings)
            print(f"    → Saved {saved} {category} listings")
            total += saved
            time.sleep(2)

        browser.close()

    print(f"OpenSooq done. Total saved: {total}")


if __name__ == "__main__":
    run()
