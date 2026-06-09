"use client";

import { MessageCircle, Globe, ExternalLink, MapPin, Phone } from "lucide-react";

export type CTAType = "whatsapp" | "website" | "instagram" | "directions" | "phone";

interface CTAButtonProps {
  type: CTAType;
  value: string;
  label?: string;
}

function buildHref(type: CTAType, value: string): string {
  switch (type) {
    case "whatsapp": {
      const digits = value.replace(/\D/g, "");
      const normalized = digits.startsWith("962") ? digits : digits.startsWith("0") ? `962${digits.slice(1)}` : `962${digits}`;
      return `https://wa.me/${normalized}`;
    }
    case "website":
      return value.startsWith("http") ? value : `https://${value}`;
    case "instagram":
      return value.startsWith("http") ? value : `https://instagram.com/${value.replace(/^@/, "")}`;
    case "directions":
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
    case "phone":
      return `tel:${value}`;
  }
}

const ICON_MAP: Record<CTAType, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  whatsapp: MessageCircle,
  website: Globe,
  instagram: ExternalLink,
  directions: MapPin,
  phone: Phone,
};

const DEFAULT_LABELS: Record<CTAType, string> = {
  whatsapp: "WhatsApp",
  website: "Website",
  instagram: "Instagram",
  directions: "Directions",
  phone: "Call",
};

const CTA_COLORS: Record<CTAType, { border: string; text: string; hover: string }> = {
  whatsapp:   { border: "#25D366", text: "#1a9e4d", hover: "#f0fdf4" },
  website:    { border: "#C9A84C", text: "#7A5C10", hover: "#FBF4E3" },
  instagram:  { border: "#E1306C", text: "#b81551", hover: "#fff0f5" },
  directions: { border: "#4A90D9", text: "#2563eb", hover: "#eff6ff" },
  phone:      { border: "#9B59B6", text: "#7c3aed", hover: "#f5f3ff" },
};

export function CTAButton({ type, value, label }: CTAButtonProps) {
  const Icon = ICON_MAP[type];
  const colors = CTA_COLORS[type];
  const displayLabel = label ?? DEFAULT_LABELS[type];
  const href = buildHref(type, value);

  return (
    <a
      href={href}
      target={type !== "phone" ? "_blank" : undefined}
      rel={type !== "phone" ? "noopener noreferrer" : undefined}
      style={{
        border: `0.5px solid ${colors.border}`,
        color: colors.text,
        fontSize: "12px",
        padding: "5px 12px",
        borderRadius: "6px",
        display: "inline-flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "5px",
        textDecoration: "none",
        fontWeight: 500,
        lineHeight: 1.4,
        transition: "background 0.15s ease",
        background: "transparent",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = colors.hover;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
      }}
    >
      <Icon size={13} strokeWidth={2} />
      {displayLabel}
    </a>
  );
}
