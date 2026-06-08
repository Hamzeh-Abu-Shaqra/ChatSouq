"""
Collect additional Jordan entities from OpenStreetMap Overpass API —
entity types not covered by ingest-places.ts (which already queries
amenity, shop, tourism, leisure, healthcare, office).

Outputs: data/knowledge-graph/raw/osm_supplement.json
"""
import json, time, urllib.request, urllib.error
from pathlib import Path

OUT = Path("/Users/Hamzeh23/Desktop/chatsouq/data/knowledge-graph/raw/osm_supplement.json")
OVERPASS = "https://overpass-api.de/api/interpreter"

# Additional OSM keys not already ingested
EXTRA_KEYS = [
    "historic",     # castles, ruins, archaeological sites
    "man_made",     # towers, factories, landmarks
    "craft",        # workshops, artisans, bakeries
    "sport",        # stadiums, courts, sports venues
    "natural",      # springs, mountains, valleys (tourist interest)
    "aeroway",      # airports, terminals
    "emergency",    # fire stations, hospitals not tagged amenity
    "military",     # military bases (if named publicly)
    "power",        # power plants (industrial entities)
    "public_transport", # bus stations, train stops
    "railway",      # train stations
    "waterway",     # rivers, canals with named features
]

JORDAN_AREA_ID = 3600184818  # OSM relation for Jordan

def overpass_query(key: str) -> str:
    return f"""
[out:json][timeout:60];
area({JORDAN_AREA_ID})->.jo;
(
  node["{key}"]["name"](area.jo);
  way["{key}"]["name"](area.jo);
  relation["{key}"]["name"](area.jo);
);
out center tags;
"""

def get_center(el: dict) -> tuple[float | None, float | None]:
    if el["type"] == "node":
        return el.get("lat"), el.get("lon")
    c = el.get("center", {})
    return c.get("lat"), c.get("lon")

CAT_MAP = {
    "historic":        "Tourism",
    "man_made":        "Services",
    "craft":           "Services",
    "sport":           "Services",
    "natural":         "Tourism",
    "aeroway":         "Services",
    "emergency":       "Healthcare",
    "military":        "Government",
    "power":           "Government",
    "public_transport":"Services",
    "railway":         "Services",
    "waterway":        "Tourism",
}

SUBCAT_FROM_VALUE = {
    # historic
    "castle": "Castle", "ruins": "Archaeological Site", "monument": "Monument",
    "archaeological_site": "Archaeological Site", "church": "Church",
    "mosque": "Mosque", "fort": "Fort", "palace": "Palace",
    # man_made
    "tower": "Tower", "water_tower": "Utility", "factory": "Industrial",
    "bridge": "Bridge", "chimney": "Industrial",
    # craft
    "bakery": "Bakery", "jeweller": "Jeweller", "tailor": "Tailor",
    "carpenter": "Carpentry", "pottery": "Pottery",
    # sport
    "stadium": "Stadium", "swimming_pool": "Sports Facility",
    "tennis": "Sports Facility", "football": "Sports Facility",
    # natural
    "spring": "Natural Spring", "valley": "Valley", "peak": "Mountain",
    "water": "Lake/River", "beach": "Beach",
    # aeroway
    "aerodrome": "Airport", "terminal": "Airport Terminal",
    # railway
    "station": "Train Station", "halt": "Train Stop",
    # public_transport
    "station": "Transit Station", "stop_area": "Bus Stop",
}

def fetch_key(key: str) -> list[dict]:
    ql = overpass_query(key)
    data = ql.encode()
    req = urllib.request.Request(
        OVERPASS,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            result = json.loads(resp.read().decode())
        return result.get("elements", [])
    except urllib.error.URLError as e:
        print(f"  Error fetching {key}: {e}")
        return []

def el_to_entity(el: dict, key: str) -> dict | None:
    tags = el.get("tags", {})
    name = tags.get("name") or tags.get("name:en") or tags.get("name:ar")
    if not name:
        return None
    lat, lng = get_center(el)
    value = tags.get(key, "")
    subcat = SUBCAT_FROM_VALUE.get(value, value.replace("_", " ").title())

    # Collect names
    name_en = tags.get("name:en") or (name if not any(ord(c) > 127 for c in name) else None)
    name_ar = tags.get("name:ar") or (name if any(ord(c) > 127 for c in name) else None)
    if not name_en:
        name_en = name  # use whatever we have

    city = tags.get("addr:city") or tags.get("is_in:city")
    gov  = tags.get("addr:governorate") or tags.get("is_in:state")

    return {
        "name":        name_en,
        "name_en":     name_en,
        "name_ar":     name_ar,
        "category":    CAT_MAP.get(key, "Services"),
        "subcategory": subcat,
        "description": tags.get("description") or f"{subcat} in Jordan",
        "website":     tags.get("website") or tags.get("url"),
        "phone":       tags.get("phone") or tags.get("contact:phone"),
        "city":        city,
        "governorate": gov,
        "lat":         lat,
        "lng":         lng,
        "address":     tags.get("addr:full") or tags.get("addr:street"),
        "opening_hours": tags.get("opening_hours"),
        "keywords":    [key, value, subcat.lower()],
        "source":      "openstreetmap_supplement",
        "confidence":  "high",
        "osm_id":      el.get("id"),
        "osm_type":    el.get("type"),
        "osm_key":     key,
        "osm_value":   value,
    }

def main():
    print("=== OSM Supplement Collector for Jordan ===\n")
    all_entities = []
    seen_ids = set()

    for key in EXTRA_KEYS:
        print(f"Querying {key}...", end=" ", flush=True)
        elements = fetch_key(key)
        count = 0
        for el in elements:
            uid = f"{el.get('type')}/{el.get('id')}"
            if uid in seen_ids:
                continue
            seen_ids.add(uid)
            entity = el_to_entity(el, key)
            if entity:
                all_entities.append(entity)
                count += 1
        print(f"{len(elements)} elements → {count} entities")
        time.sleep(2)  # polite delay between queries

    OUT.write_text(json.dumps(all_entities, ensure_ascii=False, indent=2))
    print(f"\nTotal supplement entities: {len(all_entities)}")
    print(f"Written to: {OUT}")

if __name__ == "__main__":
    main()
