import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use — ChatSouq",
  description: "ChatSouq terms of use.",
};

export default function TermsPage() {
  return (
    <div className="bg-[#F9F8F6] min-h-screen">
      <article className="mx-auto max-w-2xl px-4 sm:px-6 py-16">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-4" style={{ color: "#C9A84C" }}>
          ◆ Terms of Use
        </p>
        <h1 className="font-serif text-[2rem] font-medium text-[#1A1A1A] mb-2">
          Terms of Use
        </h1>
        <p className="text-[13px] text-[#9ca3af] mb-10">Last updated: June 2026</p>

        <div className="space-y-8 text-[14px] leading-[1.85] text-[#374151]">
          <Section title="1. Service">
            <p>
              ChatSouq (&ldquo;the Service&rdquo;) is an AI-powered recommendation engine for businesses
              and services in Amman, Jordan. By using the Service, you agree to these terms.
            </p>
          </Section>

          <Section title="2. Use of the Service">
            <p>You may use ChatSouq to:</p>
            <ul className="mt-3 space-y-1.5 pl-4">
              <li>• Search for businesses, services, and experiences in Amman and Jordan.</li>
              <li>• Get AI-generated recommendations based on your queries.</li>
              <li>• Submit feedback on recommendations.</li>
            </ul>
            <p className="mt-3">You may not:</p>
            <ul className="mt-3 space-y-1.5 pl-4">
              <li>• Scrape, crawl, or bulk-download data from ChatSouq.</li>
              <li>• Use the Service for any unlawful purpose.</li>
              <li>• Attempt to reverse-engineer the recommendation system.</li>
              <li>• Submit false or misleading business listings.</li>
            </ul>
          </Section>

          <Section title="3. Accuracy of recommendations">
            <p>
              ChatSouq uses AI and automated data collection. Recommendations are provided
              for informational purposes only. We do not guarantee the accuracy, completeness,
              or timeliness of any information presented. Business details (hours, prices,
              availability) should be verified directly with the business before visiting.
            </p>
          </Section>

          <Section title="4. Business listings">
            <p>
              Businesses listed on ChatSouq are sourced from public data and voluntary
              submissions. Inclusion in the Service does not constitute endorsement. ChatSouq
              reserves the right to remove any listing at any time.
            </p>
          </Section>

          <Section title="5. Intellectual property">
            <p>
              All content, design, and software on ChatSouq is owned by ChatSouq or its
              licensors. You may not reproduce, distribute, or create derivative works
              without prior written permission.
            </p>
          </Section>

          <Section title="6. Limitation of liability">
            <p>
              ChatSouq is provided &ldquo;as is&rdquo; without warranties of any kind. We are not liable
              for any damages arising from your use of the Service, including but not limited
              to reliance on inaccurate recommendations.
            </p>
          </Section>

          <Section title="7. Changes to the Service">
            <p>
              We may modify, suspend, or discontinue the Service at any time without notice.
              We may also update these terms — continued use of the Service constitutes
              acceptance of the updated terms.
            </p>
          </Section>

          <Section title="8. Governing law">
            <p>
              These terms are governed by the laws of the Hashemite Kingdom of Jordan.
              Any disputes shall be subject to the jurisdiction of the courts of Amman, Jordan.
            </p>
          </Section>

          <Section title="9. Contact">
            <p>
              For questions about these terms:{" "}
              <a href="mailto:hello@chatsouq.com" className="underline" style={{ color: "#C9A84C" }}>
                hello@chatsouq.com
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
