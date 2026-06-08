"use client";

import type { ResultItem, PlaceResultItem, NeighborhoodCard, InfoCard } from "@chatsouq/core";
import { formatJOD, initials, safeUrl, mapsUrl, hostOf } from "../lib/format";

// ── Category theme system ─────────────────────────────────────────────────────

type ThemeKey =
  | "food" | "health" | "hotel" | "education" | "religion"
  | "shopping" | "service" | "pro-health" | "pro-legal" | "pro-service"
  | "attraction" | "generic";

interface Theme {
  accent:    string;
  bg:        string;
  fg:        string;
  badge:     string;
  badgeFg:   string;
  icon:      string;
  label:     string;
  ringColor: string;
}

const THEMES: Record<ThemeKey, Theme> = {
  food:        { accent:"#f59e0b", bg:"#fffbeb", fg:"#b45309", badge:"#fef3c7", badgeFg:"#92400e", icon:"🍽",   label:"Food & Drink",  ringColor:"rgba(245,158,11,0.25)" },
  health:      { accent:"#059669", bg:"#ecfdf5", fg:"#065f46", badge:"#d1fae5", badgeFg:"#064e3b", icon:"🏥",   label:"Health",        ringColor:"rgba(5,150,105,0.22)"  },
  hotel:       { accent:"#0d9488", bg:"#f0fdfa", fg:"#0f766e", badge:"#ccfbf1", badgeFg:"#134e4a", icon:"🏨",   label:"Hotel",         ringColor:"rgba(13,148,136,0.22)" },
  education:   { accent:"#4f46e5", bg:"#eef2ff", fg:"#3730a3", badge:"#e0e7ff", badgeFg:"#3730a3", icon:"🎓",   label:"Education",     ringColor:"rgba(79,70,229,0.22)"  },
  religion:    { accent:"#7c3aed", bg:"#f5f3ff", fg:"#6d28d9", badge:"#ede9fe", badgeFg:"#5b21b6", icon:"🕌",   label:"Mosque",        ringColor:"rgba(124,58,237,0.22)" },
  shopping:    { accent:"#ea580c", bg:"#fff7ed", fg:"#c2410c", badge:"#ffedd5", badgeFg:"#9a3412", icon:"🛍",   label:"Shopping",      ringColor:"rgba(234,88,12,0.22)"  },
  service:     { accent:"#475569", bg:"#f8fafc", fg:"#334155", badge:"#e2e8f0", badgeFg:"#1e293b", icon:"🔧",   label:"Services",      ringColor:"rgba(71,85,105,0.18)"  },
  "pro-health":{ accent:"#0891b2", bg:"#ecfeff", fg:"#0e7490", badge:"#cffafe", badgeFg:"#164e63", icon:"👨‍⚕️", label:"Doctor",        ringColor:"rgba(8,145,178,0.22)"  },
  "pro-legal": { accent:"#7c3aed", bg:"#f5f3ff", fg:"#6d28d9", badge:"#ede9fe", badgeFg:"#5b21b6", icon:"⚖️",   label:"Lawyer",        ringColor:"rgba(124,58,237,0.22)" },
  "pro-service":{ accent:"#475569",bg:"#f8fafc", fg:"#334155", badge:"#e2e8f0", badgeFg:"#1e293b", icon:"🏗",   label:"Professional",  ringColor:"rgba(71,85,105,0.18)"  },
  attraction:  { accent:"#9333ea", bg:"#faf5ff", fg:"#7e22ce", badge:"#f3e8ff", badgeFg:"#6b21a8", icon:"🏛",   label:"Attraction",    ringColor:"rgba(147,51,234,0.22)" },
  generic:     { accent:"#059669", bg:"#ecfdf5", fg:"#065f46", badge:"#d1fae5", badgeFg:"#064e3b", icon:"📍",   label:"Place",         ringColor:"rgba(5,150,105,0.18)"  },
};

const PROFESSIONAL_ROLES = new Set([
  "doctor","physician","dentist","specialist","consultant",
  "lawyer","attorney","legal",
  "accountant","architect","engineer","pharmacist","professional",
]);

