"""
people.py — Professional directory scraper for Jordan (Amman).

Data sources:
  1. Google Maps Text Search API — medical specialists and named professionals
  2. OpenStreetMap / Overpass API — pharmacies, clinics, dental (dense OSM coverage)

Strategy:
  • REQUIRES_NAMED_PERSON categories: use AI extraction; only save if an individual
    name is detected (doctors, lawyers, psychologists, etc.)
  • SERVICE_ACCEPTABLE categories: save the business entry directly as a professional
    service even without an individual's name — pharmacies, gyms, architects, etc.
    Google Maps lists the business; the business IS the service.

Run:
    cd scraper
    venv/bin/python scrapers/people.py
"""

import os
import re
import time
import json
import requests
import psycopg2
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

API_KEY       = os.getenv("GOOGLE_MAPS_API_KEY")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")
BASE_URL      = "https://maps.googleapis.com/maps/api/place"

# Bounding box for Amman governorate
AMMAN_LAT_MIN, AMMAN_LAT_MAX = 31.70, 32.10
AMMAN_LNG_MIN, AMMAN_LNG_MAX = 35.75, 36.05

# ── Category classification ───────────────────────────────────────────────────

# These categories require a named individual to be present in the result.
# Pure brand/company names are rejected.
REQUIRES_NAMED_PERSON = {
    "doctor", "dentist", "lawyer", "psychologist", "nutritionist",
    "physiotherapist", "cardiologist", "dermatologist", "pediatrician",
    "obgyn", "orthopedic", "optometrist", "veterinarian", "engineer",
}

# For these categories we accept the business as a professional service even
# when no individual name is found. The business name becomes the display name.
SERVICE_ACCEPTABLE = {
    "pharmacist", "personal_trainer", "real_estate_agent", "interior_designer",
    "architect", "accountant", "financial_advisor", "it_consultant",
    "marketing_agency", "fashion_designer", "chef", "insurance_agent",
    "car_dealer", "wedding_planner", "event_organizer", "tour_guide",
    "translator",
}

# ── Google Maps search queries ────────────────────────────────────────────────
# Each entry is (subcategory, query_string).
# Multiple queries per category = broader coverage.

