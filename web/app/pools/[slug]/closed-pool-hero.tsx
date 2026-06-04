"use client";

import { motion } from "motion/react";

/**
 * Hero image block for the closed-pool branch of /pools/[slug].
 * Same hover-warp as the live pool detail (PoolDetailClient) — kept
 * isolated as a small client component so the parent page can stay
 * server-rendered.
 */
export function ClosedPoolHero({
  image,
  imageOriginal,
  alt,
}: {
  image: string;
  imageOriginal: string;
  alt: string;
}) {
  return (
    <motion.div
      initial="rest"
      whileHover="hover"
      animate="rest"
      className="relative aspect-[16/9] bg-ink-surface overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 70%, #000000 100%)",
        }}
      />
      <motion.img
        src={imageOriginal}
        alt={alt}
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
      <motion.img
        src={image}
        alt={alt}
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
    </motion.div>
  );
}
