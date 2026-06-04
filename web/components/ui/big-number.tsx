import { cn } from "@/lib/cn";

interface Props {
  label: string;
  value: React.ReactNode;
  unit?: string;
  accent?: boolean;
  className?: string;
}

export function BigNumber({ label, value, unit, accent, className }: Props) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <span className="text-utility text-zinc-500">{label}</span>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-mono tabular text-4xl md:text-5xl font-medium leading-none",
            accent ? "text-hazard" : "text-zinc-100",
          )}
        >
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-zinc-500 uppercase tracking-wider">{unit}</span>}
      </div>
    </div>
  );
}
