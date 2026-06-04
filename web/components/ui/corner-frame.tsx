import { cn } from "@/lib/cn";

interface Props extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  children: React.ReactNode;
  className?: string;
  cross?: "thin" | "bold" | "hazard";
}

function Cross({ position, variant = "thin" }: { position: string; variant?: "thin" | "bold" | "hazard" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute select-none leading-none",
        position,
        variant === "thin" && "text-zinc-700 text-sm font-light",
        variant === "bold" && "text-zinc-500 text-base font-normal",
        variant === "hazard" && "text-hazard text-base font-normal",
      )}
    >
      +
    </span>
  );
}

export function CornerFrame({ children, className, cross = "thin", ...rest }: Props) {
  return (
    <div {...rest} className={cn("relative", className)}>
      <Cross position="top-0 left-0 -translate-x-1/2 -translate-y-1/2" variant={cross} />
      <Cross position="top-0 right-0 translate-x-1/2 -translate-y-1/2" variant={cross} />
      <Cross position="bottom-0 left-0 -translate-x-1/2 translate-y-1/2" variant={cross} />
      <Cross position="bottom-0 right-0 translate-x-1/2 translate-y-1/2" variant={cross} />
      {children}
    </div>
  );
}
