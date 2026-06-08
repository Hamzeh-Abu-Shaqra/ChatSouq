import schedule
import time
from scrapers.jordan_news import run as run_news
from scrapers.google_maps import run as run_maps
from scrapers.talabat import run as run_talabat
from scrapers.opensooq import run as run_opensooq
from scrapers.linkedin import run as run_linkedin

def run_all():
    print("=" * 50)
    print("Starting all Jordan scrapers...")
    print("=" * 50)
    run_news()
    run_maps()
    run_talabat()
    run_opensooq()
    run_linkedin()
    print("=" * 50)
    print("All scrapers done.")
    print("=" * 50)

# Run immediately on start
run_all()

# Then run every 6 hours
schedule.every(6).hours.do(run_all)

print("Scheduler running — scraping every 6 hours...")
while True:
    schedule.run_pending()
    time.sleep(60)
