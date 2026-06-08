import { sql } from "drizzle-orm";
import { db } from "@chatsouq/db";
import type { Candidate, Constraints } from "./types";

let categoryCache: { at: number; values: string[] } | null = null;

/** Distinct catalogue categories (cached 5 min) — drives query->category matching. */
export async function getCategories(): Promise<string[]> {
  if (categoryCache && Date.now() - categoryCache.at < 5 * 60_000) {
    return categoryCache.values;
  }
  const rows = (await db.execute(
    sql`SELECT DISTINCT category FROM listings WHERE category IS NOT NULL ORDER BY category`
  )) as unknown as { category: string }[];
  const values = rows.map((r) => r.category);
  categoryCache = { at: Date.now(), values };
  return values;
}

function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

interface RetrieveOpts {
  poolSize?: number;
  useCategoryFilter: boolean;
  useBudgetFilter: boolean;
  /** When true, at least one keyword must appear in the item's name or search_text. */
  useKeywordFilter?: boolean;
}

/**
 * Hard-filter (budget + optional category) then rank a candidate pool by a blend
 * of vector cosine similarity and trigram text similarity. Final scoring happens
 * in rank.ts; this just builds a high-recall pool.
 */
export async function retrieve(
  constraints: Constraints,
  queryVec: number[],
  queryText: string,
  opts: RetrieveOpts
): Promise<Candidate[]> {
  const poolSize = opts.poolSize ?? 120;
  const vecLit = toVectorLiteral(queryVec);

  const conditions = [sql`l.embedding IS NOT NULL`];

  if (opts.useBudgetFilter && constraints.budgetMax !== null) {
    conditions.push(sql`l.price IS NOT NULL AND l.price <= ${constraints.budgetMax}`);
  }
  if (opts.useBudgetFilter && constraints.budgetMin !== null) {
    conditions.push(sql`l.price >= ${constraints.budgetMin}`);
  }
  if (opts.useCategoryFilter && constraints.categories.length > 0) {
    const cats = sql.join(
      constraints.categories.map((c) => sql`${c}`),
      sql`, `
    );
    conditions.push(sql`l.category IN (${cats})`);
  }
  // Keyword presence filter: require that at least one keyword appears in the
  // item's name or search_text. This prevents off-topic items (e.g. a vinyl
  // record in the Audio category) from winning keyword-specific queries.
  if (opts.useKeywordFilter && constraints.keywords.length > 0) {
    const kwConditions = constraints.keywords.map(
      (k) => sql`(lower(coalesce(l.search_text, '')) LIKE ${"%" + k.toLowerCase() + "%"} OR lower(l.name) LIKE ${"%" + k.toLowerCase() + "%"})`
    );
    conditions.push(sql`(${sql.join(kwConditions, sql` OR `)})`);
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const rows = (await db.execute(sql`
    SELECT
      l.id, l.vendor_id AS "vendorId", l.name, l.description, l.category,
      l.price, l.currency, l.image_url AS "imageUrl", l.brand, l.source_url AS "sourceUrl",
      l.search_text AS "searchText",
      v.business_name AS "vendorName", v.location AS "vendorLocation", v.website_url AS "vendorWebsite",
      (1 - (l.embedding <=> ${vecLit}::vector)) AS "vecSim",
      similarity(coalesce(l.search_text, ''), ${queryText}) AS "txtSim"
    FROM listings l
    JOIN vendors v ON v.id = l.vendor_id
    WHERE ${whereClause}
    ORDER BY (1 - (l.embedding <=> ${vecLit}::vector)) + 2.0 * similarity(coalesce(l.search_text, ''), ${queryText}) DESC
    LIMIT ${poolSize}
  `)) as unknown as Record<string, unknown>[];

  return rows.map((r) => ({
    id: Number(r.id),
    vendorId: Number(r.vendorId),
    name: String(r.name),
    description: (r.description as string) ?? null,
    category: (r.category as string) ?? null,
    price: r.price === null || r.price === undefined ? null : Number(r.price),
    currency: (r.currency as string) ?? "JOD",
    imageUrl: (r.imageUrl as string) ?? null,
    brand: (r.brand as string) ?? null,
    sourceUrl: (r.sourceUrl as string) ?? null,
    searchText: (r.searchText as string) ?? null,
    vendorName: String(r.vendorName ?? ""),
    vendorLocation: (r.vendorLocation as string) ?? null,
    vendorWebsite: (r.vendorWebsite as string) ?? null,
    vecSim: Number(r.vecSim ?? 0),
    txtSim: Number(r.txtSim ?? 0),
  }));
}
