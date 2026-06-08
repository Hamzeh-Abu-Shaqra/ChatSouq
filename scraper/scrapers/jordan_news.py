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
        CREATE TABLE IF NOT EXISTS jordan_news (
            id SERIAL PRIMARY KEY,
            title TEXT,
            url TEXT UNIQUE,
            source TEXT,
            scraped_at TIMESTAMP DEFAULT NOW()
        )
    """)
    conn.commit()
    cur.close()
    conn.close()

def scrape_roya_news():
    articles = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://en.roya.tv/", timeout=60000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(5000)

        # Try multiple selectors
        selectors = ["a[href*='news']", "a[href*='article']", "h2 a", "h3 a", ".news-title a", ".article a"]
        for selector in selectors:
            items = page.query_selector_all(selector)
            for item in items[:30]:
                title = item.inner_text().strip()
                url = item.get_attribute("href")
                if title and url and len(title) > 10:
                    if not url.startswith("http"):
                        url = "https://en.roya.tv" + url
                    if {"title": title, "url": url} not in [{"title": a["title"], "url": a["url"]} for a in articles]:
                        articles.append({"title": title, "url": url, "source": "Roya News"})

        browser.close()
    return articles

def save_articles(articles):
    conn = get_db()
    cur = conn.cursor()
    saved = 0
    for article in articles:
        try:
            cur.execute(
                "INSERT INTO jordan_news (title, url, source) VALUES (%s, %s, %s) ON CONFLICT (url) DO NOTHING",
                (article["title"], article["url"], article["source"])
            )
            saved += 1
        except Exception as e:
            print(f"Error saving: {e}")
    conn.commit()
    cur.close()
    conn.close()
    return saved

def run():
    print("Setting up database table...")
    setup_table()
    print("Scraping Roya News...")
    articles = scrape_roya_news()
    print(f"Found {len(articles)} articles")
    saved = save_articles(articles)
    print(f"Saved {saved} new articles to Neon DB")

if __name__ == "__main__":
    run()
