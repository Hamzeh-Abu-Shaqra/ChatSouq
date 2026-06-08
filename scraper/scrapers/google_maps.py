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
    "restaurant":        "food",
    "cafe":              "food",
    "bakery":            "food",
    "fast_food":         "food",
    "juice_bar":         "food",
    "gym":               "health",
    "clinic":            "health",
    "hospital":          "health",
    "pharmacy":          "health",
    "dentist":           "health",
    "spa":               "health",
    "veterinary_care":   "health",
    "physiotherapy":     "health",
    "optical":           "health",
    "supermarket":       "shopping",
    "electronics_store": "shopping",
    "clothing_store":    "shopping",
    "jewelry_store":     "shopping",
    "furniture_store":   "shopping",
    "pet_store":         "shopping",
    "book_store":        "shopping",
    "florist":           "shopping",
    "shopping_mall":     "shopping",
    "salon":             "services",
    "barbershop":        "services",
    "laundry":           "services",
    "car_repair":        "services",
    "gas_station":       "services",
    "bank":              "services",
    "atm":               "services",
    "school":            "education",
    "university":        "education",
    "hotel":             "hospitality",
    "mosque":            "religion",
    "church":            "religion",
}

# Text search queries: (subcategory, arabic/english query)
# subcategory is the specific type; category is derived from CATEGORY_MAP
SEARCH_QUERIES = [
    # Food & Drink
    ("restaurant",        "مطعم عمان"),
    ("restaurant",        "restaurant Amman Jordan"),
    ("cafe",              "مقهى عمان"),
    ("cafe",              "cafe coffee shop Amman Jordan"),
    ("bakery",            "مخبز عمان"),
    ("bakery",            "bakery Amman Jordan"),
    ("juice_bar",         "عصير طازج عمان"),
    ("fast_food",         "وجبات سريعة عمان"),
    # Health & Wellness
    ("clinic",            "عيادة عمان"),
    ("clinic",            "clinic Amman Jordan"),
    ("hospital",          "مستشفى عمان"),
    ("hospital",          "hospital Amman Jordan"),
    ("pharmacy",          "صيدلية عمان"),
    ("pharmacy",          "pharmacy Amman Jordan"),
    ("dentist",           "طبيب أسنان عمان"),
    ("dentist",           "dental clinic Amman Jordan"),
    ("gym",               "نادي رياضي عمان"),
    ("gym",               "gym fitness Amman Jordan"),
    ("spa",               "سبا عمان"),
    ("spa",               "spa massage Amman Jordan"),
    ("veterinary_care",   "عيادة بيطرية عمان"),
    ("physiotherapy",     "علاج طبيعي عمان"),
    ("optical",           "بصريات عمان"),
    # Shopping
    ("supermarket",       "سوبرماركت عمان"),
    ("supermarket",       "supermarket Amman Jordan"),
    ("shopping_mall",     "مول تسوق عمان"),
    ("shopping_mall",     "mall Amman Jordan"),
    ("clothing_store",    "محل ملابس عمان"),
    ("clothing_store",    "clothing store Amman Jordan"),
    ("electronics_store", "محل الكترونيات عمان"),
    ("electronics_store", "electronics store Amman"),
    ("jewelry_store",     "محل مجوهرات عمان"),
    ("furniture_store",   "محل أثاث عمان"),
    ("book_store",        "مكتبة عمان"),
    ("pet_store",         "محل حيوانات عمان"),
    ("florist",           "محل ورد عمان"),
    # Services
    ("salon",             "صالون تجميل عمان"),
    ("salon",             "beauty salon Amman Jordan"),
    ("barbershop",        "حلاق عمان"),
    ("laundry",           "مغسلة عمان"),
    ("car_repair",        "ميكانيكي عمان"),
    ("car_repair",        "car repair garage Amman"),
    ("gas_station",       "محطة وقود عمان"),
    ("gas_station",       "petrol station Amman Jordan"),
    ("bank",              "بنك عمان"),
    ("bank",              "bank Amman Jordan"),
    # Education
    ("school",            "مدرسة عمان"),
    ("school",            "school Amman Jordan"),
    ("university",        "جامعة عمان"),
    ("university",        "university Amman Jordan"),
    # Hospitality
    ("hotel",             "فندق عمان"),
    ("hotel",             "hotel Amman Jordan"),
    # Religion
    ("mosque",            "مسجد عمان"),
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
                                 'veterinary_care','physiotherapy','optical')        THEN 'health'
            WHEN subcategory IN ('supermarket','electronics_store','clothing_store',
                                 'jewelry_store','furniture_store','pet_store',
                                 'book_store','florist','shopping_mall')             THEN 'shopping'
            WHEN subcategory IN ('salon','barbershop','laundry','car_repair',
                                 'gas_station','bank','atm')                         THEN 'services'
            WHEN subcategory IN ('school','university')                              THEN 'education'
            WHEN subcategory IN ('hotel')                                            THEN 'hospitality'
            WHEN subcategory IN ('mosque','church')                                  THEN 'religion'
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
                print(f"  API status: {status}")
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
                    "place_id": pid,
                    "name": place.get("name"),
                    "category": broad_category,   # broad group (food, health, etc.)
                    "subcategory": subcategory,    # specific type (cafe, clinic, etc.)
                    "address": place.get("formatted_address"),
                    "rating": place.get("rating"),
                    "reviews_count": place.get("user_ratings_total"),
                    "lat": lat,
                    "lng": lng,
                })

            next_token = res.get("next_page_token")
            if not next_token:
                break
            time.sleep(2)
            params = {"pagetoken": next_token, "key": API_KEY}

        except Exception as e:
            print(f"  Request error: {e}")
            break

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
        print(f"  [embedder] skipped: {e}")
        for p in places:
            p["embedding"] = None

    conn = get_db()
    cur = conn.cursor()
    saved = 0
    for place in places:
        try:
            cur.execute("""
                INSERT INTO jordan_places
                    (place_id, name, category, subcategory, address, rating, reviews_count, lat, lng, search_text, embedding)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::vector)
                ON CONFLICT (place_id) DO UPDATE SET
                    category      = EXCLUDED.category,
                    subcategory   = EXCLUDED.subcategory,
                    rating        = EXCLUDED.rating,
                    reviews_count = EXCLUDED.reviews_count,
                    search_text   = EXCLUDED.search_text,
                    embedding     = EXCLUDED.embedding
            """, (
                place["place_id"], place["name"], place["category"],
                place.get("subcategory"), place["address"],
                place["rating"], place["reviews_count"],
                place["lat"], place["lng"],
                place.get("search_text"), place.get("embedding")
            ))
            saved += 1
        except Exception as e:
            print(f"  Error saving {place.get('name')}: {e}")
    conn.commit()
    cur.close()
    conn.close()
    return saved


def run():
    print("Setting up jordan_places table...")
    setup_table()
    total = 0
    seen_queries = set()
    for subcategory, query in SEARCH_QUERIES:
        if query in seen_queries:
            continue
        seen_queries.add(query)
        broad = CATEGORY_MAP.get(subcategory, subcategory)
        print(f"Searching: '{query}' [{broad} › {subcategory}]...")
        places = text_search(query, subcategory)
        saved = save_places(places)
        print(f"  → Found {len(places)}, saved {saved}")
        total += saved
        time.sleep(1)
    print(f"Google Maps done. Total saved: {total}")


if __name__ == "__main__":
    run()
