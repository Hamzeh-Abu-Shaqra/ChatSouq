/**
 * Context assembler for ChatSouq Tier 1 signals.
 *
 * Collects location, temporal, and history signals and assembles them into
 * a QueryContext to be sent with every recommendation request.
 *
 * Location priority: GPS > user-stated (handled server-side) > IP > history-inferred > default
 */

import type { QueryContext, LocationContext } from "@chatsouq/core";
import { getTemporalContext } from "./temporalContext";
import { getHistoryContext } from "./searchHistory";
import { getGpsLocationContext, getGpsPermissionState } from "./gpsLocation";
import { getIpLocationContext } from "./ipLocation";

// Default location when nothing else resolves (West Amman)
const DEFAULT_LOCATION: LocationContext = {
  source: "default",
  neighborhood: null,
  governorate: "Amman",
  lat: null,
  lng: null,
  accuracyM: null,
};

/**
 * Assemble all context signals.
 *
 * @param tryGps - Whether to attempt GPS. Set to false if user dismissed the banner.
 * @param ipContext - Pre-fetched IP location (optional, to avoid duplicate fetches).
 */
export async function assembleContext(
  tryGps = false,
  ipContext?: LocationContext | null
): Promise<QueryContext> {
  // ── Temporal (synchronous, always available) ─────────────────────────────
  const temporal = getTemporalContext();

  // ── History (synchronous, localStorage) ──────────────────────────────────
  const history = getHistoryContext();

  // ── Location (async, layered) ─────────────────────────────────────────────
  let location: LocationContext | null = null;

  // 1. GPS (only if user previously granted OR we're actively trying)
  const gpsPermission = getGpsPermissionState();
  if (tryGps || gpsPermission === "granted") {
    location = await getGpsLocationContext();
  }

  // 2. IP geolocation fallback (city-level only)
  if (!location) {
    location = ipContext !== undefined ? ipContext : await getIpLocationContext();
  }

  // 3. History-inferred neighbourhood fallback
  if ((!location || !location.neighborhood) && history?.inferredNeighborhood) {
    location = {
      source: "history",
      neighborhood: history.inferredNeighborhood,
      governorate: "Amman",
      lat: null,
      lng: null,
      accuracyM: null,
    };
  }

  // 4. Default (West Amman — never null)
  if (!location) {
    location = DEFAULT_LOCATION;
  }

  return { location, temporal, history };
}

/**
 * Quick synchronous context assembly — returns temporal + history only.
 * Use when you need context immediately (e.g. first render) without waiting for async signals.
 */
export function assembleContextSync(): Omit<QueryContext, "location"> & { location: null } {
  return {
    location: null,
    temporal: getTemporalContext(),
    history: getHistoryContext(),
  };
}
