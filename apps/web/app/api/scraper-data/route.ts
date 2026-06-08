import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

async function safeQuery(query: Promise<any[]>) {
  try {
    return await query;
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table") || "news";
  const page = Number(searchParams.get("page") || 1);
  const category = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    let data: any[] = [];
    let total = 0;
    let categories: string[] = [];

    if (table === "news") {
      data = await safeQuery(sql`SELECT id, title, url, source, scraped_at FROM jordan_news ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`);
      const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_news`);
      total = Number(count[0]?.count ?? 0);

    } else if (table === "places") {
      const cats = await safeQuery(sql`SELECT DISTINCT category FROM jordan_places ORDER BY category`);
      categories = cats.map((c: any) => c.category);

      if (category && search) {
        data = await safeQuery(sql`SELECT id, name, category, address, rating, reviews_count, scraped_at FROM jordan_places WHERE category = ${category} AND name ILIKE ${'%' + search + '%'} ORDER BY rating DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`);
        const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_places WHERE category = ${category} AND name ILIKE ${'%' + search + '%'}`);
        total = Number(count[0]?.count ?? 0);
      } else if (category) {
        data = await safeQuery(sql`SELECT id, name, category, address, rating, reviews_count, scraped_at FROM jordan_places WHERE category = ${category} ORDER BY rating DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`);
        const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_places WHERE category = ${category}`);
        total = Number(count[0]?.count ?? 0);
      } else if (search) {
        data = await safeQuery(sql`SELECT id, name, category, address, rating, reviews_count, scraped_at FROM jordan_places WHERE name ILIKE ${'%' + search + '%'} ORDER BY rating DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`);
        const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_places WHERE name ILIKE ${'%' + search + '%'}`);
        total = Number(count[0]?.count ?? 0);
      } else {
        data = await safeQuery(sql`SELECT id, name, category, address, rating, reviews_count, scraped_at FROM jordan_places ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`);
        const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_places`);
        total = Number(count[0]?.count ?? 0);
      }

    } else if (table === "restaurants") {
      data = await safeQuery(sql`SELECT id, name, cuisine, rating, delivery_time, url, scraped_at FROM jordan_restaurants ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`);
      const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_restaurants`);
      total = Number(count[0]?.count ?? 0);

    } else if (table === "listings") {
      const cats = await safeQuery(sql`SELECT DISTINCT category FROM jordan_listings ORDER BY category`);
      categories = cats.map((c: any) => c.category);
      if (category) {
        data = await safeQuery(sql`SELECT id, title, price, location, category, url, scraped_at FROM jordan_listings WHERE category = ${category} ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`);
        const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_listings WHERE category = ${category}`);
        total = Number(count[0]?.count ?? 0);
      } else {
        data = await safeQuery(sql`SELECT id, title, price, location, category, url, scraped_at FROM jordan_listings ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`);
        const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_listings`);
        total = Number(count[0]?.count ?? 0);
      }

    } else if (table === "companies") {
      data = await safeQuery(sql`SELECT id, name, industry, location, url, scraped_at FROM jordan_companies ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`);
      const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_companies`);
      total = Number(count[0]?.count ?? 0);

    } else if (table === "people") {
      const cats = await safeQuery(sql`SELECT DISTINCT subcategory FROM jordan_people WHERE subcategory IS NOT NULL ORDER BY subcategory`);
      categories = cats.map((c: any) => c.subcategory);

      if (category && search) {
        data = await safeQuery(sql`SELECT id, name, title, subcategory, organization, specialty, phone, address, scraped_at FROM jordan_people WHERE subcategory = ${category} AND name ILIKE ${'%' + search + '%'} ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`);
        const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_people WHERE subcategory = ${category} AND name ILIKE ${'%' + search + '%'}`);
        total = Number(count[0]?.count ?? 0);
      } else if (category) {
        data = await safeQuery(sql`SELECT id, name, title, subcategory, organization, specialty, phone, address, scraped_at FROM jordan_people WHERE subcategory = ${category} ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`);
        const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_people WHERE subcategory = ${category}`);
        total = Number(count[0]?.count ?? 0);
      } else if (search) {
        data = await safeQuery(sql`SELECT id, name, title, subcategory, organization, specialty, phone, address, scraped_at FROM jordan_people WHERE name ILIKE ${'%' + search + '%'} ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`);
        const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_people WHERE name ILIKE ${'%' + search + '%'}`);
        total = Number(count[0]?.count ?? 0);
      } else {
        data = await safeQuery(sql`SELECT id, name, title, subcategory, organization, specialty, phone, address, scraped_at FROM jordan_people ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`);
        const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_people`);
        total = Number(count[0]?.count ?? 0);
      }
    }

    return NextResponse.json({ data, total, page, limit, categories });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
