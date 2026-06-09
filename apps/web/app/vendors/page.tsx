"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BENEFITS = [
  {
    icon: "🎯",
    title: "Appear in AI answers",
    body: "ChatSouq's AI recommends your business to thousands of Ammanis searching for exactly what you offer — by name, not by ad spend.",
  },
  {
    icon: "📊",
    title: "Real intent, real customers",
    body: "Every person who finds you through ChatSouq typed a specific request. These are buyers, not browsers.",
  },
  {
    icon: "🇯🇴",
    title: "Amman-first, always",
    body: "We only index Jordan. No noise from international results, no dilution. Your competition is local and so are your customers.",
  },
  {
    icon: "✦",
    title: "Curated, not just listed",
    body: "Our AI explains why your business matches each query. Customers arrive with context — not just a name in a list.",
  },
  {
    icon: "📱",
    title: "Arabic + English",
    body: "ChatSouq handles searches in both languages natively. Your listing appears whether customers search in English or Arabic.",
  },
  {
    icon: "🔒",
    title: "Verified listings only",
    body: "We manually verify every business. Your listing carries a trust signal that Google can't give you.",
  },
];

const PLANS = [
  {
    name: "Basic",
    price: "Free",
    period: "",
    features: ["Listed in search results", "Basic business details", "Phone & location", "Community updates"],
    cta: "Get listed",
    highlight: false,
  },
  {
    name: "Verified",
    price: "15",
    period: "JOD / month",
    features: ["Everything in Basic", "✦ Verified badge", "Priority ranking", "Photos & menu upload", "Analytics dashboard", "Arabic + English"],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Partner",
    price: "45",
    period: "JOD / month",
    features: ["Everything in Verified", "AI-generated profile copy", "Featured placement", "Weekly insights report", "Dedicated support", "Custom AI answers"],
    cta: "Contact us",
    highlight: false,
  },
];

interface FormState {
  businessName: string;
  category: string;
  area: string;
  phone: string;
  email: string;
  website: string;
  notes: string;
}

