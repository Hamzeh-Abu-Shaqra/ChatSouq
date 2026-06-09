"use client";

import { motion } from "framer-motion";
import type { ChatResponse } from "../../types/vendor";
import { ResponseHeader } from "./ResponseHeader";
import { EditorialText } from "./EditorialText";
import { FeaturedCard } from "./FeaturedCard";
import { ResultCard } from "./ResultCard";
import { ResultsNavigator } from "./ResultsNavigator";
import { ResponseSkeleton } from "./SkeletonCard";
import { useArabicFonts } from "../../hooks/useRTL";

interface ResponseContainerProps {
  response: ChatResponse | null;
  isLoading?: boolean;
  isStreaming?: boolean;
  streamingIntro?: string;
}

export function ResponseContainer({
  response,
  isLoading = false,
  isStreaming = false,
  streamingIntro,
}: ResponseContainerProps) {
  const isArabic = response?.isArabic ?? false;
  useArabicFonts(isArabic);

  if (isLoading && !response) {
    return (
      <div style={{ maxWidth: "780px", margin: "0 auto", padding: "24px 16px" }}>
        <ResponseSkeleton />
      </div>
    );
  }

  if (!response) return null;

  const {
    query,
    category,
    location,
    totalResults,
    responseTimeMs,
    editorialIntro,
    connectorText,
    insightText,
    featuredVendor,
    gridVendors,
    allVendors,
    followUpPrompts,
  } = response;

  // The intro shown — use streaming version if available during stream
  const introText = (isStreaming && streamingIntro) ? streamingIntro : editorialIntro;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        maxWidth: "780px",
        margin: "0 auto",
        padding: "24px 16px 48px",
        display: "flex",
        flexDirection: "column",
        gap: "28px",
        fontFamily: isArabic
          ? "'Noto Sans Arabic', 'Noto Serif Arabic', sans-serif"
          : "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* 1. Header — query + category + timing */}
      <ResponseHeader
        query={query}
        category={category}
        location={location}
        totalResults={totalResults}
        responseTimeMs={responseTimeMs}
        isArabic={isArabic}
      />

      {/* 2. Editorial intro + connector + insight */}
      {introText && (
        <EditorialText
          intro={introText}
          connector={isStreaming ? undefined : connectorText}
          insight={isStreaming ? undefined : insightText}
          isArabic={isArabic}
          isStreaming={isStreaming}
        />
      )}

      {/* 3. Featured card — #1 result */}
      {featuredVendor && (
        <FeaturedCard vendor={featuredVendor} isArabic={isArabic} />
      )}

      {/* 4. Grid — results #2-#4 */}
      {!isStreaming && gridVendors.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(gridVendors.length, 3)}, 1fr)`,
            gap: "12px",
          }}
        >
          {gridVendors.map((vendor, i) => (
            <ResultCard key={vendor.id} vendor={vendor} index={i} isArabic={isArabic} />
          ))}
        </div>
      )}

      {/* 5. Full results navigator (all vendors, filterable) */}
      {!isStreaming && allVendors.length > 3 && (
        <ResultsNavigator vendors={allVendors} isArabic={isArabic} />
      )}

      {/* 6. Follow-up prompts */}
      {!isStreaming && followUpPrompts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#9B8A6A",
            }}
          >
            {isArabic ? "اقتراحات" : "Explore more"}
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {followUpPrompts.map((prompt, i) => (
              <button
                key={i}
                style={{
                  fontSize: "13px",
                  padding: "7px 14px",
                  borderRadius: "20px",
                  border: "1px solid #E8D5A0",
                  background: "transparent",
                  color: "#5C4A1E",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                  fontWeight: 400,
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "#FBF4E3";
                  el.style.borderColor = "#C9A84C";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "transparent";
                  el.style.borderColor = "#E8D5A0";
                }}
                onClick={() => {
                  // Dispatch a custom event that the parent chat UI can listen to
                  window.dispatchEvent(
                    new CustomEvent("chatsouq:followup", { detail: { prompt } })
                  );
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