PROFESSIONAL_QUERIES = [
    # Doctors & general practitioners
    ("doctor",              "دكتور عمان"),
    ("doctor",              "عيادة دكتور عمان"),
    ("doctor",              "doctor clinic Amman Jordan"),
    ("doctor",              "family medicine clinic Amman"),
    # Dentists
    ("dentist",             "طبيب أسنان عمان"),
    ("dentist",             "dental clinic Amman Jordan"),
    ("dentist",             "عيادة أسنان عمان"),
    # Lawyers
    ("lawyer",              "مكتب محامي عمان"),
    ("lawyer",              "law firm Amman Jordan"),
    ("lawyer",              "محامي أردن"),
    # Engineers & architects
    ("engineer",            "مكتب مهندس استشاري عمان"),
    ("engineer",            "consulting engineer Amman Jordan"),
    ("architect",           "مكتب معماري عمان"),
    ("architect",           "architecture firm Amman Jordan"),
    ("architect",           "architect designer Amman"),
    ("architect",           "مصمم معماري عمان"),
    # Accountants
    ("accountant",          "مكتب محاسبة قانونية عمان"),
    ("accountant",          "chartered accountant Amman Jordan"),
    ("accountant",          "مكتب تدقيق مالي عمان"),
    # Personal trainers — search gyms; trainers are often listed through gyms
    ("personal_trainer",    "personal trainer gym Amman"),
    ("personal_trainer",    "fitness trainer Amman Jordan"),
    ("personal_trainer",    "مدرب شخصي عمان"),
    ("personal_trainer",    "مدرب لياقة جيم عمان"),
    ("personal_trainer",    "gym trainer Amman Jordan"),
    # Real estate agents
    ("real_estate_agent",   "real estate office Amman Jordan"),
    ("real_estate_agent",   "real estate broker Amman"),
    ("real_estate_agent",   "property company Amman Jordan"),
    ("real_estate_agent",   "مكتب عقاري عمان"),
    ("real_estate_agent",   "شركة عقارات عمان"),
    # Interior designers
    ("interior_designer",   "interior design studio Amman Jordan"),
    ("interior_designer",   "interior designer Amman"),
    ("interior_designer",   "مكتب تصميم داخلي عمان"),
    ("interior_designer",   "مصمم ديكور عمان"),
    # Wedding & events
    ("wedding_planner",     "تنظيم أعراس عمان"),
    ("wedding_planner",     "wedding planner Amman Jordan"),
    ("wedding_planner",     "wedding organizer Amman"),
    ("event_organizer",     "تنظيم فعاليات عمان"),
    ("event_organizer",     "event planning company Amman Jordan"),
    # Tour guides
    ("tour_guide",          "مرشد سياحي عمان"),
    ("tour_guide",          "tour guide Amman Jordan"),
    ("tour_guide",          "tour operator Amman"),
    # Translators
    ("translator",          "مكتب ترجمة عمان"),
    ("translator",          "translation office Amman Jordan"),
    ("translator",          "certified translator Amman"),
    # Financial advisors
    ("financial_advisor",   "مكتب استشارات مالية عمان"),
    ("financial_advisor",   "financial advisory Amman Jordan"),
    ("financial_advisor",   "investment advisor Amman"),
    # IT & tech
    ("it_consultant",       "شركة برمجة تقنية عمان"),
    ("it_consultant",       "IT consulting software Amman Jordan"),
    ("it_consultant",       "technology company Amman Jordan"),
    # Marketing
    ("marketing_agency",    "وكالة تسويق رقمي عمان"),
    ("marketing_agency",    "digital marketing agency Amman Jordan"),
    ("marketing_agency",    "marketing company Amman"),
    # Fashion & creative
    ("fashion_designer",    "مصمم أزياء عمان"),
    ("fashion_designer",    "fashion designer Amman Jordan"),
    # Chefs
    ("chef",                "شيف خاص عمان"),
    ("chef",                "private chef catering Amman Jordan"),
    ("chef",                "catering company Amman"),
    # Veterinarians
    ("veterinarian",        "عيادة طب بيطري عمان"),
    ("veterinarian",        "veterinary clinic Amman Jordan"),
    # Eye care
    ("optometrist",         "عيادة طب عيون عمان"),
    ("optometrist",         "eye clinic ophthalmologist Amman Jordan"),
    ("optometrist",         "optometry clinic Amman"),
    # Skin care
    ("dermatologist",       "عيادة جلدية عمان"),
    ("dermatologist",       "dermatology clinic Amman Jordan"),
    ("dermatologist",       "skin specialist Amman"),
    # Pediatrics
    ("pediatrician",        "طبيب أطفال عمان"),
    ("pediatrician",        "pediatric clinic Amman Jordan"),
    ("pediatrician",        "children doctor Amman"),
    # OB/GYN
    ("obgyn",               "طبيب نساء وتوليد عمان"),
    ("obgyn",               "gynecology obstetrics clinic Amman"),
    ("obgyn",               "obgyn specialist Amman Jordan"),
    # Cardiology
    ("cardiologist",        "طبيب قلب عمان"),
    ("cardiologist",        "cardiology clinic Amman Jordan"),
    ("cardiologist",        "heart specialist Amman"),
    # Orthopedics
    ("orthopedic",          "طبيب عظام عمان"),
    ("orthopedic",          "orthopedic clinic Amman Jordan"),
    ("orthopedic",          "bone specialist Amman"),
    # Psychology & therapy
    ("psychologist",        "طبيب نفسي عمان"),
    ("psychologist",        "psychologist therapist Amman Jordan"),
    ("psychologist",        "mental health clinic Amman"),
    ("psychologist",        "نفسانية عمان"),
    # Nutrition
    ("nutritionist",        "أخصائي تغذية عمان"),
    ("nutritionist",        "nutritionist dietitian Amman Jordan"),
    ("nutritionist",        "dietitian clinic Amman"),
    # Physiotherapy
    ("physiotherapist",     "عيادة علاج طبيعي عمان"),
    ("physiotherapist",     "physiotherapy clinic Amman Jordan"),
    ("physiotherapist",     "physical therapy Amman"),
    # Insurance
    ("insurance_agent",     "شركة تأمين عمان"),
    ("insurance_agent",     "insurance company Amman Jordan"),
    ("insurance_agent",     "insurance broker Amman"),
    # Car dealers
    ("car_dealer",          "معرض سيارات عمان"),
    ("car_dealer",          "car showroom Amman Jordan"),
    ("car_dealer",          "car dealer Amman"),
]