function detectTheme(category: string): ThemeKey {
  const c     = category.toLowerCase();
  const first = c.split(/[^a-z]/)[0] ?? "";

  if (/^(doctor|physician|dentist|specialist)/.test(first)) return "pro-health";
  if (/^(pharmacist)/.test(first))                          return "pro-health";
  if (/^(lawyer|attorney|legal)/.test(first))               return "pro-legal";
  if (/^(architect|engineer|accountant|professional)/.test(first)) return "pro-service";

  if (/restaurant|cafe|coffee|bakery|dessert|fast.food|bar|sweets|food|delivery|pizza|burger|sushi|shawarma/.test(c)) return "food";
  if (/hotel|hostel|guest.house|resort|motel/.test(c))       return "hotel";
  if (/school|university|college|institute|kindergarten|education|academy/.test(c)) return "education";
  if (/mosque|masjid|church|synagogue|religion|prayer|worship/.test(c)) return "religion";
  if (/supermarket|mall|shop|store|market|grocery|boutique|retail/.test(c)) return "shopping";
  if (/hospital|clinic|medical|pharmacy|gym|spa|salon|barber|health|fitness|dental|optical/.test(c)) return "health";
  if (/bank|atm|gas.station|fuel|laundry|garage|telecom|government/.test(c)) return "service";
  if (/museum|park|attraction|viewpoint|landmark|monument|gallery|theatre/.test(c)) return "attraction";

  return "generic";
}

function isProfessionalTheme(k: ThemeKey) {
  return k === "pro-health" || k === "pro-legal" || k === "pro-service";
}

// ── Content-quality filters ───────────────────────────────────────────────────

const TRIVIAL_WHY = /^(top pick|alternative|a (cafe|restaurant|hotel|place|doctor|shop|gym|store|clinic)|top result|best result|located in|a \w+ in )/i;

function isGoodWhy(why: string | undefined | null): boolean {
  if (!why || why.trim().length < 30) return false;
  if (TRIVIAL_WHY.test(why.trim())) return false;
  return true;
}

function cleanPros(pros: string[]): string[] {
  return pros.filter(
    (p) => !/^(located in|in amman|in jordan|available in|found in)/i.test(p.trim())
  );
}

// Cons about missing data are data gaps — don't expose them to users
function cleanCons(cons: string[]): string[] {
  return cons.filter(
    (c) => !/(not listed|not available|no phone|no website|no address|not provided|missing|unknown)/i.test(c)
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
      {children}
    </span>
  );
}

/** Inline pros list — no pill chips, just small labeled text */
function InlinePros({ pros }: { pros: string[] }) {
  const good = cleanPros(pros);
  if (!good.length) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {good.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-[11px] text-souq-700">
          <CheckDot /> {p}
        </span>
      ))}
    </div>
  );
}

/** One primary ActionBtn (e.g. Get directions) — kept for best cards */
function ActionBtn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-900 hover:underline"
    >
      {children}
    </a>
  );
}

/** Secondary text-link CTA */
function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-400 hover:text-ink-700 hover:underline transition-colors"
    >
      {children}
    </a>
  );
}

/** Newspaper section-header: label on left, thin rule extending right */
function SectionRule({ label, topLabel, accent }: { label: string; topLabel?: string; accent: string }) {
  return (
    <div
      className="flex items-center justify-between pb-1.5 mb-0"
      style={{ borderBottom: `2px solid ${accent}` }}
    >
      <span
        className="text-[9px] font-black uppercase tracking-[0.22em] leading-none"
        style={{ color: accent }}
      >
        {label}
      </span>
      {topLabel && (
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-ink-400 leading-none">
          {topLabel}
        </span>
      )}
    </div>
  );
}

// ── Product cards ─────────────────────────────────────────────────────────────

function ProductThumb({ item }: { item: ResultItem }) {
  const { imageUrl, name, vendor } = item.listing;
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-sand-100 text-[15px] font-black text-ink-400">
      {initials(vendor.name)}
    </div>
  );
}

