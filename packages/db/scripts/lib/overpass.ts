// Polite Overpass API client. Real Jordan data from OpenStreetMap (ODbL).
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run an Overpass QL query with retry + endpoint failover. Returns elements. */
export async function overpass(ql: string, attempt = 0): Promise<OsmElement[]> {
  const endpoint = ENDPOINTS[attempt % ENDPOINTS.length]!;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "ChatSouq/0.1 (Jordan local-discovery; non-commercial seed)",
      },
      body: "data=" + encodeURIComponent(ql),
    });
    if (res.status === 429 || res.status === 504) throw new Error(`rate-limited ${res.status}`);
    if (!res.ok) throw new Error(`overpass ${res.status}`);
    const json = (await res.json()) as { elements: OsmElement[] };
    return json.elements ?? [];
  } catch (err) {
    if (attempt >= 5) throw err;
    const wait = 2000 * (attempt + 1);
    console.warn(`  overpass retry ${attempt + 1} in ${wait}ms (${(err as Error).message})`);
    await sleep(wait);
    return overpass(ql, attempt + 1);
  }
}

/** Wrap a body in a Jordan-scoped Overpass query that emits tags + centroids. */
export function jordanQuery(body: string, timeout = 180): string {
  return `[out:json][timeout:${timeout}];area["ISO3166-1"="JO"][admin_level=2]->.jo;(${body});out tags center;`;
}

export const polite = (ms = 1500) => sleep(ms);
