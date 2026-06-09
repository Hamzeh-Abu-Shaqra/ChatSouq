/**
 * Temporal context for ChatSouq — Jordan-specific time signals.
 *
 * Jordan uses Asia/Amman timezone (UTC+3 year-round since abolishing DST in 2022).
 * Weekend: Friday + Saturday (Islamic calendar work week).
 * School year: mid-September through mid-June.
 */

import type { TemporalContext } from "@chatsouq/core";

// ── Ramadan date ranges (approximate, Islamic calendar shifts ~11 days/year) ──

/** [year, startMonth(1-based), startDay, endMonth, endDay] */
const RAMADAN_RANGES: [number, number, number, number, number][] = [
  [2024,  3, 11,  4,  9],
  [2025,  3,  1,  3, 29],
  [2026,  2, 18,  3, 19],
  [2027,  2,  8,  3,  8],
  [2028,  1, 28,  2, 25],
  [2029,  1, 17,  2, 14],
  [2030,  1,  6,  2,  4],
];

/** Eid Al-Fitr (3-day) + Eid Al-Adha (3-day) windows */
const EID_RANGES: [number, number, number, number, number][] = [
  // Eid Al-Fitr
  [2024,  4, 10,  4, 12],
  [2025,  3, 30,  4,  1],
  [2026,  3, 20,  3, 22],
  [2027,  3,  9,  3, 11],
  [2028,  2, 26,  2, 28],
  [2029,  2, 15,  2, 17],
  [2030,  2,  5,  2,  7],
  // Eid Al-Adha
  [2024,  6, 16,  6, 18],
  [2025,  6,  6,  6,  8],
  [2026,  5, 27,  5, 29],
  [2027,  5, 17,  5, 19],
  [2028,  5,  5,  5,  7],
  [2029,  4, 25,  4, 27],
  [2030,  4, 14,  4, 16],
];

/** Fixed Jordanian national holidays (month, day, name) */
const JORDAN_HOLIDAYS: [number, number, string][] = [
  [1,  1,  "New Year's Day"],
  [1,  30, "King Abdullah II Birthday"],  // King Abdullah II born 30 Jan 1962
  [5,  1,  "Labour Day"],
  [5,  25, "Independence Day"],
  [6,  10, "Arab Revolt Day"],            // Great Arab Revolt began 10 Jun 1916
  [8,  11, "Accession Day"],              // King Abdullah II ascended 7 Feb 1999; parade day 11 Aug
  [11, 14, "King Hussein's Birthday"],    // King Hussein I born 14 Nov 1935
];

function isInRange(
  year: number, month: number, day: number,
  ranges: [number, number, number, number, number][]
): boolean {
  for (const [y, sm, sd, em, ed] of ranges) {
    if (y !== year) continue;
    const start = sm * 100 + sd;
    const end   = em * 100 + ed;
    const cur   = month * 100 + day;
    if (cur >= start && cur <= end) return true;
  }
  return false;
}

function getHoliday(month: number, day: number): string | null {
  for (const [m, d, name] of JORDAN_HOLIDAYS) {
    if (m === month && d === day) return name;
  }
  return null;
}

function getTimeOfDay(hour: number): TemporalContext["timeOfDay"] {
  if (hour >= 5  && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

function getSeason(month: number): TemporalContext["season"] {
  if (month >= 3 && month <= 5)  return "spring";
  if (month >= 6 && month <= 8)  return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

/**
 * Compute Jordan-local temporal context from the current UTC time.
 * Safe to call in any environment (server or client).
 */
export function getTemporalContext(): TemporalContext {
  // Jordan is UTC+3 year-round
  const utcNow = new Date();
  const jordanOffset = 3 * 60; // minutes
  const local = new Date(utcNow.getTime() + jordanOffset * 60 * 1000);

  const year  = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;  // 1-based
  const day   = local.getUTCDate();
  const hour  = local.getUTCHours();
  const dow   = local.getUTCDay(); // 0=Sun

  const isRamadan = isInRange(year, month, day, RAMADAN_RANGES);
  const isEid     = isInRange(year, month, day, EID_RANGES);
  const isFriday  = dow === 5;
  const isSaturday = dow === 6;

  // School year: mid-Sep → mid-Jun (conservative bounds)
  const isSchoolYear =
    (month === 9 && day >= 15) ||
    (month >= 10 && month <= 12) ||
    (month >= 1  && month <= 5) ||
    (month === 6 && day <= 15);

  return {
    timezone: "Asia/Amman",
    localHour: hour,
    localDay: dow,
    timeOfDay: getTimeOfDay(hour),
    isRamadan,
    isEid,
    isWeekend: isFriday || isSaturday,
    isFriday,
    season: getSeason(month),
    isSchoolYear,
    holiday: getHoliday(month, day),
  };
}

/**
 * Build a short human-readable context line for injection into LLM prompts.
 * Example: "It's Friday evening in Amman (Ramadan hours in effect)."
 */
export function temporalContextLine(t: TemporalContext): string {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const day = dayNames[t.localDay] ?? "today";
  const parts: string[] = [`It's ${day} ${t.timeOfDay} in Amman`];
  if (t.isRamadan) parts.push("Ramadan is active — many venues have special hours");
  if (t.isEid)     parts.push("Eid holidays — expect high demand and special closures");
  if (t.holiday)   parts.push(`today is a Jordanian holiday (${t.holiday})`);
  if (t.isFriday)  parts.push("Friday — many restaurants are at peak capacity");
  return parts.join("; ") + ".";
}
