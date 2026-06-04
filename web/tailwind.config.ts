import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hazard: {
          DEFAULT: "#F5FF00",
          50: "#FEFFE6",
          100: "#FDFFCC",
          400: "#F5FF00",
          500: "#E6F000",
          600: "#C8D100",
        },
        ink: {
          DEFAULT: "#0A0A0A",
          surface: "#141414",
          raised: "#1A1A1A",
        },
      },
      fontFamily: {
        sans: ['var(--font-garamond)', '"EB Garamond"', "serif"],
        serif: ['var(--font-garamond)', '"EB Garamond"', "serif"],
        mono: ['var(--font-mono)', '"DM Mono"', "ui-monospace", "monospace"],
      },
      // Body text bumped substantially — base is now 18px, lg is 20px.
      // Headers in pages stay controlled by display-* sizes.
      fontSize: {
        xs: ["0.875rem", { lineHeight: "1.3" }],     // 14
        sm: ["1rem", { lineHeight: "1.5" }],          // 16
        base: ["1.125rem", { lineHeight: "1.7" }],    // 18
        lg: ["1.25rem", { lineHeight: "1.6" }],       // 20
        xl: ["1.5rem", { lineHeight: "1.4" }],        // 24
        "2xl": ["1.75rem", { lineHeight: "1.3" }],    // 28
        "3xl": ["2.125rem", { lineHeight: "1.2" }],   // 34
        "4xl": ["2.75rem", { lineHeight: "1.1" }],    // 44
        "5xl": ["3.5rem", { lineHeight: "1.05" }],    // 56
        "6xl": ["4.25rem", { lineHeight: "1" }],      // 68
        "7xl": ["5.25rem", { lineHeight: "1" }],      // 84
        "display-xl": [
          "clamp(4rem, 11vw, 9.5rem)",
          { lineHeight: "0.92", letterSpacing: "-0.03em", fontWeight: "600" },
        ],
        "display-lg": [
          "clamp(3rem, 7vw, 6rem)",
          { lineHeight: "0.96", letterSpacing: "-0.025em", fontWeight: "600" },
        ],
        "display-md": [
          "clamp(2rem, 4.5vw, 3.5rem)",
          { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "600" },
        ],
        utility: [
          "0.8125rem",
          { lineHeight: "1.1", letterSpacing: "0.16em", fontWeight: "500" },
        ],
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.85)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
