import { NextResponse } from "next/server";
import { db } from "@chatsouq/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function safeQuery(query: Promise<{ rows: Record<string, unknown>[] }>) {
  try {
    const result = await query;
    return result.rows as any[];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const table    = searchParams.get("table") || "news";
  const page     = Math.max(1, Number(searchParams.get("page") || 1));
  const category = searchParams.get("category") || "";
  const search   = searchParams.get("search") || "";
  const limit    = 20;
  const offset   = (page - 1) * limit;

  try {
    let data: any[] = [];
    let total = 0;
    let categories: string[] = [];

    // ── NEWS ────────────────────────────────────────────────────────────────
    if (table === "news") {
      const nsources = await safeQuery(db.execute(sql`SELECT DISTINCT source as val FROM jordan_news WHERE source IS NOT NULL ORDER BY source`));
      categories = nsources.map((r: any) => r.val);
      if (category && search) {
        data = await safeQuery(db.execute(sql`SELECT id, title, url, source, language, published_at, scraped_at FROM jordan_news WHERE source = ${category} AND title ILIKE ${'%' + search + '%'} ORDER BY COALESCE(published_at, scraped_at) DESC LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_news WHERE source = ${category} AND title ILIKE ${'%' + search + '%'}`));
        total = Number(c[0]?.count ?? 0);
      } else if (category) {
        data = await safeQuery(db.execute(sql`SELECT id, title, url, source, language, published_at, scraped_at FROM jordan_news WHERE source = ${category} ORDER BY COALESCE(published_at, scraped_at) DESC LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_news WHERE source = ${category}`));
        total = Number(c[0]?.count ?? 0);
      } else if (search) {
        data = await safeQuery(db.execute(sql`SELECT id, title, url, source, language, published_at, scraped_at FROM jordan_news WHERE title ILIKE ${'%' + search + '%'} ORDER BY COALESCE(published_at, scraped_at) DESC LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_news WHERE title ILIKE ${'%' + search + '%'}`));
        total = Number(c[0]?.count ?? 0);
      } else {
        data = await safeQuery(db.execute(sql`SELECT id, title, url, source, language, published_at, scraped_at FROM jordan_news ORDER BY COALESCE(published_at, scraped_at) DESC LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_news`));
        total = Number(c[0]?.count ?? 0);
      }

    // ── FOOD & DRINK (Places + Talabat UNION) ───────────────────────────────
    } else if (table === "food") {
      const subcats = await safeQuery(
        db.execute(sql`SELECT DISTINCT subcategory as val FROM jordan_places WHERE category = 'food' AND subcategory IS NOT NULL ORDER BY subcategory`)
      );
      categories = ["Talabat Delivery", ...subcats.map((r: any) => r.val)];

      if (category === "Talabat Delivery") {
        if (search) {
          data = await safeQuery(db.execute(sql`SELECT id, name, cuisine as subcategory, rating, delivery_time, COALESCE(address, area) as address, 'Talabat' as source, url, scraped_at FROM jordan_restaurants WHERE name ILIKE ${'%' + search + '%'} ORDER BY rating DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`));
          const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_restaurants WHERE name ILIKE ${'%' + search + '%'}`));
          total = Number(c[0]?.count ?? 0);
        } else {
          data = await safeQuery(db.execute(sql`SELECT id, name, cuisine as subcategory, rating, delivery_time, COALESCE(address, area) as address, 'Talabat' as source, url, scraped_at FROM jordan_restaurants ORDER BY rating DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`));
          const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_restaurants`));
          total = Number(c[0]?.count ?? 0);
        }
      } else if (category) {
        data = await safeQuery(db.execute(sql`SELECT id, name, subcategory, rating, NULL::text as delivery_time, address, 'Google Maps' as source, NULL::text as url, scraped_at FROM jordan_places WHERE category = 'food' AND subcategory = ${category} AND (${search} = '' OR name ILIKE ${'%' + search + '%'}) ORDER BY rating DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_places WHERE category = 'food' AND subcategory = ${category} AND (${search} = '' OR name ILIKE ${'%' + search + '%'})`));
        total = Number(c[0]?.count ?? 0);
      } else if (search) {
        data = await safeQuery(db.execute(sql`
          SELECT id, name, subcategory, rating, NULL::text as delivery_time, address, 'Google Maps' as source, NULL::text as url, scraped_at
          FROM jordan_places WHERE category = 'food' AND name ILIKE ${'%' + search + '%'}
          UNION ALL
          SELECT id, name, cuisine as subcategory, rating, delivery_time, COALESCE(address, area) as address, 'Talabat' as source, url, scraped_at
          FROM jordan_restaurants WHERE name ILIKE ${'%' + search + '%'}
          ORDER BY rating DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}
        `));
        const c1 = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_places WHERE category = 'food' AND name ILIKE ${'%' + search + '%'}`));
        const c2 = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_restaurants WHERE name ILIKE ${'%' + search + '%'}`));
        total = Number(c1[0]?.count ?? 0) + Number(c2[0]?.count ?? 0);
      } else {
        data = await safeQuery(db.execute(sql`
          SELECT id, name, subcategory, rating, NULL::text as delivery_time, address, 'Google Maps' as source, NULL::text as url, scraped_at
          FROM jordan_places WHERE category = 'food'
          UNION ALL
          SELECT id, name, cuisine as subcategory, rating, delivery_time, COALESCE(address, area) as address, 'Talabat' as source, url, scraped_at
          FROM jordan_restaurants
          ORDER BY rating DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}
        `));
        const c1 = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_places WHERE category = 'food'`));
        const c2 = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_restaurants`));
        total = Number(c1[0]?.count ?? 0) + Number(c2[0]?.count ?? 0);
      }

    // ── PLACES helper (health / shopping / services / education / hospitality / religion) ──
    } else if (["health","shopping","services","education","hospitality","religion"].includes(table)) {
      const subcats = await safeQuery(
        db.execute(sql`SELECT DISTINCT subcategory as val FROM jordan_places WHERE category = ${table} AND subcategory IS NOT NULL ORDER BY subcategory`)
      );
      categories = subcats.map((r: any) => r.val);

      if (category && search) {
        data = await safeQuery(db.execute(sql`SELECT id, name, subcategory, address, rating, reviews_count, phone, scraped_at FROM jordan_places WHERE category = ${table} AND subcategory = ${category} AND name ILIKE ${'%' + search + '%'} ORDER BY rating DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_places WHERE category = ${table} AND subcategory = ${category} AND name ILIKE ${'%' + search + '%'}`));
        total = Number(c[0]?.count ?? 0);
      } else if (category) {
        data = await safeQuery(db.execute(sql`SELECT id, name, subcategory, address, rating, reviews_count, phone, scraped_at FROM jordan_places WHERE category = ${table} AND subcategory = ${category} ORDER BY rating DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_places WHERE category = ${table} AND subcategory = ${category}`));
        total = Number(c[0]?.count ?? 0);
      } else if (search) {
        data = await safeQuery(db.execute(sql`SELECT id, name, subcategory, address, rating, reviews_count, phone, scraped_at FROM jordan_places WHERE category = ${table} AND name ILIKE ${'%' + search + '%'} ORDER BY rating DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_places WHERE category = ${table} AND name ILIKE ${'%' + search + '%'}`));
        total = Number(c[0]?.count ?? 0);
      } else {
        data = await safeQuery(db.execute(sql`SELECT id, name, subcategory, address, rating, reviews_count, phone, scraped_at FROM jordan_places WHERE category = ${table} ORDER BY rating DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_places WHERE category = ${table}`));
        total = Number(c[0]?.count ?? 0);
      }

    // ── PEOPLE ──────────────────────────────────────────────────────────────
    } else if (table === "people") {
      const subcats = await safeQuery(
        db.execute(sql`SELECT DISTINCT subcategory as val FROM jordan_people WHERE subcategory IS NOT NULL ORDER BY subcategory`)
      );
      categories = subcats.map((r: any) => r.val);

      if (category && search) {
        data = await safeQuery(db.execute(sql`SELECT id, name, title, subcategory, organization, specialty, phone, website, address, url, scraped_at FROM jordan_people WHERE subcategory = ${category} AND name ILIKE ${'%' + search + '%'} ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_people WHERE subcategory = ${category} AND name ILIKE ${'%' + search + '%'}`));
        total = Number(c[0]?.count ?? 0);
      } else if (category) {
        data = await safeQuery(db.execute(sql`SELECT id, name, title, subcategory, organization, specialty, phone, website, address, url, scraped_at FROM jordan_people WHERE subcategory = ${category} ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_people WHERE subcategory = ${category}`));
        total = Number(c[0]?.count ?? 0);
      } else if (search) {
        data = await safeQuery(db.execute(sql`SELECT id, name, title, subcategory, organization, specialty, phone, website, address, url, scraped_at FROM jordan_people WHERE name ILIKE ${'%' + search + '%'} ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_people WHERE name ILIKE ${'%' + search + '%'}`));
        total = Number(c[0]?.count ?? 0);
      } else {
        data = await safeQuery(db.execute(sql`SELECT id, name, title, subcategory, organization, specialty, phone, website, address, url, scraped_at FROM jordan_people ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_people`));
        total = Number(c[0]?.count ?? 0);
      }

    // ── LISTINGS ────────────────────────────────────────────────────────────
    } else if (table === "listings") {
      const cats = await safeQuery(
        db.execute(sql`SELECT DISTINCT category as val FROM jordan_listings WHERE category IS NOT NULL ORDER BY category`)
      );
      categories = cats.map((r: any) => r.val);

      if (category && search) {
        data = await safeQuery(db.execute(sql`SELECT id, title, price, location, category, url, scraped_at FROM jordan_listings WHERE category = ${category} AND title ILIKE ${'%' + search + '%'} ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_listings WHERE category = ${category} AND title ILIKE ${'%' + search + '%'}`));
        total = Number(c[0]?.count ?? 0);
      } else if (category) {
        data = await safeQuery(db.execute(sql`SELECT id, title, price, location, category, url, scraped_at FROM jordan_listings WHERE category = ${category} ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_listings WHERE category = ${category}`));
        total = Number(c[0]?.count ?? 0);
      } else if (search) {
        data = await safeQuery(db.execute(sql`SELECT id, title, price, location, category, url, scraped_at FROM jordan_listings WHERE title ILIKE ${'%' + search + '%'} ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_listings WHERE title ILIKE ${'%' + search + '%'}`));
        total = Number(c[0]?.count ?? 0);
      } else {
        data = await safeQuery(db.execute(sql`SELECT id, title, price, location, category, url, scraped_at FROM jordan_listings ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`));
        const c = await safeQuery(db.execute(sql`SELECT COUNT(*) as count FROM jordan_listings`));
        total = Number(c[0]?.count ?? 0);
      }
    }

    return NextResponse.json({ data, total, page, limit, categories });
  } catch (error) {
    console.error("[api/scraper-data]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
