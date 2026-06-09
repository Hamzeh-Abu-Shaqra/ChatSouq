/**
 * IP-based geolocation for ChatSouq.
 *
 * Privacy rules:
 *   - Only city/country is fetched — raw IP is never stored locally or logged
 *   - Result cached in localStorage for 24 hours (chatsouq_ip_location)
 *   - History / query data is NEVER sent to IP geolocation APIs
 *   - No client-side console.log of location data
 *
 * Primary: ipapi.co (free, 1k req/day)
 * Fallback: ip-api.com (free, 45 req/min)
 */

import type { LocationContext } from "@chatsouq/core";

const CACHE_KEY = "chatsouq_ip_location";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedIpLocation {
  result: IpLocationData;
  cachedAt: number;
}

interface IpLocationData {
  country: string | null;   // ISO 2-letter, e.g. "JO"
  city: string | null;      // e.g. "Amman"
  region: string | null;    // e.g. "Amman Governorate"
}

// Known Jordanian city → canonical governorate mapping
const JORDAN_CITY_GOVERNORATE: Record<string, string> = {
  amman: "Amman",
  zarqa: "Zarqa",
  irbid: "Irbid",
  aqaba: "Aqaba",
  karak: "Karak",
  madaba: "Madaba",
  mafraq: "Mafraq",
  jerash: "Jerash",
  ajloun: "Ajloun",
  salt: "Balqa",
  "al-salt": "Balqa",
  tafilah: "Tafilah",
  maan: "Maan",
};

async function fetchFromIpApi(): Promise<IpLocationData | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { country_code?: string; city?: string; region?: string };
    return {
      country: data.country_code ?? null,
      city: data.city ?? null,
      region: data.region ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchFromIpApiCom(): Promise<IpLocationData | null> {
  // ip-api.com free tier is HTTP-only; HTTPS requires a paid plan.
  // Modern browsers block HTTP requests from HTTPS pages (mixed content).
  // This fallback is intentionally disabled — ipapi.co (HTTPS) is the primary.
  return null;
}

/**
 * Returns an IP-based LocationContext or null if geolocation fails / is outside Jordan.
 * Caches the result in localStorage for 24 hours.
 */
export async function getIpLocationContext(): Promise<LocationContext | null> {
  if (typeof window === "undefined") return null;

  // Check cache
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed: CachedIpLocation = JSON.parse(cached);
      if (Date.now() - parsed.cachedAt < CACHE_TTL_MS) {
        return buildLocationContext(parsed.result);
      }
    }
  } catch {
    // Ignore parse errors
  }

  // Fetch — primary then fallback
  let data = await fetchFromIpApi();
  if (!data) data = await fetchFromIpApiCom();
  if (!data) return null;

  // Store in cache (no raw IP, only city/country)
  try {
    const cached: CachedIpLocation = { result: data, cachedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore storage errors
  }

  return buildLocationContext(data);
}

function buildLocationContext(data: IpLocationData): LocationContext | null {
  // Only return a meaningful location if the user is in Jordan
  if (data.country && data.country.toUpperCase() !== "JO") {
    // Outside Jordan — don't inject a false location
    return null;
  }

  const cityLower = (data.city ?? "").toLowerCase();
  const governorate = JORDAN_CITY_GOVERNORATE[cityLower] ?? (data.country === "JO" ? "Amman" : null);

  return {
    source: "ip",
    neighborhood: null, // IP geo is city-level, not neighbourhood-level
    governorate,
    lat: null,
    lng: null,
    accuracyM: null,
  };
}
