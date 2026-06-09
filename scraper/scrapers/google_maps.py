import os
import time
import requests
import psycopg2
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
BASE_URL = "https://maps.googleapis.com/maps/api/place"

# Maps specific subcategory → broad display category
CATEGORY_MAP = {
    # Food
    "restaurant":         "food",
    "cafe":               "food",
    "bakery":             "food",
    "fast_food":          "food",
    "juice_bar":          "food",
    # Health
    "clinic":             "health",
    "hospital":           "health",
    "pharmacy":           "health",
    "dentist":            "health",
    "gym":                "health",
    "spa":                "health",
    "veterinary_care":    "health",
    "physiotherapy":      "health",
    "optical":            "health",
    "medical_lab":        "health",
    "beauty_clinic":      "health",
    # Shopping
    "supermarket":        "shopping",
    "electronics_store":  "shopping",
    "clothing_store":     "shopping",
    "jewelry_store":      "shopping",
    "furniture_store":    "shopping",
    "pet_store":          "shopping",
    "book_store":         "shopping",
    "florist":            "shopping",
    "shopping_mall":      "shopping",
    "toy_store":          "shopping",
    "hardware_store":     "shopping",
    "stationery_store":   "shopping",
    # Services
    "salon":              "services",
    "beauty_salon":       "services",
    "barbershop":         "services",
    "laundry":            "services",
    "car_repair":         "services",
    "gas_station":        "services",
    "bank":               "services",
    "atm":                "services",
    "car_wash":           "services",
    "lawyer":             "services",
    "accounting":         "services",
    "real_estate_agency": "services",
    "printing":           "services",
    "cleaning_service":   "services",
    # Education
    "school":             "education",
    "university":         "education",
    "nursery":            "education",
    "kindergarten":       "education",
    "college":            "education",
    "training_center":    "education",
    # Hospitality
    "hotel":              "hospitality",
    "guesthouse":         "hospitality",
    "apartment_hotel":    "hospitality",
    # Religion
    "mosque":             "religion",
    "church":             "religion",
}

