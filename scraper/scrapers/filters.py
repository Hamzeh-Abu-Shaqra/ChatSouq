# ============================================
# ChatSouq Scraper - Amman MVP Exclusion Filters
# ============================================

# --- LOCATION FILTERS ---
# Only keep results in Amman
ALLOWED_LOCATIONS = [
    "amman", "عمان", "al-abdali", "abdali", "sweifieh", "sweifiyyeh",
    "khalda", "shmeisani", "jabal amman", "downtown amman", "wadi seer",
    "tla al ali", "mecca street", "zahran", "gardens", "jubeiha",
    "al-rabiyeh", "rabieh", "um uthaina", "medina street", "airport road",
    "zarqa road", "salt road", "aqaba road"
]

EXCLUDED_LOCATIONS = [
    "irbid", "aqaba", "zarqa", "salt", "madaba", "jerash", "ajloun",
    "karak", "tafileh", "maan", "mafraq", "balqa",
    # Neighboring countries
    "israel", "palestine", "west bank", "gaza", "saudi", "riyadh",
    "dubai", "abu dhabi", "kuwait", "beirut", "lebanon", "syria",
    "damascus", "cairo", "egypt", "iraq", "baghdad"
]

# --- CATEGORY EXCLUSIONS ---
# Categories that add noise with no business value
EXCLUDED_CATEGORIES = [
    "political_party", "embassy", "transit_station", "bus_station",
    "cemetery", "storage", "moving_company", "travel_agency",
    "rv_park", "campground"
]

# --- KEYWORD BLACKLIST ---
# Keywords in titles/names that indicate spam or irrelevant content
EXCLUDED_KEYWORDS = [
    # Spam patterns
    "test", "testing", "dummy", "fake", "sample", "example",
    "xxx", "adult", "escort", "casino", "gambling", "betting",
    # Off-topic
    "israel", "zionist", "occupation",
    # Low quality
    "coming soon", "closed permanently", "permanently closed",
    "under construction", "not available",
    # Non-Jordan chains with no presence
    "walmart", "costco", "whole foods", "trader joe",
]

# --- URL BLACKLIST ---
BLACKLISTED_DOMAINS = [
    "yellowpages.com",      # US version
    "yelp.com",             # Not Jordan
    "tripadvisor.com",      # Covered by Google Maps
    "booking.com",          # Hotels only, covered elsewhere
    "airbnb.com",
]

# --- LANGUAGE FILTERS ---
# Scripts that indicate non-Jordan content
# Keep Arabic and English only
EXCLUDED_SCRIPTS = [
    "hebrew",   # א-ת
    "cyrillic", # Russian etc
    "chinese",
    "japanese",
    "korean"
]

# Hebrew unicode range check
def is_hebrew(text):
    if not text:
        return False
    return any('א' <= c <= 'ת' for c in text)

def is_cyrillic(text):
    if not text:
        return False
    return any('Ѐ' <= c <= 'ӿ' for c in text)

# --- QUALITY FILTERS ---
MIN_TITLE_LENGTH = 3
MAX_TITLE_LENGTH = 200
MIN_RATING_COUNT = 0  # Allow unrated businesses

# --- DUPLICATE DETECTION ---
def normalize_name(name):
    if not name:
        return ""
    return name.lower().strip().replace("-", " ").replace("_", " ")

# --- MAIN FILTER FUNCTION ---
def is_valid(item):
    """
    Returns True if the item should be kept, False if it should be excluded.
    item = dict with keys: name, location, category, url
    """
    name = item.get("name", "") or ""
    location = item.get("location", "") or ""
    category = item.get("category", "") or ""
    url = item.get("url", "") or ""

    # Check title length
    if len(name) < MIN_TITLE_LENGTH or len(name) > MAX_TITLE_LENGTH:
        return False

    # Check excluded keywords in name
    name_lower = name.lower()
    for keyword in EXCLUDED_KEYWORDS:
        if keyword in name_lower:
            return False

    # Check Hebrew or Cyrillic script
    if is_hebrew(name) or is_cyrillic(name):
        return False

    # Check excluded locations
    location_lower = location.lower()
    for excluded in EXCLUDED_LOCATIONS:
        if excluded in location_lower:
            return False

    # Check blacklisted domains in URL
    for domain in BLACKLISTED_DOMAINS:
        if domain in url:
            return False

    # Check excluded categories
    if category.lower() in EXCLUDED_CATEGORIES:
        return False

    return True


def is_amman(location):
    """Check if a location string is in Amman."""
    if not location:
        return False
    location_lower = location.lower()
    # Must contain amman or known Amman neighborhoods
    return any(loc in location_lower for loc in ALLOWED_LOCATIONS)
