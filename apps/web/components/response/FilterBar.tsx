"use client";

import { ChevronDown } from "lucide-react";
import { FILTER_CHIPS, type FilterChip, type SortKey } from "../../hooks/useResultsFilter";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "best_match",    label: "Best Match" },
  { value: "highest_rated", label: "Highest Rated" },
  { value: "price_asc",     label: "Price: Low → High" },
  { value: "price_desc",    label: "Price: High → Low" },
];

interface FilterBarProps {
  activeFilter: FilterChip;
  onFilterChange: (f: FilterChip) => void;
  sortBy: SortKey;
  onSortChange: (s: SortKey) => void;
  totalCount: number;
  visibleCount: number;
  isArabic?: boolean;
}

export function FilterBar({
  activeFilter,
  onFilterChange,
  sortBy,
  onSortChange,
  totalCount,
  visibleCount,
  isArabic = false,
}: FilterBarProps) {
  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "nowrap",
        overflowX: "auto",
        paddingBottom: "4px",
      }}
      className="chips-scroll"
    >
      {/* Filter chips */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          flex: 1,
          overflowX: "auto",
          flexShrink: 0,
          minWidth: 0,
        }}
        className="chips-scroll"
      >
        {FILTER_CHIPS.map((chip) => {
          const active = chip === activeFilter;
          return (
            <button
              key={chip}
              onClick={() => onFilterChange(chip)}
              style={{
                flexShrink: 0,
                fontSize: "12px",
                fontWeight: active ? 600 : 400,
                padding: "5px 12px",
                borderRadius: "20px",
                border: `1px solid ${active ? "#C9A84C" : "#E8D5A0"}`,
                background: active ? "#C9A84C" : "transparent",
                color: active ? "#fff" : "#5C4A1E",
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
                lineHeight: 1.4,
              }}
            >
              {chip}
            </button>
          );
        })}
      </div>

      {/* Count + Sort */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexShrink: 0,
          marginLeft: isArabic ? 0 : "auto",
          marginRight: isArabic ? "auto" : 0,
        }}
      >
        <span
          style={{
            fontSize: "12px",
            color: "#9B8A6A",
            whiteSpace: "nowrap",
          }}
        >
          {visibleCount} of {totalCount}
        </span>

        <div style={{ position: "relative" }}>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
            style={{
              fontSize: "12px",
              fontWeight: 500,
              padding: "5px 28px 5px 10px",
              borderRadius: "6px",
              border: "1px solid #E8D5A0",
              background: "#FAFAF8",
              color: "#5C4A1E",
              cursor: "pointer",
              appearance: "none",
              WebkitAppearance: "none",
              outline: "none",
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "#9B8A6A",
            }}
          />
        </div>
      </div>
    </div>
  );
}
