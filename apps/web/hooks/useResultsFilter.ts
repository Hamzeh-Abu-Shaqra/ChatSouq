"use client";

import { useState, useMemo } from "react";
import type { Vendor } from "../types/vendor";

export type SortKey = "best_match" | "highest_rated" | "price_asc" | "price_desc";

export const FILTER_CHIPS = [
  "All",
  "Under 30 JOD",
  "Under 50 JOD",
  "Outdoor seating",
  "Open now",
  "Reservations",
  "Rooftop",
  "★ 4.5+",
] as const;

export type FilterChip = (typeof FILTER_CHIPS)[number];

function matchesFilter(v: Vendor, filter: FilterChip): boolean {
  const tagsLower = v.tags.map((t) => t.toLowerCase());
  switch (filter) {
    case "All": return true;
    case "Under 30 JOD": return v.maxPrice != null ? v.maxPrice <= 30 : false;
    case "Under 50 JOD": return v.maxPrice != null ? v.maxPrice <= 50 : false;
    case "Outdoor seating":
      return tagsLower.some((t) => /outdoor|terrace|rooftop|garden|open.air/i.test(t));
    case "Open now": return v.openNow === true;
    case "Reservations":
      return tagsLower.some((t) => /reserv|booking|book/i.test(t));
    case "Rooftop":
      return tagsLower.some((t) => /rooftop|roof.top/i.test(t));
    case "★ 4.5+": return v.rating != null ? v.rating >= 4.5 : false;
    default: return true;
  }
}

function sortVendors(vendors: Vendor[], sort: SortKey): Vendor[] {
  const copy = [...vendors];
  switch (sort) {
    case "best_match": return copy.sort((a, b) => a.rank - b.rank);
    case "highest_rated": return copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "price_asc": return copy.sort((a, b) => (a.minPrice ?? 0) - (b.minPrice ?? 0));
    case "price_desc": return copy.sort((a, b) => (b.maxPrice ?? 0) - (a.maxPrice ?? 0));
    default: return copy;
  }
}

const PAGE_SIZE = 8;

export function useResultsFilter(vendors: Vendor[]) {
  const [activeFilter, setActiveFilter] = useState<FilterChip>("All");
  const [sortBy, setSortBy] = useState<SortKey>("best_match");
  const [showCount, setShowCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const f = vendors.filter((v) => matchesFilter(v, activeFilter));
    return sortVendors(f, sortBy);
  }, [vendors, activeFilter, sortBy]);

  const visible  = filtered.slice(0, showCount);
  const hasMore  = showCount < filtered.length;
  const remaining = filtered.length - showCount;

  function showMore() {
    setShowCount((n) => n + PAGE_SIZE);
  }

  function reset() {
    setActiveFilter("All");
    setSortBy("best_match");
    setShowCount(PAGE_SIZE);
  }

  return {
    filtered,
    visible,
    hasMore,
    remaining,
    showMore,
    reset,
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
  };
}