# Text search queries: (subcategory, arabic/english query)
# subcategory is the specific type; category is derived from CATEGORY_MAP
SEARCH_QUERIES = [
    # ── Food & Drink ────────────────────────────────────────────────────
    ("restaurant",         "مطعم عمان"),
    ("restaurant",         "restaurant Amman Jordan"),
    ("cafe",               "مقهى عمان"),
    ("cafe",               "cafe coffee shop Amman Jordan"),
    ("bakery",             "مخبز عمان"),
    ("bakery",             "bakery Amman Jordan"),
    ("juice_bar",          "عصير طازج عمان"),
    ("juice_bar",          "juice bar Amman Jordan"),
    ("fast_food",          "وجبات سريعة عمان"),
    ("fast_food",          "fast food Amman Jordan"),

    # ── Health & Wellness ───────────────────────────────────────────────
    ("clinic",             "عيادة عمان"),
    ("clinic",             "clinic Amman Jordan"),
    ("hospital",           "مستشفى عمان"),
    ("hospital",           "hospital Amman Jordan"),
    ("pharmacy",           "صيدلية عمان"),
    ("pharmacy",           "pharmacy Amman Jordan"),
    ("dentist",            "طبيب أسنان عمان"),
    ("dentist",            "dental clinic Amman Jordan"),
    ("gym",                "نادي رياضي عمان"),
    ("gym",                "gym fitness center Amman Jordan"),
    ("spa",                "سبا عمان"),
    ("spa",                "spa massage Amman Jordan"),
    ("veterinary_care",    "عيادة بيطرية عمان"),
    ("veterinary_care",    "vet clinic Amman Jordan"),
    ("physiotherapy",      "علاج طبيعي عمان"),
    ("physiotherapy",      "physiotherapy clinic Amman Jordan"),
    ("optical",            "بصريات عمان"),
    ("optical",            "optical center Amman Jordan"),
    ("medical_lab",        "مختبر طبي عمان"),
    ("medical_lab",        "medical laboratory Amman Jordan"),
    ("medical_lab",        "مركز صحي عمان"),
    ("medical_lab",        "أشعة عمان"),
    ("medical_lab",        "radiology center Amman Jordan"),
    ("beauty_clinic",      "عيادة تجميل عمان"),
    ("beauty_clinic",      "cosmetic clinic Amman Jordan"),

    # ── Shopping ────────────────────────────────────────────────────────
    ("supermarket",        "سوبرماركت عمان"),
    ("supermarket",        "supermarket Amman Jordan"),
    ("shopping_mall",      "مول تسوق عمان"),
    ("shopping_mall",      "mall Amman Jordan"),
    ("clothing_store",     "محل ملابس عمان"),
    ("clothing_store",     "clothing store Amman Jordan"),
    ("electronics_store",  "محل الكترونيات عمان"),
    ("electronics_store",  "electronics store Amman Jordan"),
    ("jewelry_store",      "محل مجوهرات عمان"),
    ("jewelry_store",      "jewelry store Amman Jordan"),
    ("furniture_store",    "محل أثاث عمان"),
    ("furniture_store",    "furniture store Amman Jordan"),
    ("book_store",         "مكتبة عمان"),
    ("book_store",         "bookstore Amman Jordan"),
    ("pet_store",          "محل حيوانات أليفة عمان"),
    ("florist",            "محل ورد وزهور عمان"),
    ("toy_store",          "محل ألعاب عمان"),
    ("toy_store",          "toy store Amman Jordan"),
    ("hardware_store",     "أدوات منزلية عمان"),
    ("hardware_store",     "hardware store Amman Jordan"),
    ("stationery_store",   "محل قرطاسية عمان"),
    ("stationery_store",   "stationery office supplies Amman Jordan"),

    # ── Services ────────────────────────────────────────────────────────
    ("salon",              "صالون تجميل نسائي عمان"),
    ("salon",              "beauty salon Amman Jordan"),
    ("beauty_salon",       "صالون عرائس عمان"),
    ("barbershop",         "حلاق رجالي عمان"),
    ("barbershop",         "barbershop Amman Jordan"),
    ("laundry",            "مغسلة ملابس عمان"),
    ("laundry",            "laundry dry cleaning Amman Jordan"),
    ("car_repair",         "ميكانيكي سيارات عمان"),
    ("car_repair",         "car repair garage Amman Jordan"),
    ("gas_station",        "محطة وقود عمان"),
    ("gas_station",        "petrol station Amman Jordan"),
    ("bank",               "بنك عمان"),
    ("bank",               "bank Amman Jordan"),
    ("car_wash",           "غسيل سيارات عمان"),
    ("car_wash",           "car wash Amman Jordan"),
    ("lawyer",             "محامي عمان"),
    ("lawyer",             "law firm Amman Jordan"),
    ("accounting",         "مكتب محاسبة عمان"),
    ("accounting",         "accounting firm Amman Jordan"),
    ("printing",           "مطبعة عمان"),
    ("printing",           "printing shop Amman Jordan"),
    ("cleaning_service",   "شركة تنظيف عمان"),
    ("cleaning_service",   "cleaning company Amman Jordan"),
    ("real_estate_agency", "وكالة عقارات عمان"),
    ("real_estate_agency", "real estate agency Amman Jordan"),

    # ── Education ───────────────────────────────────────────────────────
    ("school",             "مدرسة عمان"),
    ("school",             "school Amman Jordan"),
    ("university",         "جامعة عمان"),
    ("university",         "university Amman Jordan"),
    ("nursery",            "حضانة أطفال عمان"),
    ("nursery",            "nursery daycare Amman Jordan"),
    ("kindergarten",       "روضة أطفال عمان"),
    ("kindergarten",       "kindergarten Amman Jordan"),
    ("school",             "مدرسة دولية عمان"),
    ("school",             "international school Amman Jordan"),
    ("college",            "كلية عمان"),
    ("college",            "college Amman Jordan"),
    ("training_center",    "معهد تدريب عمان"),
    ("training_center",    "training center Amman Jordan"),
    ("training_center",    "language institute Amman Jordan"),

    # ── Hospitality ─────────────────────────────────────────────────────
    ("hotel",              "فندق عمان"),
    ("hotel",              "hotel Amman Jordan"),
    ("hotel",              "hotel downtown Amman"),
    ("hotel",              "luxury hotel Amman Jordan"),
    ("hotel",              "boutique hotel Amman Jordan"),
    ("guesthouse",         "استراحة عمان"),
    ("guesthouse",         "guesthouse Amman Jordan"),
    ("apartment_hotel",    "شقة فندقية عمان"),
    ("apartment_hotel",    "apartment hotel Amman Jordan"),
    ("apartment_hotel",    "serviced apartment Amman Jordan"),

    # ── Religion ────────────────────────────────────────────────────────
    ("mosque",             "مسجد عمان"),
    ("mosque",             "mosque Amman Jordan"),
    ("mosque",             "مسجد صويفية"),
    ("mosque",             "مسجد عبدون"),
    ("mosque",             "مسجد الشميساني"),
    ("mosque",             "مسجد خلدا"),
    ("mosque",             "مسجد الجاردنز"),
    ("mosque",             "مسجد جبل عمان"),
    ("mosque",             "mosque west amman"),
    ("mosque",             "mosque east amman"),
    ("mosque",             "مسجد الرابية"),
    ("mosque",             "مسجد دابوق"),
    ("mosque",             "مسجد تلاع العلي"),
    ("mosque",             "مسجد المدينة الرياضية"),
    ("church",             "كنيسة عمان"),
    ("church",             "church Amman Jordan"),
]

