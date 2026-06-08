import { NextResponse } from "next/server";
import { recordFeedback } from "@chatsouq/core/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    sessionId?: string;
    conversationId?: string;
    query?: string;
    resultKind?: string;
    shownIds?: number[];
    clickedId?: number;
    clickedRank?: number;
    rating?: number;
    feedbackText?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.sessionId || !body.query) {
    return NextResponse.json({ error: "Missing sessionId or query" }, { status: 400 });
  }

  // Fire-and-forget — client doesn't need to wait
  recordFeedback({
    sessionId: body.sessionId,
    conversationId: body.conversationId ?? null,
    query: body.query,
    resultKind: body.resultKind ?? "general",
    shownIds: body.shownIds ?? [],
    clickedId: body.clickedId,
    clickedRank: body.clickedRank,
    rating: body.rating,
    feedbackText: body.feedbackText,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
