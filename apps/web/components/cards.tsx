"use client";

import type { ResultItem, PlaceResultItem, NeighborhoodCard, InfoCard } from "@chatsouq/core";
import { formatJOD, initials, safeUrl, mapsUrl, hostOf } from "../lib/format";

// ── Shared ────────────────────────────────────────────────────────────────────

function ProsCons({ pros, cons }: { pros: string[]; cons: string[] }) {
  if (!pros.length && !cons.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {pros.map((p, i) => (
        <span key={`p${i}`} className="inline-flex items-center gap-1 rounded-full bg-souq-50 px-2.5 py-0.5 text-xs font-medium text-souq-700">
          <CheckDot /> {p}
        </span>
      ))}
      {cons.map((c, i) => (
        <span key={`c${i}`} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          <MinusDot /> {c}
        </span>
      ))}
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
    <div className="flex h-full w-full items-center justify-center bg-sand-100 text-sm font-bold text-ink-500">
      {initials(vendor.name)}
    </div>
  );
}

export function BestCard({ item }: { item: ResultItem }) {
  const { listing } = item;
  return (
    <div className="animate-fade-up overflow-hidden rounded-2xl bg-white shadow-best ring-1 ring-souq-500/20">
      {/* Green accent bar */}
      <div className="h-1 bg-gradient-to-r from-souq-500 to-souq-700" />

      <div className="p-5 sm:p-6">
        {/* Badge row */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-souq-600 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white">
            <StarIcon /> Best match
          </span>
          {listing.category && (
            <span className="rounded-full bg-sand-100 px-3 py-1 text-xs font-medium text-ink-600">
              {listing.category}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col gap-5 sm:flex-row">
          {/* Image */}
          <div className="h-48 w-full overflow-hidden rounded-xl bg-sand-50 sm:h-36 sm:w-36 shrink-0">
            <ProductThumb item={item} />
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {listing.brand && (
                  <p className="mb-0.5 text-[11px] font-bold uppercase tracking-widest text-souq-600">
                    {listing.brand}
                  </p>
                )}
                <h3 className="text-[18px] font-bold leading-snug text-ink-900">
                  {listing.name}
                </h3>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-black text-ink-900 tabular-nums">
                  {formatJOD(listing.price)}
                </p>
              </div>
            </div>

            <p className="mt-2 text-[13px] leading-relaxed text-ink-600">{item.why}</p>

            {(item.pros.length > 0 || item.cons.length > 0) && (
              <div className="mt-3">
                <ProsCons pros={item.pros} cons={item.cons} />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {listing.sourceUrl && (
                <a
                  href={listing.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-ink-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-ink-800"
                >
                  View product <ArrowIcon />
                </a>
              )}
              <span className="text-xs text-ink-400">
                from{" "}
                {safeUrl(listing.vendor.websiteUrl) ? (
                  <a
                    href={safeUrl(listing.vendor.websiteUrl)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-ink-600 hover:underline"
                  >
                    {listing.vendor.name}
                  </a>
                ) : (
                  <span className="font-medium text-ink-600">{listing.vendor.name}</span>
                )}
                {listing.vendor.location ? ` · ${listing.vendor.location}` : ""}
              </span>
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
    <div className="animate-fade-up overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/[0.07] transition-all hover:-translate-y-px hover:shadow-card hover:ring-souq-500/20">
      <div className="flex gap-4 p-4">
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-sand-50">
          <ProductThumb item={item} />
          <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-ink-700 shadow-sm">
            #{rank}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {listing.brand && (
                <p className="truncate text-[10px] font-bold uppercase tracking-widest text-souq-600">
                  {listing.brand}
                </p>
              )}
              <h4 className="truncate text-sm font-semibold text-ink-900">{listing.name}</h4>
            </div>
            <p className="shrink-0 text-sm font-black text-ink-900 tabular-nums">
              {formatJOD(listing.price)}
            </p>
          </div>

          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">{item.why}</p>

          <div className="mt-1.5 flex flex-wrap gap-x-3">
            {item.pros.slice(0, 1).map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] text-souq-700">
                <CheckDot /> {p}
              </span>
            ))}
            {item.cons.slice(0, 1).map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] text-amber-700">
                <MinusDot /> {c}
              </span>
            ))}
          </div>

          {listing.sourceUrl && (
            <a
              href={listing.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-block text-xs font-semibold text-souq-600 hover:underline"
            >
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
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-sand-50 to-sand-100 text-souq-600">
      <PinIcon size={22} />
      <span className="px-2 text-center text-[10px] font-semibold leading-tight text-ink-500">
        {category}
      </span>
    </div>
  );
}

function PlaceActionRow({ item }: { item: PlaceResultItem }) {
  const { place } = item;
  const site = safeUrl(place.website);
  const mapQuery = ARABIC_RE.test(place.name)
    ? `${place.category} ${place.city ?? place.governorate ?? "Jordan"}`
    : place.name;
  const map = mapsUrl(place.lat, place.lng, mapQuery);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {map && (
        <a
          href={map}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-800"
        >
          <PinIcon size={12} /> Directions
        </a>
      )}
      {place.phone && (
        <a
          href={`tel:${place.phone.replace(/\s+/g, "")}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-black/[0.09] transition hover:ring-souq-500/30"
        >
          <PhoneIcon /> Call
        </a>
      )}
      {site && (
        <a
          href={site}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-black/[0.09] transition hover:ring-souq-500/30"
        >
          <GlobeIcon /> {hostOf(place.website) ?? "Website"}
        </a>
      )}
    </div>
  );
}

export function PlaceBestCard({ item }: { item: PlaceResultItem }) {
  const { place } = item;
  const where       = [place.city, place.governorate].filter(Boolean).join(", ");
  const nameIsArabic = ARABIC_RE.test(place.name);
  const secondaryLabel = nameIsArabic && place.nameAr && !ARABIC_RE.test(place.nameAr)
    ? place.nameAr
    : nameIsArabic ? null : (place.nameAr ?? null);

  return (
    <div className="animate-fade-up overflow-hidden rounded-2xl bg-white shadow-best ring-1 ring-souq-500/20">
      <div className="h-1 bg-gradient-to-r from-souq-500 to-souq-700" />

      <div className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-souq-600 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white">
            <StarIcon /> Best match
          </span>
          <span className="rounded-full bg-sand-100 px-3 py-1 text-xs font-medium text-ink-600">
            {place.category}
          </span>
          {where && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sand-50 px-3 py-1 text-xs font-medium text-ink-500">
              <PinIcon size={10} /> {where}
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
              className="text-[18px] font-bold leading-snug text-ink-900"
            >
              {place.name}
            </h3>
            {secondaryLabel && (
              <p
                className="mt-0.5 text-sm text-ink-400"
                dir={ARABIC_RE.test(secondaryLabel) ? "rtl" : "ltr"}
              >
                {secondaryLabel}
              </p>
            )}
            <p className="mt-2 text-[13px] leading-relaxed text-ink-600">{item.why}</p>
            <div className="mt-3">
              <ProsCons pros={item.pros} cons={item.cons} />
            </div>
            <PlaceActionRow item={item} />
            {place.openingHours && (
              <p className="mt-3 text-[11px] text-ink-400">Hours: {place.openingHours}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlaceAltCard({ item, rank }: { item: PlaceResultItem; rank: number }) {
  const { place } = item;
  const where       = [place.city, place.governorate].filter(Boolean).join(", ");
  const map         = mapsUrl(place.lat, place.lng, place.name);
  const site        = safeUrl(place.website);
  const nameIsArabic = ARABIC_RE.test(place.name);

  return (
    <div className="animate-fade-up overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/[0.07] transition-all hover:-translate-y-px hover:shadow-card">
      <div className="flex gap-4 p-4">
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg">
          <PlaceThumb category={place.category} />
          <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-ink-700 shadow-sm">
            #{rank}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-souq-600">{place.category}</p>
          <h4
            dir={nameIsArabic ? "rtl" : "ltr"}
            className="truncate text-sm font-semibold text-ink-900"
          >
            {place.name}
          </h4>
          {where && <p className="mt-0.5 text-[11px] text-ink-400">{where}</p>}
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">{item.why}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {map && (
              <a href={map} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-souq-600 hover:underline">
                <PinIcon size={10} /> Directions
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

const TIER_STYLES: Record<string, { gradient: string; badge: string; label: string }> = {
  budget:      { gradient: "from-blue-50 to-indigo-50",    badge: "bg-blue-100 text-blue-700",     label: "Budget"    },
  "mid-range": { gradient: "from-souq-50 to-emerald-50",   badge: "bg-souq-100 text-souq-700",     label: "Mid-Range" },
  upscale:     { gradient: "from-amber-50 to-yellow-50",   badge: "bg-amber-100 text-amber-700",   label: "Upscale"   },
  luxury:      { gradient: "from-purple-50 to-pink-50",    badge: "bg-purple-100 text-purple-700", label: "Luxury"    },
};

function NeighborhoodThumb({ tier }: { tier: string }) {
  const s = TIER_STYLES[tier] ?? TIER_STYLES["mid-range"]!;
  return (
    <div className={`flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br ${s.gradient}`}>
      <BuildingIcon />
    </div>
  );
}

export function NeighborhoodBestCard({ item }: { item: NeighborhoodCard }) {
  const s       = TIER_STYLES[item.tier] ?? TIER_STYLES["mid-range"]!;
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + " " + item.city + " Jordan")}`;

  return (
    <div className="animate-fade-up overflow-hidden rounded-2xl bg-white shadow-best ring-1 ring-souq-500/20">
      <div className="h-1 bg-gradient-to-r from-souq-500 to-souq-700" />

      <div className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-souq-600 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white">
            <StarIcon /> Best area
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.badge}`}>
            {s.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-sand-50 px-3 py-1 text-xs font-medium text-ink-500">
            <PinIcon size={10} /> {item.city}
          </span>
        </div>

        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="h-36 w-full shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-28">
            <NeighborhoodThumb tier={item.tier} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-ink-900">{item.name}</h3>
                <p className="text-sm text-ink-400" dir="rtl">{item.nameAr}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xl font-black text-ink-900 tabular-nums">
                  {item.avgRentMin}–{item.avgRentMax}
                </p>
                <p className="text-xs text-ink-400">JOD / month</p>
              </div>
            </div>

            {item.characteristics.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.characteristics.map((c, i) => (
                  <span key={i} className="rounded-full bg-sand-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
                    {c}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3">
              <ProsCons pros={item.pros} cons={item.cons} />
            </div>

            {item.bestFor.length > 0 && (
              <p className="mt-3 text-xs text-ink-400">
                Best for:{" "}
                <span className="font-semibold text-ink-600">{item.bestFor.join(", ")}</span>
              </p>
            )}

            <div className="mt-4">
              <a
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-800"
              >
                <PinIcon size={12} /> View on map
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NeighborhoodAltCard({ item, rank }: { item: NeighborhoodCard; rank: number }) {
  const s       = TIER_STYLES[item.tier] ?? TIER_STYLES["mid-range"]!;
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + " " + item.city + " Jordan")}`;

  return (
    <div className="animate-fade-up overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/[0.07] transition-all hover:-translate-y-px hover:shadow-card">
      <div className="flex gap-4 p-4">
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg">
          <NeighborhoodThumb tier={item.tier} />
          <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-ink-700 shadow-sm">
            #{rank}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.badge}`}>
                {s.label}
              </span>
              <h4 className="mt-0.5 text-sm font-bold text-ink-900">{item.name}</h4>
              <p className="text-[11px] text-ink-400" dir="rtl">{item.nameAr}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-black text-ink-900 tabular-nums">{item.avgRentMin}–{item.avgRentMax}</p>
              <p className="text-[10px] text-ink-400">JOD/mo</p>
            </div>
          </div>

          {item.characteristics.slice(0, 2).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {item.characteristics.slice(0, 2).map((c, i) => (
                <span key={i} className="rounded-full bg-sand-50 px-2 py-0.5 text-[10px] text-ink-500 ring-1 ring-black/[0.06]">
                  {c}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-x-3">
            {item.pros.slice(0, 1).map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] text-souq-700">
                <CheckDot /> {p}
              </span>
            ))}
            {item.cons.slice(0, 1).map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] text-amber-700">
                <MinusDot /> {c}
              </span>
            ))}
          </div>

          <a href={mapsLink} target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-souq-600 hover:underline">
            <PinIcon size={10} /> View on map
          </a>
        </div>
      </div>
    </div>
  );
}

// ── General info cards ────────────────────────────────────────────────────────

const INFO_ICON_MAP: Record<string, React.ReactNode> = {
  info:     <InfoIcon />,
  map:      <PinIcon size={15} />,
  star:     <StarIcon />,
  building: <BuildingIcon />,
  calendar: <CalendarIcon />,
  phone:    <PhoneIcon />,
};

export function GeneralInfoCard({ item }: { item: InfoCard }) {
  return (
    <div className="animate-fade-up rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.07]">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-souq-50 text-souq-600">
          {INFO_ICON_MAP[item.icon] ?? <InfoIcon />}
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-900">{item.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{item.body}</p>
        </div>
      </div>
    </div>
  );
}

// ── News info cards ───────────────────────────────────────────────────────────

export function NewsInfoCard({ item, index }: { item: InfoCard; index: number }) {
  return (
    <div
      className="animate-fade-up flex items-start gap-3 rounded-xl bg-white px-4 py-3 border-l-2"
      style={{
        borderLeftColor: "#fca5a5",
        animationDelay: `${index * 60}ms`,
      }}
    >
      {/* Icon square */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: "#fff1f2" }}
      >
        <CalendarIcon style={{ color: "#be123c" }} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-snug text-ink-900">{item.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-500">{item.body}</p>
      </div>
    </div>
  );
}

// ── Company info cards ────────────────────────────────────────────────────────

const COMPANY_ICON_LABEL: Record<string, string> = {
  info:     "ℹ️",
  map:      "📍",
  star:     "⭐",
  building: "🏢",
  calendar: "📅",
  phone:    "📞",
};

export function CompanyInfoCard({ item, index }: { item: InfoCard; index: number }) {
  const iconLabel = COMPANY_ICON_LABEL[item.icon] ?? "🏢";

  return (
    <div
      className="animate-fade-up rounded-xl bg-white p-4 ring-1 ring-black/[0.07]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Industry badge */}
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: "#eef2ff", color: "#3730a3" }}
        >
          {iconLabel}
        </span>
      </div>

      {/* Name + description */}
      <p className="text-sm font-semibold leading-snug text-ink-900">{item.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">{item.body}</p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.07]">
      <div className="shimmer h-1 w-full" />
      <div className="p-5">
        <div className="mb-4 flex gap-2">
          <div className="shimmer h-6 w-24 rounded-full" />
          <div className="shimmer h-6 w-16 rounded-full" />
        </div>
        <div className="flex gap-5">
          <div className="shimmer h-32 w-32 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2.5">
            <div className="shimmer h-3.5 w-20 rounded" />
            <div className="shimmer h-5 w-3/4 rounded" />
            <div className="shimmer h-3.5 w-full rounded" />
            <div className="shimmer h-3.5 w-5/6 rounded" />
            <div className="mt-4 flex gap-2">
              <div className="shimmer h-5 w-16 rounded-full" />
              <div className="shimmer h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Icons (zero deps) ─────────────────────────────────────────────────────────

function PinIcon({ size = 13 }: { size?: number }) {
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

function BuildingIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-300">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 9h2v2H7zM11 9h2v2h-2zM15 9h2v2h-2zM7 13h2v2H7zM11 13h2v2h-2zM15 13h2v2h-2zM9 21v-4h6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M12 8h.01M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function CalendarIcon({ style }: { style?: React.CSSProperties } = {}) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0" style={style}>
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7L12 2z"/>
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
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

function MinusDot() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="mt-px shrink-0">
      <circle cx="5" cy="5" r="5" fill="#fef3c7"/>
      <path d="M3 5h4" stroke="#d97706" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
