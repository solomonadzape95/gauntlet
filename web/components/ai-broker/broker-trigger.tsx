"use client";

import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

interface Props {
  onClick: () => void;
}

export function BrokerTrigger({ onClick }: Props) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.4, type: "spring", stiffness: 260, damping: 22 }}
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.96 }}
      className="group fixed bottom-6 right-6 z-30 inline-flex items-center gap-2.5 pl-4 pr-5 py-3.5 rounded-full bg-hazard text-ink font-mono text-xs uppercase tracking-[0.18em] font-semibold shadow-[0_20px_60px_-15px_rgba(245,255,0,0.45)] hover:shadow-[0_25px_70px_-15px_rgba(245,255,0,0.6)] transition-shadow"
    >
      <Sparkles className="size-4" />
      Ask the Broker
    </motion.button>
  );
}
