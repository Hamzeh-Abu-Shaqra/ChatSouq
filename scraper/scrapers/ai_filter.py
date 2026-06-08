import os
import json
import anthropic
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """You are a data quality and compliance filter for ChatSouq, a business listing database for Amman, Jordan.
You will receive a scraped business or product listing as JSON. Your job is to evaluate it and return a structured decision: INCLUDE or EXCLUDE, with a reason.
Be strict. When in doubt, exclude.

STEP 1 — GEOGRAPHIC FILTER
EXCLUDE if any of the following are true:
- City, address, or location is not in Amman, Jordan
- Location is in another Jordanian city (Irbid, Zarqa, Aqaba, Petra, Madaba, Salt, Karak, Mafraq, Jerash, Ajloun, Ramtha, Wadi Musa)
- Location is outside Jordan entirely (Dubai, Beirut, Cairo, Riyadh, London, etc.)
- Address contains "Jordan" but no Amman-specific neighborhood or district
- Coordinates (lat/lng) fall outside Amman's bounding box: Latitude 31.70N to 32.10N, Longitude 35.75E to 36.05E
- Location is listed as "online only" with no physical Amman address
- Location is a P.O. box with no street address

INCLUDE only if the listing is confirmed to be physically located in or delivering from Amman.
Valid Amman neighborhoods (non-exhaustive): Abdoun, Weibdeh, Sweifieh, Mecca Street, Tla'a Al-Ali, Khalda, Gardens, Shmeisani, Jabal Amman, Rabieh, Um Uthaina, Dabouq, Deir Ghbar, Wadi Saqra, Downtown (Balad), Jabal Hussein, Jubeiha, Sweileh, Marka, Sahab, Zarqa Road area, Airport Road area, Tabarbour, Naour, Abu Nsair.

STEP 2 — SPAM AND FAKE LISTING FILTER
EXCLUDE if any of the following are true:
- Business name contains excessive special characters, emojis, or ALL CAPS spam patterns
- Business name is a generic keyword string (e.g., "Best Restaurant Amman Cheap Food Delivery")
- Phone number does not match Jordanian format (+962 or 07x / 06x)
- Description is copy-pasted SEO filler with no real business information
- Multiple listings share the exact same phone number with different business names
- Rating is suspiciously perfect (5.0 from 1-3 reviews only)
- Review count is implausibly high for a local Amman business (more than 10,000 reviews on a small shop)
- Listing was clearly auto-generated or templated with placeholder text

STEP 3 — IRRELEVANT CATEGORY FILTER
EXCLUDE:
- Political parties, embassies, consulates, government ministries
- Military installations or security services
- Religious institutions unless they offer commercial services
- Cemeteries, funeral services
- Vacant lots, construction sites, undeveloped land
- ATMs or individual bank branches without broader service offering
- Wholesale-only suppliers with no retail or consumer offering
- Industrial factories or manufacturing plants not open to consumers
- Duplicate sub-entries of a parent business (e.g., "McDonald's — Cashier Counter 2")

INCLUDE all consumer-facing retail, food, services, experiences, health, wellness, beauty, electronics, home, fashion, sports, entertainment, and tourism businesses.

STEP 4 — DATA QUALITY FILTER
EXCLUDE if any of the following are true:
- Business name is missing or blank
- No contact information exists (no phone, no WhatsApp, no website, no Instagram)
- Address is too vague to locate ("Amman, Jordan" with nothing else)
- Price information is clearly incorrect (e.g., a meal at 0.01 JOD or 50,000 JOD)
- Description is fewer than 10 words or is a single repeated character
- Category field is missing or set to "Other" with no subcategory
- Listing is clearly a test entry (name = "test", "asdf", "123", "sample business")
- Last updated date is more than 3 years ago with no verification

STEP 5 — COPYRIGHT AND IP COMPLIANCE
HARD EXCLUDE: scraped photos/images (store URLs only, never re-host), full verbatim user reviews copied from Google/TripAdvisor/Zomato, verbatim product descriptions over 50 words copied word-for-word.
FLAG FOR REWRITE: descriptions 15-50 words copied verbatim, menu text, promotional copy.
SAFE TO STORE: name, address, phone, email, website URL, opening hours, price range, category, GPS coordinates, aggregate rating score (number only), review count (number only).

OUTPUT FORMAT — respond with ONLY valid JSON, no extra text:
{
  "decision": "INCLUDE" | "EXCLUDE" | "FLAG",
  "reason": "Short explanation of the primary reason for the decision",
  "failed_checks": ["list", "of", "failed", "filter", "steps"],
  "copyright_issues": ["list any copyright flags or empty array"],
  "confidence": "high" | "medium" | "low",
  "suggested_action": "store" | "rewrite_description" | "verify_location" | "manual_review" | "discard"
}

Be strict. A clean database of 500 verified Amman businesses is worth more than a polluted database of 5,000 unverified ones."""


def evaluate_listing(listing: dict) -> dict:
    """
    Send a listing to Claude for AI-based filtering.
    Returns full evaluation with decision, reason, failed_checks, copyright_issues, confidence, suggested_action.
    """
    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Evaluate this listing:\n{json.dumps(listing, ensure_ascii=False, indent=2)}"
                }
            ]
        )
        response_text = message.content[0].text.strip()
        # Strip markdown code blocks if present
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        result = json.loads(response_text.strip())
        return result
    except Exception as e:
        print(f"AI filter error: {e}")
        return {
            "decision": "INCLUDE",
            "reason": "AI filter unavailable — defaulting to include",
            "failed_checks": [],
            "copyright_issues": [],
            "confidence": "low",
            "suggested_action": "manual_review"
        }


def filter_listings(listings: list) -> list:
    """
    Run all listings through the AI filter.
    Returns only listings with decision INCLUDE or FLAG.
    """
    kept = []
    excluded = 0

    for listing in listings:
        result = evaluate_listing(listing)
        decision = result.get("decision", "EXCLUDE")
        action = result.get("suggested_action", "discard")

        if decision == "EXCLUDE" or action == "discard":
            excluded += 1
            print(f"  ✗ EXCLUDED: {listing.get('name', 'unknown')} — {result.get('reason', '')}")
        else:
            listing["ai_flag"] = result.get("suggested_action")
            listing["ai_confidence"] = result.get("confidence")
            listing["ai_reason"] = result.get("reason")
            listing["copyright_issues"] = result.get("copyright_issues", [])
            kept.append(listing)
            status = "⚑ FLAGGED" if decision == "FLAG" else "✓ INCLUDED"
            print(f"  {status}: {listing.get('name', 'unknown')}")

    print(f"  AI filter: kept {len(kept)}, excluded {excluded}")
    return kept