# ── Database ──────────────────────────────────────────────────────────────────

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
    cur.execute("ALTER TABLE jordan_people ADD COLUMN IF NOT EXISTS website TEXT")
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


# ── Location filter ───────────────────────────────────────────────────────────

def is_in_amman(lat, lng):
    if lat is None or lng is None:
        return False
    return AMMAN_LAT_MIN <= lat <= AMMAN_LAT_MAX and AMMAN_LNG_MIN <= lng <= AMMAN_LNG_MAX


# ── Google Maps helpers ───────────────────────────────────────────────────────

def get_place_details(place_id):
    """Fetch phone number and website from Place Details API."""
    try:
        res = requests.get(
            f"{BASE_URL}/details/json",
            params={
                "place_id": place_id,
                "fields": "formatted_phone_number,international_phone_number,website",
                "key": API_KEY,
            },
            timeout=10,
        ).json()
        if res.get("status") == "OK":
            r = res.get("result", {})
            return {
                "phone":   r.get("formatted_phone_number") or r.get("international_phone_number"),
                "website": r.get("website"),
            }
    except Exception as e:
        print(f"    Place details error for {place_id}: {e}")
    return {}


TITLE_PATTERNS = [
    (r'\bدكتور\b|\bدكتورة\b|\bد\.\s*(\w)', 'Dr.'),
    (r'\bDr\.?\s', 'Dr.'),
    (r'\bمهندس\b|\bمهندسة\b|\bم\.\s*(\w)', 'Eng.'),
    (r'\bEng\.?\s', 'Eng.'),
    (r'\bمحامي\b|\bمحامية\b', None),
    (r'\bAtt\.?\s|Attorney|Lawyer', None),
    (r'\bProf\.?\s|Professor|أستاذ', 'Prof.'),
]


def extract_person_heuristic(raw_name):
    """Return (person_name, title) if a title prefix is found; else (None, None)."""
    if not raw_name:
        return None, None
    for pattern, title in TITLE_PATTERNS:
        if re.search(pattern, raw_name, re.IGNORECASE):
            clean = re.sub(
                r'(عيادة|مكتب|مجمع|مركز|clinic|office|center|centre|studio|firm|co\.|ltd\.?)',
                '', raw_name, flags=re.IGNORECASE
            ).strip(' ,-–')
            return (clean if len(clean) >= 4 else raw_name), title
    return None, None


def ai_extract_person(place_name, subcategory, address):
    """Use Claude Haiku to detect named individuals; fall back to heuristic."""
    if not ANTHROPIC_KEY:
        name, title = extract_person_heuristic(place_name)
        return {"name": name, "title": title, "specialty": None, "is_person": name is not None}

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
                "messages": [{
                    "role": "user",
                    "content": (
                        f"You are extracting professional directory data about people in Amman, Jordan.\n\n"
                        f"Given this Google Maps listing:\n"
                        f"- Business name: \"{place_name}\"\n"
                        f"- Professional category: {subcategory}\n"
                        f"- Address: {address or 'Amman, Jordan'}\n\n"
                        "Determine if this listing refers to a named individual "
                        "(e.g. 'Dr. Ahmad Clinic' → person: Dr. Ahmad) or a purely anonymous "
                        "business (e.g. 'Amman Medical Center' → no specific person).\n"
                        "If named individual: extract full name, title (Dr./Eng./Prof./null), "
                        "specialty (null if unclear).\n"
                        "Respond ONLY with valid JSON:\n"
                        '{"is_person":true/false,"name":"...","title":"..."/null,"specialty":"..."/null}'
                    ),
                }],
            },
            timeout=15,
        ).json()
        text = (res.get("content") or [{}])[0].get("text", "").strip()
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            data = json.loads(match.group())
            return {
                "name":      data.get("name"),
                "title":     data.get("title"),
                "specialty": data.get("specialty"),
                "is_person": bool(data.get("is_person")),
            }
    except Exception as e:
        print(f"    AI extract error: {e}")

    name, title = extract_person_heuristic(place_name)
    return {"name": name, "title": title, "specialty": None, "is_person": name is not None}


# ── Google Maps text search (first page only — pagination is unreliable) ──────

