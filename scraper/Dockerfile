FROM python:3.11-slim

# Only what psycopg2 needs (libpq) + SSL for HTTPS requests
RUN apt-get update && apt-get install -y \
    libpq-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "-u", "main.py"]
