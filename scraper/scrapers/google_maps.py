import os
import time
import requests
import psycopg2
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
BASE_URL = "https://maps.googleapis.com/maps/api/place"

# Text search queries — each query returns businesses matching that exact term
# Using text search ensures correct category assignment
SEARCH_QUERIES = [
    ("restaurant", "مطعم عمان"),
    ("restaurant", "restaurant Amman Jordan"),
    ("cafe", "مقهى عمان"),
    ("cafe", "cafe Amman Jordan"),
    ("gym", "نادي رياضي عمان"),
    ("gym", "gym fitness Amman Jordan"),
    ("clinic", "عيادة عمان"),
    ("clinic", "clinic Amman Jordan"),
    ("hospital", "مستشفى عمان"),
    ("hospital", "hospital Amman Jordan"),
    ("pharmacy", "صيدلية عمان"),
    ("pharmacy", "pharmacy Amman Jordan"),
    ("salon", "صالون عمان"),
    ("salon", "salon beauty Amman Jordan"),
    ("school", "مدرسة عمان"),
    ("school", "school Amman Jordan"),
    ("university", "جامعة عمان"),
    ("supermarket", "سوبرماركت عمان"),
    ("supermarket", "supermarket Amman Jordan"),
    ("bakery", "مخبز عمان"),
    ("bakery", "bakery Amman Jordan"),
    ("hotel", "فندق عمان"),
    ("hotel", "hotel Amman Jordan"),
    ("bank", "بنك عمان"),
    ("bank", "bank Amman Jordan"),
    ("dentist", "طبيب أسنان عمان"),
    ("dentist", "dentist Amman Jordan"),
    ("electronics_store", "محل الكترونيات عمان"),
    ("electronics_store", "electronics store Amman"),
    ("clothing_store", "محل ملابس عمان"),
    ("clothing_store", "clothing store Amman Jordan"),
    ("car_repair", "ميكانيكي عمان"),
    ("car_repair", "car repair garage Amman"),
    ("spa", "سبا عمان"),
    ("spa", "spa massage Amman Jordan"),
    ("jewelry_store", "محل مجوهرات عمان"),
    ("furniture_store", "محل أثاث عمان"),
    ("gas_station", "محطة وقود عمان"),
    ("gas_station", "petrol station Amman Jordan"),
    ("mosque", "مسجد عمان"),
    ("shopping_mall", "مول عمان"),
    ("shopping_mall", "mall Amman Jordan"),
    ("veterinary_care", "طبيب بيطري عمان"),
    ("pet_store", "محل حيوانات عمان"),
    ("laundry", "مغسلة عمان"),
    ("florist", "محل ورد عمان"),
    ("book_store", "مكتبة عمان"),
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
            address TEXT,
            phone TEXT,
            website TEXT,
            rating FLOAT,
            reviews_count INT,
            lat FLOAT,
            lng FLOAT,
            opening_hours TEXT,
            scraped_at TIMESTAMP DEFAULT NOW()
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


def is_in_amman(lat, lng):
    """Validate coordinates are within Amman bounding box."""
    if lat is None or lng is None:
        return False
    return AMMAN_LAT_MIN <= lat <= AMMAN_LAT_MAX and AMMAN_LNG_MIN <= lng <= AMMAN_LNG_MAX


def text_search(query, category):
    """Use Google Places Text Search for accurate results."""
    places = []
    seen_ids = set()
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

                # Strict Amman-only filter
                if not is_in_amman(lat, lng):
                    continue

                seen_ids.add(pid)
                places.append({
                    "place_id": pid,
                    "name": place.get("name"),
                    "category": category,  # Use our defined category, not Google's
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
    conn = get_db()
    cur = conn.cursor()
    saved = 0
    for place in places:
        try:
            cur.execute("""
                INSERT INTO jordan_places (place_id, name, category, address, rating, reviews_count, lat, lng)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (place_id) DO UPDATE SET
                    rating = EXCLUDED.rating,
                    reviews_count = EXCLUDED.reviews_count
            """, (
                place["place_id"], place["name"], place["category"],
                place["address"], place["rating"], place["reviews_count"],
                place["lat"], place["lng"]
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
    for category, query in SEARCH_QUERIES:
        print(f"Searching: '{query}'...")
        places = text_search(query, category)
        saved = save_places(places)
        print(f"  → Found {len(places)}, saved {saved} {category}s")
        total += saved
        time.sleep(1)
    print(f"Google Maps done. Total saved: {total}")


if __name__ == "__main__":
    run()
