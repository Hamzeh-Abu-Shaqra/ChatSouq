/**
 * In-memory TTL response cache for ChatSouq.
 *
 * Rules:
 *   - Place query results cached for 30 minutes (TTL_PLACE_MS)
 *   - Vendor/place detail cached for 2 hours (TTL_VENDOR_MS)
 *   - Personalised responses (with memoryBlock) are NEVER cached
 *   - Max 300 entries; oldest entry evicted on overflow (FIFO-ish)
 *
 * The cache key normalises the query so "cafe in weibdeh" and "Cafe in Weibdeh"
 * resolve to the same entry.
 */

const TTL_PLACE_MS  = 30 * 60 * 1_000;   // 30 minutes
const TTL_VENDOR_MS = 2  * 60 * 60 * 1_000; // 2 hours
const MAX_ENTRIES   = 300;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    // Evict oldest entries when at capacity
    if (this.store.size >= MAX_ENTRIES) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  /** Remove all expired entries. Call periodically in long-running processes. */
  purgeExpired(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  get size(): number {
    return this.store.size;
  }
}

// ── Singleton caches ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const placeCache = new TTLCache<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vendorCache = new TTLCache<any>();

/** Normalise a query string for use as a cache key. */
function normalizeKey(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "");
}

/**
 * Build a cache key from a query + optional context string.
 * Personalized responses (with non-empty memoryBlock) return `null` —
 * meaning "do not cache this request".
 */
export function buildCacheKey(
  query: string,
  context?: { memoryBlock?: string; limit?: number }
): string | null {
  // Never cache personalised responses
  if (context?.memoryBlock?.trim()) return null;
  const limitSuffix = context?.limit ? `:${context.limit}` : "";
  return `place:${normalizeKey(query)}${limitSuffix}`;
}

/** Get a cached place recommendation response. Returns null on miss or expiry. */
export function getCachedPlaceResponse<T>(key: string): T | null {
  return placeCache.get(key) as T | null;
}

/** Store a place recommendation response in the cache. */
export function setCachedPlaceResponse<T>(key: string, value: T): void {
  placeCache.set(key, value, TTL_PLACE_MS);
}

/** Get cached vendor/place detail by ID. */
export function getCachedVendor<T>(id: number | string): T | null {
  return vendorCache.get(String(id)) as T | null;
}

/** Cache vendor/place detail by ID. */
export function setCachedVendor<T>(id: number | string, value: T): void {
  vendorCache.set(String(id), value, TTL_VENDOR_MS);
}

/** Cache stats — useful for monitoring. */
export function getCacheStats(): { placeEntries: number; vendorEntries: number } {
  return {
    placeEntries: placeCache.size,
    vendorEntries: vendorCache.size,
  };
}

/** Purge all expired entries from both caches. */
export function purgeExpiredCacheEntries(): number {
  return placeCache.purgeExpired() + vendorCache.purgeExpired();
}
