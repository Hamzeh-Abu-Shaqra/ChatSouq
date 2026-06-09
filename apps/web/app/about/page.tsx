import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — ChatSouq",
  description: "ChatSouq is Jordan's AI recommendation engine, built for Amman.",
};

const TEAM = [
  { name: "Hamzeh Al-Omari", role: "Founder & CEO", city: "Amman" },
];

const TIMELINE = [
  { year: "2024", event: "Problem identified — there is no reliable, local-first way to find the best in Amman." },
  { year: "Q1 2025", event: "First data pipeline running. 30,000 Amman listings collected, cleaned, and categorised." },
  { year: "Q2 2025", event: "AI recommendation engine goes live. Arabic and English handled natively." },
  { year: "Q3 2025", event: "82,000+ verified listings. Conversational interface launched." },
  { year: "2026 →", event: "Real-time data layer. Expanding to cover all of Jordan." },
];

export default function AboutPage() {
  return (
    <div className="bg-[#F9F8F6] min-h-screen">
      <article className="mx-auto max-w-2xl px-4 sm:px-6 py-16">
        {/* Eyebrow */}
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-4" style={{ color: "#C9A84C" }}>
          ◆ About ChatSouq
        </p>

        {/* Title */}
        <h1 className="font-serif leading-[1.15] mb-6" style={{ fontSize: "clamp(2rem, 5vw, 2.8rem)", fontWeight: 500, color: "#1A1A1A" }}>
          Built for Amman.<br />
          <span style={{ color: "#C9A84C" }}>Powered by AI.</span>
        </h1>

        {/* Lead */}
        <p className="text-[16px] leading-relaxed mb-10" style={{ color: "#374151" }}>
          ChatSouq started with a simple frustration: finding the <em>best</em> restaurant,
          gym, or gift shop in Amman takes too long, and the answers are usually wrong —
          buried under sponsored results, outdated Google listings, or generic blog posts
          written by people who have never been to Jordan.
        </p>

        {/* Body */}
        <div className="space-y-6 text-[14px] leading-[1.8] text-[#374151]" style={{ lineHeight: "1.85" }}>
          <p>
            We built ChatSouq to fix that. It is Jordan&apos;s first AI-native recommendation
            engine — not a directory, not a search engine, not a food delivery app. It is a
            conversational system that understands what you actually mean when you say
            &ldquo;romantic dinner in Weibdeh under 60 JOD&rdquo; or
            &ldquo;أحتاج هدية عيد لأمي تحت ٥٠ دينار&rdquo; — and gives you one great answer, explained.
          </p>

          <p>
            The database behind it is built entirely from Jordanian sources: local business
            directories, menus, social media listings, government data, and manual curation
            by our team on the ground in Amman. We verify every listing. We re-scrape every
            week. When a restaurant closes or a gym changes its hours, we know.
          </p>

          <p>
            The recommendation engine uses a combination of semantic vector search, keyword
            matching, and a learned ranking model tuned specifically for Jordanian consumer
            behaviour. Arabic and English are treated as equals — not translations of each other,
            but native modes of expression for Amman&apos;s population.
          </p>

          <p>
            We are not a global product with a Jordan tab. We are a Jordan product, built from
            the ground up, with the depth that only comes from caring about one city at a time.
          </p>
        </div>

        {/* Divider */}
        <div className="my-12 h-px" style={{ background: "#E8E4DC" }} />

        {/* Timeline */}
        <div className="mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-6" style={{ color: "#C9A84C" }}>
            ◆ How we got here
          </p>
          <div className="space-y-4">
            {TIMELINE.map((item) => (
              <div key={item.year} className="flex items-start gap-4">
                <span
                  className="text-[12px] font-medium w-20 flex-shrink-0 pt-0.5"
                  style={{ color: "#C9A84C" }}
                >
                  {item.year}
                </span>
                <p className="text-[13px] text-[#374151] leading-relaxed">{item.event}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="my-12 h-px" style={{ background: "#E8E4DC" }} />

        {/* Team */}
        <div className="mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-6" style={{ color: "#C9A84C" }}>
            ◆ The team
          </p>
          <div className="space-y-3">
            {TEAM.map((person) => (
              <div
                key={person.name}
                className="flex items-center gap-4 bg-white rounded-xl px-4 py-3"
                style={{ border: "0.5px solid #E8E4DC" }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-medium flex-shrink-0"
                  style={{ background: "#FBF4E3", color: "#7A5C10" }}
                >
                  {person.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#1A1A1A]">{person.name}</p>
                  <p className="text-[12px] text-[#6B7280]">{person.role} · {person.city}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="my-12 h-px" style={{ background: "#E8E4DC" }} />

        {/* Contact */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#C9A84C" }}>
            ◆ Get in touch
          </p>
          <p className="text-[14px] text-[#374151] mb-4">
            For press, partnerships, and listings:{" "}
            <a href="mailto:hello@chatsouq.com" className="underline" style={{ color: "#C9A84C" }}>
              hello@chatsouq.com
            </a>
          </p>
          <p className="text-[14px] text-[#374151]">
            For business listings:{" "}
            <a href="/vendors" className="underline" style={{ color: "#C9A84C" }}>
              chatsouq.com/vendors
            </a>
          </p>
        </div>
      </article>
    </div>
  );
}
