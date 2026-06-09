"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Vendor } from "../../types/vendor";
import { FilterBar } from "./FilterBar";
import { ResultRow } from "./ResultRow";
import { useResultsFilter } from "../../hooks/useResultsFilter";

interface ResultsNavigatorProps {
  vendors: Vendor[];
  isArabic?: boolean;
}

export function ResultsNavigator({ vendors, isArabic = false }: ResultsNavigatorProps) {
  const {
    filtered,
    visible,
    hasMore,
    remaining,
    showMore,
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
  } = useResultsFilter(vendors);

  if (vendors.length === 0) return null;

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        border: "1px solid #E8D5A0",
        borderRadius: "12px",
        overflow: "hidden",
        background: "#FAFAF8",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px 12px",
          borderBottom: "1px solid #F0E8D5",
          background: "#FBF4E3",
        }}
      >
        <h3
          style={{
            margin: "0 0 10px",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#7A5C10",
          }}
        >
          {isArabic ? `جميع النتائج (${vendors.length})` : `All Results (${vendors.length})`}
        </h3>
        <FilterBar
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
          totalCount={filtered.length}
          visibleCount={visible.length}
          isArabic={isArabic}
        />
      </div>

      {/* Rows */}
      <div style={{ padding: "0 20px" }}>
        <AnimatePresence mode="popLayout">
          {visible.map((vendor, i) => (
            <motion.div
              key={vendor.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
            >
              <ResultRow vendor={vendor} index={i} isArabic={isArabic} />
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div
            style={{
              padding: "24px 0",
              textAlign: "center",
              fontSize: "13px",
              color: "#9B8A6A",
              fontStyle: "italic",
            }}
          >
            {isArabic ? "لا توجد نتائج تطابق هذا الفلتر" : "No results match this filter"}
          </div>
        )}
      </div>

      {/* Show more */}
      {hasMore && (
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid #F0E8D5",
            background: "#FBF4E3",
          }}
        >
          <button
            onClick={showMore}
            style={{
              width: "100%",
              background: "none",
              border: "1px solid #C9A84C",
              borderRadius: "8px",
              padding: "9px 0",
              fontSize: "13px",
              fontWeight: 600,
              color: "#7A5C10",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#FBF4E3";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "none";
            }}
          >
            {isArabic
              ? `عرض ${remaining} نتيجة أخرى`
              : `Show ${remaining} more result${remaining !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
