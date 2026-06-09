"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const RECENT_SEARCHES = [
  "Best romantic restaurant in Weibdeh for two",
  "Gyms in Abdoun with a pool",
  "Eid gift for my mother under 50 JOD",
];

const SAVED_PLACES = [
  { name: "Sekrab Amman",       cat: "Restaurant",  area: "Downtown"       },
  { name: "Stretch Studio",     cat: "Yoga studio", area: "Sweifieh"       },
  { name: "Baklawa District",   cat: "Sweets",      area: "Jabal Amman"    },
];

const SETTINGS = [
  { label: "Language",       value: "English",    action: "Change" },
  { label: "City",           value: "Amman",      action: "Change" },
  { label: "Notifications",  value: "Off",        action: "Enable" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [savedItems, setSavedItems] = useState(SAVED_PLACES);

  function removeItem(name: string) {
    setSavedItems((items) => items.filter((i) => i.name !== name));
  }

  return (
    <div className="bg-[#F9F8F6] min-h-screen">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        {/* Header */}
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: "#C9A84C" }}>
          ◆ Your profile
        </p>
        <h1 className="font-serif text-[1.8rem] font-medium text-[#1A1A1A] mb-8">
          My ChatSouq
        </h1>

        {/* Guest state */}
        <div
          className="rounded-xl px-5 py-6 mb-8"
          style={{ background: "#FBF4E3", border: "0.5px solid #E8D5A0" }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-medium flex-shrink-0"
              style={{ background: "#C9A84C", color: "#fff" }}
            >
              ✦
            </div>
            <div>
              <p className="text-[14px] font-medium text-[#1A1A1A] mb-0.5">Guest user</p>
              <p className="text-[12px] text-[#7A5C10]">
                Sign in to sync your saved places and history across devices.
              </p>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all"
              style={{ background: "#C9A84C" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#b8963e"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#C9A84C"; }}
            >
              Sign in
            </button>
            <button
              className="px-4 py-2 rounded-lg text-[13px] font-medium transition-all"
              style={{ border: "0.5px solid #E8D5A0", color: "#7A5C10" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#C9A84C"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E8D5A0"; }}
            >
              Create account
            </button>
          </div>
        </div>

        {/* Saved places */}
        <Section title="Saved places">
          {savedItems.length === 0 ? (
            <EmptyState
              icon="♡"
              message="No saved places yet."
              cta="Browse Amman"
              onClick={() => router.push("/browse")}
            />
          ) : (
            <div className="space-y-2">
              {savedItems.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between bg-white rounded-xl px-4 py-3"
                  style={{ border: "0.5px solid #E8E4DC" }}
                >
                  <div>
                    <p className="text-[13px] font-medium text-[#1A1A1A]">{item.name}</p>
                    <p className="text-[11px] text-[#9ca3af]">{item.cat} · {item.area}</p>
                  </div>
                  <button
                    onClick={() => removeItem(item.name)}
                    className="text-[12px] transition-colors"
                    style={{ color: "#9ca3af" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af"; }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => router.push("/saved")}
                className="text-[12px] font-medium mt-1 transition-colors"
                style={{ color: "#C9A84C" }}
              >
                View all saved →
              </button>
            </div>
          )}
        </Section>

        {/* Recent searches */}
        <Section title="Recent searches">
          {RECENT_SEARCHES.length === 0 ? (
            <EmptyState
              icon="🔍"
              message="No recent searches."
              cta="Ask ChatSouq"
              onClick={() => router.push("/chat")}
            />
          ) : (
            <div className="space-y-2">
              {RECENT_SEARCHES.map((q) => (
                <button
                  key={q}
                  onClick={() => router.push(`/chat?q=${encodeURIComponent(q)}`)}
                  className="w-full text-left bg-white rounded-xl px-4 py-3 transition-all"
                  style={{ border: "0.5px solid #E8E4DC" }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = "#C9A84C";
                    el.style.background = "#FBF4E3";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = "#E8E4DC";
                    el.style.background = "#fff";
                  }}
                >
                  <span className="text-[12px] text-[#9ca3af] mr-2">🔍</span>
                  <span className="text-[13px] text-[#374151]">{q}</span>
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* Preferences */}
        <Section title="Preferences">
          <div className="rounded-xl overflow-hidden" style={{ border: "0.5px solid #E8E4DC" }}>
            {SETTINGS.map((s, i, arr) => (
              <div
                key={s.label}
                className="flex items-center justify-between bg-white px-4 py-3"
                style={{ borderBottom: i < arr.length - 1 ? "0.5px solid #E8E4DC" : "none" }}
              >
                <div>
                  <p className="text-[13px] text-[#1A1A1A]">{s.label}</p>
                  <p className="text-[11px] text-[#9ca3af]">{s.value}</p>
                </div>
                <button
                  className="text-[12px] transition-colors"
                  style={{ color: "#C9A84C" }}
                >
                  {s.action}
                </button>
              </div>
            ))}
          </div>
        </Section>

        {/* About links */}
        <Section title="More">
          <div className="rounded-xl overflow-hidden" style={{ border: "0.5px solid #E8E4DC" }}>
            {[
              { label: "About ChatSouq",   href: "/about"   },
              { label: "For businesses",   href: "/vendors"  },
              { label: "Privacy policy",   href: "#"         },
              { label: "Terms of service", href: "#"         },
            ].map((link, i, arr) => (
              <button
                key={link.label}
                onClick={() => router.push(link.href)}
                className="w-full text-left flex items-center justify-between bg-white px-4 py-3 transition-colors"
                style={{ borderBottom: i < arr.length - 1 ? "0.5px solid #E8E4DC" : "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FBF4E3"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
              >
                <span className="text-[13px] text-[#374151]">{link.label}</span>
                <span className="text-[#9ca3af] text-[12px]">›</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <p className="text-center text-[11px] text-[#9ca3af] mt-8">
          ChatSouq · Amman, Jordan · v1.0
        </p>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#C9A84C" }}>
        ◆ {title}
      </p>
      {children}
    </div>
  );
}

function EmptyState({ icon, message, cta, onClick }: { icon: string; message: string; cta: string; onClick: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="text-[28px] mb-2 text-[#9ca3af]">{icon}</div>
      <p className="text-[13px] text-[#6B7280] mb-3">{message}</p>
      <button
        onClick={onClick}
        className="text-[13px] font-medium transition-colors"
        style={{ color: "#C9A84C" }}
      >
        {cta} →
      </button>
    </div>
  );
}