export default function VendorsPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    businessName: "",
    category: "",
    area: "",
    phone: "",
    email: "",
    website: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function update(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/business-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitted(true);
    } catch (err) {
      console.error("[onboarding]", err);
      setSubmitError("Something went wrong. Please try again or email us at hello@chatsouq.ai");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[#F9F8F6] min-h-screen">
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 pt-16 pb-12 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-4" style={{ color: "#C9A84C" }}>
          ◆ ChatSouq for Businesses
        </p>
        <h1 className="font-serif leading-[1.15] mb-5" style={{ fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 500, color: "#1A1A1A" }}>
          Get discovered by<br />
          <span style={{ color: "#C9A84C" }}>Amman&apos;s most intent-driven</span><br />
          customers.
        </h1>
        <p className="text-[15px] leading-relaxed mx-auto mb-8" style={{ color: "#6B7280", maxWidth: "520px" }}>
          ChatSouq is Jordan&apos;s AI recommendation engine. When someone searches for the best
          restaurant, gym, or salon in Amman, we answer with the best match — your business.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a
            href="#get-listed"
            className="px-6 py-3 rounded-lg text-[14px] font-medium text-white transition-all"
            style={{ background: "#C9A84C" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#b8963e"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#C9A84C"; }}
          >
            Get listed free →
          </a>
          <a
            href="#plans"
            className="px-6 py-3 rounded-lg text-[14px] font-medium transition-all"
            style={{ border: "0.5px solid #E8E4DC", color: "#374151" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#C9A84C"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#E8E4DC"; }}
          >
            See plans
          </a>
        </div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────────────────────── */}
      <div style={{ background: "#F3F1EE", borderTop: "0.5px solid #E8E4DC", borderBottom: "0.5px solid #E8E4DC" }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { n: "82,000+", label: "verified listings" },
              { n: "2 languages", label: "Arabic & English" },
              { n: "Amman-only", label: "hyper-local search" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-serif text-[1.6rem] font-medium text-[#1A1A1A]">{stat.n}</p>
                <p className="text-[12px] text-[#6B7280]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BENEFITS ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#C9A84C" }}>
          ◆ Why ChatSouq
        </p>
        <h2 className="font-serif text-[1.8rem] font-medium text-[#1A1A1A] mb-10">
          Built for Amman businesses
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="bg-white rounded-xl p-5"
              style={{ border: "0.5px solid #E8E4DC" }}
            >
              <div className="text-[24px] mb-3">{b.icon}</div>
              <h3 className="font-serif text-[1rem] font-medium text-[#1A1A1A] mb-2">{b.title}</h3>
              <p className="text-[13px] text-[#6B7280] leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PLANS ─────────────────────────────────────────────────────────── */}
      <section id="plans" className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#C9A84C" }}>
          ◆ Pricing
        </p>
        <h2 className="font-serif text-[1.8rem] font-medium text-[#1A1A1A] mb-10">
          Simple, transparent plans
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="rounded-xl p-5 flex flex-col"
              style={{
                background: plan.highlight ? "#FBF4E3" : "#fff",
                border: plan.highlight ? "0.5px solid #E8D5A0" : "0.5px solid #E8E4DC",
              }}
            >
              {plan.highlight && (
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-3" style={{ color: "#C9A84C" }}>
                  ◆ Most popular
                </p>
              )}
              <p className="font-serif text-[1.05rem] font-medium text-[#1A1A1A] mb-1">{plan.name}</p>
              <div className="mb-4">
                <span className="font-serif text-[2rem] font-medium text-[#1A1A1A]">
                  {plan.price === "Free" ? "Free" : `${plan.price}`}
                </span>
                {plan.period && (
                  <span className="text-[12px] text-[#6B7280] ml-1">{plan.period}</span>
                )}
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-[#374151]">
                    <span className="mt-0.5 flex-shrink-0" style={{ color: "#C9A84C" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#get-listed"
                className="block text-center py-2.5 rounded-lg text-[13px] font-medium transition-all"
                style={plan.highlight
                  ? { background: "#C9A84C", color: "#fff" }
                  : { border: "0.5px solid #E8E4DC", color: "#374151" }
                }
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  if (plan.highlight) { el.style.background = "#b8963e"; }
                  else { el.style.borderColor = "#C9A84C"; }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  if (plan.highlight) { el.style.background = "#C9A84C"; }
                  else { el.style.borderColor = "#E8E4DC"; }
                }}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ── ONBOARDING FORM ───────────────────────────────────────────────── */}
      <section id="get-listed" className="mx-auto max-w-3xl px-4 sm:px-6 py-16" style={{ borderTop: "0.5px solid #E8E4DC" }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#C9A84C" }}>
          ◆ Get listed
        </p>
        <h2 className="font-serif text-[1.8rem] font-medium text-[#1A1A1A] mb-2">
          Add your business
        </h2>
        <p className="text-[14px] text-[#6B7280] mb-8">
          Fill in the details below and we&apos;ll add your business to ChatSouq within 48 hours.
        </p>

        {submitted ? (
          <div
            className="rounded-xl p-8 text-center"
            style={{ background: "#FBF4E3", border: "0.5px solid #E8D5A0" }}
          >
            <div className="text-[32px] mb-3">✦</div>
            <h3 className="font-serif text-[1.3rem] font-medium text-[#1A1A1A] mb-2">
              You&apos;re on the list.
            </h3>
            <p className="text-[14px] text-[#7A5C10]">
              We&apos;ll review your submission and get back to you within 48 hours.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Business name *">
                <input
                  required
                  type="text"
                  placeholder="e.g. Sekrab Amman"
                  value={form.businessName}
                  onChange={(e) => update("businessName", e.target.value)}
                />
              </Field>
              <Field label="Category *">
                <select
                  required
                  value={form.category}
                  onChange={(e) => update("category", e.target.value)}
                >
                  <option value="">Select a category</option>
                  {["Restaurant", "Café", "Gym", "Salon", "Gift shop", "Clinic", "Hotel", "Shopping", "Experience", "Other"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Area in Amman *">
                <input
                  required
                  type="text"
                  placeholder="e.g. Abdoun, Sweifieh, Rainbow Street"
                  value={form.area}
                  onChange={(e) => update("area", e.target.value)}
                />
              </Field>
              <Field label="Phone number">
                <input
                  type="tel"
                  placeholder="+962 6 ..."
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </Field>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Email address *">
                <input
                  required
                  type="email"
                  placeholder="you@yourbusiness.jo"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </Field>
              <Field label="Website (optional)">
                <input
                  type="url"
                  placeholder="https://yourbusiness.jo"
                  value={form.website}
                  onChange={(e) => update("website", e.target.value)}
                />
              </Field>
            </div>

            {/* Notes */}
            <Field label="Anything else we should know?">
              <textarea
                rows={3}
                placeholder="Special features, signature products, best-sellers, awards…"
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </Field>

            <div className="flex items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 rounded-lg text-[14px] font-medium text-white transition-all disabled:opacity-60"
                style={{ background: "#C9A84C" }}
                onMouseEnter={(e) => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = "#b8963e"; }}
                onMouseLeave={(e) => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = "#C9A84C"; }}
              >
                {submitting ? "Submitting…" : "Submit listing →"}
              </button>
              <p className="text-[12px] text-[#9ca3af]">Free forever. No credit card required.</p>
            </div>
            {submitError && (
              <p className="mt-3 text-[13px]" style={{ color: "#dc2626" }}>{submitError}</p>
            )}
          </form>
        )}
      </section>
    </div>
  );
}

// ── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactElement }) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    fontSize: "14px",
    color: "#1A1A1A",
    background: "#fff",
    border: "0.5px solid #E8E4DC",
    borderRadius: "8px",
    outline: "none",
    transition: "border-color 0.15s",
  };

  return (
    <div>
      <label className="block text-[12px] font-medium text-[#374151] mb-1.5">{label}</label>
      {/* Clone child and inject style via onFocus/onBlur */}
      {(children.type === "input" || children.type === "select" || children.type === "textarea")
        ? (() => {
          const Tag = children.type as "input" | "select" | "textarea";
          return (
            <Tag
              {...(children.props as Record<string, unknown>)}
              style={inputStyle}
              onFocus={(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
                e.target.style.borderColor = "#C9A84C";
              }}
              onBlur={(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
                e.target.style.borderColor = "#E8E4DC";
              }}
            />
          );
        })()
        : children
      }
    </div>
  );
}
