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
  /**
   * When true, ALL keywords must appear (AND logic). More precise but may return
   * fewer results. Fall back to OR (useKeywordFilter) if this yields too few.
   */
  useStrictKeywords?: boolean;
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
  // 250-item pool gives enough recall for large categories (Watches: 16k, Beauty: 8k)
  // without blowing query time. rank.ts then does the expensive per-item scoring.
  const poolSize = opts.poolSize ?? 250;
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
  // Keyword filter — AND mode requires ALL keywords, OR mode requires at least one.
  // We search in: lower(name) || ' ' || lower(coalesce(search_text,'')) || ' ' || lower(coalesce(description,''))
  // Including description ensures products whose key feature is in the description
  // (e.g. "wireless" in the description but not the product name) are still matched.
  if (constraints.keywords.length > 0) {
    const haystack = sql`(lower(l.name) || ' ' || lower(coalesce(l.search_text, '')) || ' ' || lower(coalesce(l.description, '')))`;
    const kwConds = constraints.keywords.map((k) => {
      const kl = k.toLowerCase();
      // Short keywords need word boundaries (e.g. "fan" must not match "fanatic")
      // PostgreSQL: \m = word start, \M = word end (POSIX regex via ~*)
      if (kl.length < 5) {
        const escaped = kl.replace(/\\/g, "\\\\").replace(/[.*+?^${}()|[\]]/g, "\\$&");
        return sql`(${haystack} ~* ${"\\m" + escaped + "\\M"})`;
      }
      return sql`(${haystack} LIKE ${"%" + kl + "%"})`;
    });
    if (opts.useStrictKeywords) {
      // ALL keywords must match
      conditions.push(sql`(${sql.join(kwConds, sql` AND `)})`);
    } else if (opts.useKeywordFilter) {
      // At least one keyword must match
      conditions.push(sql`(${sql.join(kwConds, sql` OR `)})`);
    }
  }

  const whereClause = sql.join(conditions, sql` AND `);

  // Trigram target: name + search_text gives the best lexical signal.
  // Order by: vec dominates (×3) + trigram tiebreaker (×1).
  // Previously txtSim had a ×2 coefficient which drowned out semantic meaning —
  // this was the primary cause of off-topic results bubbling up into the pool.
  const trigramTarget = sql`(l.name || ' ' || coalesce(l.search_text, ''))`;
  const rows = (await db.execute(sql`
    SELECT
      l.id, l.vendor_id AS "vendorId", l.name, l.description, l.category,
      l.price, l.currency, l.image_url AS "imageUrl", l.brand, l.source_url AS "sourceUrl",
      l.search_text AS "searchText",
      v.business_name AS "vendorName", v.location AS "vendorLocation", v.website_url AS "vendorWebsite",
      (1 - (l.embedding <=> ${vecLit}::vector)) AS "vecSim",
      similarity(${trigramTarget}, ${queryText}) AS "txtSim"
    FROM listings l
    JOIN vendors v ON v.id = l.vendor_id
    WHERE ${whereClause}
    ORDER BY
      (1 - (l.embedding <=> ${vecLit}::vector)) * 3.0
      + similarity(${trigramTarget}, ${queryText})
    DESC
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
