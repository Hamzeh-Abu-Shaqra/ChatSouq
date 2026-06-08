export function formatJOD(n: number | null): string {
  if (n === null) return "Price on request";
  const v = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return `${v} JOD`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Make a stored link safe to use as an href. OSM/site data often omits the
 * scheme (e.g. "example.jo"); we prefix https:// so the link actually resolves.
 * Returns null for empty/invalid values so callers can hide the link.
 */
export function safeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v) || /^[a-z0-9.-]+\.[a-z]{2,}/i.test(v)) return `https://${v}`;
  return null;
}

/** A Google Maps link for a place — by precise coordinates, labelled by name. */
export function mapsUrl(
  lat: number | null,
  lng: number | null,
  name?: string | null
): string | null {
  if (lat === null || lng === null) {
    if (!name) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  }
  const q = `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Display host for a URL (e.g. "https://shop.jo/x" -> "shop.jo"). */
export function hostOf(raw: string | null | undefined): string | null {
  const u = safeUrl(raw);
  if (!u) return null;
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}
