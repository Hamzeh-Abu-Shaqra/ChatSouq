import Link from "next/link";

export function Footer() {
  return (
    <footer
      className="bg-[#F9F8F6] border-t text-[#6B7280]"
      style={{ borderTopWidth: "0.5px", borderColor: "#E8E4DC" }}
    >
      {/* Main grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Col 1: Brand */}
          <div className="space-y-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-[#C9A84C] text-[16px] select-none">◆</span>
              <span className="font-serif text-[16px] font-medium text-[#1A1A1A]">ChatSouq</span>
            </Link>
            <p className="text-[13px] leading-relaxed">
              Ask anything. Find the best in Jordan.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <a
                href="https://instagram.com/chatsouq"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#9ca3af] hover:text-[#1A1A1A] transition-colors"
                aria-label="Instagram"
              >
                <InstagramIcon />
              </a>
              <a
                href="https://x.com/chatsouq"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#9ca3af] hover:text-[#1A1A1A] transition-colors"
                aria-label="X (Twitter)"
              >
                <TwitterIcon />
              </a>
            </div>
          </div>

          {/* Col 2: Explore */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C9A84C] mb-3">
              Explore
            </p>
            <ul className="space-y-2">
              {[
                { label: "Restaurants", href: "/restaurants" },
                { label: "Gifts", href: "/gifts" },
                { label: "Gyms", href: "/gyms" },
                { label: "Experiences", href: "/experiences" },
                { label: "New openings", href: "/chat?q=New%20restaurant%20and%20cafe%20openings%20in%20Amman%20this%20week" },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[13px] text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Company */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C9A84C] mb-3">
              Company
            </p>
            <ul className="space-y-2">
              {[
                { label: "About", href: "/about" },
                { label: "For businesses", href: "/vendors" },
                { label: "Contact", href: "/about#contact" },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[13px] text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Legal */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C9A84C] mb-3">
              Legal
            </p>
            <ul className="space-y-2">
              {[
                { label: "Privacy policy", href: "/privacy" },
                { label: "Terms of use", href: "/terms" },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[13px] text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="border-t"
        style={{ borderTopWidth: "0.5px", borderColor: "#E8E4DC" }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
          <p className="text-center text-[12px] text-[#9ca3af]">
            © 2026 ChatSouq · Amman, Jordan
          </p>
        </div>
      </div>
    </footer>
  );
}

function InstagramIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor"/>
    </svg>
  );
}