export function BestCard({ item }: { item: ResultItem }) {
  const { listing } = item;
  const goodWhy = isGoodWhy(item.why);
  const goodPros = cleanPros(item.pros);

  return (
    <div className="animate-fade-up px-0 py-4">
      {/* Section header rule */}
      <SectionRule
        label={`🛍 Product · ${listing.category ?? "Product"}`}
        topLabel="#1 Match"
        accent="#ea580c"
      />

      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        {/* Thumbnail */}
        <div className="h-44 w-full overflow-hidden rounded-xl bg-sand-50 sm:h-28 sm:w-28 shrink-0">
          <ProductThumb item={item} />
        </div>
        <div className="min-w-0 flex-1">
          {listing.brand && (
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ink-400 mb-0.5">{listing.brand}</p>
          )}
          <h3 className="font-serif text-[24px] font-black leading-tight text-ink-900">{listing.name}</h3>
          <p className="mt-1 text-[32px] font-black text-ink-900 tabular-nums leading-tight">
            {formatJOD(listing.price)}
          </p>
          {goodWhy && (
            <p className="mt-2 text-[14px] leading-relaxed text-ink-700 mb-4">{item.why}</p>
          )}
          {goodPros.length > 0 && (
            <div className="mb-3">
              <InlinePros pros={goodPros} />
            </div>
          )}
        </div>
      </div>

      {/* Thin rule */}
      <div className="h-px bg-ink-100 mt-4 mb-3" />

      {/* CTAs */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {listing.sourceUrl && (
          <ActionBtn href={listing.sourceUrl}>
            View product → <ArrowIcon />
          </ActionBtn>
        )}
        {safeUrl(listing.vendor.websiteUrl) && (
          <TextLink href={safeUrl(listing.vendor.websiteUrl)!}>
            {listing.vendor.name}
          </TextLink>
        )}
        {listing.vendor.location && (
          <span className="text-[11px] text-ink-300">{listing.vendor.location}</span>
        )}
      </div>
    </div>
  );
}

export function AltCard({ item, rank }: { item: ResultItem; rank: number }) {
  const { listing } = item;
  const goodWhy = isGoodWhy(item.why);
  return (
    <div
      className="animate-fade-up py-3 px-4 first:pl-0 flex flex-col"
      style={{ animationDelay: `${(rank - 2) * 55}ms` }}
    >
      {/* Accent top rule */}
      <div style={{ borderTop: "2px solid #ea580c" }} className="mb-2" />

      <div className="flex items-start gap-2 mb-2">
        <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-lg bg-sand-50">
          <ProductThumb item={item} />
          <span className="absolute left-0.5 top-0.5 rounded-full bg-white/90 px-1 py-px text-[9px] font-black text-ink-700">
            #{rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          {listing.brand && (
            <p className="text-[9px] font-black uppercase tracking-widest text-ink-400">{listing.brand}</p>
          )}
          <h4 className="font-serif text-[14px] font-bold text-ink-900 leading-snug">{listing.name}</h4>
          <p className="text-[13px] font-black text-ink-900 tabular-nums mt-0.5">{formatJOD(listing.price)}</p>
        </div>
      </div>

      {goodWhy && (
        <p className="text-[11px] text-ink-500 line-clamp-2 mb-2">{item.why}</p>
      )}

      <div className="flex-1" />

      {listing.sourceUrl && (
        <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#ea580c] hover:underline mt-2">
          View → <ArrowIcon />
        </a>
      )}
    </div>
  );
}

// ── Place cards ───────────────────────────────────────────────────────────────

const ARABIC_RE = /[؀-ۿ]/;

