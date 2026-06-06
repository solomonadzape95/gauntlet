import { TopBar } from "@/components/site/top-bar";
import { HeroCollage } from "@/components/site/hero-collage";
import { HowItWorks } from "@/components/site/how-it-works";
import { Faq } from "@/components/site/faq";
import { Marquee } from "@/components/ui/marquee";
import { BigNumber } from "@/components/ui/big-number";
import { HardRule } from "@/components/ui/hard-rule";
import { StatusDot } from "@/components/ui/status-dot";

export const revalidate = 300;

const MARQUEE = [
  "SEASON 0",
  "WORLD CUP 2026",
  "16 PLAYERS",
  "4 NATIONS",
  "0.1 SUI ENTRY",
  "KICKOFF JUN 11",
  "ENTRY OPEN",
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <TopBar />

      <HeroCollage />

      {/* Stats band */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-12 md:py-16 grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-8">
          <BigNumber label="Prize Pool" value="—" unit="SUI" accent />
          <BigNumber label="Survivors" value="—" />
          <BigNumber label="Entry Fee" value="0.10" unit="SUI" />
          <div className="flex flex-col gap-3">
            <span className="text-utility text-zinc-500">Status</span>
            <div className="flex items-center gap-2">
              <StatusDot status="open" />
              <span className="font-mono tabular text-2xl md:text-3xl font-medium uppercase tracking-tight">
                Open
              </span>
            </div>
          </div>
        </div>
      </section>

      <Marquee items={MARQUEE} />

      <HowItWorks />

      <Faq />

      <footer>
        <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-10 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="font-serif text-lg tracking-tight">Gauntlet</span>
            <HardRule className="w-12 inline-block" />
            <span className="text-utility text-zinc-500">
              Built on Sui · Walrus · Tatum
            </span>
          </div>
          <span className="text-utility text-zinc-600">© 2026 Season 0</span>
        </div>
      </footer>
    </main>
  );
}
