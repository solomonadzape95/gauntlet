"use client";

import { motion } from "motion/react";

// Each slot has two images + an editorial caption:
//   /hero/0N-edited.jpg     ← stylized (default visible)
//   /hero/0N-original.jpg   ← real photo (revealed on hover warp)
const SLOTS = [
  { player: "Bobby Moore", place: "London", year: "1966" },
  { player: "Diego Maradona", place: "Mexico City", year: "1986" },
  { player: "Lionel Messi", place: "Doha", year: "2022" },
  { player: "Pelé", place: "Mexico", year: "1970" },
  { player: "Cristiano Ronaldo", place: "Sochi", year: "2018" },
  { player: "Siphiwe Tshabalala", place: "Johannesburg", year: "2010" },
  { player: "Zinedine Zidane", place: "Berlin", year: "2006" },
  { player: "Lionel Messi", place: "Barcelona", year: "2019" },
  { player: "Zinedine Zidane", place: "Glasgow", year: "2002" },
].map((s, i) => {
  const id = String(i + 1).padStart(2, "0");
  return {
    ...s,
    edited: `/hero/${id}-edited.jpg`,
    original: `/hero/${id}-original.jpg`,
  };
});

// Triple-up the strip so the CSS marquee can wrap at -33.333% with extra
// runway against subpixel rounding glitches.
const STRIP = [...SLOTS, ...SLOTS, ...SLOTS];

const headlineContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const headlineLetter = {
  hidden: { opacity: 0, y: 80 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.75,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

function AnimatedHeadline({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className: string;
  delay?: number;
}) {
  return (
    <motion.h1
      initial="hidden"
      animate="visible"
      variants={{
        ...headlineContainer,
        visible: {
          transition: { staggerChildren: 0.05, delayChildren: delay },
        },
      }}
      className={className}
    >
      {text.split("").map((c, i) => (
        <motion.span key={i} variants={headlineLetter} className="inline-block">
          {c === " " ? " " : c}
        </motion.span>
      ))}
    </motion.h1>
  );
}

export function HeroCollage() {
  return (
    <section
      className={[
        "relative border-b border-zinc-900 flex flex-col overflow-hidden",
        "h-[calc(100svh-5rem)] md:h-[calc(100svh-6rem)]",
      ].join(" ")}
    >
      {/* Top — description + first half of headline */}
      <div className="mx-auto max-w-[90rem] w-full px-6 lg:px-12 py-5 md:py-7 shrink-0">
        <div className="grid grid-cols-12 gap-6 items-end">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="col-span-12 md:col-span-5 lg:col-span-4"
          >
            <p className="text-base md:text-lg text-zinc-300 leading-relaxed max-w-lg">
              An on‑chain survival pool where AI sets each player's stat target
              before kickoff. Pick one — if they hit it, your pass survives and
              the pot grows.
            </p>
          </motion.div>
          <div className="col-span-12 md:col-span-7 lg:col-span-8">
            <AnimatedHeadline
              text="OUTPICK"
              delay={0.1}
              className="font-serif text-display-xl text-right tracking-tighter leading-[0.92]"
            />
          </div>
        </div>
      </div>

      {/* Marquee — CSS keyframes for seamless loop */}
      <div
        className="relative flex-1 min-h-0 overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)",
        }}
      >
        <div
          className="flex h-full"
          style={{
            animation: "marquee-loop 65s linear infinite",
            willChange: "transform",
          }}
        >
          {STRIP.map((slot, i) => (
            <PhotoSlot
              key={`${slot.edited}-${i}`}
              edited={slot.edited}
              original={slot.original}
              player={slot.player}
              place={slot.place}
              year={slot.year}
            />
          ))}
        </div>

        {/* Keyframe for the triple-strip marquee — to -33.333% so the third copy
            wraps to exactly where the first copy was. */}
        <style jsx>{`
          @keyframes marquee-loop {
            from {
              transform: translate3d(0, 0, 0);
            }
            to {
              transform: translate3d(-33.3333%, 0, 0);
            }
          }
        `}</style>
      </div>

      {/* Bottom — CTAs + second half of headline */}
      <div className="mx-auto max-w-[90rem] w-full px-6 lg:px-12 py-5 md:py-7 shrink-0">
        <div className="grid grid-cols-12 gap-6 items-start">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.6 }}
            className="col-span-12 md:col-span-5 lg:col-span-4 flex flex-wrap gap-3 items-start"
          >
            <a href="/pools">
              <ButtonInline variant="hazard">Run the Gauntlet</ButtonInline>
            </a>
            <a href="/pools/genesis-wc/live">
              <ButtonInline variant="outline">Live Pool</ButtonInline>
            </a>
          </motion.div>
          <div className="col-span-12 md:col-span-7 lg:col-span-8">
            <AnimatedHeadline
              text="OUTLAST"
              delay={0.7}
              className="font-serif text-display-xl text-right tracking-tighter leading-[0.92] text-hazard"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// Local-only Button mimic — avoids the cross-file dependency from this server-rendered
