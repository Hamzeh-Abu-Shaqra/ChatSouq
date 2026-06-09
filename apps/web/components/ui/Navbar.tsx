"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SearchBar } from "./SearchBar";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const isHome = pathname === "/";

  // Single scroll listener — threshold differs between homepage (hero-relative) and other pages
  useEffect(() => {
    function onScroll() {
      const threshold = isHome ? window.innerHeight * 0.8 : 48;
      setScrolled(window.scrollY > threshold);
    }
    onScroll(); // Set initial state without waiting for first scroll
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  const navBg = isHome && !scrolled
    ? "bg-transparent border-transparent"
    : "bg-[#F9F8F6] border-[#E8E4DC]";

  // Don't show SearchBar in nav on homepage (it's in the hero)
  const showSearch = !isHome || scrolled;

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-200 ${navBg}`}
        style={{ borderBottomWidth: "0.5px" }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Left: Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[#C9A84C] text-[18px] leading-none select-none">◆</span>
              <span
                className="font-serif text-[17px] font-medium text-[#1A1A1A] leading-none tracking-tight"
              >
                ChatSouq
              </span>
            </Link>

            {/* Center: SearchBar (desktop only, appears after hero on homepage) */}
            {showSearch && (
              <div className="hidden md:block flex-1 max-w-md mx-8">
                <SearchBar
                  size="md"
                  placeholder="Ask anything in Amman..."
                  onSubmit={(q) => router.push(`/chat?q=${encodeURIComponent(q)}`)}
                />
              </div>
            )}

            {/* Right: nav actions */}
            <div className="flex items-center gap-1 sm:gap-3">
              {/* News — desktop only */}
              <Link
                href="/news"
                className="hidden sm:block text-[13px] text-[#6B7280] hover:text-[#1A1A1A] transition-colors px-2 py-1"
              >
                News
              </Link>

              {/* For businesses — desktop only */}
              <Link
                href="/vendors"
                className="hidden sm:block text-[13px] text-[#6B7280] hover:text-[#1A1A1A] transition-colors px-2 py-1"
              >
                For businesses
              </Link>

              {/* Language toggle — desktop */}
              <button className="hidden sm:flex items-center gap-1 text-[12px] text-[#6B7280] border border-[#E8E4DC] rounded-full px-3 py-1 hover:border-[#C9A84C] hover:text-[#1A1A1A] transition-all">
                <span>EN</span>
                <span className="text-[#D1CBC0]">|</span>
                <span>AR</span>
              </button>

              {/* Mobile: search icon */}
              <button
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[#F3F1EE] transition-colors"
                onClick={() => setMobileSearchOpen(true)}
                aria-label="Search"
              >
                <SearchIconSvg />
              </button>

              {/* Mobile: hamburger */}
              <button
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[#F3F1EE] transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Menu"
              >
                {mobileMenuOpen ? <XIcon /> : <MenuIcon />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#F9F8F6] border-t border-[#E8E4DC]" style={{ borderTopWidth: "0.5px" }}>
            <div className="px-4 py-3 space-y-1">
              <MobileLink href="/chat" onClick={() => setMobileMenuOpen(false)}>Search</MobileLink>
              <MobileLink href="/news" onClick={() => setMobileMenuOpen(false)}>News</MobileLink>
              <MobileLink href="/vendors" onClick={() => setMobileMenuOpen(false)}>For businesses</MobileLink>
              <MobileLink href="/about" onClick={() => setMobileMenuOpen(false)}>About</MobileLink>
              <div className="pt-2 border-t border-[#E8E4DC] mt-2" style={{ borderTopWidth: "0.5px" }}>
                <button className="text-[13px] text-[#6B7280]">
                  Language: EN | AR
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile full-screen search overlay */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 z-[60] bg-[#F9F8F6] flex flex-col p-4 pt-16">
          <div className="flex items-center gap-3 mb-4">
            <SearchBar
              size="sm"
              autoFocus
              className="flex-1"
              onSubmit={(q) => {
                setMobileSearchOpen(false);
                router.push(`/chat?q=${encodeURIComponent(q)}`);
              }}
            />
            <button
              onClick={() => setMobileSearchOpen(false)}
              className="text-[13px] text-[#6B7280] px-2 py-1 whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Spacer so content is pushed below fixed nav */}
      <div className="h-14" />
    </>
  );
}

function MobileLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-2 py-2.5 text-[14px] text-[#1A1A1A] hover:text-[#C9A84C] transition-colors rounded-lg hover:bg-[#F3F1EE]"
    >
      {children}
    </Link>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SearchIconSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="8" stroke="#6B7280" strokeWidth="1.8"/>
      <path d="m21 21-4.35-4.35" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 12h18M3 6h18M3 18h18" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M18 6L6 18M6 6l12 12" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
