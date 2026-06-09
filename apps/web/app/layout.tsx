import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Navbar } from "../components/ui/Navbar";
import { Footer } from "../components/ui/Footer";
import { BottomTabBar } from "../components/ui/BottomTabBar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "ChatSouq — Ask anything about Jordan",
  description:
    "Jordan's AI recommendation engine. Restaurants, gifts, services, experiences — described in plain language, ranked by relevance.",
  openGraph: {
    title: "ChatSouq — Ask anything about Jordan",
    description: "Jordan's AI recommendation engine for Amman and beyond.",
    url: "https://chatsouq.ai",
    siteName: "ChatSouq",
    locale: "en_JO",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#C9A84C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased bg-[#F9F8F6] text-[#1A1A1A]">
        <Navbar />
        <main className="min-h-screen">
          {children}
        </main>
        <Footer />
        <BottomTabBar />
      </body>
    </html>
  );
}
