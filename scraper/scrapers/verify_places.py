"""
verify_places.py — ChatSouq freshness verifier

Background job that keeps `places` and `jordan_places` rows up-to-date with:
  1. Google Places API  → business_status, rating, reviews_count, latest_review_at
  2. HTTP HEAD check    → website_alive / website_checked_at

Priority queue: oldest `status_checked_at` first, filtered by a per-category
re-check interval (restaurants every 2 weeks, hospitals every 3 months, etc.).

Writes back to both tables:
  • places          — uses the freshness columns added in the Drizzle migration
  • jordan_places   — only rating / reviews_count / scraped_at (no freshness cols yet)

Runs as a scheduled job from main.py (every 6 hours).
Each run processes at most `BATCH_SIZE` places to stay within API quota.
"""

import os
import time
import logging
import traceback
from datetime import datetime, timezone
from typing import Optional
import psycopg2
import psycopg2.extras

try:
    import requests
except ImportError:
    requests = None  # type: ignore

try:
    import googlemaps
except ImportError:
    googlemaps = None  # type: ignore

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

BATCH_SIZE = 50          # max places to verify per run (stay within API quota)
WEBSITE_TIMEOUT = 6      # seconds for HTTP HEAD request
WEBSITE_FOLLOW_REDIRECTS = True
GMAPS_TIMEOUT = 5        # seconds for Google Places call

# Per-category re-check interval in days.
# Lower = checked more often (data changes faster).
CATEGORY_RECHECK_DAYS: dict[str, int] = {
    # Food & drink
    "restaurant":   14,
    "food":         14,
    "cafe":         14,
    "coffee":       14,
    "fast_food":    14,
    "bakery":       14,
    "juice_bar":    14,
    "dessert":      14,
    # Nightlife
    "bar":          14,
    "nightclub":    14,
    "cinema":       30,
    "entertainment": 30,
    # Health & fitness
    "gym":          30,
    "fitness":      30,
    "spa":          30,
    "salon":        30,
    "barbershop":   30,
    "beauty":       30,
    "clinic":       60,
    "pharmacy":     30,
    "hospital":     90,
    "dentist":      60,
    "physiotherapy": 60,
    # Shopping & services
    "supermarket":  30,
    "shopping":     30,
    "services":     30,
    "mall":         60,
    "hotel":        60,
    "hospitality":  60,
    # Education & civic
    "school":       90,
    "university":   90,
    "education":    90,
    "mosque":       180,
    "church":       180,
    "religion":     180,
    "bank":         90,
    "government":   90,
    "atm":          60,
}
DEFAULT_RECHECK_DAYS = 60


def get_db():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def _recheck_interval(category: Optional[str]) -> int:
    if not category:
        return DEFAULT_RECHECK_DAYS
    cat = category.lower().replace(" ", "_")
    return CATEGORY_RECHECK_DAYS.get(cat, DEFAULT_RECHECK_DAYS)


# ── DB migration ───────────────────────────────────────────────────────────────

def ensure_columns(conn):
    """
    Add freshness columns to places and jordan_places if not already present.
    Safe to call on every startup (uses ADD COLUMN IF NOT EXISTS).
    """
    cur = conn.cursor()
    places_stmts = [
        "ALTER TABLE places ADD COLUMN IF NOT EXISTS rating              FLOAT",
        "ALTER TABLE places ADD COLUMN IF NOT EXISTS reviews_count       INT",
        "ALTER TABLE places ADD COLUMN IF NOT EXISTS business_status     TEXT",
        "ALTER TABLE places ADD COLUMN IF NOT EXISTS status_checked_at   TIMESTAMPTZ",
        "ALTER TABLE places ADD COLUMN IF NOT EXISTS website_alive       BOOLEAN",
        "ALTER TABLE places ADD COLUMN IF NOT EXISTS website_checked_at  TIMESTAMPTZ",
        "ALTER TABLE places ADD COLUMN IF NOT EXISTS latest_review_at    TIMESTAMPTZ",
        "ALTER TABLE places ADD COLUMN IF NOT EXISTS scraped_at          TIMESTAMPTZ",
        "ALTER TABLE places ADD COLUMN IF NOT EXISTS consecutive_failures INT DEFAULT 0",
    ]
    jordan_stmts = [
        "ALTER TABLE jordan_places ADD COLUMN IF NOT EXISTS reviews_count INT",
        # business_status / website columns are on `places` only for now;
        # jordan_places already has rating + scraped_at from google_maps.py
    ]
    for stmt in places_stmts + jordan_stmts:
        try:
            cur.execute(stmt)
        except Exception as e:
            logger.warning("ensure_columns skipped: %s — %s", stmt[:60], e)
            conn.rollback()
    conn.commit()
    cur.close()


