import { cn } from "@/lib/cn";
import { ArrowRight } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "hazard" | "ink" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /**
   * Renders the animated "dot → sweep → arrow" hover interaction.
   * Borders are intentionally stripped on bullet buttons so the hazard fill
   * sweeps edge-to-edge cleanly with no white outline lingering on hover.
   */
  bullet?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "outline", size = "md", bullet = false, className, children, ...rest },
  ref,
) {
  if (bullet) {
    return (
      <button
        ref={ref}
        className={cn(
          "group relative overflow-hidden inline-flex items-center justify-between gap-4 rounded-full",
          "font-mono font-medium uppercase tracking-[0.16em] transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hazard focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
          size === "sm" && "text-xs pl-4 pr-5 py-2.5",
          size === "md" && "text-sm pl-5 pr-6 py-3.5",
          size === "lg" && "text-base pl-6 pr-7 py-4",
          // No borders on bullet buttons — keeps the hazard sweep clean on hover.
          variant === "hazard" && "bg-zinc-900 text-zinc-100",
          variant === "ink" && "bg-zinc-100 text-ink",
          variant === "ghost" && "bg-transparent text-zinc-300",
          variant === "outline" && "bg-transparent text-zinc-200 border border-zinc-800 hover:border-transparent",
          className,
        )}
        {...rest}
      >
        {/* Hazard sweep, anchored to the left edge */}
        <span
          aria-hidden
          className="absolute inset-0 origin-left scale-x-0 bg-hazard transition-transform duration-[550ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100 group-disabled:hidden"
        />

        {/* Left: dot at rest, scales down on hover */}
        <span
          aria-hidden
          className={cn(
            "relative size-2 rounded-full bg-current transition-all duration-300",
            "group-hover:scale-0 group-hover:opacity-0",
          )}
        />

        {/* Text — inline-flex so an icon + label fragment stays on one line */}
        <span className="relative flex-1 inline-flex items-center justify-center gap-2 group-hover:text-ink transition-colors duration-300">
          {children}
        </span>

        {/* Right: arrow animates in from the left */}
        <span
          aria-hidden
          className={cn(
            "relative inline-flex items-center justify-center transition-all duration-300",
            "opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-0",
            "text-ink",
          )}
        >
          <ArrowRight className="size-4" strokeWidth={2.4} />
        </span>
      </button>
    );
  }

  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-mono font-medium uppercase tracking-[0.16em] transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hazard focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        size === "sm" && "text-xs px-5 py-2.5",
        size === "md" && "text-sm px-6 py-3.5",
        size === "lg" && "text-base px-8 py-4",
        variant === "hazard" && "bg-hazard text-ink hover:bg-hazard-500",
        variant === "ink" && "bg-zinc-100 text-ink hover:bg-white",
        variant === "ghost" && "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900",
        variant === "outline" && "border border-zinc-800 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-900/50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
