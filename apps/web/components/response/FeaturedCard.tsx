"use client";

import { useState } from "react";
import { MapPin, Star, Clock, ShieldCheck, AlertTriangle, X } from "lucide-react";
import { motion } from "framer-motion";
import type { Vendor } from "../../types/vendor";
import { CTAButton } from "./CTAButton";
import { recordAvoidedVendor } from "../../lib/signals/searchHistory";

interface FeaturedCardProps {
  vendor: Vendor;
  isArabic?: boolean;
}

export function FeaturedCard({ vendor, isArabic = false }: FeaturedCardProps) {
  const name = isArabic && vendor.nameAr ? vendor.nameAr : vendor.name;
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return (
      <div
        style={{
          border: "1px solid #E8D5A0",
          borderRadius: "12px",
          padding: "16px 24px",
          background: "#FAFAF8",
          color: "#9B8A6A",
          fontSize: "13px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>{isArabic ? "تم الإخفاء ✓ لن يظهر هذا المكان في البحثات القادمة" : "Dismissed ✓ — won't appear in future searches"}</span>
        <button
          onClick={() => setDismissed(false)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#C9A84C", fontSize: "12px" }}
        >
          {isArabic ? "تراجع" : "Undo"}
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        border: "1px solid #E8D5A0",
        borderRadius: "12px",
        overflow: "hidden",
        background: "#FAFAF8",
        boxShadow: "0 2px 12px rgba(201,168,76,0.10)",
      }}
    >
      {/* Gold header bar */}
      <div
        style={{
          height: "4px",
          background: "linear-gradient(90deg, #C9A84C 0%, #E8D5A0 60%, #FBF4E3 100%)",
        }}
      />

      <div style={{ padding: "24px" }}>
        {/* Top Pick badge + name + dismiss */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "14px" }}>
          <span
            style={{
              flexShrink: 0,
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "3px 10px",
              borderRadius: "4px",
              background: "#C9A84C",
              color: "#fff",
              marginTop: "3px",
            }}
          >
            {isArabic ? "الاختيار الأول" : "Top Pick"}
          </span>

          <h2
            style={{
              margin: 0,
              fontSize: "1.35rem",
              fontWeight: 700,
              color: "#2C2416",
              fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
              lineHeight: 1.25,
              flex: 1,
            }}
          >
            {name}
          </h2>

          {/* Dismiss button */}
          <button
            title={isArabic ? "إخفاء هذا المكان" : "Not for me"}
            onClick={() => {
              recordAvoidedVendor(vendor.id);
              setDismissed(true);
            }}
            style={{
              flexShrink: 0,
              background: "none",
              border: "1px solid #E8D5A0",
              borderRadius: "6px",
              cursor: "pointer",
              color: "#9B8A6A",
              padding: "3px 6px",
              display: "flex",
              alignItems: "center",
              gap: "3px",
              fontSize: "11px",
              marginTop: "2px",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#C9A84C"; (e.currentTarget as HTMLButtonElement).style.color = "#5C4A1E"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E8D5A0"; (e.currentTarget as HTMLButtonElement).style.color = "#9B8A6A"; }}
          >
            <X size={11} strokeWidth={2} />
            {isArabic ? "إخفاء" : "Not for me"}
          </button>
        </div>

        {/* Meta row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}
        >
          {/* Category */}
          <span
            style={{
              fontSize: "12px",
              padding: "3px 10px",
              borderRadius: "12px",
              background: "#FBF4E3",
              border: "1px solid #E8D5A0",
              color: "#7A5C10",
              fontWeight: 500,
            }}
          >
            {vendor.category}
          </span>

          {/* Tavily verified badge */}
          {vendor.tavilyValidated && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#1a6e45",
                background: "#f0fdf4",
                border: "1px solid #86efac",
                padding: "2px 8px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                whiteSpace: "nowrap",
              }}
            >
              <ShieldCheck size={11} strokeWidth={2} />
              {isArabic ? "موثَّق" : "Verified online"}
            </span>
          )}

          {/* Warning flags from Tavily */}
          {vendor.warningFlags && vendor.warningFlags.length > 0 && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#92400e",
                background: "#fffbeb",
                border: "1px solid #fcd34d",
                padding: "2px 8px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                whiteSpace: "nowrap",
              }}
            >
              <AlertTriangle size={11} strokeWidth={2} />
              {vendor.warningFlags[0]}
            </span>
          )}

          {/* Rating */}
          {vendor.rating != null && (
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#C9A84C",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Star size={13} fill="#C9A84C" strokeWidth={0} />
              {vendor.rating.toFixed(1)}
              {vendor.reviewCount != null && (
                <span style={{ fontSize: "11px", fontWeight: 400, color: "#9B8A6A" }}>
                  ({vendor.reviewCount.toLocaleString()})
                </span>
              )}
            </span>
          )}

          {/* Price */}
          {vendor.priceRange && (
            <span style={{ fontSize: "13px", color: "#7A5C10", fontWeight: 500 }}>
              {vendor.priceRange}
            </span>
          )}

          {/* Location */}
          {vendor.location && (
            <span
              style={{
                fontSize: "12px",
                color: "#9B8A6A",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <MapPin size={12} strokeWidth={2} />
              {vendor.neighborhood ?? vendor.location}
            </span>
          )}

          {/* Hours / Open now */}
          {vendor.hours && (
            <span
              style={{
                fontSize: "12px",
                color: "#9B8A6A",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Clock size={12} strokeWidth={2} />
              {vendor.hours}
            </span>
          )}

          {vendor.openNow != null && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: vendor.openNow ? "#1a9e4d" : "#c0392b",
                background: vendor.openNow ? "#f0fdf4" : "#fff5f5",
                border: `1px solid ${vendor.openNow ? "#86efac" : "#fca5a5"}`,
                padding: "2px 8px",
                borderRadius: "10px",
              }}
            >
              {vendor.openNow
                ? isArabic ? "مفتوح الآن" : "Open now"
                : isArabic ? "مغلق الآن" : "Closed"}
            </span>
          )}
        </div>

        {/* Why it fits */}
        {vendor.whyItFits && (
          <p
            style={{
              fontSize: "14px",
              lineHeight: 1.7,
              color: "#5C4A1E",
              margin: "0 0 16px",
              fontStyle: "italic",
            }}
          >
            {vendor.whyItFits}
          </p>
        )}

        {/* Tags */}
        {vendor.tags.length > 0 && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "18px" }}>
            {vendor.tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: "12px",
                  padding: "3px 10px",
                  borderRadius: "12px",
                  background: "#F5EED8",
                  color: "#7A5C10",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* CTA row */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {vendor.whatsapp && <CTAButton type="whatsapp" value={vendor.whatsapp} />}
          {vendor.website && <CTAButton type="website" value={vendor.website} />}
          {vendor.instagram && <CTAButton type="instagram" value={vendor.instagram} />}
          {vendor.phone && <CTAButton type="phone" value={vendor.phone} />}
          {vendor.location && (
            <CTAButton type="directions" value={vendor.address ?? vendor.location} />
          )}
        </div>
      </div>
    </motion.div>
  );
}
