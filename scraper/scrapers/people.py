import os
import time
import psycopg2
import requests
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))


def get_db():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def setup_table():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS jordan_people (
            id SERIAL PRIMARY KEY,
            name TEXT,
            name_ar TEXT,
            category TEXT,
            subcategory TEXT,
            title TEXT,
            organization TEXT,
            specialty TEXT,
            phone TEXT,
            email TEXT,
            address TEXT,
            url TEXT UNIQUE,
            source TEXT,
            bio TEXT,
            scraped_at TIMESTAMP DEFAULT NOW()
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


def save_people(people):
    if not people:
        return 0
    conn = get_db()
    cur = conn.cursor()
    saved = 0
    for p in people:
        try:
            cur.execute("""
                INSERT INTO jordan_people (name, name_ar, category, subcategory, title, organization, specialty, phone, email, address, url, source, bio)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (url) DO UPDATE SET
                    name = EXCLUDED.name,
                    organization = EXCLUDED.organization,
                    specialty = EXCLUDED.specialty
            """, (
                p.get("name"), p.get("name_ar"), p.get("category"),
                p.get("subcategory"), p.get("title"), p.get("organization"),
                p.get("specialty"), p.get("phone"), p.get("email"),
                p.get("address"), p.get("url"), p.get("source"), p.get("bio")
            ))
            saved += 1
        except Exception as e:
            print(f"  Error saving {p.get('name')}: {e}")
    conn.commit()
    cur.close()
    conn.close()
    return saved


# ─── SCRAPERS ────────────────────────────────────────────────

def scrape_doctors():
    """Scrape doctors from Jordanian medical directories."""
    people = []
    sources = [
        "https://www.doctor.com.jo/en/doctors/amman",
        "https://www.doctors-jo.com/en/amman",
    ]
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for url in sources:
            try:
                page = browser.new_page()
                page.goto(url, timeout=30000)
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(3000)

                cards = page.query_selector_all(".doctor-card, .doctor-item, .physician-card, article, .card")
                for card in cards[:50]:
                    name = card.query_selector("h2, h3, .name, .doctor-name")
                    specialty = card.query_selector(".specialty, .speciality, .type")
                    phone = card.query_selector(".phone, .tel, [href^='tel:']")
                    link = card.query_selector("a")

                    href = link.get_attribute("href") if link else url
                    if href and not href.startswith("http"):
                        href = url.split("/en/")[0] + href

                    if name and name.inner_text().strip():
                        people.append({
                            "name": name.inner_text().strip(),
                            "category": "professional",
                            "subcategory": "doctor",
                            "title": "Dr.",
                            "specialty": specialty.inner_text().strip() if specialty else None,
                            "phone": phone.inner_text().strip() if phone else None,
                            "url": href or url,
                            "source": url
                        })
            except Exception as e:
                print(f"  Error scraping {url}: {e}")
        browser.close()
    return people


def scrape_via_google_maps():
    """Use Google Maps to find professionals in Amman."""
    API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
    BASE_URL = "https://maps.googleapis.com/maps/api/place"

    PROFESSIONAL_QUERIES = [
        ("doctor", "دكتور عمان"),
        ("doctor", "doctor clinic Amman Jordan"),
        ("dentist", "طبيب أسنان عمان"),
        ("dentist", "dental clinic Amman Jordan"),
        ("lawyer", "محامي عمان"),
        ("lawyer", "law firm Amman Jordan"),
        ("engineer", "مكتب هندسي عمان"),
        ("architect", "مكتب معماري عمان"),
        ("accountant", "مكتب محاسبة عمان"),
        ("accountant", "accounting office Amman Jordan"),
        ("pharmacist", "صيدلية عمان"),
        ("psychologist", "طبيب نفسي عمان"),
        ("psychologist", "psychologist therapist Amman"),
        ("nutritionist", "أخصائي تغذية عمان"),
        ("physiotherapist", "علاج طبيعي عمان"),
        ("physiotherapist", "physiotherapy Amman Jordan"),
        ("personal_trainer", "مدرب شخصي عمان"),
        ("real_estate_agent", "وكيل عقاري عمان"),
        ("real_estate_agent", "real estate agent Amman"),
        ("interior_designer", "مصمم داخلي عمان"),
        ("interior_designer", "interior design Amman Jordan"),
        ("wedding_planner", "منظم أفراح عمان"),
        ("event_organizer", "تنظيم فعاليات عمان"),
        ("tour_guide", "مرشد سياحي عمان"),
        ("tour_guide", "tour guide Amman Jordan"),
        ("translator", "مترجم عمان"),
        ("financial_advisor", "مستشار مالي عمان"),
        ("it_consultant", "استشارات تقنية عمان"),
        ("marketing_agency", "وكالة تسويق عمان"),
        ("marketing_agency", "marketing agency Amman Jordan"),
        ("fashion_designer", "مصمم أزياء عمان"),
        ("chef", "شيف عمان"),
        ("journalist", "صحفي عمان"),
        ("professor", "جامعة عمان أستاذ"),
        ("school_principal", "مدير مدرسة عمان"),
        ("social_worker", "أخصائي اجتماعي عمان"),
        ("insurance_agent", "وكيل تأمين عمان"),
        ("car_dealer", "تاجر سيارات عمان"),
        ("car_dealer", "car dealer Amman Jordan"),
        ("politician", "سياسي أردني"),
        ("minister", "وزير أردني"),
    ]

    AMMAN_LAT_MIN, AMMAN_LAT_MAX = 31.70, 32.10
    AMMAN_LNG_MIN, AMMAN_LNG_MAX = 35.75, 36.05

    people = []
    seen_ids = set()

    for subcategory, query in PROFESSIONAL_QUERIES:
        print(f"  Searching: '{query}'...")
        params = {"query": query, "key": API_KEY, "region": "jo"}
        url = f"{BASE_URL}/textsearch/json"

        while True:
            try:
                res = requests.get(url, params=params, timeout=10).json()
                if res.get("status") not in ("OK", "ZERO_RESULTS"):
                    break

                for place in res.get("results", []):
                    pid = place.get("place_id")
                    if not pid or pid in seen_ids:
                        continue

                    lat = place.get("geometry", {}).get("location", {}).get("lat")
                    lng = place.get("geometry", {}).get("location", {}).get("lng")

                    if not (AMMAN_LAT_MIN <= (lat or 0) <= AMMAN_LAT_MAX and
                            AMMAN_LNG_MIN <= (lng or 0) <= AMMAN_LNG_MAX):
                        continue

                    seen_ids.add(pid)
                    people.append({
                        "name": place.get("name"),
                        "category": "professional",
                        "subcategory": subcategory,
                        "organization": place.get("name"),
                        "address": place.get("formatted_address"),
                        "url": f"https://maps.google.com/?place_id={pid}",
                        "source": "google_maps"
                    })

                next_token = res.get("next_page_token")
                if not next_token:
                    break
                time.sleep(2)
                params = {"pagetoken": next_token, "key": API_KEY}

            except Exception as e:
                print(f"  Error: {e}")
                break

        time.sleep(0.5)

    return people


def scrape_public_figures():
    """Scrape public figures from Jordanian news and government sites."""
    people = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # Jordan government ministers
        try:
            page = browser.new_page()
            page.goto("https://www.pm.gov.jo/content/1/1/Ministers.html", timeout=30000)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(3000)

            cards = page.query_selector_all(".minister-card, .member, article, .card, tr")
            for card in cards[:50]:
                name = card.query_selector("h2, h3, h4, .name, td")
                title = card.query_selector(".title, .position, td:nth-child(2)")
                if name and name.inner_text().strip():
                    people.append({
                        "name": name.inner_text().strip(),
                        "category": "public_figure",
                        "subcategory": "minister",
                        "title": title.inner_text().strip() if title else "Minister",
                        "organization": "Government of Jordan",
                        "url": f"https://www.pm.gov.jo/minister/{name.inner_text().strip().replace(' ', '-')}",
                        "source": "pm.gov.jo"
                    })
        except Exception as e:
            print(f"  Error scraping ministers: {e}")

        browser.close()
    return people


def run():
    print("Setting up jordan_people table...")
    setup_table()

    total = 0

    print("Scraping professionals via Google Maps...")
    people = scrape_via_google_maps()
    saved = save_people(people)
    print(f"  → Saved {saved} professionals from Google Maps")
    total += saved

    print("Scraping doctors from medical directories...")
    doctors = scrape_doctors()
    saved = save_people(doctors)
    print(f"  → Saved {saved} doctors")
    total += saved

    print("Scraping public figures...")
    figures = scrape_public_figures()
    saved = save_people(figures)
    print(f"  → Saved {saved} public figures")
    total += saved

    print(f"People scraper done. Total saved: {total}")


if __name__ == "__main__":
    run()
