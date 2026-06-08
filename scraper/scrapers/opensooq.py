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
            search_text TEXT,
            scraped_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("ALTER TABLE jordan_listings ADD COLUMN IF NOT EXISTS search_text TEXT")
    cur.execute("ALTER TABLE jordan_listings ADD COLUMN IF NOT EXISTS embedding vector(384)")
    cur.execute("""
        CREATE INDEX IF NOT EXISTS jordan_listings_vec_idx
        ON jordan_listings USING hnsw (embedding vector_cosine_ops)
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS jordan_listings_trgm_idx
        ON jordan_listings USING gin (search_text gin_trgm_ops)
    """)
    conn.commit()
    cur.close()
    conn.close()


def scrape_category(category_name, url):
    listings = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            ),
            locale="en-US",
        )
        page = context.new_page()
        try:
            page.goto(url, timeout=60000, wait_until="domcontentloaded")
            page.wait_for_load_state("networkidle", timeout=20000)
            page.wait_for_timeout(5000)

            for _ in range(5):
                page.evaluate("window.scrollBy(0, 1200)")
                page.wait_for_timeout(800)

            page.wait_for_timeout(2000)
        except Exception as e:
            print(f"  Navigation warning for {category_name}: {e}")

        # Try many selector patterns — OpenSooq updates their class names frequently
        SELECTORS = [
            "li.post-cell",
            ".listing-item",
            "article.post",
            "[class*='PostCell']",
            "[class*='post-card']",
            "[class*='listing-card']",
            "[class*='PostCard']",
            "div[class*='post'][class*='cell']",
            "a[href*='/post/']",  # fallback: any link to a post
        ]

        seen_urls = set()
        for selector in SELECTORS:
            try:
                items = page.query_selector_all(selector)
                if not items:
                    continue
                print(f"  [{category_name}] selector '{selector}' → {len(items)} elements")
                for item in items[:60]:
                    try:
                        # Get the anchor element — could be the item itself or a child
                        if item.evaluate("el => el.tagName") == "A":
                            link_el = item
                        else:
                            link_el = item.query_selector("a[href]")

                        href = link_el.get_attribute("href") if link_el else None
                        if not href:
                            continue
                        if not href.startswith("http"):
                            href = "https://jo.opensooq.com" + href
                        if href in seen_urls:
                            continue
                        seen_urls.add(href)

                        # Try every plausible title / price / location selector
                        title_el = item.query_selector(
                            "h2, h3, h4, [class*='title'], [class*='Title'], [class*='name'], [class*='Name']"
                        )
                        price_el = item.query_selector(
                            "[class*='price'], [class*='Price'], [class*='cost'], [class*='amount']"
                        )
                        loc_el = item.query_selector(
                            "[class*='location'], [class*='Location'], [class*='city'], [class*='area']"
                        )

                        title_text = title_el.inner_text().strip() if title_el else link_el.inner_text().strip() if link_el else None
                        price_text = price_el.inner_text().strip() if price_el else None
                        loc_text   = loc_el.inner_text().strip() if loc_el else None

                        if title_text and len(title_text) > 3:
                            listings.append({
                                "title":    title_text,
                                "price":    price_text,
                                "location": loc_text,
                                "category": category_name,
                                "url":      href,
                            })
                    except Exception:
                        pass
                if listings:
                    break  # stop trying more selectors once we found results
            except Exception:
                pass

        if not listings:
            print(f"  [{category_name}] 0 listings found with all selectors")
        else:
            print(f"  [{category_name}] {len(listings)} listings collected")

        browser.close()
    return [l for l in listings if l.get("title") and l.get("url")]


def save_listings(listings):
    if not listings:
        return 0

    for l in listings:
        price_str = f"{l['price']} JOD" if l.get("price") else ""
        l["search_text"] = (
            f"{l.get('title', '')} {l.get('category', '')} {l.get('location', '')} jordan {price_str}"
            .replace("  ", " ").strip()
        )

    try:
        from scrapers.embedder import embed_batch, to_pg_vector
        texts = [l["search_text"] for l in listings]
        vecs = embed_batch(texts)
        for i, l in enumerate(listings):
            l["embedding"] = to_pg_vector(vecs[i])
    except Exception as e:
        print(f"  [embedder] skipped: {e}")
        for l in listings:
            l["embedding"] = None

    conn = get_db()
    cur = conn.cursor()
    saved = 0
    for l in listings:
        try:
            cur.execute("""
                INSERT INTO jordan_listings (title, price, location, category, url, search_text, embedding)
                VALUES (%s, %s, %s, %s, %s, %s, %s::vector)
                ON CONFLICT (url) DO UPDATE SET
                    price       = EXCLUDED.price,
                    search_text = EXCLUDED.search_text,
                    embedding   = EXCLUDED.embedding
            """, (
                l.get("title"), l.get("price"), l.get("location"),
                l.get("category"), l.get("url"),
                l.get("search_text"), l.get("embedding")
            ))
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
