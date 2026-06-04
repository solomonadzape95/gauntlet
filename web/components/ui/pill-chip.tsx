import { cn } from "@/lib/cn";

interface Props {
  children: React.ReactNode;
  variant?: "default" | "hazard" | "outline" | "ghost";
  size?: "sm" | "md";
  className?: string;
}

export function PillChip({ children, variant = "default", size = "md", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium uppercase",
        size === "sm" && "text-[10px] tracking-[0.15em] px-2 py-0.5",
        size === "md" && "text-[11px] tracking-[0.18em] px-2.5 py-1",
        variant === "default" && "bg-zinc-900 text-zinc-300 border border-zinc-800",
        variant === "outline" && "border border-zinc-700 text-zinc-300",
        variant === "ghost" && "text-zinc-500",
        variant === "hazard" && "bg-hazard text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}
