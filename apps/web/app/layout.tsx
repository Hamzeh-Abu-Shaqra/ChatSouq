import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChatSouq — Ask anything about Jordan",
  description:
    "Jordan's AI assistant. Ask about neighborhoods to rent in, restaurants, products to buy, tourist spots, and more. Real data, no made-up answers.",
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
