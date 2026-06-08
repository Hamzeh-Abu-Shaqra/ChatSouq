import type { PlaceInput } from "./normalize";

/**
 * Adapter interface for ingesting from a specific site you have the rights to
 * (the "open data + my own sites" sourcing choice). Implement one of these per
 * source, drop it in `sources/`, and the loader can embed + upsert its output
 * exactly like the OSM data. Keeps third-party data swappable and separate from
 * app code, per the project's data-rights constraint.
 */
export interface SiteAdapter {
  /** Stable identifier stored in places.source (e.g. "mysite.jo"). */
  readonly source: string;
  /** Yield normalized place rows. Must set source = this.source on each row. */
  scrape(): AsyncGenerator<PlaceInput>;
}

// No site adapters are registered yet — add them here once you confirm rights.
export const SITE_ADAPTERS: SiteAdapter[] = [];
