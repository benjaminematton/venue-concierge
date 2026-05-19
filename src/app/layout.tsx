import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Variable serif with an opsz axis — adjusts contrast and joinery between
// 9pt (intimate, high-contrast) and 144pt (poster-like, loose). Carries
// the full editorial weight here; body text uses the same family at
// smaller weights for visual coherence.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

// Mono for prices, package ids, and tool-call argument summaries. JetBrains
// Mono has slightly more personality than the generic monos (open dot on
// the zero, characterful lowercase g).
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Venue Concierge",
  description:
    "An AI concierge that gathers what it needs from a customer and produces a venue quote. Extracted from a real event-planning marketplace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col">
        {/* z-10 to sit above the paper-grain ::before; otherwise everything
            looks slightly muted because the noise overlays the content. */}
        <div className="relative z-10 flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
