import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))


def get_db():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def setup_table():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS jordan_companies (
            id SERIAL PRIMARY KEY,
            name TEXT,
            industry TEXT,
            location TEXT,
            description TEXT,
            url TEXT UNIQUE,
            scraped_at TIMESTAMP DEFAULT NOW()
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


def run():
    print("Setting up jordan_companies table...")
    setup_table()
    print("LinkedIn blocked — skipping. Companies covered by Google Maps data.")


if __name__ == "__main__":
    run()
