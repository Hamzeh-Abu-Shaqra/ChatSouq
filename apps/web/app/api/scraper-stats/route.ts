import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

async function safeCount(query: Promise<any[]>): Promise<Record<string, unknown>> {
  try {
    const result = await query;
    return result[0] ?? { count: 0, last_scraped: null };
  } catch {
    return { count: 0, last_scraped: null };
  }
}

export async function GET() {
  try {
    const [news, food, foodTalabat, health, shopping, services, education, hospitality, religion, people, listings] =
      await Promise.all([
        safeCount(sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_news`),
        safeCount(sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_places WHERE category = 'food'`),
        safeCount(sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_restaurants`),
        safeCount(sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_places WHERE category = 'health'`),
        safeCount(sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_places WHERE category = 'shopping'`),
        safeCount(sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_places WHERE category = 'services'`),
        safeCount(sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_places WHERE category = 'education'`),
        safeCount(sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_places WHERE category = 'hospitality'`),
        safeCount(sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_places WHERE category = 'religion'`),
        safeCount(sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_people`),
        safeCount(sql`SELECT COUNT(*) as count, MAX(scraped_at) as last_scraped FROM jordan_listings`),
      ]);

    const foodCount = Number(food.count) + Number(foodTalabat.count);
    // Compare dates safely — either may be null
    const foodScraped =
      food.last_scraped == null ? foodTalabat.last_scraped
      : foodTalabat.last_scraped == null ? food.last_scraped
      : food.last_scraped >= foodTalabat.last_scraped ? food.last_scraped : foodTalabat.last_scraped;

    const total =
      Number(news.count) + foodCount + Number(health.count) +
      Number(shopping.count) + Number(services.count) + Number(education.count) +
      Number(hospitality.count) + Number(religion.count) + Number(people.count) + Number(listings.count);

    return NextResponse.json({
      tables: [
        { name: "News",         icon: "📰",  count: Number(news.count),        last_scraped: news.last_scraped },
        { name: "Food & Drink", icon: "🍽️", count: foodCount,                 last_scraped: foodScraped },
        { name: "Health",       icon: "🏥",  count: Number(health.count),      last_scraped: health.last_scraped },
        { name: "Shopping",     icon: "🛍️", count: Number(shopping.count),    last_scraped: shopping.last_scraped },
        { name: "Services",     icon: "🔧",  count: Number(services.count),    last_scraped: services.last_scraped },
        { name: "Education",    icon: "🎓",  count: Number(education.count),   last_scraped: education.last_scraped },
        { name: "Hotels",       icon: "🏨",  count: Number(hospitality.count), last_scraped: hospitality.last_scraped },
        { name: "Mosques",      icon: "🕌",  count: Number(religion.count),    last_scraped: religion.last_scraped },
        { name: "People",       icon: "👤",  count: Number(people.count),      last_scraped: people.last_scraped },
        { name: "Listings",     icon: "🛒",  count: Number(listings.count),    last_scraped: listings.last_scraped },
      ],
      total,
    });
  } catch (error) {
    console.error("[api/scraper-stats]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
