"use client";

import { MapPin, Star, ShieldCheck, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import type { Vendor } from "../../types/vendor";
import { CTAButton } from "./CTAButton";

interface ResultCardProps {
  vendor: Vendor;
  index: number;
  isArabic?: boolean;
}

export function ResultCard({ vendor, index, isArabic = false }: ResultCardProps) {
  const name = isArabic && vendor.nameAr ? vendor.nameAr : vendor.name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07, ease: "easeOut" }}
      style={{
        border: "1px solid #E8D5A0",
        borderRadius: "10px",
        padding: "16px",
        background: "#FAFAF8",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        position: "relative",
      }}
      dir={isArabic ? "rtl" : "ltr"}
    >
      {/* Rank badge */}
      <span
        style={{
          position: "absolute",
          top: "12px",
          right: isArabic ? "auto" : "12px",
          left: isArabic ? "12px" : "auto",
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          background: "#F5EED8",
          color: "#7A5C10",
          fontSize: "11px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {vendor.rank}
      </span>

      {/* Name */}
      <h3
        style={{
          margin: 0,
          fontSize: "15px",
          fontWeight: 700,
          color: "#2C2416",
          fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
          lineHeight: 1.3,
          paddingRight: isArabic ? 0 : "28px",
          paddingLeft: isArabic ? "28px" : 0,
        }}
      >
        {name}
      </h3>

      {/* Category + Tavily badges + rating */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "10px",
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
              fontSize: "10px",
              fontWeight: 600,
              color: "#1a6e45",
              background: "#f0fdf4",
              border: "1px solid #86efac",
              padding: "1px 6px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "3px",
              whiteSpace: "nowrap",
            }}
          >
            <ShieldCheck size={9} strokeWidth={2} />
            {isArabic ? "موثَّق" : "Verified"}
          </span>
        )}

        {/* Warning flags */}
        {vendor.warningFlags && vendor.warningFlags.length > 0 && (
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              color: "#92400e",
              background: "#fffbeb",
              border: "1px solid #fcd34d",
              padding: "1px 6px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "3px",
              whiteSpace: "nowrap",
            }}
          >
            <AlertTriangle size={9} strokeWidth={2} />
            {vendor.warningFlags[0]}
          </span>
        )}

        {vendor.rating != null && (
          <span
            style={{
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
        {vendor.priceRange && (
          <span style={{ fontSize: "12px", color: "#9B8A6A", marginLeft: "auto" }}>
            {vendor.priceRange}
          </span>
        )}
      </div>

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
          <MapPin size={11} strokeWidth={2} />
          {vendor.neighborhood ?? vendor.location}
        </span>
      )}

      {/* Why it fits */}
      {vendor.whyItFits && (
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            lineHeight: 1.6,
            color: "#5C4A1E",
            fontStyle: "italic",
            flex: 1,
          }}
        >
          {vendor.whyItFits}
        </p>
      )}

      {/* Tags */}
      {vendor.tags.length > 0 && (
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {vendor.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: "11px",
                padding: "2px 7px",
                borderRadius: "10px",
                background: "#F5EED8",
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
      <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "auto" }}>
        {vendor.whatsapp && <CTAButton type="whatsapp" value={vendor.whatsapp} />}
        {vendor.website && <CTAButton type="website" value={vendor.website} />}
        {vendor.phone && !vendor.whatsapp && <CTAButton type="phone" value={vendor.phone} />}
        {!vendor.whatsapp && !vendor.website && vendor.location && (
          <CTAButton type="directions" value={vendor.address ?? vendor.location} />
        )}
      </div>
    </motion.div>
  );
}
