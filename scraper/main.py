import os
import sys
import time
import traceback
from datetime import datetime

print("=== ChatSouq Scraper Starting ===", flush=True)
print(f"Python version: {sys.version}", flush=True)

try:
    from dotenv import load_dotenv
    load_dotenv()
    print("dotenv loaded", flush=True)
except Exception as e:
    print(f"dotenv error: {e}", flush=True)

db_url = os.getenv("DATABASE_URL")
gmaps_key = os.getenv("GOOGLE_MAPS_API_KEY")
anthropic_key = os.getenv("ANTHROPIC_API_KEY")

print(f"DATABASE_URL set: {bool(db_url)}", flush=True)
print(f"GOOGLE_MAPS_API_KEY set: {bool(gmaps_key)}", flush=True)
print(f"ANTHROPIC_API_KEY set: {bool(anthropic_key)}", flush=True)

if not db_url:
    print("FATAL: DATABASE_URL is not set. Exiting.", flush=True)
    sys.exit(1)

# ── Import scrapers ──────────────────────────────────────────────────────────
print("Importing scrapers...", flush=True)

def try_import(name, import_fn):
    try:
        fn = import_fn()
        print(f"  {name} OK", flush=True)
        return fn
    except Exception as e:
        print(f"  {name} FAILED: {e}", flush=True)
        traceback.print_exc()
        return None

run_news     = try_import("jordan_news",     lambda: __import__("scrapers.jordan_news",     fromlist=["run"]).run)
run_maps     = try_import("google_maps",     lambda: __import__("scrapers.google_maps",     fromlist=["run"]).run)
run_talabat  = try_import("talabat",         lambda: __import__("scrapers.talabat",         fromlist=["run"]).run)
run_opensooq = try_import("opensooq",        lambda: __import__("scrapers.opensooq",        fromlist=["run"]).run)
run_people   = try_import("people",          lambda: __import__("scrapers.people",          fromlist=["run"]).run)
run_verify   = try_import("verify_places",   lambda: __import__("scrapers.verify_places",   fromlist=["run"]).run)

# ── Interval config (seconds) ────────────────────────────────────────────────
# Quality-first: each scraper runs only as often as its data meaningfully changes.
# Running too often wastes API credits and fills the DB with duplicate noise.
INTERVALS = {
    "News":             30 * 60,    # 30 min  — RSS feeds update ~hourly; 30min is plenty
    "Talabat":           8 * 3600,  # 8 hours — restaurant menus don't change daily
    "OpenSooq":         24 * 3600,  # 24 hours — listings cycle daily, not hourly
    "Google Maps":      48 * 3600,  # 48 hours — place data is stable; API costs money
    "People":            7 * 86400, # 7 days  — professional directory changes slowly
    "LinkedIn":         30 * 86400, # 30 days — skipped anyway; placeholder
    # Freshness verifier: runs every 6 hours, verifies BATCH_SIZE=50 places/run.
    # This means 200 verifications/day — enough to cycle through ~6 000 places/month.
    # Uses GOOGLE_MAPS_API_KEY (same key as google_maps scraper).
    "Verify Places":     6 * 3600,  # 6 hours — freshness verification
}

SCRAPERS = [
    ("News",            run_news),
    ("Google Maps",     run_maps),
    ("Talabat",         run_talabat),
    ("OpenSooq",        run_opensooq),
    ("People",          run_people),
    ("Verify Places",   run_verify),
]
SCRAPERS = [(name, fn) for name, fn in SCRAPERS if fn is not None]

print(f"\nLoaded {len(SCRAPERS)} scrapers: {[s[0] for s in SCRAPERS]}", flush=True)
print("Intervals:", {k: f"{v//60}min" for k, v in INTERVALS.items()}, flush=True)

# ── Main loop ────────────────────────────────────────────────────────────────
last_run: dict = {}   # name → timestamp of last successful run

cycle = 0
while True:
    cycle += 1
    now = time.time()
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Tick #{cycle}", flush=True)

    for name, scraper in SCRAPERS:
        interval = INTERVALS.get(name, 3600)
        last = last_run.get(name, 0)
        due_in = max(0, int((last + interval - now) / 60))

        if now - last < interval:
            print(f"  ⏭  {name} — next in {due_in}min", flush=True)
            continue

        print(f"\n>>> [{datetime.now().strftime('%H:%M:%S')}] Running {name}...", flush=True)
        try:
            scraper()
            last_run[name] = time.time()
        except Exception as e:
            print(f"!!! {name} failed: {e}", flush=True)
            traceback.print_exc()

    print("\nSleeping 60s...", flush=True)
    time.sleep(60)
