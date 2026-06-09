"use client";

/**
 * ContextIndicator — shows active Tier 1 context signals as gold pills.
 *
 * Renders at most 3 pills:
 *   - Near you (GPS or stated neighbourhood)
 *   - Open now / Friday / Evening (temporal)
 *   - Ramadan hours / Holiday
 *   - Personalised (history profile active)
 *
 * Pills are shown only when relevant — e.g. "Open now" is not shown if there's
 * no useful temporal signal. Clicking a pill has no action (informational only).
 */

import type { QueryContext } from "@chatsouq/core";

interface Props {
  context: QueryContext | null;
}

interface Pill {
  label: string;
  icon: string;
  title: string;
}

function buildPills(ctx: QueryContext | null): Pill[] {
  if (!ctx) return [];
  const pills: Pill[] = [];

  // Location pill
  if (ctx.location) {
    const nb = ctx.location.neighborhood;
    const gov = ctx.location.governorate;
    if (nb) {
      pills.push({
        icon: "📍",
        label: nb,
        title: `Location from ${ctx.location.source === "gps" ? "GPS" : ctx.location.source === "ip" ? "IP geolocation" : "your history"}`,
      });
    } else if (gov && ctx.location.source !== "default") {
      pills.push({
        icon: "📍",
        label: gov,
        title: `Location from ${ctx.location.source}`,
      });
    }
  }

  // Temporal pills
  if (ctx.temporal) {
    const t = ctx.temporal;
    if (t.isRamadan) {
      pills.push({ icon: "🌙", label: "Ramadan hours", title: "Ramadan is active — venues may have special hours" });
    } else if (t.isEid) {
      pills.push({ icon: "🎉", label: "Eid", title: "Eid holidays — expect high demand" });
    } else if (t.holiday) {
      pills.push({ icon: "🏖️", label: t.holiday, title: `Today is ${t.holiday}` });
    } else if (t.isFriday) {
      pills.push({ icon: "🕌", label: "Friday", title: "Friday — many venues have special Friday hours" });
    } else if (t.timeOfDay === "evening" || t.timeOfDay === "night") {
      pills.push({ icon: "🌙", label: "Evening", title: "Evening results prioritised" });
    }
  }

  // History / personalisation pill
  if (
    ctx.history &&
    (ctx.history.inferredBudget || ctx.history.inferredNeighborhood || ctx.history.preferredCategories.length > 0)
  ) {
    pills.push({ icon: "✨", label: "Personalised", title: "Based on your search history" });
  }

  return pills.slice(0, 3);
}

export default function ContextIndicator({ context }: Props) {
  const pills = buildPills(context);
  if (pills.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {pills.map((p, i) => (
        <span
          key={i}
          title={p.title}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-default select-none"
          style={{
            background: "#FBF4E3",
            border: "0.5px solid #E8D5A0",
            color: "#7A5C10",
          }}
        >
          <span>{p.icon}</span>
          <span>{p.label}</span>
        </span>
      ))}
    </div>
  );
}
