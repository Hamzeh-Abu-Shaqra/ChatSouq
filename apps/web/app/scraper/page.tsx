"use client";

import { useEffect, useState } from "react";

interface TableStat {
  name: string;
  source: string;
  icon: string;
  count: number;
  last_scraped: string | null;
}

interface Stats {
  tables: TableStat[];
  total: number;
}

interface DataRow {
  [key: string]: any;
}

const TABS = [
  { key: "news",        label: "News",        icon: "📰" },
  { key: "food",        label: "Food & Drink", icon: "🍽️" },
  { key: "health",      label: "Health",       icon: "🏥" },
  { key: "shopping",    label: "Shopping",     icon: "🛍️" },
  { key: "services",    label: "Services",     icon: "🔧" },
  { key: "education",   label: "Education",    icon: "🎓" },
  { key: "hospitality", label: "Hotels",       icon: "🏨" },
  { key: "religion",    label: "Mosques",      icon: "🕌" },
  { key: "people",      label: "People",       icon: "👤" },
  { key: "listings",    label: "Listings",     icon: "🛒" },
];

const COLUMNS: Record<string, string[]> = {
  news:        ["title", "source", "scraped_at"],
  food:        ["name", "subcategory", "rating", "address", "delivery_time", "source"],
  health:      ["name", "subcategory", "address", "rating", "phone"],
  shopping:    ["name", "subcategory", "address", "rating"],
  services:    ["name", "subcategory", "address", "phone"],
  education:   ["name", "subcategory", "address"],
  hospitality: ["name", "address", "rating"],
  religion:    ["name", "address"],
  people:      ["name", "title", "subcategory", "specialty", "organization", "phone"],
  listings:    ["title", "price", "location", "category"],
};

function timeAgo(date: string | null): string {
  if (!date) return "Never";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatValue(key: string, value: any): string {
  if (!value) return "—";
  if (key === "scraped_at") return timeAgo(value);
  if (key === "url") return "🔗";
  if (typeof value === "number") return value.toLocaleString();
  const str = String(value);
  return str.length > 60 ? str.slice(0, 60) + "..." : str;
}

export default function ScraperDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState("news");
  const [data, setData] = useState<DataRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/scraper-stats?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json && json.tables) setStats(json);
    } catch (e) {
      console.error("fetchStats error:", e);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchData = async (tab: string, p: number, cat: string = category, q: string = search) => {
    setLoadingData(true);
    try {
      const params = new URLSearchParams({ table: tab, page: String(p), t: String(Date.now()) });
      if (cat) params.set("category", cat);
      if (q) params.set("search", q);
      const res = await fetch(`/api/scraper-data?${params}`, { cache: "no-store" });
      const json = await res.json();
      setData(json.data ?? []);
      setTotal(json.total ?? 0);
      if (json.categories?.length) setCategories(json.categories);
    } finally {
      setLoadingData(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchData(activeTab, page)]);
    setLastRefresh(new Date());
    setRefreshing(false);
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
      fetchStats();
      fetchData(activeTab, page);
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab, page]);

  useEffect(() => {
    setPage(1);
    setCategory("");
    setSearch("");
    setCategories([]);
    fetchData(activeTab, 1, "", "");
  }, [activeTab]);

  useEffect(() => {
    fetchData(activeTab, page);
  }, [page]);

  const columns = COLUMNS[activeTab] ?? [];
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${refreshing ? "bg-yellow-400" : "bg-green-400 animate-pulse"}`} />
              <span className={`text-xs font-mono ${refreshing ? "text-yellow-400" : "text-green-400"}`}>
                {refreshing ? "REFRESHING..." : "LIVE"}
              </span>
              <span className="text-zinc-600 text-xs">· refreshes every 30s</span>
            </div>
            <h1 className="text-2xl font-bold">ChatSouq Scraper</h1>
            <p className="text-zinc-500 text-sm">Amman, Jordan · Last updated: {timeAgo(lastRefresh.toISOString())}</p>
          </div>
          <div className="flex items-center gap-4">
            {stats && (
              <div className="text-right">
                <p className="text-3xl font-bold">{stats.total.toLocaleString()}</p>
                <p className="text-zinc-500 text-xs">total records</p>
              </div>
            )}
            <button
              onClick={refresh}
              disabled={refreshing}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm disabled:opacity-50 transition-colors"
            >
              {refreshing ? "⟳" : "↺"} Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="border-b border-zinc-800 px-8 py-4">
          <div className="max-w-7xl mx-auto grid grid-cols-5 lg:grid-cols-10 gap-3">
            {stats.tables.map((t) => (
              <div key={t.name} className="text-center">
                <p className="text-lg font-bold">{t.count.toLocaleString()}</p>
                <p className="text-zinc-500 text-xs">{t.icon} {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-8 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-white text-black"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
              fetchData(activeTab, 1, category, e.target.value);
            }}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 w-64"
          />
          {categories.length > 0 && (
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
                fetchData(activeTab, 1, e.target.value, search);
              }}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {(search || category) && (
            <button
              onClick={() => {
                setSearch("");
                setCategory("");
                setPage(1);
                fetchData(activeTab, 1, "", "");
              }}
              className="px-3 py-2 bg-zinc-800 rounded-lg text-sm text-zinc-400 hover:bg-zinc-700"
            >
              ✕ Clear
            </button>
          )}
          <span className="text-zinc-500 text-sm self-center">{total.toLocaleString()} results</span>
        </div>

        {/* Data Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {loadingData ? (
            <div className="p-8 text-center text-zinc-500 text-sm">Loading...</div>
          ) : data.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">
              No data yet — scraper hasn't run for this source
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {columns.map((col) => (
                      <th key={col} className="text-left px-4 py-3 text-zinc-400 font-medium capitalize">
                        {col.replace("_", " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      {columns.map((col) => (
                        <td key={col} className="px-4 py-3 text-zinc-300">
                          {col === "url" && row[col] ? (
                            <a href={row[col]} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                              🔗 Link
                            </a>
                          ) : col === "title" && row["url"] ? (
                            <a href={row["url"]} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                              {formatValue(col, row[col])}
                            </a>
                          ) : (
                            formatValue(col, row[col])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-zinc-500 text-sm">{total.toLocaleString()} records</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded bg-zinc-800 text-sm disabled:opacity-30 hover:bg-zinc-700"
              >
                ← Prev
              </button>
              <span className="px-3 py-1 text-sm text-zinc-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded bg-zinc-800 text-sm disabled:opacity-30 hover:bg-zinc-700"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        <p className="mt-6 text-zinc-600 text-xs">
          Scrapes every 6 hours · Filtered by Claude AI · Amman only
        </p>
      </div>
    </div>
  );
}
