import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

async function safeCount(query: Promise<any[]>) {
  try {
    const result = await query;
    return result[0] ?? { count: 0, last_scraped: null };
  } catch {
    return { count: 0, last_scraped: null };
  }
}

export async function GET() {
  try {
    const [news, places, restaurants, listings, companies] = await Promise.all([
      safeCount(sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_news`),
      safeCount(sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_places`),
      safeCount(sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_restaurants`),
      safeCount(sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_listings`),
      safeCount(sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_companies`),
    ]);

    const n = news;
    const p = places;
    const r = restaurants;
    const l = listings;
    const c = companies;

    return NextResponse.json({
      tables: [
        { name: "News", source: "Roya News", icon: "📰", count: Number(n.count), last_scraped: n.last_scraped },
        { name: "Places", source: "Google Maps", icon: "🗺️", count: Number(p.count), last_scraped: p.last_scraped },
        { name: "Restaurants", source: "Talabat", icon: "🍔", count: Number(r.count), last_scraped: r.last_scraped },
        { name: "Listings", source: "OpenSooq", icon: "🛒", count: Number(l.count), last_scraped: l.last_scraped },
        { name: "Companies", source: "LinkedIn", icon: "💼", count: Number(c.count), last_scraped: c.last_scraped },
      ],
      total: Number(n.count) + Number(p.count) + Number(r.count) + Number(l.count) + Number(c.count),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("scraper-stats error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
