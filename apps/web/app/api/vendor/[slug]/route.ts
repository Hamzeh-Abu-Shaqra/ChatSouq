import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Match by slugifying the stored name (e.g. "Sekrab Amman" → "sekrab-amman")
    const rows = await sql`
      SELECT
        id,
        name,
        subcategory,
        category,
        address,
        rating,
        reviews_count,
        phone,
        website,
        opening_hours,
        area,
        lat,
        lng,
        scraped_at
      FROM jordan_places
      WHERE REGEXP_REPLACE(LOWER(name), '[^a-z0-9]+', '-', 'g') = ${slug}
      ORDER BY rating DESC NULLS LAST
      LIMIT 1
    `;

    if (!rows.length) {
      // Fallback: prefix match (slug may contain extra segments)
      const prefix = slug.slice(0, 40);
      const fallback = await sql`
        SELECT
          id, name, subcategory, category, address, rating,
          reviews_count, phone, website, opening_hours, area, lat, lng, scraped_at
        FROM jordan_places
        WHERE REGEXP_REPLACE(LOWER(name), '[^a-z0-9]+', '-', 'g') LIKE ${prefix + "%"}
        ORDER BY rating DESC NULLS LAST
        LIMIT 1
      `;
      if (!fallback.length) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }
      return NextResponse.json(fallback[0]);
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("[api/vendor/slug]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
