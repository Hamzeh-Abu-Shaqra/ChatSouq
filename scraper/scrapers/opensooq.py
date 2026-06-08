import os
import psycopg2
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv()

CATEGORIES = [
    ("properties", "https://jo.opensooq.com/en/real-estate/amman"),
    ("cars", "https://jo.opensooq.com/en/cars/amman"),
    ("jobs", "https://jo.opensooq.com/en/jobs/amman"),
    ("electronics", "https://jo.opensooq.com/en/mobiles-tablets/amman"),
]


def get_db():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def setup_table():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS jordan_listings (
            id SERIAL PRIMARY KEY,
            title TEXT,
            price TEXT,
            location TEXT,
            category TEXT,
            url TEXT UNIQUE,
            scraped_at TIMESTAMP DEFAULT NOW()
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


def scrape_category(category_name, url):
    listings = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, timeout=60000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(4000)

        for _ in range(3):
            page.evaluate("window.scrollBy(0, 1500)")
            page.wait_for_timeout(1000)

        items = page.query_selector_all("li.post-cell, .listing-item, article.post")
        print(f"  Found {len(items)} {category_name} elements")

        for item in items[:40]:
            try:
                title = item.query_selector("h2, h3, .post-title, [class*='title']")
                price = item.query_selector(".price, [class*='price']")
                location = item.query_selector(".location, [class*='location']")
                link = item.query_selector("a")

                href = link.get_attribute("href") if link else None
                if href and not href.startswith("http"):
                    href = "https://jo.opensooq.com" + href

                listings.append({
                    "title": title.inner_text().strip() if title else None,
                    "price": price.inner_text().strip() if price else None,
                    "location": location.inner_text().strip() if location else None,
                    "category": category_name,
                    "url": href
                })
            except Exception as e:
                print(f"  Error parsing item: {e}")

        browser.close()
    return [l for l in listings if l["title"] and l["url"]]


def save_listings(listings):
    conn = get_db()
    cur = conn.cursor()
    saved = 0
    for l in listings:
        try:
            cur.execute("""
                INSERT INTO jordan_listings (title, price, location, category, url)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (url) DO UPDATE SET
                    price = EXCLUDED.price
            """, (l["title"], l["price"], l["location"], l["category"], l["url"]))
            saved += 1
        except Exception as e:
            print(f"Error saving: {e}")
    conn.commit()
    cur.close()
    conn.close()
    return saved


def run():
    print("Setting up jordan_listings table...")
    setup_table()
    total = 0
    for category_name, url in CATEGORIES:
        print(f"Scraping OpenSooq {category_name}...")
        listings = scrape_category(category_name, url)
        saved = save_listings(listings)
        print(f"  → Saved {saved} {category_name}")
        total += saved
    print(f"OpenSooq done. Total saved: {total}")


if __name__ == "__main__":
    run()
