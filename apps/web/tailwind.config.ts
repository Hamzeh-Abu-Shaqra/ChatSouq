import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f4f1ea",
        ink: {
          900: "#0d1117",
          800: "#1f2937",
          700: "#374151",
          600: "#4b5563",
          500: "#6b7280",
          400: "#9ca3af",
          300: "#d1d5db",
          200: "#e5e7eb",
        },
        sand: {
          50:  "#faf7f2",
          100: "#f3ede2",
          200: "#e7dcc6",
          300: "#d8c5a3",
        },
        souq: {
          50:  "#ecfdf5",
          100: "#d1fae5",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
        },
        amber: {
          50:  "#fffbeb",
          100: "#fef3c7",
          400: "#fbbf24",
          500: "#f59e0b",
          700: "#b45309",
        },
        blue: {
          50:  "#eff6ff",
          100: "#dbeafe",
          700: "#1d4ed8",
        },
        indigo:  { 50: "#eef2ff" },
        emerald: { 50: "#ecfdf5" },
        purple: {
          50:  "#faf5ff",
          100: "#f3e8ff",
          700: "#7e22ce",
        },
        pink:   { 50: "#fdf2f8" },
        yellow: { 50: "#fefce8" },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        sm:    "0 1px 3px rgba(0,0,0,0.06)",
        card:  "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)",
        float: "0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
        best:  "0 8px 32px -4px rgba(5,150,105,0.20), 0 2px 8px rgba(0,0,0,0.06)",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
