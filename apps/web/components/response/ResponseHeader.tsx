"use client";

import { motion } from "framer-motion";

interface ResponseHeaderProps {
  query: string;
  category: string;
  location: string;
  totalResults: number;
  responseTimeMs: number;
  isArabic?: boolean;
}

export function ResponseHeader({
  query,
  category,
  location,
  totalResults,
  responseTimeMs,
  isArabic = false,
}: ResponseHeaderProps) {
  const secStr = (responseTimeMs / 1000).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      dir={isArabic ? "rtl" : "ltr"}
      style={{ display: "flex", flexDirection: "column", gap: "8px" }}
    >
      {/* Category tag */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "3px 10px",
            borderRadius: "4px",
            background: "#FBF4E3",
            border: "1px solid #E8D5A0",
            color: "#7A5C10",
          }}
        >
          {category}
        </span>

        <span style={{ fontSize: "11px", color: "#9B8A6A" }}>
          {location}
        </span>
      </div>

      {/* Query heading */}
      <h1
        style={{
          margin: 0,
          fontSize: isArabic ? "1.5rem" : "1.6rem",
          fontWeight: 700,
          color: "#2C2416",
          fontFamily: isArabic
            ? "'Noto Serif Arabic', serif"
            : "var(--font-playfair), 'Playfair Display', Georgia, serif",
          lineHeight: 1.25,
        }}
      >
        {query}
      </h1>

      {/* Meta line */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "12px",
          color: "#9B8A6A",
        }}
      >
        <span>
          {isArabic
            ? `${totalResults} نتيجة`
            : `${totalResults} result${totalResults !== 1 ? "s" : ""}`}
        </span>
        <span style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#D4C5A0", display: "inline-block" }} />
        <span>
          {isArabic ? `في ${secStr}ث` : `${secStr}s`}
        </span>
      </div>
    </motion.div>
  );
}
