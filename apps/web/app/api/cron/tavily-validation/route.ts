/**
 * /api/cron/tavily-validation
 *
 * Nightly batch job — pre-validates popular places against Tavily so the
 * in-memory enrichment cache is warm for the first requests of the day.
 *
 * Triggered by Vercel Cron (see vercel.json) at 00:00 UTC = 03:00 Jordan time.
 * Protected by the CRON_SECRET env var that Vercel injects automatically.
 *
 * All DB logic lives in @chatsouq/core/tavilyEnrichment — this route is a
 * thin HTTP wrapper.
 */

import { NextResponse } from "next/server";
import { runNightlyTavilyBatch } from "@chatsouq/core";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 55; // seconds (Vercel pro allows up to 300s; hobby: 60s)

export async function GET(req: Request) {
  // Verify this request genuinely comes from Vercel Cron
  const authHeader = req.headers.get("authorization");
  const cronSecret  = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.TAVILY_API_KEY) {
    return NextResponse.json({ skipped: true, reason: "TAVILY_API_KEY not set" });
  }

  try {
    const result = await runNightlyTavilyBatch(45_000);
    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[cron/tavily-validation] unexpected error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
