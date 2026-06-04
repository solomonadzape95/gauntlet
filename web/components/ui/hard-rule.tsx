import { cn } from "@/lib/cn";

export function HardRule({ className }: { className?: string }) {
  return <hr className={cn("border-t border-zinc-900 my-0", className)} />;
}
