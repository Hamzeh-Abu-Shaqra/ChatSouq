"use client";

import type { ResultItem, PlaceResultItem, NeighborhoodCard, InfoCard } from "@chatsouq/core";
import { formatJOD, initials, safeUrl, mapsUrl, hostOf } from "../lib/format";

// ── Shared sub-components ─────────────────────────────────────────────────────

function ProsCons({ pros, cons }: { pros: string[]; cons: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {pros.length > 0 && (
        <ul className="space-y-1.5">
          {pros.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-souq-900">
              <CheckIcon /> <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
      {cons.length > 0 && (
        <ul className="space-y-1.5">
          {cons.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
              <MinusIcon /> <span>{c}</span>
            </li>
          ))}
        </ul>
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
        className="h-full w-full rounded-xl object-cover"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center rounded-xl bg-souq-50 text-souq-700 font-semibold text-sm">
      {initials(vendor.name)}
    </div>
  );
}

export function BestCard({ item }: { item: ResultItem }) {
  const { listing } = item;
  return (
    <div className="animate-fade-up rounded-3xl bg-white p-1 shadow-best ring-1 ring-souq-500/30">
      <div className="rounded-[22px] bg-gradient-to-br from-souq-600 to-souq-800 p-[1.5px]">
        <div className="rounded-[21px] bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-souq-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              <StarIcon /> Best match
            </span>
            {listing.category && (
              <span className="rounded-full bg-souq-50 px-3 py-1 text-xs font-medium text-souq-700">
                {listing.category}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="h-40 w-full shrink-0 overflow-hidden rounded-xl bg-sand-50 sm:h-32 sm:w-32">
              <ProductThumb item={item} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {listing.brand && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-souq-600">
                      {listing.brand}
                    </p>
                  )}
                  <h3 className="text-lg font-semibold leading-snug text-souq-900">{listing.name}</h3>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-bold text-souq-700">{formatJOD(listing.price)}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-souq-800/90">{item.why}</p>
              <div className="mt-4"><ProsCons pros={item.pros} cons={item.cons} /></div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {listing.sourceUrl && (
                  <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-souq-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-souq-700">
                    View product <ArrowIcon />
                  </a>
                )}
                <span className="text-xs text-souq-800/55">
                  from{" "}
                  {safeUrl(listing.vendor.websiteUrl) ? (
                    <a href={safeUrl(listing.vendor.websiteUrl)!} target="_blank" rel="noopener noreferrer"
                      className="font-medium text-souq-700 hover:underline">{listing.vendor.name}</a>
                  ) : (
                    <span className="font-medium">{listing.vendor.name}</span>
                  )}
                  {listing.vendor.location ? ` · ${listing.vendor.location}` : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AltCard({ item, rank }: { item: ResultItem; rank: number }) {
  const { listing } = item;
  return (
    <div className="animate-fade-up rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5 transition hover:-translate-y-0.5">
      <div className="flex gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-sand-50">
          <ProductThumb item={item} />
          <span className="absolute left-1 top-1 rounded-full bg-white/90 px-1.5 text-[10px] font-bold text-souq-700">
            #{rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {listing.brand && (
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-souq-600">
                  {listing.brand}
                </p>
              )}
              <h4 className="truncate text-sm font-semibold text-souq-900">{listing.name}</h4>
            </div>
            <p className="shrink-0 text-base font-bold text-souq-700">{formatJOD(listing.price)}</p>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-souq-800/75">{item.why}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {item.pros.slice(0, 1).map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] text-souq-700">
                <CheckIcon small /> {p}
              </span>
            ))}
            {item.cons.slice(0, 1).map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] text-amber-700">
                <MinusIcon small /> {c}
              </span>
            ))}
          </div>
          {listing.sourceUrl && (
            <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-semibold text-souq-600 hover:underline">
              View product →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Place cards ───────────────────────────────────────────────────────────────

const ARABIC_RE = /[؀-ۿ]/;

function PlaceThumb({ category }: { category: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-xl bg-gradient-to-br from-souq-50 to-sand-100 text-souq-600">
      <PinIcon size={20} />
      <span className="mt-1 px-1 text-center text-[10px] font-semibold leading-tight text-souq-700">
        {category}
      </span>
    </div>
  );
}

function PlaceLinks({ item }: { item: PlaceResultItem }) {
  const { place } = item;
  const site = safeUrl(place.website);
  // For Arabic place names, search by category + location so Maps can find the right spot
  const mapQuery = ARABIC_RE.test(place.name)
    ? `${place.category} ${place.city ?? place.governorate ?? "Jordan"}`
    : place.name;
  const map = mapsUrl(place.lat, place.lng, mapQuery);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {map && (
        <a href={map} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-souq-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-souq-700">
          <PinIcon size={13} /> Directions
        </a>
      )}
      {place.phone && (
        <a href={`tel:${place.phone.replace(/\s+/g, "")}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-souq-700 ring-1 ring-souq-500/30 hover:ring-souq-500/60 transition">
          <PhoneIcon /> Call
        </a>
      )}
      {site && (
        <a href={site} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-souq-700 ring-1 ring-souq-500/30 hover:ring-souq-500/60 transition">
          <GlobeIcon /> {hostOf(place.website) ?? "Website"}
        </a>
      )}
    </div>
  );
}

export function PlaceBestCard({ item }: { item: PlaceResultItem }) {
  const { place } = item;
  const where = [place.city, place.governorate].filter(Boolean).join(", ");
  const nameIsArabic = ARABIC_RE.test(place.name);
  // Show a transliteration hint when the primary name is Arabic
  const secondaryLabel = nameIsArabic && place.nameAr && !ARABIC_RE.test(place.nameAr)
    ? place.nameAr  // nameAr is actually a Latin transliteration
    : nameIsArabic ? null : (place.nameAr ?? null); // show Arabic subtitle when name is Latin

  return (
    <div className="animate-fade-up rounded-3xl bg-white p-1 shadow-best ring-1 ring-souq-500/30">
      <div className="rounded-[22px] bg-gradient-to-br from-souq-600 to-souq-800 p-[1.5px]">
        <div className="rounded-[21px] bg-white p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-souq-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              <StarIcon /> Best match
            </span>
            <span className="rounded-full bg-souq-50 px-3 py-1 text-xs font-medium text-souq-700">
              {place.category}
            </span>
            {where && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-3 py-1 text-xs font-medium text-souq-800/75">
                <PinIcon size={11} /> {where}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="h-40 w-full shrink-0 overflow-hidden rounded-xl sm:h-32 sm:w-32">
              <PlaceThumb category={place.category} />
            </div>
            <div className="min-w-0 flex-1">
              <h3
                dir={nameIsArabic ? "rtl" : "ltr"}
                className="text-lg font-semibold leading-snug text-souq-900"
              >
                {place.name}
              </h3>
              {secondaryLabel && (
                <p className="text-sm text-souq-800/55" dir={ARABIC_RE.test(secondaryLabel) ? "rtl" : "ltr"}>
                  {secondaryLabel}
                </p>
              )}
              <p className="mt-2 text-sm text-souq-800/85">{item.why}</p>
              <div className="mt-4"><ProsCons pros={item.pros} cons={item.cons} /></div>
              <PlaceLinks item={item} />
              {place.openingHours && (
                <p className="mt-3 text-[11px] text-souq-800/45">Hours: {place.openingHours}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlaceAltCard({ item, rank }: { item: PlaceResultItem; rank: number }) {
  const { place } = item;
  const where = [place.city, place.governorate].filter(Boolean).join(", ");
  const map = mapsUrl(place.lat, place.lng, place.name);
  const site = safeUrl(place.website);
  const nameIsArabic = ARABIC_RE.test(place.name);
  return (
    <div className="animate-fade-up rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5 transition hover:-translate-y-0.5">
      <div className="flex gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
          <PlaceThumb category={place.category} />
          <span className="absolute left-1 top-1 rounded-full bg-white/90 px-1.5 text-[10px] font-bold text-souq-700">
            #{rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-souq-600">{place.category}</p>
          <h4
            dir={nameIsArabic ? "rtl" : "ltr"}
            className="truncate text-sm font-semibold text-souq-900"
          >
            {place.name}
          </h4>
          {where && <p className="mt-0.5 truncate text-[11px] text-souq-800/55">{where}</p>}
          <p className="mt-1 line-clamp-2 text-xs text-souq-800/75">{item.why}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {map && (
              <a href={map} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-souq-600 hover:underline">
                <PinIcon size={11} /> Directions
              </a>
            )}
            {place.phone && (
              <a href={`tel:${place.phone.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-souq-600 hover:underline">
                <PhoneIcon /> Call
              </a>
            )}
            {site && (
              <a href={site} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-souq-600 hover:underline">
                <GlobeIcon /> Site
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Neighborhood / rental cards ───────────────────────────────────────────────

const TIER_STYLES: Record<string, { bg: string; badge: string; label: string }> = {
  budget:     { bg: "from-blue-50 to-indigo-50",    badge: "bg-blue-100 text-blue-700",    label: "Budget-Friendly" },
  "mid-range":{ bg: "from-souq-50 to-emerald-50",   badge: "bg-souq-100 text-souq-700",    label: "Mid-Range" },
  upscale:    { bg: "from-amber-50 to-yellow-50",   badge: "bg-amber-100 text-amber-700",  label: "Upscale" },
  luxury:     { bg: "from-purple-50 to-pink-50",    badge: "bg-purple-100 text-purple-700",label: "Luxury" },
};

function NeighborhoodThumb({ tier }: { tier: string }) {
  const style = TIER_STYLES[tier] ?? TIER_STYLES["mid-range"]!;
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center rounded-xl bg-gradient-to-br ${style.bg}`}>
      <BuildingIcon />
    </div>
  );
}

export function NeighborhoodBestCard({ item }: { item: NeighborhoodCard }) {
  const style = TIER_STYLES[item.tier] ?? TIER_STYLES["mid-range"]!;
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + " " + item.city + " Jordan")}`;

  return (
    <div className="animate-fade-up rounded-3xl bg-white p-1 shadow-best ring-1 ring-souq-500/30">
      <div className="rounded-[22px] bg-gradient-to-br from-souq-600 to-souq-800 p-[1.5px]">
        <div className="rounded-[21px] bg-white p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-souq-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              <StarIcon /> Best area
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}>
              {style.label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-3 py-1 text-xs font-medium text-souq-800/75">
              <PinIcon size={11} /> {item.city}
            </span>
          </div>

          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="h-36 w-full shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-28">
              <NeighborhoodThumb tier={item.tier} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-souq-900">{item.name}</h3>
                  <p className="text-sm text-souq-800/55" dir="rtl">{item.nameAr}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-bold text-souq-700">
                    {item.avgRentMin}–{item.avgRentMax}
                  </p>
                  <p className="text-xs text-souq-800/55">JOD/month</p>
                </div>
              </div>

              {item.characteristics.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.characteristics.map((c, i) => (
                    <span key={i} className="rounded-full bg-sand-100 px-2.5 py-0.5 text-[11px] font-medium text-souq-800/75">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <ProsCons pros={item.pros} cons={item.cons} />
              </div>

              {item.bestFor.length > 0 && (
                <p className="mt-3 text-xs text-souq-800/55">
                  Best for: <span className="font-medium text-souq-700">{item.bestFor.join(", ")}</span>
                </p>
              )}

              <div className="mt-4">
                <a href={mapsLink} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-souq-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-souq-700">
                  <PinIcon size={13} /> View on map
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NeighborhoodAltCard({ item, rank }: { item: NeighborhoodCard; rank: number }) {
  const style = TIER_STYLES[item.tier] ?? TIER_STYLES["mid-range"]!;
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + " " + item.city + " Jordan")}`;

  return (
    <div className="animate-fade-up rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5 transition hover:-translate-y-0.5">
      <div className="flex gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
          <NeighborhoodThumb tier={item.tier} />
          <span className="absolute left-1 top-1 rounded-full bg-white/90 px-1.5 text-[10px] font-bold text-souq-700">
            #{rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}>
                {style.label}
              </span>
              <h4 className="mt-0.5 text-sm font-bold text-souq-900">{item.name}</h4>
              <p className="text-[11px] text-souq-800/50" dir="rtl">{item.nameAr}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-souq-700">{item.avgRentMin}–{item.avgRentMax}</p>
              <p className="text-[10px] text-souq-800/45">JOD/mo</p>
            </div>
          </div>
          {item.characteristics.slice(0, 2).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {item.characteristics.slice(0, 2).map((c, i) => (
                <span key={i} className="rounded-full bg-sand-50 px-2 py-0.5 text-[10px] text-souq-800/65 ring-1 ring-black/5">
                  {c}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {item.pros.slice(0, 1).map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] text-souq-700">
                <CheckIcon small /> {p}
              </span>
            ))}
            {item.cons.slice(0, 1).map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] text-amber-700">
                <MinusIcon small /> {c}
              </span>
            ))}
          </div>
          <a href={mapsLink} target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-souq-600 hover:underline">
            <PinIcon size={11} /> View on map
          </a>
        </div>
      </div>
    </div>
  );
}

// ── General info cards ────────────────────────────────────────────────────────

const INFO_ICONS: Record<string, React.ReactNode> = {
  info:     <InfoIcon />,
  map:      <PinIcon size={16} />,
  star:     <StarIcon />,
  building: <BuildingIcon />,
  calendar: <CalendarIcon />,
  phone:    <PhoneIcon />,
};

export function GeneralInfoCard({ item }: { item: InfoCard }) {
  return (
    <div className="animate-fade-up rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-souq-50 text-souq-600">
          {INFO_ICONS[item.icon] ?? <InfoIcon />}
        </div>
        <div>
          <p className="text-sm font-semibold text-souq-900">{item.title}</p>
          <p className="mt-1 text-xs text-souq-800/70 leading-relaxed">{item.body}</p>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function SkeletonCard() {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-black/5">
      <div className="shimmer mb-4 h-5 w-28 rounded-full bg-sand-100" />
      <div className="flex gap-5">
        <div className="shimmer h-32 w-32 rounded-xl bg-sand-100" />
        <div className="flex-1 space-y-3">
          <div className="shimmer h-4 w-24 rounded bg-sand-100" />
          <div className="shimmer h-5 w-3/4 rounded bg-sand-100" />
          <div className="shimmer h-4 w-full rounded bg-sand-100" />
          <div className="shimmer h-4 w-5/6 rounded bg-sand-100" />
        </div>
      </div>
    </div>
  );
}

// ── Icons (no external deps) ──────────────────────────────────────────────────

function PinIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path d="M5 4h3l2 5-2.5 1.5a11 11 0 005 5L19 13l2 5v3a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  );
}
function BuildingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 text-souq-400">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M7 9h2v2H7zM11 9h2v2h-2zM15 9h2v2h-2zM7 13h2v2H7zM11 13h2v2h-2zM15 13h2v2h-2zM9 21v-4h6v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M12 8h.01M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function CheckIcon({ small }: { small?: boolean }) {
  const s = small ? 12 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none" className="mt-0.5 shrink-0">
      <circle cx="10" cy="10" r="10" fill="#d1fae5"/>
      <path d="M6 10.5l2.5 2.5L14 7.5" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function MinusIcon({ small }: { small?: boolean }) {
  const s = small ? 12 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none" className="mt-0.5 shrink-0">
      <circle cx="10" cy="10" r="10" fill="#fef3c7"/>
      <path d="M6 10h8" stroke="#d97706" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7L12 2z"/>
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
