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

function timeAgo(date: string | null): string {
  if (!date) return "Never";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function ScraperDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/scraper-stats");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStats(data);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError("Failed to load stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-sm font-mono">LIVE</span>
          </div>
          <h1 className="text-3xl font-bold mb-1">ChatSouq Scraper</h1>
          <p className="text-zinc-400 text-sm">Amman, Jordan — Data Collection Dashboard</p>
        </div>

        {/* Total */}
        {stats && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
            <p className="text-zinc-400 text-sm mb-1">Total Records Collected</p>
            <p className="text-5xl font-bold">{stats.total.toLocaleString()}</p>
            <p className="text-zinc-500 text-xs mt-2">Last refreshed {timeAgo(lastRefresh.toISOString())}</p>
          </div>
        )}

        {/* Table Stats */}
        {loading && (
          <div className="text-zinc-500 text-sm">Loading stats...</div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-1 gap-3">
            {stats.tables.map((table) => (
              <div
                key={table.name}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-between hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{table.icon}</span>
                  <div>
                    <p className="font-semibold">{table.name}</p>
                    <p className="text-zinc-500 text-xs">{table.source}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">{table.count.toLocaleString()}</p>
                  <p className="text-zinc-500 text-xs">{timeAgo(table.last_scraped)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-zinc-600 text-xs">
          Scrapes every 6 hours · Filtered by Claude AI · Amman only
        </div>
      </div>
    </div>
  );
}
