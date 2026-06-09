"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MapPin, Star } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Vendor } from "../../types/vendor";
import { CTAButton } from "./CTAButton";

interface ResultRowProps {
  vendor: Vendor;
  index: number;
  isArabic?: boolean;
}

export function ResultRow({ vendor, index, isArabic = false }: ResultRowProps) {
  const [expanded, setExpanded] = useState(false);

  const hasCTAs =
    vendor.whatsapp || vendor.website || vendor.instagram || vendor.phone || vendor.location;

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        borderBottom: "1px solid #F0E8D5",
        overflow: "hidden",
      }}
    >
      {/* Row header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          padding: "12px 0",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          textAlign: isArabic ? "right" : "left",
        }}
      >
        {/* Rank badge */}
        <span
          style={{
            flexShrink: 0,
            width: "26px",
            height: "26px",
            borderRadius: "50%",
            background: index === 0 ? "#C9A84C" : "#F5EED8",
            color: index === 0 ? "#fff" : "#7A5C10",
            fontSize: "12px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {vendor.rank}
        </span>

        {/* Name + location */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#2C2416",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {isArabic && vendor.nameAr ? vendor.nameAr : vendor.name}
          </span>
          {vendor.location && (
            <span
              style={{
                fontSize: "12px",
                color: "#9B8A6A",
                display: "flex",
                alignItems: "center",
                gap: "3px",
                marginTop: "1px",
              }}
            >
              <MapPin size={10} strokeWidth={2} />
              {vendor.location}
            </span>
          )}
        </div>

        {/* Rating */}
        {vendor.rating != null && (
          <span
            style={{
              flexShrink: 0,
              fontSize: "12px",
              fontWeight: 600,
              color: "#C9A84C",
              display: "flex",
              alignItems: "center",
              gap: "3px",
            }}
          >
            <Star size={11} fill="#C9A84C" strokeWidth={0} />
            {vendor.rating.toFixed(1)}
          </span>
        )}

        {/* Price */}
        {vendor.priceRange && (
          <span
            style={{
              flexShrink: 0,
              fontSize: "12px",
              color: "#7A5C10",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            {vendor.priceRange}
          </span>
        )}

        {/* Expand chevron */}
        <span style={{ flexShrink: 0, color: "#C9A84C" }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ paddingBottom: "14px", paddingLeft: "38px" }}>
              {/* Why it fits */}
              {vendor.whyItFits && (
                <p
                  style={{
                    fontSize: "13px",
                    lineHeight: 1.6,
                    color: "#5C4A1E",
                    margin: "0 0 10px",
                    fontStyle: "italic",
                  }}
                >
                  {vendor.whyItFits}
                </p>
              )}

              {/* Tags */}
              {vendor.tags.length > 0 && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                  {vendor.tags.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "10px",
                        background: "#FBF4E3",
                        border: "1px solid #E8D5A0",
                        color: "#7A5C10",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* CTAs */}
              {hasCTAs && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {vendor.whatsapp && <CTAButton type="whatsapp" value={vendor.whatsapp} />}
                  {vendor.website && <CTAButton type="website" value={vendor.website} />}
                  {vendor.instagram && <CTAButton type="instagram" value={vendor.instagram} />}
                  {vendor.phone && <CTAButton type="phone" value={vendor.phone} />}
                  {vendor.location && <CTAButton type="directions" value={vendor.address ?? vendor.location} />}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
