import { NextResponse } from "next/server";
import { loadThread } from "@chatsouq/core/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const thread = await loadThread(sessionId);

  return NextResponse.json({
    sessionId,
    conversationId: thread.conversationId,
    messages: thread.messages,
    prefs: thread.prefs,
    summary: thread.summary,
    turnCount: thread.turnCount,
  });
}
