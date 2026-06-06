"use client";

import { motion } from "motion/react";
import { ArrowRight, Trophy } from "lucide-react";
import { CornerFrame } from "@/components/ui/corner-frame";

interface Step {
  step: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    step: "01",
    title: "Pick a player.",
    body: "Scroll the roster. Every player already has one target to clear this matchday — a striker might need a goal, a keeper four saves. Harder targets draw fewer backers, so they pay more.",
  },
  {
    step: "02",
    title: "Stake 0.1 SUI.",
    body: "Minting a Survival Pass drops your stake in the pot and ties the pass to your player. Back as many players as you like, right up to kickoff.",
  },
  {
    step: "03",
    title: "The match decides.",
    body: "When the whistle goes, the real stats are written to Walrus and the contract checks them. Hit your target and you're through. Miss and you're out — your stake stays in for the survivors.",
  },
  {
    step: "04",
    title: "Take your cut.",
    body: "Survivors split the pot, weighted so the longer the odds you beat, the bigger your slice. Cash out every winning pass in one click. We keep 10%.",
  },
];

export function HowItWorks() {
  return (
    <CornerFrame id="how" className="border-b border-zinc-900">
      <section className="mx-auto max-w-[90rem] px-6 lg:px-12 py-20 md:py-32">
        <h2 className="font-serif text-display-lg max-w-3xl mb-14 md:mb-20">
          Four moves between you and the pot.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {STEPS.map((s, i) => (
            <StepCard key={s.step} {...s} isLast={i === STEPS.length - 1} />
          ))}
        </div>
      </section>
    </CornerFrame>
  );
}

interface StepCardProps extends Step {
  isLast: boolean;
}

function StepCard({ step, title, body, isLast }: StepCardProps) {
  return (
    <motion.div
      initial="rest"
      whileHover="hover"
      animate="rest"
      variants={{ rest: {}, hover: {} }}
      className="group relative h-80 md:h-96 p-8 md:p-10 border border-zinc-900 overflow-hidden cursor-default"
    >
      {/* Hazard sweep, anchored to the left edge — same vocabulary as the buttons */}
      <motion.div
        aria-hidden
        variants={{ rest: { scaleX: 0 }, hover: { scaleX: 1 } }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 origin-left bg-hazard pointer-events-none"
      />

      {/* Top row: step number + indicator */}
      <div className="relative flex items-start justify-between">
        <motion.span
          variants={{
            rest: { color: "#52525B" },
            hover: { color: "#0A0A0A" },
          }}
          transition={{ duration: 0.35 }}
          className="font-mono text-base md:text-lg"
        >
          {step}
        </motion.span>
        {isLast ? (
          <motion.span
            variants={{
              rest: { opacity: 0.3, scale: 1, rotate: 0, color: "#F5FF00" },
              hover: { opacity: 1, scale: 1.6, rotate: -10, color: "#0A0A0A" },
            }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
          >
            <Trophy className="size-7 md:size-8" />
          </motion.span>
        ) : (
          <motion.span
            variants={{
              rest: { opacity: 0, x: -16, scale: 0.7, color: "#F5FF00" },
              hover: { opacity: 1, x: 0, scale: 1.5, color: "#0A0A0A" },
            }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
          >
            <ArrowRight className="size-7 md:size-8" />
          </motion.span>
        )}
      </div>

      {/* Title — slides DOWN and grows BIGGER on hover */}
      <motion.h3
        variants={{
          rest: {
            y: 0,
            scale: 1,
            color: "#FAFAFA",
            transformOrigin: "left top",
          },
          hover: {
            y: 56,
            scale: 1.18,
            color: "#0A0A0A",
            transformOrigin: "left top",
          },
        }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="absolute left-8 right-8 md:left-10 md:right-10 top-20 md:top-24 font-serif text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]"
      >
        {title}
      </motion.h3>

      {/* Body — fades in on hover (dark text on yellow) */}
      <motion.p
        variants={{
          rest: { opacity: 0, y: 16 },
          hover: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        className="absolute left-8 right-8 md:left-10 md:right-10 bottom-8 md:bottom-10 text-base md:text-lg leading-relaxed text-ink"
      >
        {body}
      </motion.p>
    </motion.div>
  );
}
