"""
Jordan News Scraper
Primary: RSS feeds (reliable, no JS, structured)
Fallback: Playwright for sites without RSS
Sources: Jordan Times, Petra News Agency, Al-Ghad, Jo24, Al-Rai, Roya News
"""
import os
import re
import time
import requests
import psycopg2
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
}

# RSS-based sources (most reliable — no JS, structured XML)
RSS_SOURCES = [
    {
        "name": "Jordan Times",
        "language": "en",
        "urls": [
            "https://jordantimes.com/rss/jordan",
            "https://jordantimes.com/rss/news",
            "https://jordantimes.com/rss",
        ],
    },
    {
        "name": "Petra News Agency",
        "language": "en",
        "urls": [
            "https://www.petra.gov.jo/Api/Rss",
            "https://petra.gov.jo/rss.aspx",
            "https://petra.gov.jo/Include/rss.php",
        ],
    },
    {
        "name": "Al-Ghad",
        "language": "ar",
        "urls": [
            "https://alghad.com/feed/",
            "https://alghad.com/rss/",
        ],
    },
    {
        "name": "Jo24",
        "language": "ar",
        "urls": [
            "https://www.jo24.net/rss.php",
            "https://jo24.net/feed",
        ],
    },
    {
        "name": "Al-Rai",
        "language": "ar",
        "urls": [
            "https://alrai.com/rss",
            "https://alrai.com/feed",
        ],
    },
    {
        "name": "Ammonnews",
        "language": "ar",
        "urls": [
            "https://www.ammonnews.net/rss",
            "https://ammonnews.net/feed",
        ],
    },
]

# Playwright-based sources (no RSS available)
PLAYWRIGHT_SOURCES = [
    {
        "name": "Roya News",
        "url": "https://en.roya.tv/news",
        "language": "en",
        "base_url": "https://en.roya.tv",
    },
    {
        "name": "Arab News Jordan",
        "url": "https://www.arabnews.com/taxonomy/term/7/rss.xml",
        "language": "en",
        "base_url": "https://www.arabnews.com",
    },
]


