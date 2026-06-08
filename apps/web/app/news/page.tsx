"use client";

import { useEffect, useState, useCallback } from "react";

interface Article {
  id: number;
  title: string;
  url: string;
  source: string;
  language: string;
  summary: string | null;
  published_at: string | null;
  scraped_at: string;
  is_breaking: boolean;
  is_today: boolean;
}

function timeAgo(date: string | null): string {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60)   return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400)return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function langBadge(lang: string) {
  return lang === "ar"
    ? <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/50 text-green-400 font-mono">AR</span>
    : <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400 font-mono">EN</span>;
}

export default function NewsPage() {
  const [articles, setArticles]     = useState<Article[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState("");
  const [source, setSource]         = useState("");
  const [lang, setLang]             = useState("");
  const [sources, setSources]       = useState<string[]>([]);
  const [loading, setLoading]       = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const fetchNews = useCallback(async (p = page, q = search, src = source, l = lang) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        t: String(Date.now()),
        ...(q   && { search: q }),
        ...(src && { source: src }),
        ...(l   && { lang: l }),
      });
      const res  = await fetch(`/api/news?${params}`, { cache: "no-store" });
      const json = await res.json();
      setArticles(json.articles ?? []);
      setTotal(json.total ?? 0);
      if (json.sources?.length) setSources(json.sources);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, source, lang]);

  // Initial load + auto-refresh every 30s
  useEffect(() => {
    fetchNews(1, search, source, lang);
    const interval = setInterval(() => {
      setRefreshing(true);
      fetchNews(1, search, source, lang);
    }, 30_000);
    return () => clearInterval(interval);
  }, [source, lang]);

  useEffect(() => { fetchNews(page); }, [page]);

  const handleSearch = (q: string) => {
    setSearch(q);
    setPage(1);
    fetchNews(1, q, source, lang);
  };

  const breaking = articles.filter(a => a.is_breaking);
  const rest      = articles.filter(a => !a.is_breaking);
  const totalPages = Math.ceil(total / 30);

  return (
    <div className="min-h-screen bg-black text-white">

      {/* ── Header ── */}
      <div className="border-b border-zinc-800 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${refreshing ? "bg-yellow-400" : "bg-red-500 animate-pulse"}`} />
              <span className={`text-xs font-mono ${refreshing ? "text-yellow-400" : "text-red-400"}`}>
                {refreshing ? "REFRESHING" : "LIVE"}
              </span>
              <span className="text-zinc-600 text-xs">· updates every 30s</span>
            </div>
            <h1 className="text-2xl font-bold">📰 Amman Live News</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              {total.toLocaleString()} articles · updated {timeAgo(lastUpdate.toISOString())}
            </p>
          </div>
          <a href="/" className="text-zinc-500 hover:text-white text-sm transition-colors">
            ← ChatSouq
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">

        {/* ── Filters ── */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <input
            type="text"
            placeholder="Search news... (e.g. حادث، traffic)"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="flex-1 min-w-[200px] bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          <select
            value={lang}
            onChange={e => { setLang(e.target.value); setPage(1); fetchNews(1, search, source, e.target.value); }}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
          >
            <option value="">All languages</option>
            <option value="en">🇬🇧 English</option>
            <option value="ar">🇯🇴 Arabic</option>
          </select>
          <select
            value={source}
            onChange={e => { setSource(e.target.value); setPage(1); fetchNews(1, search, e.target.value, lang); }}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
          >
            <option value="">All sources</option>
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(search || source || lang) && (
            <button
              onClick={() => { setSearch(""); setSource(""); setLang(""); setPage(1); fetchNews(1, "", "", ""); }}
              className="px-3 py-2 bg-zinc-800 rounded-lg text-sm text-zinc-400 hover:bg-zinc-700"
            >
              ✕ Clear
            </button>
          )}
        </div>

        {loading && !articles.length ? (
          <div className="text-center py-16 text-zinc-500">Loading news...</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">No articles found</div>
        ) : (
          <>
            {/* ── Breaking News ── */}
            {breaking.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded animate-pulse">
                    🔴 BREAKING
                  </span>
                  <span className="text-zinc-500 text-xs">Last 2 hours</span>
                </div>
                <div className="space-y-2">
                  {breaking.map(a => <ArticleCard key={a.id} article={a} highlight />)}
                </div>
              </div>
            )}

            {/* ── All Articles ── */}
            {rest.length > 0 && (
              <div className="space-y-2">
                {breaking.length > 0 && (
                  <p className="text-zinc-600 text-xs uppercase tracking-wider mb-3">Earlier</p>
                )}
                {rest.map(a => <ArticleCard key={a.id} article={a} />)}
              </div>
            )}

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-8">
                <span className="text-zinc-500 text-sm">{total.toLocaleString()} articles</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded bg-zinc-800 text-sm disabled:opacity-30 hover:bg-zinc-700"
                  >
                    ← Prev
                  </button>
                  <span className="px-3 py-1.5 text-sm text-zinc-400">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded bg-zinc-800 text-sm disabled:opacity-30 hover:bg-zinc-700"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ArticleCard({ article: a, highlight = false }: { article: Article; highlight?: boolean }) {
  const date = a.published_at || a.scraped_at;
  const ago  = timeAgo(date);

  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block p-4 rounded-xl border transition-all group ${
        highlight
          ? "border-red-900/50 bg-red-950/20 hover:bg-red-950/40"
          : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/70"
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        {langBadge(a.language)}
        <span className="text-zinc-500 text-xs">{a.source}</span>
        <span className="text-zinc-700 text-xs">·</span>
        <span className={`text-xs font-mono ${a.is_breaking ? "text-red-400 font-semibold" : "text-zinc-500"}`}>
          {ago}
        </span>
      </div>
      <p className={`text-sm font-medium leading-snug group-hover:text-white transition-colors ${
        a.language === "ar" ? "text-right" : ""
      } ${highlight ? "text-white" : "text-zinc-200"}`}
        dir={a.language === "ar" ? "rtl" : "ltr"}
      >
        {a.title}
      </p>
      {a.summary && (
        <p className={`text-xs text-zinc-500 mt-1 leading-relaxed line-clamp-2 ${
          a.language === "ar" ? "text-right" : ""
        }`} dir={a.language === "ar" ? "rtl" : "ltr"}>
          {a.summary}
        </p>
      )}
    </a>
  );
}
