"""
Jordan News Scraper
Strategy: RSS-only (reliable, no browser needed, structured XML)
Sources: Google News JO, Al-Ghad, Jo24, Roya News, and 10+ via Google News aggregation
Quality: deduplicates by URL, strips HTML, detects AR/EN from content
"""
import os
import re
import time
import requests
import psycopg2
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))


def detect_language(text: str) -> str:
    """Detect AR vs EN from actual character content — ignores query language."""
    if not text:
        return "en"
    arabic = sum(1 for c in text if "؀" <= c <= "ۿ")
    return "ar" if arabic / max(len(text), 1) > 0.15 else "en"


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
}

# RSS-based sources (most reliable — no JS, structured XML)
RSS_SOURCES = [
    # ── Google News RSS — aggregates 50+ Jordan sources automatically ──────────
    {
        "name": "Google News",
        "language": "ar",
        "urls": [
            "https://news.google.com/rss/search?q=عمان+الأردن&hl=ar&gl=JO&ceid=JO:ar",
        ],
    },
    {
        "name": "Google News",
        "language": "en",
        "urls": [
            "https://news.google.com/rss/search?q=Amman+Jordan&hl=en-JO&gl=JO&ceid=JO:en",
        ],
    },
    {
        "name": "Google News",
        "language": "ar",
        "urls": [
            "https://news.google.com/rss/headlines/section/geo/JO?hl=ar&gl=JO&ceid=JO:ar",
        ],
    },
    # ── Breaking / local Amman topics ─────────────────────────────────────────
    {
        "name": "Google News",
        "language": "ar",
        "urls": [
            "https://news.google.com/rss/search?q=حوادث+عمان&hl=ar&gl=JO&ceid=JO:ar",
        ],
    },
    {
        "name": "Google News",
        "language": "ar",
        "urls": [
            "https://news.google.com/rss/search?q=أخبار+عمان+اليوم&hl=ar&gl=JO&ceid=JO:ar",
        ],
    },
    # ── Direct RSS feeds ───────────────────────────────────────────────────────
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
    {
        "name": "Roya News",
        "language": "en",
        "urls": [
            "https://en.roya.tv/rss",
            "https://en.roya.tv/feed",
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

    # Fix existing rows: re-detect language from actual title text
    cur.execute("""
        UPDATE jordan_news
        SET language = CASE
            WHEN title ~ '[\\u0600-\\u06FF]' THEN 'ar'
            ELSE 'en'
        END
        WHERE language IS NULL OR language = 'en'
    """)
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

        # Google News embeds source in title: "Headline - Source Name"
        # Also check <source> tag for the real publisher
        source_el = item.find("source")
        real_source = source_name
        if source_el is not None and source_el.text:
            real_source = source_el.text.strip()
        elif source_name == "Google News" and title and " - " in title:
            parts = title.rsplit(" - ", 1)
            if len(parts) == 2 and len(parts[1]) < 50:
                title = parts[0].strip()
                real_source = parts[1].strip()

        if title and url and len(title) > 10 and url.startswith("http"):
            articles.append({
                "title": title,
                "url": url,
                "source": real_source,
                "language": detect_language(title),   # detect from actual text
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
    print("Setting up jordan_news table...", flush=True)
    setup_table()
    total = 0

    for source in RSS_SOURCES:
        articles = scrape_rss_source(source)
        saved = save_articles(articles)
        total += saved
        if saved:
            print(f"    → Saved {saved} articles from {source['name']}", flush=True)
        time.sleep(1)

    print(f"News done. Total saved: {total}", flush=True)


if __name__ == "__main__":
    run()