# ── Google Places helpers ──────────────────────────────────────────────────────

def _gmaps_client():
    key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not key or not googlemaps:
        return None
    return googlemaps.Client(key=key, timeout=GMAPS_TIMEOUT)


def _search_place(client, name: str, city: str = "Amman") -> Optional[dict]:
    """
    Text-search Google Places for the place by name + city.
    Returns the first result's details or None.
    """
    try:
        results = client.find_place(
            input=f"{name} {city} Jordan",
            input_type="textquery",
            fields=["place_id", "name", "business_status",
                    "rating", "user_ratings_total", "geometry"],
            language="en",
        )
        candidates = results.get("candidates", [])
        if not candidates:
            return None
        place_id = candidates[0]["place_id"]
        # Fetch full details including reviews
        details = client.place(
            place_id=place_id,
            fields=["business_status", "rating", "user_ratings_total",
                    "reviews", "opening_hours"],
            language="en",
        )
        return details.get("result")
    except Exception as e:
        logger.debug("Google Places search failed for '%s': %s", name, e)
        return None


def _latest_review_time(place_result: dict) -> Optional[datetime]:
    """Return the most recent review timestamp from a Google Places result."""
    reviews = place_result.get("reviews", [])
    if not reviews:
        return None
    times = [r.get("time") for r in reviews if r.get("time")]
    if not times:
        return None
    latest_ts = max(times)  # Unix timestamp int
    return datetime.fromtimestamp(latest_ts, tz=timezone.utc)


# ── Website liveness ───────────────────────────────────────────────────────────

def _check_website(url: str) -> bool:
    """
    HEAD request to url. Returns True if status is 2xx or 3xx.
    Falls back to GET if HEAD is not allowed (405 / 501).
    Treats connection errors and timeouts as False.
    """
    if not requests:
        return False
    try:
        headers = {"User-Agent": "Mozilla/5.0 ChatSouq-verifier/1.0"}
        resp = requests.head(
            url, headers=headers,
            timeout=WEBSITE_TIMEOUT,
            allow_redirects=WEBSITE_FOLLOW_REDIRECTS,
        )
        if resp.status_code in (405, 501):
            resp = requests.get(
                url, headers=headers,
                timeout=WEBSITE_TIMEOUT,
                allow_redirects=WEBSITE_FOLLOW_REDIRECTS,
                stream=True,
            )
        return 200 <= resp.status_code < 400
    except Exception:
        return False


# ── Main verify loop ──────────────────────────────────────────────────────────

def _build_priority_query(table: str, id_field: str = "id") -> str:
    """
    Build a SQL query that picks the next BATCH_SIZE rows due for re-check.
    Priority: NULL status_checked_at first, then oldest, filtered by
    per-category recheck interval via a CASE expression.
    """
    # We build a CASE expression for the interval. Rows that haven't reached
    # their recheck interval yet are excluded.
    # For jordan_places the status_checked_at column doesn't exist — we use
    # scraped_at as a proxy and only run website checks.
    if table == "places":
        return f"""
            SELECT {id_field}, name, category, website,
                   status_checked_at, consecutive_failures
            FROM {table}
            WHERE status_checked_at IS NULL
               OR (NOW() - status_checked_at) > (
                    INTERVAL '1 day' * CASE
                        WHEN lower(category) IN ('restaurant','food','cafe','coffee',
                             'fast_food','bakery','juice_bar','dessert','bar','nightclub')
                             THEN 14
                        WHEN lower(category) IN ('cinema','entertainment','gym','fitness',
                             'spa','salon','barbershop','beauty','pharmacy','supermarket',
                             'shopping','services','nightclub')
                             THEN 30
                        WHEN lower(category) IN ('clinic','dentist','physiotherapy',
                             'mall','hotel','hospitality','atm')
                             THEN 60
                        ELSE 90
                    END
               )
            ORDER BY status_checked_at ASC NULLS FIRST
            LIMIT {BATCH_SIZE}
        """
    else:
        # jordan_places — only website check; use scraped_at as proxy
        return f"""
            SELECT {id_field} AS id, name, category, website, scraped_at
            FROM {table}
            WHERE website IS NOT NULL
              AND (
                scraped_at IS NULL
                OR (NOW() - scraped_at) > INTERVAL '30 days'
              )
            ORDER BY scraped_at ASC NULLS FIRST
            LIMIT {BATCH_SIZE}
        """


