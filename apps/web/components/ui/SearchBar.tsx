"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Size = "lg" | "md" | "sm";

interface SearchBarProps {
  size?: Size;
  placeholder?: string;
  defaultValue?: string;
  onSubmit?: (query: string) => void;
  autoFocus?: boolean;
  className?: string;
}

const RECENT_KEY = "chatsouq_recent_searches";
const MAX_RECENT = 5;

function getRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecent(q: string) {
  if (typeof window === "undefined") return;
  const prev = getRecent().filter((r) => r !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
}

export function SearchBar({
  size = "md",
  placeholder,
  defaultValue = "",
  onSubmit,
  autoFocus = false,
  className = "",
}: SearchBarProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focused) setRecent(getRecent());
  }, [focused]);

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    saveRecent(trimmed);
    setFocused(false);
    if (onSubmit) {
      onSubmit(trimmed);
    } else {
      router.push(`/chat?q=${encodeURIComponent(trimmed)}`);
    }
  }

  const isRtl = /[؀-ۿ]/.test(value);
  const showDropdown = focused && recent.length > 0 && !value;

  // ── Size variants ────────────────────────────────────────────────────────────

  if (size === "lg") {
    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <form
          onSubmit={(e) => { e.preventDefault(); submit(value); }}
          className={`flex items-center h-14 bg-white rounded-xl overflow-hidden transition-all duration-150 ${
            focused
              ? "border border-[#C9A84C]"
              : "border border-[#E8E4DC]"
          }`}
        >
          {/* Search icon */}
          <div className="pl-4 pr-2 flex-shrink-0">
            <SearchIcon size={18} className="text-[#9ca3af]" />
          </div>
          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            dir={isRtl ? "rtl" : "ltr"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={placeholder ?? "Ask anything in Amman..."}
            autoFocus={autoFocus}
            className="flex-1 bg-transparent outline-none text-[16px] text-[#1A1A1A] placeholder:text-[#9ca3af] py-0 min-w-0"
          />
          {/* Submit button */}
          <button
            type="submit"
            disabled={!value.trim()}
            className="m-1.5 px-5 h-[42px] rounded-[9px] bg-[#C9A84C] text-white text-[14px] font-medium whitespace-nowrap transition-opacity disabled:opacity-40 hover:bg-[#b8963e] active:scale-[0.98]"
          >
            Ask ChatSouq
          </button>
        </form>
        {showDropdown && (
          <RecentDropdown recent={recent} onSelect={(q) => { setValue(q); submit(q); }} />
        )}
      </div>
    );
  }

  if (size === "sm") {
    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <form
          onSubmit={(e) => { e.preventDefault(); submit(value); }}
          className={`flex items-center h-11 bg-white rounded-lg overflow-hidden transition-all duration-150 ${
            focused ? "border border-[#C9A84C]" : "border border-[#E8E4DC]"
          }`}
        >
          <div className="pl-3 pr-2 flex-shrink-0">
            <SearchIcon size={15} className="text-[#9ca3af]" />
          </div>
          <input
            ref={inputRef}
            type="text"
            dir={isRtl ? "rtl" : "ltr"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={placeholder ?? "Describe what you're looking for..."}
            autoFocus={autoFocus}
            className="flex-1 bg-transparent outline-none text-[14px] text-[#1A1A1A] placeholder:text-[#9ca3af] min-w-0"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="mr-1.5 flex items-center justify-center w-8 h-8 rounded-md bg-[#C9A84C] text-white transition-opacity disabled:opacity-40 hover:bg-[#b8963e] active:scale-95"
          >
            <ArrowRightIcon size={14} />
          </button>
        </form>
        {showDropdown && (
          <RecentDropdown recent={recent} onSelect={(q) => { setValue(q); submit(q); }} />
        )}
      </div>
    );
  }

  // md (default — used in Navbar)
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form
        onSubmit={(e) => { e.preventDefault(); submit(value); }}
        className={`flex items-center h-10 bg-white rounded-lg overflow-hidden transition-all duration-150 ${
          focused ? "border border-[#C9A84C]" : "border border-[#E8E4DC]"
        }`}
      >
        <div className="pl-3 pr-1.5 flex-shrink-0">
          <SearchIcon size={14} className="text-[#9ca3af]" />
        </div>
        <input
          ref={inputRef}
          type="text"
          dir={isRtl ? "rtl" : "ltr"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={placeholder ?? "Ask anything in Amman..."}
          autoFocus={autoFocus}
          className="flex-1 bg-transparent outline-none text-[14px] text-[#1A1A1A] placeholder:text-[#9ca3af] min-w-0"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="mr-1 flex items-center justify-center w-8 h-8 rounded-md text-[#C9A84C] transition disabled:opacity-30 hover:bg-[#FBF4E3] active:scale-95"
        >
          <ArrowRightIcon size={14} />
        </button>
      </form>
      {showDropdown && (
        <RecentDropdown recent={recent} onSelect={(q) => { setValue(q); submit(q); }} />
      )}
    </div>
  );
}

function RecentDropdown({ recent, onSelect }: { recent: string[]; onSelect: (q: string) => void }) {
  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-[#F3F1EE] border border-[#E8E4DC] rounded-lg overflow-hidden z-50">
      <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">Recent</p>
      {recent.map((q) => (
        <button
          key={q}
          onMouseDown={(e) => { e.preventDefault(); onSelect(q); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#374151] hover:bg-[#E8E4DC] transition-colors text-left"
        >
          <ClockIcon size={12} className="text-[#9ca3af] flex-shrink-0" />
          <span className="truncate">{q}</span>
        </button>
      ))}
    </div>
  );
}

// ── Inline SVG icons ─────────────────────────────────────────────────────────

function SearchIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8"/>
      <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function ArrowRightIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ClockIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
