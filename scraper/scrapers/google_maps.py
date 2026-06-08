import os
import requests
import psycopg2
from dotenv import load_dotenv
from scrapers.filters import is_valid
from scrapers.ai_filter import filter_listings

load_dotenv()

API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
BASE_URL = "https://maps.googleapis.com/maps/api/place"

CATEGORIES = [
    "restaurant", "gym", "clinic", "salon", "hospital",
    "pharmacy", "school", "supermarket", "cafe", "hotel",
    "bank", "gas_station", "shopping_mall", "mosque", "university",
    "store", "spa", "dentist", "veterinary_care", "laundry",
    "car_repair", "car_wash", "electrician", "plumber", "painter",
    "bakery", "clothing_store", "electronics_store", "furniture_store",
    "jewelry_store", "shoe_store", "book_store", "florist", "pet_store"
]

# Grid of points covering all of Amman
AMMAN_GRID = [
    "31.9539,35.9106",  # City center
    "31.9800,35.9000",  # North Amman (Rabieh/Khalda)
    "31.9700,35.9300",  # East Amman
    "31.9300,35.9000",  # West Amman (Sweifieh)
    "31.9200,35.9300",  # South Amman
    "31.9600,35.8800",  # Abdoun/Shmeisani
    "32.0000,35.9200",  # Jubeiha/University
    "31.9900,35.9500",  # Marka/Zarqa road
    "31.9400,35.8900",  # Gardens/Mecca St
    "31.9100,35.9500",  # Sahab/Airport road
]

RADIUS = 3000  # 3km per point — tight grid coverage


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


def search_places(category):
    places = []
    seen_ids = set()
    url = f"{BASE_URL}/nearbysearch/json"

    for grid_point in AMMAN_GRID:
        params = {
            "location": grid_point,
            "radius": RADIUS,
            "type": category,
            "key": API_KEY
        }

        while True:
            res = requests.get(url, params=params).json()
            for place in res.get("results", []):
                pid = place.get("place_id")
                if pid and pid not in seen_ids:
                    seen_ids.add(pid)
                    places.append({
                        "place_id": pid,
                        "name": place.get("name"),
                        "category": category,
                        "address": place.get("vicinity"),
                        "rating": place.get("rating"),
                        "reviews_count": place.get("user_ratings_total"),
                        "lat": place.get("geometry", {}).get("location", {}).get("lat"),
                        "lng": place.get("geometry", {}).get("location", {}).get("lng"),
                    })

            next_token = res.get("next_page_token")
            if not next_token:
                break
            import time
            time.sleep(2)
            params = {"pagetoken": next_token, "key": API_KEY}

    return places


def get_place_details(place_id):
    url = f"{BASE_URL}/details/json"
    params = {
        "place_id": place_id,
        "fields": "formatted_phone_number,website,opening_hours",
        "key": API_KEY
    }
    res = requests.get(url, params=params).json()
    result = res.get("result", {})
    hours = result.get("opening_hours", {}).get("weekday_text", [])
    return {
        "phone": result.get("formatted_phone_number"),
        "website": result.get("website"),
        "opening_hours": ", ".join(hours) if hours else None
    }


def save_places(places):
    conn = get_db()
    cur = conn.cursor()
    saved = 0
    for place in places:
        details = get_place_details(place["place_id"])
        try:
            cur.execute("""
                INSERT INTO jordan_places (place_id, name, category, address, phone, website, rating, reviews_count, lat, lng, opening_hours)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (place_id) DO UPDATE SET
                    rating = EXCLUDED.rating,
                    reviews_count = EXCLUDED.reviews_count,
                    opening_hours = EXCLUDED.opening_hours
            """, (
                place["place_id"], place["name"], place["category"],
                place["address"], details["phone"], details["website"],
                place["rating"], place["reviews_count"],
                place["lat"], place["lng"], details["opening_hours"]
            ))
            saved += 1
        except Exception as e:
            print(f"Error saving {place['name']}: {e}")
    conn.commit()
    cur.close()
    conn.close()
    return saved


def run():
    print("Setting up jordan_places table...")
    setup_table()
    total = 0
    for category in CATEGORIES:
        print(f"Scraping {category}s in Amman...")
        places = search_places(category)
        print(f"  Running AI filter on {len(places)} results...")
        places = filter_listings(places)
        saved = save_places(places)
        print(f"  → Saved {saved} {category}s")
        total += saved
    print(f"Google Maps done. Total saved: {total}")


if __name__ == "__main__":
    run()
