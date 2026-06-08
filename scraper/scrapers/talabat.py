import os
import psycopg2
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv()


def get_db():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def setup_table():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS jordan_restaurants (
            id SERIAL PRIMARY KEY,
            name TEXT,
            cuisine TEXT,
            rating FLOAT,
            delivery_time TEXT,
            min_order TEXT,
            delivery_fee TEXT,
            url TEXT UNIQUE,
            search_text TEXT,
            scraped_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS search_text TEXT")
    cur.execute("ALTER TABLE jordan_restaurants ADD COLUMN IF NOT EXISTS embedding vector(384)")
    cur.execute("""
        CREATE INDEX IF NOT EXISTS jordan_restaurants_vec_idx
        ON jordan_restaurants USING hnsw (embedding vector_cosine_ops)
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS jordan_restaurants_trgm_idx
        ON jordan_restaurants USING gin (search_text gin_trgm_ops)
    """)
    conn.commit()
    cur.close()
    conn.close()


def scrape_talabat():
    restaurants = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_extra_http_headers({"Accept-Language": "en-US,en;q=0.9"})
        page.goto("https://www.talabat.com/jordan/restaurants", timeout=60000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(5000)

        # Scroll to load more
        for _ in range(5):
            page.evaluate("window.scrollBy(0, 1500)")
            page.wait_for_timeout(1500)

        items = page.query_selector_all("a[data-testid='restaurant-item'], a[href*='/jordan/restaurant/']")
        print(f"Found {len(items)} restaurant elements")

        for item in items[:50]:
            try:
                name = item.query_selector("[data-testid='restaurant-name'], h2, h3")
                rating = item.query_selector("[data-testid='rating'], .rating")
                delivery_time = item.query_selector("[data-testid='delivery-time']")
                url = item.get_attribute("href")

                restaurants.append({
                    "name": name.inner_text().strip() if name else None,
                    "rating": rating.inner_text().strip() if rating else None,
                    "delivery_time": delivery_time.inner_text().strip() if delivery_time else None,
                    "url": f"https://www.talabat.com{url}" if url and not url.startswith("http") else url,
                    "cuisine": None,
                    "min_order": None,
                    "delivery_fee": None
                })
            except Exception as e:
                print(f"Error parsing item: {e}")

        browser.close()
    return [r for r in restaurants if r["name"]]


def save_restaurants(restaurants):
    if not restaurants:
        return 0

    for r in restaurants:
        r["search_text"] = (
            f"{r['name']} {r.get('cuisine') or 'restaurant'} restaurant food delivery amman jordan"
            .replace("  ", " ").strip()
        )

    try:
        from scrapers.embedder import embed_batch, to_pg_vector
        texts = [r["search_text"] for r in restaurants]
        vecs = embed_batch(texts)
        for i, r in enumerate(restaurants):
            r["embedding"] = to_pg_vector(vecs[i])
    except Exception as e:
        print(f"  [embedder] skipped: {e}")
        for r in restaurants:
            r["embedding"] = None

    conn = get_db()
    cur = conn.cursor()
    saved = 0
    for r in restaurants:
        try:
            cur.execute("""
                INSERT INTO jordan_restaurants
                    (name, cuisine, rating, delivery_time, min_order, delivery_fee, url, search_text, embedding)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::vector)
                ON CONFLICT (url) DO UPDATE SET
                    rating        = EXCLUDED.rating,
                    delivery_time = EXCLUDED.delivery_time,
                    search_text   = EXCLUDED.search_text,
                    embedding     = EXCLUDED.embedding
            """, (
                r["name"], r.get("cuisine"), r.get("rating"),
                r.get("delivery_time"), r.get("min_order"), r.get("delivery_fee"),
                r.get("url"), r.get("search_text"), r.get("embedding")
            ))
            saved += 1
        except Exception as e:
            print(f"Error saving {r.get('name')}: {e}")
    conn.commit()
    cur.close()
    conn.close()
    return saved


def run():
    print("Setting up jordan_restaurants table...")
    setup_table()
    print("Scraping Talabat Jordan...")
    restaurants = scrape_talabat()
    print(f"Found {len(restaurants)} restaurants")
    saved = save_restaurants(restaurants)
    print(f"Saved {saved} restaurants to Neon DB")


if __name__ == "__main__":
    run()
