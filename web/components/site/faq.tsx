import { CornerFrame } from "@/components/ui/corner-frame";

interface QA {
  q: string;
  a: string;
}

const FAQS: QA[] = [
  {
    q: "What is Gauntlet?",
    a: "A last-player-standing pool for football matchdays. You back a player to hit a target, and everyone whose pick comes through splits the pot.",
  },
  {
    q: "Who sets the targets?",
    a: "An AI Game Master gives every player one stat target before kickoff, scaled to how hard it is for them. A star striker might need to score; a defender might need seven duels won. The tougher the ask, the fewer people back it — and the bigger the reward if it lands.",
  },
  {
    q: "What does it cost?",
    a: "One entry fee per pass — 0.1 SUI in the Genesis pool. Back as many players as you want. The only other charge is a 10% cut taken from the prize pool at settlement.",
  },
  {
    q: "How are winnings split?",
    a: "Not evenly. Survivors share the pot in proportion to how unlikely their pick was to make it, so beating long odds pays more than riding a safe bet. The 10% platform fee comes off the top before the split.",
  },
  {
    q: "Where's my money while a pool is live?",
    a: "In the pool's smart contract on Sui. There's no admin withdraw path — the only way SUI leaves the pot is a valid winning pass cashing out, or the 10% fee at settlement. You can verify every pool object on-chain.",
  },
  {
    q: "What happens if my player is eliminated?",
    a: "That pass is done for the matchday and your stake stays in the pot for the players who survived. No pass, one player — pick the ones you believe in.",
  },
  {
    q: "When can I withdraw?",
    a: "The moment the matchday is settled. A single button on the live page cashes out all of your winning passes in one transaction.",
  },
  {
    q: "What do I need to play?",
    a: "A Sui wallet and some testnet SUI. Connect it, pick a player, mint a pass — that's the whole flow.",
  },
];

export function Faq() {
  return (
    <CornerFrame id="faq" className="border-b border-zinc-900">
      <section className="mx-auto max-w-[90rem] px-6 lg:px-12 py-20 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-4">
            <div className="text-utility text-zinc-500 mb-3">FAQ</div>
            <h2 className="font-serif text-display-lg leading-[0.95]">
              Questions,
              <br />
              answered.
            </h2>
            <p className="mt-5 text-base text-zinc-400 max-w-sm leading-relaxed">
              The short version of how the pool, the targets, and the payouts
              actually work.
            </p>
          </div>

          <div className="lg:col-span-8">
            <ul className="border-t border-zinc-900">
              {FAQS.map((item) => (
                <li key={item.q} className="border-b border-zinc-900">
                  <details className="group">
                    <summary className="flex items-center justify-between gap-6 cursor-pointer list-none py-6 md:py-7">
                      <span className="font-serif text-xl md:text-2xl font-semibold tracking-tight text-zinc-100 group-hover:text-hazard transition-colors">
                        {item.q}
                      </span>
                      <span
                        aria-hidden
                        className="shrink-0 text-2xl leading-none text-zinc-600 group-hover:text-hazard transition-all group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <p className="pb-7 -mt-1 text-base md:text-lg text-zinc-400 leading-relaxed max-w-2xl">
                      {item.a}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </CornerFrame>
  );
}
