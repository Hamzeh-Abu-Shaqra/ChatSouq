import os
import re
import time
import json
import requests
import psycopg2
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")
BASE_URL = "https://maps.googleapis.com/maps/api/place"

AMMAN_LAT_MIN, AMMAN_LAT_MAX = 31.70, 32.10
AMMAN_LNG_MIN, AMMAN_LNG_MAX = 35.75, 36.05

# Search queries: (subcategory, query)
# Each query is crafted to return individual professionals or named professional offices
PROFESSIONAL_QUERIES = [
    ("doctor",              "دكتور عمان"),
    ("doctor",              "عيادة دكتور عمان"),
    ("doctor",              "doctor clinic Amman Jordan"),
    ("dentist",             "طبيب أسنان عمان"),
    ("dentist",             "dental clinic Amman Jordan"),
    ("lawyer",              "مكتب محامي عمان"),
    ("lawyer",              "law firm Amman Jordan"),
    ("engineer",            "مكتب مهندس عمان"),
    ("architect",           "مكتب معماري عمان"),
    ("architect",           "architecture office Amman Jordan"),
    ("accountant",          "مكتب محاسبة قانونية عمان"),
    ("accountant",          "chartered accountant Amman Jordan"),
    ("pharmacist",          "صيدلية عمان"),
    ("pharmacist",          "pharmacy Amman Jordan"),
    ("psychologist",        "طبيب نفسي عمان"),
    ("psychologist",        "psychologist therapist Amman Jordan"),
    ("nutritionist",        "أخصائي تغذية عمان"),
    ("nutritionist",        "nutritionist dietitian Amman Jordan"),
    ("physiotherapist",     "عيادة علاج طبيعي عمان"),
    ("physiotherapist",     "physiotherapy clinic Amman Jordan"),
    ("personal_trainer",    "مدرب شخصي عمان"),
    ("personal_trainer",    "personal trainer fitness Amman"),
    ("real_estate_agent",   "مكتب عقاري عمان"),
    ("real_estate_agent",   "real estate office Amman Jordan"),
    ("interior_designer",   "مكتب تصميم داخلي عمان"),
    ("interior_designer",   "interior design studio Amman Jordan"),
    ("wedding_planner",     "تنظيم أعراس عمان"),
    ("wedding_planner",     "wedding planner Amman Jordan"),
    ("event_organizer",     "تنظيم فعاليات عمان"),
    ("event_organizer",     "event planning company Amman Jordan"),
    ("tour_guide",          "مرشد سياحي عمان"),
    ("tour_guide",          "tour guide Amman Jordan"),
    ("translator",          "مكتب ترجمة عمان"),
    ("translator",          "translation office Amman Jordan"),
    ("financial_advisor",   "مكتب استشارات مالية عمان"),
    ("financial_advisor",   "financial advisory Amman Jordan"),
    ("it_consultant",       "شركة برمجة تقنية عمان"),
    ("it_consultant",       "IT consulting software Amman Jordan"),
    ("marketing_agency",    "وكالة تسويق رقمي عمان"),
    ("marketing_agency",    "digital marketing agency Amman Jordan"),
    ("fashion_designer",    "مصمم أزياء عمان"),
    ("fashion_designer",    "fashion designer Amman Jordan"),
    ("chef",                "شيف خاص عمان"),
    ("chef",                "private chef catering Amman Jordan"),
    ("veterinarian",        "عيادة طب بيطري عمان"),
    ("veterinarian",        "veterinary clinic Amman Jordan"),
    ("optometrist",         "عيادة طب عيون عمان"),
    ("optometrist",         "eye clinic ophthalmologist Amman Jordan"),
    ("dermatologist",       "عيادة جلدية عمان"),
    ("dermatologist",       "dermatology clinic Amman Jordan"),
    ("pediatrician",        "طبيب أطفال عمان"),
    ("pediatrician",        "pediatric clinic Amman Jordan"),
    ("obgyn",               "طبيب نساء وتوليد عمان"),
    ("obgyn",               "gynecology obstetrics clinic Amman"),
    ("cardiologist",        "طبيب قلب عمان"),
    ("cardiologist",        "cardiology clinic Amman Jordan"),
    ("orthopedic",          "طبيب عظام عمان"),
    ("orthopedic",          "orthopedic clinic Amman Jordan"),
    ("insurance_agent",     "وكيل تأمين عمان"),
    ("insurance_agent",     "insurance broker Amman Jordan"),
    ("car_dealer",          "معرض سيارات عمان"),
    ("car_dealer",          "car showroom Amman Jordan"),
]


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
            website TEXT,
            url TEXT UNIQUE,
            source TEXT,
            bio TEXT,
            scraped_at TIMESTAMP DEFAULT NOW()
        )
    """)
    # Add website column if table existed before this change
    cur.execute("ALTER TABLE jordan_people ADD COLUMN IF NOT EXISTS website TEXT")
    conn.commit()
    cur.close()
    conn.close()


def is_in_amman(lat, lng):
    if lat is None or lng is None:
        return False
    return AMMAN_LAT_MIN <= lat <= AMMAN_LAT_MAX and AMMAN_LNG_MIN <= lng <= AMMAN_LNG_MAX


def get_place_details(place_id):
    """Fetch phone number and website from Place Details API."""
    try:
        url = f"{BASE_URL}/details/json"
        params = {
            "place_id": place_id,
            "fields": "formatted_phone_number,international_phone_number,website",
            "key": API_KEY,
        }
        res = requests.get(url, params=params, timeout=10).json()
        if res.get("status") == "OK":
            result = res.get("result", {})
            phone = result.get("formatted_phone_number") or result.get("international_phone_number")
            website = result.get("website")
            return {"phone": phone, "website": website}
    except Exception as e:
        print(f"    Place details error for {place_id}: {e}")
    return {}


# Titles that indicate a named professional
TITLE_PATTERNS = [
    (r'\bدكتور\b|\bدكتورة\b|\bد\.\s*(\w)', 'Dr.'),
    (r'\bDr\.?\s', 'Dr.'),
    (r'\bمهندس\b|\bمهندسة\b|\bم\.\s*(\w)', 'Eng.'),
    (r'\bEng\.?\s', 'Eng.'),
    (r'\bمحامي\b|\bمحامية\b', None),
    (r'\bAtt\.?\s|Attorney|Lawyer', None),
    (r'\bProf\.?\s|Professor|أستاذ', 'Prof.'),
]


def extract_person_from_name(raw_name, subcategory):
    """
    Heuristically detect if raw_name contains an individual's name.
    Returns (person_name, title) or (None, None) if it's a pure business.
    """
    if not raw_name:
        return None, None

    name = raw_name.strip()

    # If the name has a known title prefix, it almost certainly refers to a person
    for pattern, title in TITLE_PATTERNS:
        if re.search(pattern, name, re.IGNORECASE):
            # Strip the prefix words that indicate business type
            clean = re.sub(
                r'(عيادة|مكتب|مجمع|مركز|clinic|office|center|centre|studio|firm|co\.|ltd\.?)',
                '', name, flags=re.IGNORECASE
            ).strip(' ,-–')
            if len(clean) >= 4:
                return clean, title
            return name, title

    # No title found — it's likely a pure business name, skip
    return None, None


def ai_extract_person(place_name, subcategory, address):
    """
    Use Claude Haiku to extract person name, title, and specialty from a business name.
    Returns dict with keys: name, title, specialty, is_person (bool).
    Falls back to heuristic if Claude unavailable.
    """
    if not ANTHROPIC_KEY:
        person_name, title = extract_person_from_name(place_name, subcategory)
        return {
            "name": person_name,
            "title": title,
            "specialty": None,
            "is_person": person_name is not None,
        }

    prompt = f"""You are extracting professional directory data about people in Amman, Jordan.