def text_search_professionals(query, subcategory):
    """
    Search Google Maps for professionals in Amman.
    Only uses the first page of results to avoid next_page_token INVALID_REQUEST.
    """
    found     = []
    seen_ids  = set()
    needs_person = subcategory in REQUIRES_NAMED_PERSON

    try:
        res = requests.get(
            f"{BASE_URL}/textsearch/json",
            params={"query": query, "key": API_KEY, "region": "jo"},
            timeout=10,
        ).json()

        status = res.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            # Don't print for INVALID_REQUEST — it still sometimes returns results
            pass

        for place in res.get("results", []):
            pid = place.get("place_id")
            if not pid or pid in seen_ids:
                continue

            lat = place.get("geometry", {}).get("location", {}).get("lat")
            lng = place.get("geometry", {}).get("location", {}).get("lng")
            if not is_in_amman(lat, lng):
                continue

            seen_ids.add(pid)
            raw_name = place.get("name", "").strip()
            address  = place.get("formatted_address", "")

            if needs_person:
                # Must detect a named individual
                extracted = ai_extract_person(raw_name, subcategory, address)
                if not extracted["is_person"]:
                    continue
                display_name = extracted["name"]
                title        = extracted["title"]
                specialty    = extracted["specialty"]
            else:
                # SERVICE_ACCEPTABLE: use the business name directly
                # Still try to extract an individual name if present
                extracted = ai_extract_person(raw_name, subcategory, address)
                if extracted["is_person"] and extracted["name"]:
                    display_name = extracted["name"]
                    title        = extracted["title"]
                    specialty    = extracted["specialty"]
                else:
                    # Save the business as the professional service
                    display_name = raw_name
                    title        = None
                    specialty    = subcategory.replace("_", " ").title()

            details = get_place_details(pid)
            time.sleep(0.1)

            found.append({
                "name":        display_name,
                "category":    "professional",
                "subcategory": subcategory,
                "title":       title,
                "specialty":   specialty,
                "organization": raw_name,
                "address":     address,
                "phone":       details.get("phone"),
                "website":     details.get("website"),
                "url":         f"https://maps.google.com/?place_id={pid}",
                "source":      "google_maps",
            })

    except Exception as e:
        print(f"    Request error: {e}")

    return found


# ── OpenStreetMap / Overpass API ──────────────────────────────────────────────

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

def fetch_overpass(amenity_type, subcategory, healthcare_specialty=None):
    """
    Fetch places from OpenStreetMap via Overpass API.
    Used for pharmacies, clinics, dental — OSM coverage in Amman is excellent.
    Tries multiple mirrors with retry delay to handle rate-limiting.
    """
    lat_min, lng_min = AMMAN_LAT_MIN, AMMAN_LNG_MIN
    lat_max, lng_max = AMMAN_LAT_MAX, AMMAN_LNG_MAX
    bbox = f"{lat_min},{lng_min},{lat_max},{lng_max}"

    if healthcare_specialty:
        query = f"""
[out:json][timeout:40];
(
  node["amenity"="{amenity_type}"]["healthcare:specialty"="{healthcare_specialty}"]({bbox});
  way["amenity"="{amenity_type}"]["healthcare:specialty"="{healthcare_specialty}"]({bbox});
  node["healthcare:specialty"="{healthcare_specialty}"]({bbox});
);
out body;
"""
    else:
        query = f"""
[out:json][timeout:40];
(
  node["amenity"="{amenity_type}"]({bbox});
  way["amenity"="{amenity_type}"]({bbox});
);
out body;
"""

    elements = []
    for mirror in OVERPASS_MIRRORS:
        try:
            resp = requests.post(mirror, data={"data": query}, timeout=50)
            if resp.status_code != 200:
                print(f"    Overpass mirror {mirror} returned {resp.status_code}, trying next...")
                time.sleep(3)
                continue
            res = resp.json()
            elements = res.get("elements", [])
            break  # success
        except Exception as e:
            print(f"    Overpass error on {mirror}: {e}, trying next...")
            time.sleep(3)
    else:
        print("    All Overpass mirrors failed")
        return []

    found = []
    for el in elements:
        tags    = el.get("tags", {})
        name    = tags.get("name") or tags.get("name:en") or tags.get("name:ar")
        name_ar = tags.get("name:ar")
        if not name:
            continue

        address_parts = [
            tags.get("addr:street"), tags.get("addr:city"), tags.get("addr:suburb")
        ]
        address = ", ".join(p for p in address_parts if p) or "Amman"
        phone   = tags.get("phone") or tags.get("contact:phone")
        website = tags.get("website") or tags.get("contact:website")
        osm_url = f"https://www.openstreetmap.org/{el.get('type','node')}/{el['id']}"

        # For pharmacies, check if the name contains a person's name (title prefix)
        person_name, title = extract_person_heuristic(name)
        display_name       = person_name if person_name else name

        found.append({
            "name":        display_name,
            "name_ar":     name_ar,
            "category":    "professional",
            "subcategory": subcategory,
            "title":       title,
            "specialty":   subcategory.replace("_", " ").title(),
            "organization": name,
            "address":     address,
            "phone":       phone,
            "website":     website,
            "url":         osm_url,
            "source":      "openstreetmap",
        })

    return found


