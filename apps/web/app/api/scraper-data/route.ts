import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

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
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    let data: any[] = [];
    let total = 0;

    if (table === "news") {
      data = await safeQuery(sql`SELECT id, title, url, source, scraped_at FROM jordan_news ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`);
      const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_news`);
      total = Number(count[0]?.count ?? 0);
    } else if (table === "places") {
      data = await safeQuery(sql`SELECT id, name, category, address, phone, website, rating, reviews_count, scraped_at FROM jordan_places ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`);
      const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_places`);
      total = Number(count[0]?.count ?? 0);
    } else if (table === "restaurants") {
      data = await safeQuery(sql`SELECT id, name, cuisine, rating, delivery_time, url, scraped_at FROM jordan_restaurants ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`);
      const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_restaurants`);
      total = Number(count[0]?.count ?? 0);
    } else if (table === "listings") {
      data = await safeQuery(sql`SELECT id, title, price, location, category, url, scraped_at FROM jordan_listings ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`);
      const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_listings`);
      total = Number(count[0]?.count ?? 0);
    } else if (table === "companies") {
      data = await safeQuery(sql`SELECT id, name, industry, location, url, scraped_at FROM jordan_companies ORDER BY scraped_at DESC LIMIT ${limit} OFFSET ${offset}`);
      const count = await safeQuery(sql`SELECT COUNT(*) as count FROM jordan_companies`);
      total = Number(count[0]?.count ?? 0);
    }

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
