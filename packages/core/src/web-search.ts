/**
 * web-search.ts
 *
 * Thin wrapper around Tavily Search API — purpose-built for AI agents, returns
 * clean text snippets (not raw HTML) that can be injected directly into Claude's
 * context window.
 *
 * Falls back silently to [] when TAVILY_API_KEY is not set, so the rest of the
 * app keeps working without it.
 *
 * Sign up free at https://tavily.com — 1 000 searches/month on the free tier.
 * Set TAVILY_API_KEY in your .env / Vercel environment variables.
 */

export interface WebResult {
  title: string;
  url: string;
  content: string; // clean 1-3 sentence snippet, ready to paste into a prompt
  score: number;   // relevance 0-1
}

export interface WebSearchOptions {
  maxResults?: number;           // default 5
  searchDepth?: "basic" | "advanced"; // basic = faster, advanced = more thorough
  topic?: "general" | "news";   // "news" biases toward recent articles
  days?: number;                 // when topic=news, restrict to this many days back
}

/**
 * Search the web and return AI-ready snippets. Runs in ~400-800ms.
 * Always appends "Jordan" to the query to keep results geo-relevant.
 */
export async function webSearch(
  query: string,
  opts: WebSearchOptions = {}
): Promise<WebResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const {
    maxResults   = 5,
    searchDepth  = "basic",
    topic        = "general",
    days,
  } = opts;

  // Ensure every search is Jordan-scoped unless it already mentions Jordan
  const jordanQuery = /jordan|الأردن|أردن/i.test(query) ? query : `${query} Jordan`;

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key:      apiKey,
        query:        jordanQuery,
        search_depth: searchDepth,
        max_results:  maxResults,
        topic,
        ...(days ? { days } : {}),
        include_answer:      false,
        include_raw_content: false,
        include_images:      false,
      }),
      signal: AbortSignal.timeout(6000), // never block the response more than 6s
    });

    if (!res.ok) return [];
    const data = await res.json() as {
      results?: { title: string; url: string; content: string; score: number }[];
    };

    return (data.results ?? [])
      .filter((r) => r.content && r.content.length > 20)
      .map((r) => ({
        title:   r.title,
        url:     r.url,
        content: r.content.slice(0, 400), // cap snippet length
        score:   r.score ?? 0,
      }))
      .sort((a, b) => b.score - a.score);
  } catch {
    // Network error, timeout, or bad JSON — fail silently
    return [];
  }
}

/**
 * Format web results as a context block ready to paste into a system prompt.
 * Returns empty string when results is empty.
 */
export function formatWebResults(results: WebResult[], label = "LIVE WEB SEARCH RESULTS"): string {
  if (results.length === 0) return "";
  return (
    `\n${label} (current data from the internet — use alongside your knowledge for accuracy):\n` +
    results
      .map((r) => `- [${r.title}]: ${r.content}`)
      .join("\n")
  );
}
