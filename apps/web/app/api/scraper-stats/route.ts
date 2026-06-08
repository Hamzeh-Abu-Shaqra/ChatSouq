import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const [news, places, restaurants, listings, companies] = await Promise.all([
      sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_news`,
      sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_places`,
      sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_restaurants`,
      sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_listings`,
      sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_companies`,
    ]);

    const n = news[0] ?? { count: 0, last_scraped: null };
    const p = places[0] ?? { count: 0, last_scraped: null };
    const r = restaurants[0] ?? { count: 0, last_scraped: null };
    const l = listings[0] ?? { count: 0, last_scraped: null };
    const c = companies[0] ?? { count: 0, last_scraped: null };

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
