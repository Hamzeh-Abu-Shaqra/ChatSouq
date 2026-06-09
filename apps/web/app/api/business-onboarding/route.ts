import { NextResponse } from "next/server";
import { db } from "@chatsouq/db";
import { events } from "@chatsouq/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OnboardingPayload {
  businessName: string;
  category: string;
  area: string;
  phone?: string;
  email: string;
  website?: string;
  notes?: string;
}

export async function POST(req: Request) {
  let body: Partial<OnboardingPayload>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.businessName || !body.category || !body.area || !body.email) {
    return NextResponse.json(
      { error: "Missing required fields: businessName, category, area, email" },
      { status: 400 }
    );
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  try {
    // Store as an event — in production this would go to a dedicated
    // business_onboarding table and trigger an email notification
    await db.insert(events).values({
      type: "business_onboarding",
      payload: {
        businessName: body.businessName,
        category: body.category,
        area: body.area,
        phone: body.phone ?? null,
        email: body.email,
        website: body.website ?? null,
        notes: body.notes ?? null,
        submittedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[business-onboarding]", err);
    return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
  }
}
