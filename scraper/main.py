import os
import time
from dotenv import load_dotenv
load_dotenv()

# Debug env vars on startup
print("ENV CHECK:")
print(f"  DATABASE_URL set: {bool(os.getenv('DATABASE_URL'))}")
print(f"  GOOGLE_MAPS_API_KEY set: {bool(os.getenv('GOOGLE_MAPS_API_KEY'))}")
print(f"  ANTHROPIC_API_KEY set: {bool(os.getenv('ANTHROPIC_API_KEY'))}")

from scrapers.jordan_news import run as run_news
from scrapers.google_maps import run as run_maps
from scrapers.talabat import run as run_talabat
from scrapers.opensooq import run as run_opensooq
from scrapers.linkedin import run as run_linkedin

SCRAPERS = [
    ("Google Maps", run_maps),
    ("Talabat", run_talabat),
    ("OpenSooq", run_opensooq),
    ("LinkedIn", run_linkedin),
    ("Roya News", run_news),
]

def run_all():
    print("=" * 50)
    print("Starting aggressive scrape cycle...")
    print("=" * 50)
    for name, scraper in SCRAPERS:
        try:
            print(f"\n>>> Running {name}...")
            scraper()
        except Exception as e:
            print(f"!!! {name} failed: {e} — continuing...")
    print("=" * 50)
    print("Cycle complete. Starting next cycle immediately...")
    print("=" * 50)

# Run continuously — no waiting between cycles
cycle = 1
while True:
    print(f"\n{'='*50}")
    print(f"CYCLE {cycle}")
    print(f"{'='*50}")
    run_all()
    cycle += 1
    # 60 second cooldown between cycles to avoid rate limits
    print("Cooling down 60s before next cycle...")
    time.sleep(60)