# ── Main ──────────────────────────────────────────────────────────────────────

def run():
    print("Setting up jordan_people table...")
    setup_table()

    total     = 0
    seen_urls = set()

    # ── Phase 1: Google Maps text search ─────────────────────────────────────
    print("\n=== Phase 1: Google Maps text search ===")
    seen_queries = set()
    for subcategory, query in PROFESSIONAL_QUERIES:
        if query in seen_queries:
            continue
        seen_queries.add(query)

        print(f"  [{subcategory}] '{query}'...")
        people = text_search_professionals(query, subcategory)
        # Deduplicate by URL across queries
        fresh  = [p for p in people if p["url"] not in seen_urls]
        for p in fresh:
            seen_urls.add(p["url"])
        saved  = save_people(fresh)
        if saved:
            print(f"    → {saved} new")
        total += saved
        time.sleep(0.8)

    # ── Phase 2: OpenStreetMap — pharmacies ───────────────────────────────────
    print("\n=== Phase 2: OpenStreetMap pharmacies ===")
    pharmacy_entries = fetch_overpass("pharmacy", "pharmacist")
    print(f"  Found {len(pharmacy_entries)} pharmacies on OSM")
    fresh_pharm = [p for p in pharmacy_entries if p["url"] not in seen_urls]
    for p in fresh_pharm:
        seen_urls.add(p["url"])
    saved_pharm = save_people(fresh_pharm)
    print(f"  Saved {saved_pharm} new pharmacies")
    total += saved_pharm

    # ── Phase 3: OpenStreetMap — dental clinics ───────────────────────────────
    print("\n=== Phase 3: OpenStreetMap dental ===")
    dental_entries = fetch_overpass("dentist", "dentist")
    print(f"  Found {len(dental_entries)} dental clinics on OSM")
    fresh_dent = [p for p in dental_entries if p["url"] not in seen_urls]
    for p in fresh_dent:
        seen_urls.add(p["url"])
    saved_dent = save_people(fresh_dent)
    print(f"  Saved {saved_dent} new dental clinics")
    total += saved_dent

    # ── Phase 4: OpenStreetMap — general clinics / doctors ───────────────────
    print("\n=== Phase 4: OpenStreetMap clinics ===")
    clinic_entries = fetch_overpass("clinic", "doctor")
    print(f"  Found {len(clinic_entries)} clinics on OSM")
    fresh_clin = [p for p in clinic_entries if p["url"] not in seen_urls]
    for p in fresh_clin:
        seen_urls.add(p["url"])
    saved_clin = save_people(fresh_clin)
    print(f"  Saved {saved_clin} new clinics")
    total += saved_clin

    # ── Phase 5: OpenStreetMap — physiotherapy ────────────────────────────────
    print("\n=== Phase 5: OpenStreetMap physiotherapy ===")
    physio_entries = fetch_overpass("clinic", "physiotherapist", healthcare_specialty="physiotherapy")
    print(f"  Found {len(physio_entries)} physio clinics on OSM")
    fresh_physio = [p for p in physio_entries if p["url"] not in seen_urls]
    for p in fresh_physio:
        seen_urls.add(p["url"])
    saved_physio = save_people(fresh_physio)
    print(f"  Saved {saved_physio} physio entries")
    total += saved_physio

    print(f"\nPeople scraper done. Total new records: {total}")


if __name__ == "__main__":
    run()
