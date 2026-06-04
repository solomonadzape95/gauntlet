import { cn } from "@/lib/cn";

type Status = "open" | "locked" | "settled" | "closed";

const tone: Record<Status, string> = {
  open: "bg-hazard",
  locked: "bg-orange-400",
  settled: "bg-emerald-400",
  closed: "bg-zinc-500",
};

export function StatusDot({ status, pulse = true }: { status: Status; pulse?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 rounded-full",
        tone[status],
        pulse && status === "open" && "animate-pulse-dot",
      )}
    />
  );
}
