import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const sql = neon(process.env.DATABASE_URL!);

/**
 * GET /api/vendor/[slug]
 * Returns a unified vendor/place profile for the detail page.
 * The slug is a numeric ID prefixed with a source type:
 *   place-{id}       → jordan_places
 *   restaurant-{id}  → jordan_restaurants
 *   person-{id}      → jordan_people
 *
 * Falls back to plain numeric ID → searches all three tables in order.
 * Also supports name-based slug lookup for backwards compatibility.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Parse "type-id" format, e.g. "place-42" or just "42"
    let source: "place" | "restaurant" | "person" | null = null;
    let numericId: number | null = null;

    const prefixMatch = slug.match(/^(place|restaurant|person)-(\d+)$/);
    if (prefixMatch) {
      source = prefixMatch[1] as "place" | "restaurant" | "person";
      numericId = parseInt(prefixMatch[2]!, 10);
    } else if (/^\d+$/.test(slug)) {
      numericId = parseInt(slug, 10);
    }

    // ── Numeric ID lookup ────────────────────────────────────────────────
    if (numericId && !isNaN(numericId) && numericId > 0) {
      if (!source || source === "place") {
        const rows = await sql`
          SELECT
            id, name, subcategory, category, address,
            rating, reviews_count, phone, website,
            opening_hours, lat, lng, scraped_at,
            NULL::text AS area,
            'place' AS source_type
          FROM jordan_places
          WHERE id = ${numericId}
          LIMIT 1
        `;
        if (rows.length > 0) return NextResponse.json(rows[0]);
      }

      if (!source || source === "restaurant") {
        const rows = await sql`
          SELECT
            id, name,
            cuisine AS subcategory,
            'Restaurant' AS category,
            address,
            rating, rating_count AS reviews_count,
            NULL::text AS phone,
            url AS website,
            NULL::text AS opening_hours,
            NULL::float AS lat,
            NULL::float AS lng,
            scraped_at,
            area,
            'restaurant' AS source_type
          FROM jordan_restaurants
          WHERE id = ${numericId}
          LIMIT 1
        `;
        if (rows.length > 0) return NextResponse.json(rows[0]);
      }

      if (!source || source === "person") {
        const rows = await sql`
          SELECT
            id, name, subcategory, category,
            address,
            NULL::float AS rating,
            NULL::int AS reviews_count,
            phone, website,
            NULL::text AS opening_hours,
            NULL::float AS lat,
            NULL::float AS lng,
            scraped_at,
            NULL::text AS area,
            'person' AS source_type
          FROM jordan_people
          WHERE id = ${numericId}
          LIMIT 1
        `;
        if (rows.length > 0) return NextResponse.json(rows[0]);
      }

      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // ── Name-slug fallback (e.g. "sekrab-amman") ─────────────────────────
    const rows = await sql`
      SELECT
        id, name, subcategory, category, address,
        rating, reviews_count, phone, website,
        opening_hours, NULL::text AS area, lat, lng, scraped_at,
        'place' AS source_type
      FROM jordan_places
      WHERE REGEXP_REPLACE(LOWER(name), '[^a-z0-9]+', '-', 'g') = ${slug}
      ORDER BY rating DESC NULLS LAST
      LIMIT 1
    `;
    if (rows.length > 0) return NextResponse.json(rows[0]);

    // Prefix match fallback
    const prefix = slug.slice(0, 40);
    const fallback = await sql`
      SELECT
        id, name, subcategory, category, address,
        rating, reviews_count, phone, website,
        opening_hours, NULL::text AS area, lat, lng, scraped_at,
        'place' AS source_type
      FROM jordan_places
      WHERE REGEXP_REPLACE(LOWER(name), '[^a-z0-9]+', '-', 'g') LIKE ${prefix + "%"}
      ORDER BY rating DESC NULLS LAST
      LIMIT 1
    `;
    if (fallback.length > 0) return NextResponse.json(fallback[0]);

    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  } catch (err) {
    console.error("[api/vendor] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
