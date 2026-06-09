import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — ChatSouq",
  description: "How ChatSouq collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="bg-[#F9F8F6] min-h-screen">
      <article className="mx-auto max-w-2xl px-4 sm:px-6 py-16">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-4" style={{ color: "#C9A84C" }}>
          ◆ Privacy Policy
        </p>
        <h1 className="font-serif text-[2rem] font-medium text-[#1A1A1A] mb-2">
          Privacy Policy
        </h1>
        <p className="text-[13px] text-[#9ca3af] mb-10">Last updated: June 2026</p>

        <div className="space-y-8 text-[14px] leading-[1.85] text-[#374151]">
          <Section title="1. What we collect">
            <p>
              ChatSouq collects the following information when you use the service:
            </p>
            <ul className="mt-3 space-y-1.5 pl-4">
              <li>• <strong>Search queries</strong> — the text you type into the search bar or chat, to generate recommendations.</li>
              <li>• <strong>Session data</strong> — anonymous session identifiers, device type, browser, and screen size, to improve the service.</li>
              <li>• <strong>Interaction data</strong> — which results you click on, ratings you submit, and how long you spend on results.</li>
              <li>• <strong>Location context</strong> — if you manually specify a neighbourhood or area, we store this as part of your query (no GPS data is collected).</li>
            </ul>
          </Section>

          <Section title="2. What we do not collect">
            <ul className="space-y-1.5 pl-4">
              <li>• We do not require account registration to use ChatSouq.</li>
              <li>• We do not collect your name, email, or phone number unless you voluntarily submit the business onboarding form.</li>
              <li>• We do not track you across other websites.</li>
              <li>• We do not sell your data to third parties.</li>
            </ul>
          </Section>

          <Section title="3. How we use your data">
            <p>Your data is used exclusively to:</p>
            <ul className="mt-3 space-y-1.5 pl-4">
              <li>• Generate accurate, relevant recommendations.</li>
              <li>• Improve the ranking model and search quality over time.</li>
              <li>• Understand which categories and queries are most popular.</li>
              <li>• Debug technical issues.</li>
            </ul>
          </Section>

          <Section title="4. Data storage">
            <p>
              All data is stored in a Postgres database hosted in the US East (AWS Neon).
              Session data is retained for 90 days. Aggregated analytics are retained
              indefinitely in anonymised form.
            </p>
          </Section>

          <Section title="5. Cookies">
            <p>
              ChatSouq uses browser localStorage (not cookies) to store your recent
              searches and session state. This data stays on your device and is not
              transmitted to our servers unless you submit a search.
            </p>
          </Section>

          <Section title="6. Third-party services">
            <p>
              ChatSouq uses the following third-party services:
            </p>
            <ul className="mt-3 space-y-1.5 pl-4">
              <li>• <strong>Anthropic Claude</strong> — to power the AI recommendation engine. Queries are sent to Anthropic&apos;s API. See <a href="https://anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "#C9A84C" }}>Anthropic&apos;s Privacy Policy</a>.</li>
              <li>• <strong>Vercel</strong> — for hosting. Vercel may log IP addresses per their standard infrastructure logging.</li>
            </ul>
          </Section>

          <Section title="7. Your rights">
            <p>
              You may request deletion of any data associated with your session by
              contacting us at{" "}
              <a href="mailto:privacy@chatsouq.com" className="underline" style={{ color: "#C9A84C" }}>
                privacy@chatsouq.com
              </a>
              . We will action all requests within 14 days.
            </p>
          </Section>

          <Section title="8. Changes to this policy">
            <p>
              We may update this policy from time to time. Material changes will be
              noted at the top of this page with a revised date.
            </p>
          </Section>

          <Section title="9. Contact">
            <p>
              For any privacy-related questions:{" "}
              <a href="mailto:privacy@chatsouq.com" className="underline" style={{ color: "#C9A84C" }}>
                privacy@chatsouq.com
              </a>
            </p>
          </Section>
        </div>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-[1.05rem] font-medium text-[#1A1A1A] mb-3">{title}</h2>
      {children}
    </div>
  );
}