# Amman bounding box for validation
AMMAN_LAT_MIN, AMMAN_LAT_MAX = 31.70, 32.10
AMMAN_LNG_MIN, AMMAN_LNG_MAX = 35.75, 36.05


def get_db():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def setup_table():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS jordan_places (
            id SERIAL PRIMARY KEY,
            place_id TEXT UNIQUE,
            name TEXT,
            category TEXT,
            subcategory TEXT,
            address TEXT,
            phone TEXT,
            website TEXT,
            rating FLOAT,
            reviews_count INT,
            lat FLOAT,
            lng FLOAT,
            opening_hours TEXT,
            search_text TEXT,
            scraped_at TIMESTAMP DEFAULT NOW()
        )
    """)
    # Add columns if they didn't exist before
    for stmt in [
        "ALTER TABLE jordan_places ADD COLUMN IF NOT EXISTS subcategory TEXT",
        "ALTER TABLE jordan_places ADD COLUMN IF NOT EXISTS search_text TEXT",
        "ALTER TABLE jordan_places ADD COLUMN IF NOT EXISTS phone TEXT",
        "ALTER TABLE jordan_places ADD COLUMN IF NOT EXISTS website TEXT",
        "ALTER TABLE jordan_places ADD COLUMN IF NOT EXISTS embedding vector(384)",
    ]:
        cur.execute(stmt)

    # ── MIGRATION: populate subcategory from old category values,
    #    then remap category → broad group ──────────────────────────
    cur.execute("UPDATE jordan_places SET subcategory = category WHERE subcategory IS NULL")
    cur.execute("""
        UPDATE jordan_places SET category = CASE
            WHEN subcategory IN ('restaurant','cafe','bakery','fast_food','juice_bar') THEN 'food'
            WHEN subcategory IN ('clinic','hospital','pharmacy','dentist','gym','spa',
                                 'veterinary_care','physiotherapy','optical',
                                 'medical_lab','beauty_clinic')                        THEN 'health'
            WHEN subcategory IN ('supermarket','electronics_store','clothing_store',
                                 'jewelry_store','furniture_store','pet_store',
                                 'book_store','florist','shopping_mall',
                                 'toy_store','hardware_store','stationery_store')      THEN 'shopping'
            WHEN subcategory IN ('salon','beauty_salon','barbershop','laundry',
                                 'car_repair','gas_station','bank','atm',
                                 'car_wash','lawyer','accounting',
                                 'real_estate_agency','printing',
                                 'cleaning_service')                                   THEN 'services'
            WHEN subcategory IN ('school','university','nursery','kindergarten',
                                 'college','training_center')                          THEN 'education'
            WHEN subcategory IN ('hotel','guesthouse','apartment_hotel')               THEN 'hospitality'
            WHEN subcategory IN ('mosque','church')                                    THEN 'religion'
            ELSE category
        END
        WHERE category NOT IN ('food','health','shopping','services','education','hospitality','religion')
    """)

    # Indexes
    cur.execute("""
        CREATE INDEX IF NOT EXISTS jordan_places_vec_idx
        ON jordan_places USING hnsw (embedding vector_cosine_ops)
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS jordan_places_trgm_idx
        ON jordan_places USING gin (search_text gin_trgm_ops)
    """)
    conn.commit()
    cur.close()
    conn.close()


def is_in_amman(lat, lng):
    """Validate coordinates are within Amman bounding box."""
    if lat is None or lng is None:
        return False
    return AMMAN_LAT_MIN <= lat <= AMMAN_LAT_MAX and AMMAN_LNG_MIN <= lng <= AMMAN_LNG_MAX


def get_place_details(place_id):
    """
    Call Place Details API to fetch phone number and website.
    Returns a dict with 'phone' and 'website' keys (values may be None).
    """
    url = f"{BASE_URL}/details/json"
    params = {
        "place_id": place_id,
        "fields": "formatted_phone_number,website",
        "key": API_KEY,
    }
    try:
        res = requests.get(url, params=params, timeout=10).json()
        if res.get("status") == "OK":
            result = res.get("result", {})
            return {
                "phone":   result.get("formatted_phone_number"),
                "website": result.get("website"),
            }
    except Exception as e:
        print(f"  [details] Error for {place_id}: {e}", flush=True)
    return {"phone": None, "website": None}


def text_search(query, subcategory):
    """Use Google Places Text Search for accurate results."""
    places = []
    seen_ids = set()
    broad_category = CATEGORY_MAP.get(subcategory, subcategory)
    url = f"{BASE_URL}/textsearch/json"
    params = {
        "query": query,
        "key": API_KEY,
        "region": "jo",
    }

    while True:
        try:
            res = requests.get(url, params=params, timeout=10).json()
            status = res.get("status")
            if status not in ("OK", "ZERO_RESULTS"):
                print(f"  API status: {status}", flush=True)
                break

            for place in res.get("results", []):
                pid = place.get("place_id")
                if not pid or pid in seen_ids:
                    continue

                lat = place.get("geometry", {}).get("location", {}).get("lat")
                lng = place.get("geometry", {}).get("location", {}).get("lng")

                if not is_in_amman(lat, lng):
                    continue

                seen_ids.add(pid)
                places.append({
                    "place_id":     pid,
                    "name":         place.get("name"),
                    "category":     broad_category,
                    "subcategory":  subcategory,
                    "address":      place.get("formatted_address"),
                    "rating":       place.get("rating"),
                    "reviews_count": place.get("user_ratings_total"),
                    "lat":          lat,
                    "lng":          lng,
                    "phone":        None,
                    "website":      None,
                })

            next_token = res.get("next_page_token")
            if not next_token:
                break
            time.sleep(2)
            params = {"pagetoken": next_token, "key": API_KEY}

        except Exception as e:
            print(f"  Request error: {e}", flush=True)
            break

    # Enrich every place with phone + website via Place Details API
    for i, p in enumerate(places):
        details = get_place_details(p["place_id"])
        p["phone"]   = details["phone"]
        p["website"] = details["website"]
        if (i + 1) % 10 == 0:
            print(f"  [details] enriched {i + 1}/{len(places)}", flush=True)
        time.sleep(0.5)   # stay well within QPS limits

    return places


def save_places(places):
    if not places:
        return 0

    # Build search_text for each place
    for p in places:
        p["search_text"] = (
            f"{p['name']} {p['category']} {p.get('address', '')} amman jordan"
            .replace("  ", " ").strip()
        )

    # Batch embed — falls back gracefully if sentence-transformers not installed
    try:
        from scrapers.embedder import embed_batch, to_pg_vector
        texts = [p["search_text"] for p in places]
        vecs = embed_batch(texts)
        for i, p in enumerate(places):
            p["embedding"] = to_pg_vector(vecs[i])
    except Exception as e:
        print(f"  [embedder] skipped: {e}", flush=True)
        for p in places:
            p["embedding"] = None

    conn = get_db()
    cur = conn.cursor()
    saved = 0
    for place in places:
        try:
            cur.execute("""
                INSERT INTO jordan_places
                    (place_id, name, category, subcategory, address,
                     phone, website, rating, reviews_count, lat, lng,
                     search_text, embedding)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::vector)
                ON CONFLICT (place_id) DO UPDATE SET
                    category      = EXCLUDED.category,
                    subcategory   = EXCLUDED.subcategory,
                    phone         = COALESCE(EXCLUDED.phone, jordan_places.phone),
                    website       = COALESCE(EXCLUDED.website, jordan_places.website),
                    rating        = EXCLUDED.rating,
                    reviews_count = EXCLUDED.reviews_count,
                    search_text   = EXCLUDED.search_text,
                    embedding     = EXCLUDED.embedding
            """, (
                place["place_id"], place["name"], place["category"],
                place.get("subcategory"), place["address"],
                place.get("phone"), place.get("website"),
                place["rating"], place["reviews_count"],
                place["lat"], place["lng"],
                place.get("search_text"), place.get("embedding"),
            ))
            saved += 1
        except Exception as e:
            print(f"  Error saving {place.get('name')}: {e}", flush=True)
    conn.commit()
    cur.close()
    conn.close()
    return saved


def backfill_phones():
    """
    One-time backfill: fetch phone + website for every existing place
    that has a place_id but a NULL phone.  Updates in-place.
    Safe to run multiple times — only touches rows still missing phone.
    """
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, place_id FROM jordan_places
        WHERE phone IS NULL AND place_id IS NOT NULL
        ORDER BY id
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    if not rows:
        print("backfill_phones: nothing to backfill.", flush=True)
        return

    print(f"backfill_phones: {len(rows)} places need phone data.", flush=True)

    conn = get_db()
    cur = conn.cursor()
    updated = 0

    for idx, (row_id, place_id) in enumerate(rows, start=1):
        details = get_place_details(place_id)
        phone   = details.get("phone")
        website = details.get("website")

        try:
            cur.execute("""
                UPDATE jordan_places
                SET phone   = COALESCE(%s, phone),
                    website = COALESCE(%s, website)
                WHERE id = %s
            """, (phone, website, row_id))
            if phone:
                updated += 1
        except Exception as e:
            print(f"  [backfill] Error updating id={row_id}: {e}", flush=True)

        if idx % 50 == 0:
            conn.commit()
            print(f"  [backfill] progress {idx}/{len(rows)}, phones found so far: {updated}", flush=True)

        time.sleep(1)  # 1 second between calls as requested

    conn.commit()
    cur.close()
    conn.close()
    print(f"backfill_phones done. Updated phone for {updated}/{len(rows)} places.", flush=True)


def run():
    print("Setting up jordan_places table...", flush=True)
    setup_table()

    total = 0
    seen_queries = set()
    for subcategory, query in SEARCH_QUERIES:
        if query in seen_queries:
            continue
        seen_queries.add(query)
        broad = CATEGORY_MAP.get(subcategory, subcategory)
        print(f"Searching: '{query}' [{broad} › {subcategory}]...", flush=True)
        places = text_search(query, subcategory)
        saved = save_places(places)
        print(f"  → Found {len(places)}, saved {saved}", flush=True)
        total += saved
        time.sleep(1)

    print(f"\nGoogle Maps scrape done. Total saved: {total}", flush=True)

    # Backfill phones for pre-existing records (and any new ones that missed details)
    print("\nStarting phone backfill for all NULL-phone records...", flush=True)
    backfill_phones()


if __name__ == "__main__":
    run()