Given this Google Maps listing:
- Business name: "{place_name}"
- Professional category: {subcategory}
- Address: {address or 'Amman, Jordan'}

Your job:
1. Determine if this listing refers to a named individual (e.g. "Dr. Ahmad Clinic" → person: Dr. Ahmad) or a purely anonymous business (e.g. "Amman Medical Center" → no specific person).
2. If it IS a named individual, extract:
   - Their full name (Arabic or English, whichever is clearer)
   - Their title (Dr., Eng., Prof., etc.) — null if none
   - Their specialty/role (e.g. "Cardiologist", "Family Medicine", "Criminal Lawyer") — null if unclear
3. If it is NOT a named individual (pure brand/company), set is_person to false.

Respond ONLY with valid JSON, no explanation:
{{"is_person": true/false, "name": "...", "title": "..." or null, "specialty": "..." or null}}"""

    try:
        res = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 150,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=15,
        ).json()

        text = res.get("content", [{}])[0].get("text", "").strip()
        # Extract JSON from response
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            data = json.loads(match.group())
            return {
                "name": data.get("name"),
                "title": data.get("title"),
                "specialty": data.get("specialty"),
                "is_person": bool(data.get("is_person")),
            }
    except Exception as e:
        print(f"    AI extract error: {e}")

    # Fallback to heuristic
    person_name, title = extract_person_from_name(place_name, subcategory)
    return {
        "name": person_name,
        "title": title,
        "specialty": None,
        "is_person": person_name is not None,
    }


def text_search_professionals(query, subcategory):
    """Search Google Maps for professionals in Amman and enrich each result."""
    found = []
    seen_ids = set()
    url = f"{BASE_URL}/textsearch/json"
    params = {"query": query, "key": API_KEY, "region": "jo"}

    while True:
        try:
            res = requests.get(url, params=params, timeout=10).json()
            status = res.get("status")
            if status == "ZERO_RESULTS":
                break
            if status != "OK":
                print(f"    API status: {status}")
                break

            for place in res.get("results", []):
                pid = place.get("place_id")
                if not pid or pid in seen_ids:
                    continue

                lat = place.get("geometry", {}).get("location", {}).get("lat")
                lng = place.get("geometry", {}).get("location", {}).get("lng")

                # Strict Amman-only filter
                if not is_in_amman(lat, lng):
                    continue

                seen_ids.add(pid)
                raw_name = place.get("name", "").strip()
                address = place.get("formatted_address", "")

                # Step 1: Use AI to determine if this is a named person
                extracted = ai_extract_person(raw_name, subcategory, address)
                if not extracted["is_person"]:
                    continue  # Skip pure business listings

                # Step 2: Get phone + website from Place Details
                details = get_place_details(pid)
                time.sleep(0.1)  # Be gentle on the API

                found.append({
                    "name": extracted["name"],
                    "category": "professional",
                    "subcategory": subcategory,
                    "title": extracted["title"],
                    "specialty": extracted["specialty"],
                    "organization": raw_name,  # Original business name as org
                    "address": address,
                    "phone": details.get("phone"),
                    "website": details.get("website"),
                    "url": f"https://maps.google.com/?place_id={pid}",
                    "source": "google_maps",
                })

            next_token = res.get("next_page_token")
            if not next_token:
                break
            time.sleep(2)
            params = {"pagetoken": next_token, "key": API_KEY}

        except Exception as e:
            print(f"    Request error: {e}")
            break

    return found


def save_people(people):
    if not people:
        return 0
    conn = get_db()
    cur = conn.cursor()
    saved = 0
    for p in people:
        try:
            cur.execute("""
                INSERT INTO jordan_people
                    (name, name_ar, category, subcategory, title, organization,
                     specialty, phone, email, address, website, url, source, bio)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (url) DO UPDATE SET
                    name         = EXCLUDED.name,
                    phone        = COALESCE(EXCLUDED.phone, jordan_people.phone),
                    website      = COALESCE(EXCLUDED.website, jordan_people.website),
                    specialty    = COALESCE(EXCLUDED.specialty, jordan_people.specialty),
                    organization = EXCLUDED.organization
            """, (
                p.get("name"), p.get("name_ar"), p.get("category"),
                p.get("subcategory"), p.get("title"), p.get("organization"),
                p.get("specialty"), p.get("phone"), p.get("email"),
                p.get("address"), p.get("website"), p.get("url"),
                p.get("source"), p.get("bio")
            ))
            saved += 1
        except Exception as e:
            print(f"    Error saving {p.get('name')}: {e}")
    conn.commit()
    cur.close()
    conn.close()
    return saved


def run():
    print("Setting up jordan_people table...")
    setup_table()

    total = 0
    seen_queries = set()

    for subcategory, query in PROFESSIONAL_QUERIES:
        if query in seen_queries:
            continue
        seen_queries.add(query)

        print(f"  Searching people: '{query}'...")
        people = text_search_professionals(query, subcategory)
        saved = save_people(people)
        print(f"    → Found {len(people)} named professionals, saved {saved} [{subcategory}]")
        total += saved
        time.sleep(1)

    print(f"People scraper done. Total saved: {total}")


if __name__ == "__main__":
    run()