def verify_osm_places(conn, gmaps_client) -> int:
    """
    Verify `places` rows: Google status + website liveness.
    Returns the number of rows processed.
    """
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute(_build_priority_query("places"))
    rows = cur.fetchall()
    now = datetime.now(tz=timezone.utc)
    processed = 0

    for row in rows:
        place_id   = row["id"]
        name       = row["name"]
        website    = row["website"]
        failures   = row["consecutive_failures"] or 0

        gdata        = None
        business_status    = None
        rating             = None
        reviews_count      = None
        latest_review_at   = None
        website_alive      = None

        # ── Google Places lookup ─────────────────────────────────────────────
        if gmaps_client:
            gdata = _search_place(gmaps_client, name)
            if gdata:
                business_status  = gdata.get("business_status")
                rating           = gdata.get("rating")
                reviews_count    = gdata.get("user_ratings_total")
                latest_review_at = _latest_review_time(gdata)
                failures         = 0   # reset on success
            else:
                failures += 1

        # ── Website liveness ─────────────────────────────────────────────────
        if website:
            website_alive = _check_website(website)

        # ── Write back ───────────────────────────────────────────────────────
        try:
            cur.execute("""
                UPDATE places SET
                    business_status     = COALESCE(%s, business_status),
                    status_checked_at   = %s,
                    rating              = COALESCE(%s, rating),
                    reviews_count       = COALESCE(%s, reviews_count),
                    latest_review_at    = COALESCE(%s, latest_review_at),
                    website_alive       = COALESCE(%s, website_alive),
                    website_checked_at  = CASE WHEN %s IS NOT NULL THEN %s ELSE website_checked_at END,
                    scraped_at          = COALESCE(scraped_at, %s),
                    consecutive_failures = %s
                WHERE id = %s
            """, (
                business_status,
                now,
                rating,
                reviews_count,
                latest_review_at,
                website_alive,
                website_alive,   # condition
                now,             # website_checked_at value
                now,             # fallback scraped_at (first time only)
                failures,
                place_id,
            ))
            conn.commit()
            processed += 1
        except Exception as e:
            conn.rollback()
            logger.warning("Failed to update place %s: %s", place_id, e)

        # Throttle: 5 API calls/sec is well within Google's 50 QPS limit
        time.sleep(0.2)

    cur.close()
    return processed


def verify_jordan_places(conn) -> int:
    """
    Verify `jordan_places` website liveness only (no Google Places re-lookup —
    jordan_places already comes from Google Maps scraper).
    Returns the number of rows processed.
    """
    if not requests:
        return 0

    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute(_build_priority_query("jordan_places"))
    rows = cur.fetchall()
    now = datetime.now(tz=timezone.utc)
    processed = 0

    for row in rows:
        place_id = row["id"]
        website  = row["website"]
        if not website:
            continue

        alive = _check_website(website)
        try:
            # jordan_places doesn't have website_alive column — only update scraped_at
            # as a "we checked recently" marker so it doesn't re-queue immediately
            cur.execute(
                "UPDATE jordan_places SET scraped_at = %s WHERE id = %s",
                (now, place_id),
            )
            conn.commit()
            processed += 1
        except Exception as e:
            conn.rollback()
            logger.warning("Failed to update jordan_places %s: %s", place_id, e)

        time.sleep(0.05)  # light throttle for HTTP-only

    cur.close()
    return processed


# ── Entry point ────────────────────────────────────────────────────────────────

def run():
    """
    Called by main.py scheduler every 6 hours.
    Runs one batch of freshness verification across both tables.
    """
    logger.info("[verify_places] Starting freshness verification run")
    start = time.time()

    try:
        conn = get_db()
    except Exception as e:
        logger.error("[verify_places] DB connection failed: %s", e)
        return

    try:
        ensure_columns(conn)
        gmaps = _gmaps_client()
        if not gmaps:
            logger.warning("[verify_places] GOOGLE_MAPS_API_KEY not set — skipping Google Places lookup")

        osm_count = verify_osm_places(conn, gmaps)
        jp_count  = verify_jordan_places(conn)

        elapsed = time.time() - start
        logger.info(
            "[verify_places] Done in %.1fs — OSM places: %d verified, jordan_places: %d website-checked",
            elapsed, osm_count, jp_count,
        )
    except Exception as e:
        logger.error("[verify_places] Unexpected error: %s\n%s", e, traceback.format_exc())
    finally:
        conn.close()
