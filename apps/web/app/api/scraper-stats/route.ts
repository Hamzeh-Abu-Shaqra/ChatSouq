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

    return NextResponse.json({
      tables: [
        {
          name: "News",
          source: "Roya News",
          icon: "📰",
          count: Number(news[0].count),
          last_scraped: news[0].last_scraped,
        },
        {
          name: "Places",
          source: "Google Maps",
          icon: "🗺️",
          count: Number(places[0].count),
          last_scraped: places[0].last_scraped,
        },
        {
          name: "Restaurants",
          source: "Talabat",
          icon: "🍔",
          count: Number(restaurants[0].count),
          last_scraped: restaurants[0].last_scraped,
        },
        {
          name: "Listings",
          source: "OpenSooq",
          icon: "🛒",
          count: Number(listings[0].count),
          last_scraped: listings[0].last_scraped,
        },
        {
          name: "Companies",
          source: "LinkedIn",
          icon: "💼",
          count: Number(companies[0].count),
          last_scraped: companies[0].last_scraped,
        },
      ],
      total: Number(news[0].count) + Number(places[0].count) + Number(restaurants[0].count) + Number(listings[0].count) + Number(companies[0].count),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
