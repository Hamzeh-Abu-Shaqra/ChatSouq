/**
 * Search history signals for ChatSouq.
 *
 * Reads from localStorage (chatsouq_local_history — the existing key used by chat/page.tsx)
 * and infers lightweight profile signals: budget preference, neighbourhood affinity,
 * and category interests. All data stays in the browser; nothing is sent to third parties.
 */

import type { HistoryContext, RecentQuery } from "@chatsouq/core";
import { NEIGHBORHOOD_CANONICAL } from "@chatsouq/core";

const HISTORY_KEY = "chatsouq_local_history"; // matches chat/page.tsx

interface StoredHistoryItem {
  id: number;
  query: string;
  timestamp: number;
}

// ── Budget signal keywords ────────────────────────────────────────────────────

const BUDGET_KW   = /\b(cheap|budget|affordable|rخيص|رخيص|اقتصادي|سعر مناسب)\b/i;
const UPSCALE_KW  = /\b(luxury|upscale|fine dining|premium|fancy|فاخر|راقي|فخم)\b/i;
const MID_KW      = /\b(reasonable|moderate|mid.?range|good value)\b/i;

// ── Category hint patterns ────────────────────────────────────────────────────

const CATEGORY_PATTERNS: Array<{ cat: string; re: RegExp }> = [
  { cat: "restaurant", re: /\b(restaurant|dinner|lunch|eat|food|مطعم|اكل|عشاء|غداء)\b/i },
  { cat: "cafe", re: /\b(cafe|coffee|كافيه|قهوة|مقهى)\b/i },
  { cat: "gym", re: /\b(gym|fitness|workout|جيم|رياضة)\b/i },
  { cat: "spa", re: /\b(spa|massage|salon|سبا|مساج|صالون)\b/i },
  { cat: "Electronics", re: /\b(phone|laptop|headphones|electronics|تلفون|لابتوب|الكترونيات)\b/i },
  { cat: "Fashion & Clothing", re: /\b(clothes|clothing|shoes|fashion|ملابس|احذية|موضة)\b/i },
  { cat: "Toys & Games", re: /\b(game|toy|kids|gift|لعبة|هدية|اطفال)\b/i },
];

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build a HistoryContext from the user's local query history.
 * Returns null if localStorage is unavailable (SSR) or history is empty.
 */
export function getHistoryContext(): HistoryContext | null {
  if (typeof window === "undefined") return null;

  let items: StoredHistoryItem[] = [];
  try {
    items = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return null;
  }
  if (!items.length) return null;

  // Only use queries from the last 7 days
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = items
    .filter((h) => h.timestamp > cutoff)
    .slice(0, 20);

  if (!recent.length) return null;

  const recentQueries: RecentQuery[] = recent.map((h) => ({
    query: h.query,
    timestamp: h.timestamp,
    kind: null, // kind is not stored in the local history
  }));

  // ── Infer budget preference ─────────────────────────────────────────────────
  let budgetVotes = 0, upscaleVotes = 0, midVotes = 0;
  for (const h of recent) {
    if (BUDGET_KW.test(h.query))  budgetVotes++;
    if (UPSCALE_KW.test(h.query)) upscaleVotes++;
    if (MID_KW.test(h.query))     midVotes++;
  }
  let inferredBudget: HistoryContext["inferredBudget"] = null;
  const total = budgetVotes + upscaleVotes + midVotes;
  if (total >= 2) {
    if (upscaleVotes >= budgetVotes && upscaleVotes >= midVotes) inferredBudget = "upscale";
    else if (budgetVotes >= upscaleVotes && budgetVotes >= midVotes) inferredBudget = "budget";
    else inferredBudget = "mid_range";
  }

  // ── Infer neighbourhood preference ─────────────────────────────────────────
  const neighbourhoodVotes = new Map<string, number>();
  const allAliases = Object.entries(NEIGHBORHOOD_CANONICAL).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const h of recent) {
    const lower = h.query.toLowerCase();
    for (const [alias, canonical] of allAliases) {
      if (lower.includes(alias)) {
        neighbourhoodVotes.set(canonical, (neighbourhoodVotes.get(canonical) ?? 0) + 1);
        break; // only count the first match per query
      }
    }
  }
  let inferredNeighborhood: string | null = null;
  let maxVotes = 0;
  for (const [nb, votes] of neighbourhoodVotes) {
    if (votes > maxVotes) { maxVotes = votes; inferredNeighborhood = nb; }
  }
  // Only surface if ≥2 queries mention the same neighbourhood
  if (maxVotes < 2) inferredNeighborhood = null;

  // ── Infer preferred categories ──────────────────────────────────────────────
  const catVotes = new Map<string, number>();
  for (const h of recent) {
    for (const { cat, re } of CATEGORY_PATTERNS) {
      if (re.test(h.query)) catVotes.set(cat, (catVotes.get(cat) ?? 0) + 1);
    }
  }
  const preferredCategories = [...catVotes.entries()]
    .filter(([, v]) => v >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  return {
    recentQueries: recentQueries.slice(0, 10),
    inferredBudget,
    inferredNeighborhood,
    preferredCategories,
    avoidedVendorIds: [], // future: populated from explicit "not this vendor" feedback
  };
}

/**
 * Record a query into local history with kind tagging.
 * Called after a response is received so we can tag by kind.
 */
export function recordQueryKind(query: string, kind: RecentQuery["kind"]): void {
  if (typeof window === "undefined") return;
  const SIGNAL_KEY = "chatsouq_signal_kinds";
  try {
    const existing: Record<string, RecentQuery["kind"]> = JSON.parse(
      localStorage.getItem(SIGNAL_KEY) ?? "{}"
    );
    // Normalise key
    const key = query.toLowerCase().trim().slice(0, 100);
    existing[key] = kind;
    // Keep only last 50 entries
    const keys = Object.keys(existing);
    if (keys.length > 50) {
      const toDelete = keys.slice(0, keys.length - 50);
      for (const k of toDelete) delete existing[k];
    }
    localStorage.setItem(SIGNAL_KEY, JSON.stringify(existing));
  } catch {
    // localStorage errors are silent
  }
}
