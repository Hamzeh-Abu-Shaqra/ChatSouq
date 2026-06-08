import os
import sys
import time
import traceback

print("=== ChatSouq Scraper Starting ===", flush=True)
print(f"Python version: {sys.version}", flush=True)

# Load env
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("dotenv loaded", flush=True)
except Exception as e:
    print(f"dotenv error: {e}", flush=True)

# Check env vars
db_url = os.getenv("DATABASE_URL")
gmaps_key = os.getenv("GOOGLE_MAPS_API_KEY")
anthropic_key = os.getenv("ANTHROPIC_API_KEY")

print(f"DATABASE_URL set: {bool(db_url)}", flush=True)
print(f"GOOGLE_MAPS_API_KEY set: {bool(gmaps_key)}", flush=True)
print(f"ANTHROPIC_API_KEY set: {bool(anthropic_key)}", flush=True)

if not db_url:
    print("FATAL: DATABASE_URL is not set. Exiting.", flush=True)
    sys.exit(1)

# Import scrapers
print("Importing scrapers...", flush=True)
try:
    from scrapers.jordan_news import run as run_news
    print("  jordan_news OK", flush=True)
except Exception as e:
    print(f"  jordan_news FAILED: {e}", flush=True)
    traceback.print_exc()

try:
    from scrapers.google_maps import run as run_maps
    print("  google_maps OK", flush=True)
except Exception as e:
    print(f"  google_maps FAILED: {e}", flush=True)
    traceback.print_exc()

try:
    from scrapers.talabat import run as run_talabat
    print("  talabat OK", flush=True)
except Exception as e:
    print(f"  talabat FAILED: {e}", flush=True)
    traceback.print_exc()

try:
    from scrapers.opensooq import run as run_opensooq
    print("  opensooq OK", flush=True)
except Exception as e:
    print(f"  opensooq FAILED: {e}", flush=True)
    traceback.print_exc()

try:
    from scrapers.linkedin import run as run_linkedin
    print("  linkedin OK", flush=True)
except Exception as e:
    print(f"  linkedin FAILED: {e}", flush=True)
    traceback.print_exc()

SCRAPERS = []
for name, var in [("Google Maps", "run_maps"), ("Talabat", "run_talabat"),
                   ("OpenSooq", "run_opensooq"), ("LinkedIn", "run_linkedin"),
                   ("Roya News", "run_news")]:
    if var in dir():
        SCRAPERS.append((name, eval(var)))

print(f"\nLoaded {len(SCRAPERS)} scrapers: {[s[0] for s in SCRAPERS]}", flush=True)

def run_all(cycle):
    print(f"\n{'='*50}", flush=True)
    print(f"CYCLE {cycle}", flush=True)
    print(f"{'='*50}", flush=True)
    for name, scraper in SCRAPERS:
        try:
            print(f">>> Running {name}...", flush=True)
            scraper()
        except Exception as e:
            print(f"!!! {name} failed: {e}", flush=True)
            traceback.print_exc()
    print(f"Cycle {cycle} complete.", flush=True)

# Run continuously
cycle = 1
while True:
    run_all(cycle)
    cycle += 1
    print("Cooling down 60s...", flush=True)
    time.sleep(60)