export function PlaceBestCard({ item }: { item: PlaceResultItem }) {
  const { place } = item;
  const themeKey = detectTheme(place.category);
  const theme    = THEMES[themeKey];
  const isPro    = isProfessionalTheme(themeKey);
  const where    = [place.city, place.governorate].filter(Boolean).join(", ");
  const nameIsAr = ARABIC_RE.test(place.name);
  const altName  = nameIsAr && place.nameAr && !ARABIC_RE.test(place.nameAr)
    ? place.nameAr
    : !nameIsAr ? (place.nameAr ?? null) : null;
  const site     = safeUrl(place.website);
  const mapQuery = nameIsAr ? `${place.category} ${place.city ?? place.governorate ?? "Jordan"}` : place.name;
  const map      = mapsUrl(place.lat, place.lng, mapQuery);
  const goodWhy  = isGoodWhy(item.why);
  const goodPros = cleanPros(item.pros);

  return (
    <div className="animate-fade-up px-0 py-4">
      {/* Section header rule */}
      <SectionRule
        label={`${theme.icon} ${theme.label}`}
        topLabel="★ Top Pick"
        accent={theme.accent}
      />

      {/* Body — no box, just white space */}
      <div className="mt-4">
        {/* Place name */}
        <h3
          dir={nameIsAr ? "rtl" : "ltr"}
          className="font-serif text-[28px] sm:text-[34px] font-black leading-tight text-ink-900"
        >
          {place.name}
        </h3>
        {altName && (
          <p
            className="mt-0.5 text-[14px] text-ink-400"
            dir={ARABIC_RE.test(altName) ? "rtl" : "ltr"}
          >
            {altName}
          </p>
        )}

        {/* Meta row */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-500">
          {where && (
            <span className="flex items-center gap-1">
              <PinIcon size={11} /> {where}
            </span>
          )}
          {place.category && (
            <span>{place.category}</span>
          )}
          {!isPro && place.openingHours && (
            <span className="flex items-center gap-1">
              <ClockIcon /> {place.openingHours}
            </span>
          )}
          {isPro && place.subcategory && (
            <span style={{ color: theme.fg }} className="font-semibold">{place.subcategory}</span>
          )}
          {isPro && place.openingHours && (
            <span className="flex items-center gap-1">🏢 {place.openingHours}</span>
          )}
          {place.address && (
            <span className="truncate max-w-xs">{place.address}</span>
          )}
        </div>

        {/* Why — editorial standfirst */}
        {goodWhy && (
          <p className="mt-3 text-[14px] leading-relaxed text-ink-700 mb-4">{item.why}</p>
        )}

        {/* Pros — inline, no chips */}
        {goodPros.length > 0 && (
          <div className="mt-2 mb-4">
            <InlinePros pros={goodPros} />
          </div>
        )}

        {/* Thin rule */}
        <div className="h-px bg-ink-100 mb-3" />

        {/* CTAs: primary bold + text links */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {map && (
            <ActionBtn href={map}>
              <PinIcon size={12} /> Get directions →
            </ActionBtn>
          )}
          {place.phone && (
            <TextLink href={`tel:${place.phone.replace(/\s+/g, "")}`}>
              <PhoneIcon /> Call
            </TextLink>
          )}
          {site && (
            <TextLink href={site}>
              <GlobeIcon /> {hostOf(place.website) ?? "Website"}
            </TextLink>
          )}
        </div>
      </div>
    </div>
  );
}

export function PlaceAltCard({ item, rank }: { item: PlaceResultItem; rank: number }) {
  const { place } = item;
  const themeKey = detectTheme(place.category);
  const theme    = THEMES[themeKey];
  const where    = [place.city, place.governorate].filter(Boolean).join(", ");
  const map      = mapsUrl(
    place.lat, place.lng,
    ARABIC_RE.test(place.name) ? `${place.category} ${place.city ?? "Amman"}` : place.name
  );
  const site     = safeUrl(place.website);
  const nameIsAr = ARABIC_RE.test(place.name);
  const goodWhy  = isGoodWhy(item.why);

  return (
    <div
      className="animate-fade-up py-3 px-4 first:pl-0 flex flex-col"
      style={{ animationDelay: `${(rank - 2) * 60}ms` }}
    >
      {/* Accent top rule */}
      <div style={{ borderTop: `2px solid ${theme.accent}` }} className="mb-2" />

      {/* Category + rank */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-[9px] font-black uppercase tracking-[0.22em]"
          style={{ color: theme.accent }}
        >
          {theme.icon} {place.category}
        </span>
        <span className="text-[9px] font-black text-ink-400">#{rank}</span>
      </div>

      {/* Name */}
      <h4
        dir={nameIsAr ? "rtl" : "ltr"}
        className="font-serif text-[14px] font-bold text-ink-900 leading-snug mt-1.5"
      >
        {place.name}
      </h4>

      {where && <p className="text-[11px] text-ink-400 mt-0.5">{where}</p>}

      {goodWhy && (
        <p className="text-[11px] text-ink-500 line-clamp-2 mt-1">{item.why}</p>
      )}

      <div className="flex-1" />

      {/* CTAs */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {map && (
          <a href={map} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold hover:underline"
            style={{ color: theme.accent }}>
            <PinIcon size={10} /> Directions →
          </a>
        )}
        {place.phone && (
          <a href={`tel:${place.phone.replace(/\s+/g, "")}`}
            className="inline-flex items-center gap-1 text-[11px] font-bold hover:underline"
            style={{ color: theme.accent }}>
            <PhoneIcon /> Call
          </a>
        )}
        {site && (
          <a href={site} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold hover:underline"
            style={{ color: theme.accent }}>
            <GlobeIcon /> Site
          </a>
        )}
      </div>
    </div>
  );
}

// ── Rental / Neighborhood cards ───────────────────────────────────────────────

interface TierMeta { gradient: string; accentColor: string; badgeBg: string; badgeFg: string; label: string; emoji: string }
const TIER_META: Record<string, TierMeta> = {
  budget:      { gradient:"from-blue-50 to-blue-100/60",      accentColor:"#2563eb", badgeBg:"#dbeafe", badgeFg:"#1d4ed8", label:"Budget",   emoji:"💰" },
  "mid-range": { gradient:"from-souq-50 to-souq-100/60",      accentColor:"#059669", badgeBg:"#d1fae5", badgeFg:"#047857", label:"Mid-Range", emoji:"🏡" },
  upscale:     { gradient:"from-amber-50 to-amber-100/60",    accentColor:"#f59e0b", badgeBg:"#fef3c7", badgeFg:"#b45309", label:"Upscale",   emoji:"✨" },
  luxury:      { gradient:"from-violet-50 to-purple-100/60",  accentColor:"#7c3aed", badgeBg:"#ede9fe", badgeFg:"#6d28d9", label:"Luxury",    emoji:"💎" },
};

export function NeighborhoodBestCard({ item }: { item: NeighborhoodCard }) {
  const tier     = TIER_META[item.tier] ?? TIER_META["mid-range"]!;
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + " " + item.city + " Jordan")}`;

  return (
    <div className="animate-fade-up px-0 py-4">
      <SectionRule
        label={`${tier.emoji} ${tier.label} · ${item.city}`}
        topLabel="Best Area"
        accent={tier.accentColor}
      />

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-[28px] font-black text-ink-900 leading-tight">{item.name}</h3>
          {item.nameAr && <p className="text-sm text-ink-400 mt-0.5" dir="rtl">{item.nameAr}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[28px] font-black tabular-nums leading-tight" style={{ color: tier.accentColor }}>
            {item.avgRentMin}–{item.avgRentMax}
          </p>
          <p className="text-[10px] font-black uppercase tracking-wider text-ink-400">JOD / month</p>
        </div>
      </div>

      {item.characteristics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.characteristics.map((c, i) => <Chip key={i}>{c}</Chip>)}
        </div>
      )}

      {cleanPros(item.pros).length > 0 && (
        <div className="mt-3">
          <InlinePros pros={item.pros} />
        </div>
      )}

      {item.bestFor.length > 0 && (
        <p className="mt-2 text-[12px] text-ink-400">
          Best for: <span className="font-semibold text-ink-600">{item.bestFor.join(", ")}</span>
        </p>
      )}

      <div className="h-px bg-ink-100 mt-4 mb-3" />
      <ActionBtn href={mapsLink}><PinIcon size={12} /> View on map →</ActionBtn>
    </div>
  );
}

export function NeighborhoodAltCard({ item, rank }: { item: NeighborhoodCard; rank: number }) {
  const tier     = TIER_META[item.tier] ?? TIER_META["mid-range"]!;
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + " " + item.city + " Jordan")}`;

  return (
    <div
      className="animate-fade-up py-3 px-4 first:pl-0 flex flex-col"
      style={{ animationDelay: `${(rank - 2) * 55}ms` }}
    >
      <div style={{ borderTop: `2px solid ${tier.accentColor}` }} className="mb-2" />

      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: tier.accentColor }}>
          {tier.emoji} {tier.label}
        </span>
        <span className="text-[9px] font-black text-ink-400">#{rank}</span>
      </div>

      <h4 className="font-serif text-[14px] font-bold text-ink-900">{item.name}</h4>
      {item.nameAr && <p className="text-[11px] text-ink-400" dir="rtl">{item.nameAr}</p>}

      <p className="text-[13px] font-black tabular-nums mt-1" style={{ color: tier.accentColor }}>
        {item.avgRentMin}–{item.avgRentMax} <span className="text-[10px] font-bold text-ink-400">JOD/mo</span>
      </p>

      {item.characteristics.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {item.characteristics.slice(0, 3).map((c, i) => (
            <span key={i} className="rounded-full bg-sand-50 px-2 py-0.5 text-[10px] text-ink-500 ring-1 ring-black/[0.06]">{c}</span>
          ))}
        </div>
      )}

      <div className="flex-1" />

      <a href={mapsLink} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] font-bold hover:underline mt-2"
        style={{ color: tier.accentColor }}>
        <PinIcon size={10} /> View on map →
      </a>
    </div>
  );
}

