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
  { key: "news", label: "News", icon: "📰", source: "Roya News" },
  { key: "places", label: "Places", icon: "🗺️", source: "Google Maps" },
  { key: "restaurants", label: "Restaurants", icon: "🍔", source: "Talabat" },
  { key: "listings", label: "Listings", icon: "🛒", source: "OpenSooq" },
  { key: "companies", label: "Companies", icon: "💼", source: "LinkedIn" },
];

const COLUMNS: Record<string, string[]> = {
  news: ["title", "source", "scraped_at"],
  places: ["name", "category", "address", "rating", "phone"],
  restaurants: ["name", "cuisine", "rating", "delivery_time"],
  listings: ["title", "price", "location", "category"],
  companies: ["name", "industry", "location"],
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

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/scraper-stats");
      const json = await res.json();
      setStats(json);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchData = async (tab: string, p: number) => {
    setLoadingData(true);
    try {
      const res = await fetch(`/api/scraper-data?table=${tab}&page=${p}`);
      const json = await res.json();
      setData(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setPage(1);
    fetchData(activeTab, 1);
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
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-mono">LIVE</span>
            </div>
            <h1 className="text-2xl font-bold">ChatSouq Scraper</h1>
            <p className="text-zinc-500 text-sm">Amman, Jordan</p>
          </div>
          {stats && (
            <div className="text-right">
              <p className="text-3xl font-bold">{stats.total.toLocaleString()}</p>
              <p className="text-zinc-500 text-xs">total records</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="border-b border-zinc-800 px-8 py-4">
          <div className="max-w-7xl mx-auto grid grid-cols-5 gap-4">
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
        <div className="flex gap-2 mb-6 flex-wrap">
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
