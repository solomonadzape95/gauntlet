import "./globals.css";
import type { Metadata } from "next";
import { EB_Garamond, DM_Mono, Anton } from "next/font/google";
import { Providers } from "./providers";
import { PitchPattern } from "@/components/site/pitch-pattern";

const garamond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-garamond",
  display: "swap",
});

const mono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-mono",
  display: "swap",
});

// Anton — heavy condensed display font used for the jersey number overlay.
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gauntlet · World Cup 2026 Survival Pool",
  description: "Pick a player. Hit their target. Survive.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${garamond.variable} ${mono.variable} ${anton.variable}`}>
      <body>
        <PitchPattern />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
