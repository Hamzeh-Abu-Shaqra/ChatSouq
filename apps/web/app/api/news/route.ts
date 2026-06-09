import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const sql = neon(process.env.DATABASE_URL!);

async function safe<T>(q: Promise<T[]>): Promise<T[]> {
  try { return await q; } catch { return []; }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page     = Math.max(1, Number(searchParams.get("page") || 1));
  const search   = searchParams.get("search") || "";
  const source   = searchParams.get("source") || "";
  const lang     = searchParams.get("lang") || "";
  const limit    = 30;
  const offset   = (page - 1) * limit;

  try {
    // Available sources for filter dropdown
    const sources = await safe(
      sql`SELECT DISTINCT source as val FROM jordan_news WHERE source IS NOT NULL ORDER BY source`
    );

    let data: any[] = [];
    let total = 0;

    if (search && source && lang) {
      data = await safe(sql`SELECT id, title, url, source, language, summary, published_at, scraped_at FROM jordan_news WHERE source = ${source} AND language = ${lang} AND title ILIKE ${'%' + search + '%'} ORDER BY COALESCE(published_at, scraped_at) DESC LIMIT ${limit} OFFSET ${offset}`);
      const c = await safe(sql`SELECT COUNT(*) as count FROM jordan_news WHERE source = ${source} AND language = ${lang} AND title ILIKE ${'%' + search + '%'}`);
      total = Number(c[0]?.count ?? 0);
    } else if (search && source) {
      data = await safe(sql`SELECT id, title, url, source, language, summary, published_at, scraped_at FROM jordan_news WHERE source = ${source} AND title ILIKE ${'%' + search + '%'} ORDER BY COALESCE(published_at, scraped_at) DESC LIMIT ${limit} OFFSET ${offset}`);
      const c = await safe(sql`SELECT COUNT(*) as count FROM jordan_news WHERE source = ${source} AND title ILIKE ${'%' + search + '%'}`);
      total = Number(c[0]?.count ?? 0);
    } else if (search && lang) {
      data = await safe(sql`SELECT id, title, url, source, language, summary, published_at, scraped_at FROM jordan_news WHERE language = ${lang} AND title ILIKE ${'%' + search + '%'} ORDER BY COALESCE(published_at, scraped_at) DESC LIMIT ${limit} OFFSET ${offset}`);
      const c = await safe(sql`SELECT COUNT(*) as count FROM jordan_news WHERE language = ${lang} AND title ILIKE ${'%' + search + '%'}`);
      total = Number(c[0]?.count ?? 0);
    } else if (source && lang) {
      data = await safe(sql`SELECT id, title, url, source, language, summary, published_at, scraped_at FROM jordan_news WHERE source = ${source} AND language = ${lang} ORDER BY COALESCE(published_at, scraped_at) DESC LIMIT ${limit} OFFSET ${offset}`);
      const c = await safe(sql`SELECT COUNT(*) as count FROM jordan_news WHERE source = ${source} AND language = ${lang}`);
      total = Number(c[0]?.count ?? 0);
    } else if (search) {
      data = await safe(sql`SELECT id, title, url, source, language, summary, published_at, scraped_at FROM jordan_news WHERE title ILIKE ${'%' + search + '%'} ORDER BY COALESCE(published_at, scraped_at) DESC LIMIT ${limit} OFFSET ${offset}`);
      const c = await safe(sql`SELECT COUNT(*) as count FROM jordan_news WHERE title ILIKE ${'%' + search + '%'}`);
      total = Number(c[0]?.count ?? 0);
    } else if (source) {
      data = await safe(sql`SELECT id, title, url, source, language, summary, published_at, scraped_at FROM jordan_news WHERE source = ${source} ORDER BY COALESCE(published_at, scraped_at) DESC LIMIT ${limit} OFFSET ${offset}`);
      const c = await safe(sql`SELECT COUNT(*) as count FROM jordan_news WHERE source = ${source}`);
      total = Number(c[0]?.count ?? 0);
    } else if (lang) {
      data = await safe(sql`SELECT id, title, url, source, language, summary, published_at, scraped_at FROM jordan_news WHERE language = ${lang} ORDER BY COALESCE(published_at, scraped_at) DESC LIMIT ${limit} OFFSET ${offset}`);
      const c = await safe(sql`SELECT COUNT(*) as count FROM jordan_news WHERE language = ${lang}`);
      total = Number(c[0]?.count ?? 0);
    } else {
      data = await safe(sql`SELECT id, title, url, source, language, summary, published_at, scraped_at FROM jordan_news ORDER BY COALESCE(published_at, scraped_at) DESC LIMIT ${limit} OFFSET ${offset}`);
      const c = await safe(sql`SELECT COUNT(*) as count FROM jordan_news`);
      total = Number(c[0]?.count ?? 0);
    }

    // Mark breaking news (published within last 2 hours)
    const now = Date.now();
    const articles = data.map((a: any) => {
      const published = a.published_at || a.scraped_at;
      const ageMs = published ? now - new Date(published).getTime() : Infinity;
      return {
        ...a,
        is_breaking: ageMs < 2 * 60 * 60 * 1000,   // < 2 hours
        is_today:    ageMs < 24 * 60 * 60 * 1000,   // < 24 hours
      };
    });

    return NextResponse.json({
      articles,
      total,
      page,
      limit,
      sources: sources.map((s: any) => s.val),
    });
  } catch (error) {
    console.error("[api/news]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