// ── Newspaper front layout (today digest) ─────────────────────────────────────

export function NewspaperFront({ cards }: { cards: InfoCard[] }) {
  const news        = cards.filter((c) => c.section === "news");
  const restaurants = cards.filter((c) => c.section === "restaurant");
  const places      = cards.filter((c) => c.section === "place");

  const today  = new Date();
  const dateEn = today.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const dateAr = today.toLocaleDateString("ar-JO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-card">
      {/* Masthead */}
      <div className="px-4 pt-4 pb-3 sm:px-5">
        <div className="h-[2.5px] bg-ink-900 mb-3" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-ink-400 leading-none mb-1">Amman Morning Brief</p>
            <p className="text-[11px] font-medium text-ink-500">{dateEn}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-ink-500" dir="rtl" lang="ar">{dateAr}</p>
            <div className="flex items-center justify-end gap-1.5 mt-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-600" />
              </span>
              <p className="text-[9px] font-black text-rose-600 uppercase tracking-[0.2em]">Live</p>
            </div>
          </div>
        </div>
        <div className="h-px bg-ink-200 mt-3" />
      </div>

      <div className="px-4 pb-4 sm:px-5 space-y-5">
        {news[0] && <HeroNewsStory item={news[0]} />}

        {news.length > 1 && (
          <div>
            <SectionDivider color="#e11d48" label="Top Stories" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {news.slice(1, 5).map((item, i) => <NewsGridItem key={i} item={item} />)}
            </div>
          </div>
        )}

        {restaurants.length > 0 && (
          <div>
            <SectionDivider color="#f59e0b" label="On The Table" badge="via Talabat" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {restaurants.slice(0, 3).map((item, i) => <RestaurantTile key={i} item={item} />)}
            </div>
          </div>
        )}

        {places.length > 0 && (
          <div>
            <SectionDivider color="#059669" label="Around Amman" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {places.slice(0, 6).map((item, i) => <PlaceTile key={i} item={item} />)}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function SectionDivider({ color, label, badge }: { color: string; label: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[9px] font-black uppercase tracking-[0.22em] shrink-0" style={{ color }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: color, opacity: 0.25 }} />
      {badge && <span className="text-[9px] text-ink-400 font-medium shrink-0">{badge}</span>}
    </div>
  );
}

function HeroNewsStory({ item }: { item: InfoCard }) {
  const inner = (
    <div className="group rounded-xl overflow-hidden bg-sand-50 ring-1 ring-black/[0.06]">
      <div className="h-[3px]" style={{ background: "#e11d48" }} />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-black text-rose-700 uppercase tracking-wider">
            📰 Breaking
          </span>
          {item.body && <span className="text-[10px] text-ink-400 truncate">{item.body}</span>}
        </div>
        <h2 className="font-serif text-[16px] sm:text-[19px] font-black leading-snug text-ink-900 group-hover:text-rose-700 transition-colors">
          {item.title}
        </h2>
        {item.url && <p className="mt-2 text-[11px] text-rose-600 font-bold">Read full story →</p>}
      </div>
    </div>
  );
  if (item.url) return <a href={item.url} target="_blank" rel="noopener noreferrer">{inner}</a>;
  return inner;
}

function NewsGridItem({ item }: { item: InfoCard }) {
  const inner = (
    <div className="group flex items-start gap-3 rounded-lg bg-sand-50 px-3.5 py-3 ring-1 ring-black/[0.06] hover:ring-rose-200 transition-all">
      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#e11d48" }} />
      <div className="min-w-0">
        <p className="text-[12px] font-semibold leading-snug text-ink-800 group-hover:text-rose-700 transition-colors line-clamp-2">
          {item.title}
        </p>
        {item.body && <p className="mt-0.5 text-[10px] text-ink-400">{item.body}</p>}
      </div>
    </div>
  );
  if (item.url) return <a href={item.url} target="_blank" rel="noopener noreferrer">{inner}</a>;
  return inner;
}

function RestaurantTile({ item }: { item: InfoCard }) {
  const inner = (
    <div className="group rounded-xl bg-sand-50 p-3.5 ring-1 ring-black/[0.06] hover:ring-amber-300 transition-all hover:-translate-y-px">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-lg">🍽</span>
        <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">{item.body}</span>
      </div>
      <p className="font-serif text-[13px] font-bold text-ink-900 group-hover:text-amber-700 transition-colors leading-snug">
        {item.title}
      </p>
      {item.url && <p className="mt-1.5 text-[10px] font-bold text-amber-600">Order on Talabat →</p>}
    </div>
  );
  if (item.url) return <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">{inner}</a>;
  return inner;
}

function PlaceTile({ item }: { item: InfoCard }) {
  const fallback = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.title + " Amman Jordan")}`;
  return (
    <a
      href={item.url ?? fallback}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-xl bg-sand-50 p-3 ring-1 ring-black/[0.06] hover:ring-souq-300 transition-all hover:-translate-y-px block"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-base">📍</span>
        <span className="text-[10px] font-black uppercase tracking-wider text-souq-600">{item.body}</span>
      </div>
      <p className="font-serif text-[12px] font-semibold text-ink-900 group-hover:text-souq-700 transition-colors leading-snug line-clamp-2">
        {item.title}
      </p>
    </a>
  );
}

function ProTile({ item }: { item: InfoCard }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-sand-50 p-3.5 ring-1 ring-black/[0.06]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[13px] font-black text-cyan-700">
        {item.title.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("")}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-[13px] font-bold text-ink-900 truncate">{item.title}</p>
        <p className="text-[11px] text-ink-500">{item.body}</p>
      </div>
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer"
          className="ml-auto shrink-0 text-[10px] font-black text-cyan-600 hover:underline">
          Contact →
        </a>
      )}
    </div>
  );
}

// ── News cards ─────────────────────────────────────────────────────────────────

export function NewsInfoCard({ item, index }: { item: InfoCard; index: number }) {
  const inner = (
    <div
      className="animate-fade-up group py-3 border-b border-[#e8e3da] last:border-0"
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 h-1 w-5 shrink-0" style={{ background: "#e11d48" }} />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[13px] font-bold leading-snug text-ink-900 group-hover:text-rose-700 transition-colors">
            {item.title}
          </p>
          {item.body && <p className="mt-0.5 text-[11px] leading-relaxed text-ink-400">{item.body}</p>}
          {item.url && <p className="mt-1 text-[10px] font-black text-rose-600">Read →</p>}
        </div>
      </div>
    </div>
  );
  if (item.url) return <a href={item.url} target="_blank" rel="noopener noreferrer">{inner}</a>;
  return inner;
}

// ── General & company info cards ──────────────────────────────────────────────

const INFO_ICON_MAP: Record<string, string> = {
  info: "ℹ️", map: "📍", star: "⭐", building: "🏢", calendar: "📅", phone: "📞",
};

export function GeneralInfoCard({ item }: { item: InfoCard }) {
  return (
    <div className="animate-fade-up py-3 border-b border-[#e8e3da] last:border-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-base">{INFO_ICON_MAP[item.icon] ?? "ℹ️"}</span>
        <div>
          <p className="font-serif text-[13px] font-bold text-ink-900">{item.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{item.body}</p>
        </div>
      </div>
    </div>
  );
}

export function CompanyInfoCard({ item, index }: { item: InfoCard; index: number }) {
  const emoji = INFO_ICON_MAP[item.icon] ?? "🏢";
  return (
    <div
      className="animate-fade-up py-3 border-b border-[#e8e3da] last:border-0"
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-base">{emoji}</span>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-indigo-600 mb-0.5">Business</p>
          <p className="font-serif text-[13px] font-bold leading-snug text-ink-900">{item.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{item.body}</p>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function SkeletonCard() {
  return (
    <div className="px-0 py-4">
      {/* Section rule shimmer */}
      <div className="shimmer h-[2px] w-full rounded mb-4" />
      {/* Large name block */}
      <div className="shimmer h-9 w-2/3 rounded mb-2" />
      <div className="shimmer h-5 w-1/3 rounded mb-4" />
      {/* Meta lines */}
      <div className="space-y-2 mb-5">
        <div className="shimmer h-3 w-full rounded" />
        <div className="shimmer h-3 w-4/5 rounded" />
      </div>
      {/* Thin rule + CTA */}
      <div className="shimmer h-px w-full rounded mb-3" />
      <div className="shimmer h-4 w-28 rounded" />
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

export function PinIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path d="M5 4h3l2 5-2.5 1.5a11 11 0 005 5L19 13l2 5v3a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CheckDot() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="mt-px shrink-0">
      <circle cx="5" cy="5" r="5" fill="#d1fae5"/>
      <path d="M3 5l1.5 1.5L7 3.5" stroke="#059669" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

void PROFESSIONAL_ROLES;
void cleanCons;