def get_db():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def setup_table():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS jordan_news (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            url TEXT UNIQUE NOT NULL,
            source TEXT,
            language TEXT DEFAULT 'en',
            summary TEXT,
            published_at TIMESTAMP,
            scraped_at TIMESTAMP DEFAULT NOW()
        )
    """)
    for stmt in [
        "ALTER TABLE jordan_news ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en'",
        "ALTER TABLE jordan_news ADD COLUMN IF NOT EXISTS summary TEXT",
        "ALTER TABLE jordan_news ADD COLUMN IF NOT EXISTS published_at TIMESTAMP",
    ]:
        cur.execute(stmt)
    conn.commit()
    cur.close()
    conn.close()


def parse_rss(xml_text, source_name, language):
    """Parse RSS 2.0 or Atom feed, return list of article dicts."""
    articles = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return articles

    # Detect namespace
    ns = {}
    if root.tag.startswith("{"):
        ns_uri = root.tag.split("}")[0].strip("{")
        ns = {"atom": ns_uri}

    # ── RSS 2.0 ────────────────────────────────────────────────
    for item in root.iter("item"):
        title_el   = item.find("title")
        link_el    = item.find("link")
        desc_el    = item.find("description")
        date_el    = item.find("pubDate")

        title = title_el.text.strip() if title_el is not None and title_el.text else None
        url   = link_el.text.strip()  if link_el  is not None and link_el.text  else None
        desc  = desc_el.text.strip()  if desc_el  is not None and desc_el.text  else None

        # Strip HTML from description
        if desc:
            desc = re.sub(r"<[^>]+>", "", desc).strip()[:300]

        published = None
        if date_el is not None and date_el.text:
            try:
                published = parsedate_to_datetime(date_el.text).replace(tzinfo=None)
            except Exception:
                pass

        if title and url and len(title) > 10 and url.startswith("http"):
            articles.append({
                "title": title,
                "url": url,
                "source": source_name,
                "language": language,
                "summary": desc,
                "published_at": published,
            })

    # ── Atom ───────────────────────────────────────────────────
    if not articles:
        atom_ns = "http://www.w3.org/2005/Atom"
        for entry in root.iter(f"{{{atom_ns}}}entry"):
            title_el = entry.find(f"{{{atom_ns}}}title")
            link_el  = entry.find(f"{{{atom_ns}}}link")
            summ_el  = entry.find(f"{{{atom_ns}}}summary")
            date_el  = entry.find(f"{{{atom_ns}}}updated") or entry.find(f"{{{atom_ns}}}published")

            title = title_el.text.strip() if title_el is not None and title_el.text else None
            url   = link_el.get("href")   if link_el  is not None                   else None
            summ  = summ_el.text.strip()  if summ_el  is not None and summ_el.text  else None

            if title and url and len(title) > 10 and url.startswith("http"):
                articles.append({
                    "title": title,
                    "url": url,
                    "source": source_name,
                    "language": language,
                    "summary": summ,
                    "published_at": None,
                })

    return articles


def scrape_rss_source(source):
    """Try each RSS URL for a source until one works."""
    for url in source["urls"]:
        try:
            res = requests.get(url, headers=HEADERS, timeout=15)
            if res.status_code == 200 and ("<rss" in res.text or "<feed" in res.text or "<channel" in res.text):
                articles = parse_rss(res.text, source["name"], source["language"])
                if articles:
                    print(f"  [{source['name']}] RSS OK → {len(articles)} articles from {url}")
                    return articles
        except Exception as e:
            pass
    print(f"  [{source['name']}] No working RSS feed found")
    return []


def scrape_playwright_source(source):
    """Scrape a news site with Playwright, capturing JSON API responses."""
    articles = []
    seen_urls = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_extra_http_headers({"Accept-Language": "en-US,en;q=0.9"})

        api_hits = []

        def capture(response):
            try:
                ct = response.headers.get("content-type", "")
                if "json" in ct and response.status == 200:
                    u = response.url
                    if any(k in u for k in ["article", "news", "post", "story", "feed"]):
                        api_hits.append(response.json())
            except Exception:
                pass

        page.on("response", capture)

        try:
            page.goto(source["url"], timeout=45000, wait_until="domcontentloaded")
            page.wait_for_load_state("networkidle", timeout=15000)
            page.wait_for_timeout(3000)

            for _ in range(4):
                page.evaluate("window.scrollBy(0, 1000)")
                page.wait_for_timeout(600)
        except Exception as e:
            print(f"  [{source['name']}] nav warning: {e}")

        page.remove_listener("response", capture)

        # Try to find article links in HTML
        link_els = page.query_selector_all("a[href]")
        base = source.get("base_url", "")
        for el in link_els:
            try:
                href = el.get_attribute("href") or ""
                title = el.inner_text().strip()
                if not href.startswith("http"):
                    href = base + href
                if (
                    len(title) > 15
                    and href.startswith("http")
                    and href not in seen_urls
                    and any(k in href for k in ["/news/", "/article/", "/story/", "/post/"])
                ):
                    seen_urls.add(href)
                    articles.append({
                        "title": title,
                        "url": href,
                        "source": source["name"],
                        "language": source["language"],
                        "summary": None,
                        "published_at": None,
                    })
            except Exception:
                pass

        browser.close()

    print(f"  [{source['name']}] Playwright → {len(articles)} articles")
    return articles[:60]


def save_articles(articles):
    if not articles:
        return 0
    conn = get_db()
    cur = conn.cursor()
    saved = 0
    for a in articles:
        if not a.get("title") or not a.get("url"):
            continue
        try:
            cur.execute("""
                INSERT INTO jordan_news (title, url, source, language, summary, published_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (url) DO UPDATE SET
                    title       = EXCLUDED.title,
                    summary     = COALESCE(EXCLUDED.summary, jordan_news.summary),
                    published_at= COALESCE(EXCLUDED.published_at, jordan_news.published_at)
            """, (
                a["title"][:500], a["url"], a.get("source"),
                a.get("language", "en"), a.get("summary"),
                a.get("published_at"),
            ))
            saved += 1
        except Exception as e:
            pass
    conn.commit()
    cur.close()
    conn.close()
    return saved


def run():
    print("Setting up jordan_news table...")
    setup_table()
    total = 0

    for source in RSS_SOURCES:
        articles = scrape_rss_source(source)
        saved = save_articles(articles)
        total += saved
        if saved:
            print(f"    → Saved {saved} articles from {source['name']}")
        time.sleep(1)

    for source in PLAYWRIGHT_SOURCES:
        print(f"  Scraping {source['name']} via Playwright...")
        articles = scrape_playwright_source(source)
        saved = save_articles(articles)
        total += saved
        if saved:
            print(f"    → Saved {saved} articles from {source['name']}")

    print(f"News done. Total saved: {total}")


if __name__ == "__main__":
    run()
