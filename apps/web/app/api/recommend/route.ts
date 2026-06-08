import { NextResponse } from "next/server";
import { assist } from "@chatsouq/core";
import type { ConvMessage } from "@chatsouq/core";
import { db, schema } from "@chatsouq/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { query?: string; sessionId?: string; history?: ConvMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }
  if (query.length > 500) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  // Sanitise history: keep last 10 turns (5 exchanges), trim content to avoid
  // bloated prompts from very long prior answers.
  const history: ConvMessage[] = (body.history ?? [])
    .slice(-10)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 800) }));

  try {
    const result = await assist({ query, history });

    // Behavioral capture for product and place queries (general queries have no DB rows to reference).
    if (result.kind === "products" || result.kind === "places") {
      const ids =
        result.kind === "products"
          ? [result.best?.listing.id, ...result.alternatives.map((a) => a.listing.id)]
          : [result.best?.place.id, ...result.alternatives.map((a) => a.place.id)];

      db.insert(schema.recommendations)
        .values({
          sessionId: body.sessionId ?? null,
          query,
          constraints:
            result.kind === "products"
              ? (result.constraints as unknown as Record<string, unknown>)
              : (result.intent as unknown as Record<string, unknown>),
          bestListingId: result.kind === "products" ? (result.best?.listing.id ?? null) : null,
          results: { kind: result.kind, ids: ids.filter((x) => x != null) },
          provider: result.meta.provider,
        })
        .catch(() => {});
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[recommend] error:", err);
    return NextResponse.json({ error: "Recommendation failed" }, { status: 500 });
  }
}
