import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: {
          50: "#faf7f2",
          100: "#f3ede2",
          200: "#e7dcc6",
          300: "#d8c5a3",
        },
        souq: {
          50: "#ecfdf5",
          100: "#d1fae5",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
        },
        amber: {
          50: "#fffbeb",
          100: "#fef3c7",
          400: "#fbbf24",
          500: "#f59e0b",
          700: "#b45309",
        },
        blue: {
          50: "#eff6ff",
          100: "#dbeafe",
          700: "#1d4ed8",
        },
        indigo: {
          50: "#eef2ff",
        },
        emerald: {
          50: "#ecfdf5",
        },
        purple: {
          50: "#faf5ff",
          100: "#f3e8ff",
          700: "#7e22ce",
        },
        pink: {
          50: "#fdf2f8",
        },
        yellow: {
          50: "#fefce8",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 10px 30px -12px rgba(6,95,70,0.18)",
        best: "0 8px 40px -8px rgba(16,185,129,0.45)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
