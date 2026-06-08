import os
import psycopg2
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv()

SEARCH_QUERIES = [
    "companies in Amman Jordan",
    "clinics Amman Jordan",
    "tech startups Amman Jordan",
    "restaurants Amman Jordan",
    "law firms Amman Jordan",
    "retail shops Amman Jordan",
    "hospitals Amman Jordan",
    "schools Amman Jordan",
    "real estate Amman Jordan",
    "marketing agencies Amman Jordan"
]


def get_db():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def setup_table():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS jordan_companies (
            id SERIAL PRIMARY KEY,
            name TEXT,
            industry TEXT,
            location TEXT,
            description TEXT,
            url TEXT UNIQUE,
            scraped_at TIMESTAMP DEFAULT NOW()
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


def scrape_linkedin():
    companies = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        for query in SEARCH_QUERIES:
            try:
                search_url = f"https://www.linkedin.com/search/results/companies/?keywords={query.replace(' ', '%20')}&origin=GLOBAL_SEARCH_HEADER"
                page.goto(search_url, timeout=60000)
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(4000)

                items = page.query_selector_all(".entity-result__item, .reusable-search__result-container")
                print(f"  Found {len(items)} results for '{query}'")

                for item in items[:10]:
                    try:
                        name = item.query_selector(".entity-result__title-text, .app-aware-link span")
                        industry = item.query_selector(".entity-result__primary-subtitle")
                        location = item.query_selector(".entity-result__secondary-subtitle")
                        link = item.query_selector("a.app-aware-link, a[href*='/company/']")

                        href = link.get_attribute("href") if link else None
                        if href and "?" in href:
                            href = href.split("?")[0]

                        companies.append({
                            "name": name.inner_text().strip() if name else None,
                            "industry": industry.inner_text().strip() if industry else None,
                            "location": location.inner_text().strip() if location else None,
                            "description": None,
                            "url": href
                        })
                    except Exception as e:
                        print(f"  Error parsing: {e}")

            except Exception as e:
                print(f"  Error searching '{query}': {e}")

        browser.close()
    return [c for c in companies if c["name"] and c["url"]]


def save_companies(companies):
    conn = get_db()
    cur = conn.cursor()
    saved = 0
    for c in companies:
        try:
            cur.execute("""
                INSERT INTO jordan_companies (name, industry, location, description, url)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (url) DO NOTHING
            """, (c["name"], c["industry"], c["location"], c["description"], c["url"]))
            saved += 1
        except Exception as e:
            print(f"Error saving {c['name']}: {e}")
    conn.commit()
    cur.close()
    conn.close()
    return saved


def run():
    print("Setting up jordan_companies table...")
    setup_table()
    print("Scraping LinkedIn companies in Jordan...")
    companies = scrape_linkedin()
    print(f"Found {len(companies)} companies")
    saved = save_companies(companies)
    print(f"Saved {saved} companies to Neon DB")


if __name__ == "__main__":
    run()