// hero component and keeps the bullet animation identical to <Button bullet>.
function ButtonInline({
  variant,
  children,
}: {
  variant: "hazard" | "outline";
  children: React.ReactNode;
}) {
  const base =
    "group relative overflow-hidden inline-flex items-center justify-between gap-4 rounded-full font-mono font-medium uppercase tracking-[0.16em] transition-colors text-base pl-6 pr-7 py-4";
  const variantClass =
    variant === "hazard"
      ? "bg-zinc-900 text-zinc-100"
      : "bg-transparent text-zinc-200 border border-zinc-800 hover:border-transparent";

  return (
    <button className={`${base} ${variantClass}`}>
      <span
        aria-hidden
        className="absolute inset-0 origin-left scale-x-0 bg-hazard transition-transform duration-[550ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100"
      />
      <span
        aria-hidden
        className="relative size-2 rounded-full bg-current transition-all duration-300 group-hover:scale-0 group-hover:opacity-0"
      />
      <span className="relative flex-1 inline-flex items-center justify-center gap-2 group-hover:text-ink transition-colors duration-300">
        {children}
      </span>
      <span
        aria-hidden
        className="relative inline-flex items-center justify-center transition-all duration-300 opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 text-ink"
      >
        →
      </span>
    </button>
  );
}

function PhotoSlot({
  edited,
  original,
  player,
  place,
  year,
}: {
  edited: string;
  original: string;
  player: string;
  place: string;
  year: string;
}) {
  return (
    <motion.div
      initial="rest"
      whileHover="hover"
      animate="rest"
      className="group relative h-full aspect-[5/8] shrink-0 bg-ink-surface overflow-hidden"
    >
      {/* Fallback gradient */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 70%, #000000 100%)",
        }}
      />

      {/* Original photo — sits underneath, revealed on hover */}
      <motion.img
        src={original}
        alt={player}
        loading="lazy"
        variants={{
          rest: { opacity: 0, scale: 1.04 },
          hover: { opacity: 1, scale: 1 },
        }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />

      {/* Stylized — warps away on hover */}
      <motion.img
        src={edited}
        alt={player}
        loading="lazy"
        variants={{
          rest: { opacity: 1, scale: 1, skewY: "0deg", filter: "blur(0px)" },
          hover: {
            opacity: 0,
            scale: 1.04,
            skewY: "-1.5deg",
            filter: "blur(3px)",
          },
        }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />

      {/* Caption — invisible at rest, fades in on hover */}
      <motion.div
        variants={{
          rest: { opacity: 0, y: 12 },
          hover: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-x-0 bottom-0 z-10 px-4 pt-12 pb-4 pointer-events-none bg-gradient-to-t from-black/85 via-black/40 to-transparent"
      >
        <div
          className="font-serif text-base md:text-lg text-zinc-50 leading-tight"
          style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}
        >
          {player}
        </div>
        <div
          className="text-utility text-zinc-300 mt-1.5"
          style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
        >
          {place} · {year}
        </div>
      </motion.div>
    </motion.div>
  );
}
