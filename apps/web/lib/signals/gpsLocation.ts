/**
 * GPS-based geolocation for ChatSouq.
 *
 * Privacy rules:
 *   - Raw GPS coordinates are NEVER sent to any third-party API
 *   - Neighbourhood detection uses Haversine locally in the browser
 *   - Coordinates cached in sessionStorage only (cleared on tab close)
 *   - Do NOT log coordinates to client-side console
 *   - Amman-only: coordinates outside Amman bounding box are ignored
 */

import type { LocationContext } from "@chatsouq/core";

const CACHE_KEY = "chatsouq_location";
const GPS_PERMISSION_KEY = "chatsouq_gps_permission"; // 'granted' | 'denied' | 'dismissed'
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedGpsLocation {
  lat: number;
  lng: number;
  accuracyM: number;
  cachedAt: number;
}

// Amman bounding box (reject GPS outside this)
const AMMAN_BOUNDS = { latMin: 31.85, latMax: 32.20, lngMin: 35.75, lngMax: 36.05 };

// Neighbourhood centroids (lat, lng) and max radius in km
const NEIGHBOURHOOD_CENTROIDS: Array<{ name: string; lat: number; lng: number; radiusKm: number }> = [
  { name: "Abdoun",         lat: 31.960, lng: 35.882, radiusKm: 1.5 },
  { name: "Sweifieh",       lat: 31.970, lng: 35.865, radiusKm: 1.5 },
  { name: "Shmeisani",      lat: 31.980, lng: 35.905, radiusKm: 1.5 },
  { name: "Weibdeh",        lat: 31.965, lng: 35.927, radiusKm: 1.2 },
  { name: "Jabal Amman",    lat: 31.957, lng: 35.925, radiusKm: 1.2 },
  { name: "Rainbow Street", lat: 31.957, lng: 35.928, radiusKm: 0.8 },
  { name: "Downtown Amman", lat: 31.953, lng: 35.934, radiusKm: 1.2 },
  { name: "1st Circle",     lat: 31.957, lng: 35.921, radiusKm: 0.7 },
  { name: "2nd Circle",     lat: 31.959, lng: 35.917, radiusKm: 0.7 },
  { name: "3rd Circle",     lat: 31.960, lng: 35.910, radiusKm: 0.7 },
  { name: "4th Circle",     lat: 31.961, lng: 35.901, radiusKm: 0.8 },
  { name: "5th Circle",     lat: 31.965, lng: 35.890, radiusKm: 0.8 },
  { name: "6th Circle",     lat: 31.970, lng: 35.880, radiusKm: 0.8 },
  { name: "7th Circle",     lat: 31.975, lng: 35.865, radiusKm: 0.8 },
  { name: "8th Circle",     lat: 31.981, lng: 35.848, radiusKm: 0.8 },
  { name: "Khalda",         lat: 31.990, lng: 35.855, radiusKm: 1.5 },
  { name: "Rabieh",         lat: 32.010, lng: 35.893, radiusKm: 1.5 },
  { name: "Gardens",        lat: 31.983, lng: 35.898, radiusKm: 1.2 },
  { name: "Dabouq",         lat: 32.005, lng: 35.840, radiusKm: 1.8 },
  { name: "Tlaa Ali",       lat: 31.990, lng: 35.845, radiusKm: 1.5 },
  { name: "Deir Ghbar",     lat: 31.955, lng: 35.876, radiusKm: 1.2 },
  { name: "Um Uthaina",     lat: 31.953, lng: 35.863, radiusKm: 1.2 },
  { name: "Jubeiha",        lat: 32.025, lng: 35.875, radiusKm: 1.8 },
  { name: "Wadi Seer",      lat: 31.933, lng: 35.825, radiusKm: 2.0 },
  { name: "Sweileh",        lat: 31.985, lng: 35.805, radiusKm: 1.8 },
  { name: "Marj El Hamam",  lat: 31.913, lng: 35.863, radiusKm: 1.8 },
  { name: "Jabal Hussein",  lat: 31.969, lng: 35.934, radiusKm: 1.2 },
];

/** Haversine distance in kilometres. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Returns the canonical neighbourhood name for the given GPS coords, or null. */
function detectNeighbourhood(lat: number, lng: number): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const { name, lat: cLat, lng: cLng, radiusKm } of NEIGHBOURHOOD_CENTROIDS) {
    const d = haversineKm(lat, lng, cLat, cLng);
    if (d <= radiusKm && d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

export function getGpsPermissionState(): "granted" | "denied" | "dismissed" | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(GPS_PERMISSION_KEY);
  return (v as "granted" | "denied" | "dismissed") ?? null;
}

export function setGpsPermissionState(state: "granted" | "denied" | "dismissed"): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GPS_PERMISSION_KEY, state);
}

/**
 * Request GPS position and return a LocationContext.
 * Returns null if permission is denied, timeout, or outside Amman.
 */
export async function getGpsLocationContext(): Promise<LocationContext | null> {
  if (typeof window === "undefined") return null;
  if (!navigator.geolocation) return null;

  // Check cached position
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed: CachedGpsLocation = JSON.parse(cached);
      if (Date.now() - parsed.cachedAt < CACHE_TTL_MS) {
        return buildFromCoords(parsed.lat, parsed.lng, parsed.accuracyM);
      }
    }
  } catch {
    // Ignore
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;

        // Reject if outside Amman bounding box
        if (
          lat < AMMAN_BOUNDS.latMin || lat > AMMAN_BOUNDS.latMax ||
          lng < AMMAN_BOUNDS.lngMin || lng > AMMAN_BOUNDS.lngMax
        ) {
          resolve(null);
          return;
        }

        // Cache coords in sessionStorage (cleared on tab close)
        try {
          const entry: CachedGpsLocation = { lat, lng, accuracyM: accuracy, cachedAt: Date.now() };
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
        } catch {
          // Ignore
        }

        setGpsPermissionState("granted");
        resolve(buildFromCoords(lat, lng, accuracy));
      },
      () => {
        setGpsPermissionState("denied");
        resolve(null);
      },
      { timeout: 5000, maximumAge: CACHE_TTL_MS, enableHighAccuracy: false }
    );
  });
}

function buildFromCoords(lat: number, lng: number, accuracyM: number): LocationContext {
  const neighbourhood = detectNeighbourhood(lat, lng);
  return {
    source: "gps",
    neighborhood: neighbourhood,
    governorate: "Amman",
    lat,
    lng,
    accuracyM,
  };
}

/**
 * Human-readable distance label for a place given user GPS coords.
 * Used for display in result cards ("~500m away", "1.2km away").
 */
export function distanceLabel(
  userLat: number,
  userLng: number,
  placeLat: number | null,
  placeLng: number | null
): string | null {
  if (placeLat === null || placeLng === null) return null;
  const km = haversineKm(userLat, userLng, placeLat, placeLng);
  if (km < 0.1) return "< 100m away";
  if (km < 1)   return `~${Math.round(km * 1000)}m away`;
  return `${km.toFixed(1)}km away`;
}
