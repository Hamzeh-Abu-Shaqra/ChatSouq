"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  href: string;
  label: string;
  icon: (props: { size: number; color: string }) => React.ReactElement;
  gold?: boolean;
}

const TABS: Tab[] = [
  { href: "/",        label: "Home",    icon: HomeIcon    },
  { href: "/chat",    label: "Search",  icon: SearchIcon, gold: true },
  { href: "/browse",  label: "Browse",  icon: GridIcon    },
  { href: "/saved",   label: "Saved",   icon: HeartIcon   },
  { href: "/profile", label: "Profile", icon: UserIcon    },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#F9F8F6] border-t"
      style={{ borderTopWidth: "0.5px", borderColor: "#E8E4DC" }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {TABS.map((tab) => {
          const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-3 py-1 rounded-xl transition-colors"
            >
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all ${
                  tab.gold
                    ? active
                      ? "bg-[#C9A84C]"
                      : "bg-[#FBF4E3]"
                    : active
                    ? "bg-[#F3F1EE]"
                    : ""
                }`}
              >
                <Icon
                  size={19}
                  color={
                    tab.gold
                      ? active ? "#fff" : "#C9A84C"
                      : active ? "#1A1A1A" : "#9ca3af"
                  }
                />
              </div>
              <span
                className="text-[10px] font-medium leading-none"
                style={{ color: tab.gold ? (active ? "#C9A84C" : "#9ca3af") : active ? "#1A1A1A" : "#9ca3af" }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* iOS safe area */}
      <div className="pb-safe" />
    </nav>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function HomeIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke={color} strokeWidth="1.7"/>
      <path d="M9 21V12h6v9" stroke={color} strokeWidth="1.7"/>
    </svg>
  );
}

function SearchIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="8" stroke={color} strokeWidth="1.7"/>
      <path d="m21 21-4.35-4.35" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}

function GridIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.7"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.7"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.7"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.7"/>
    </svg>
  );
}

function HeartIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" stroke={color} strokeWidth="1.7"/>
    </svg>
  );
}

function UserIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.7"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}
