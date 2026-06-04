import { cn } from "@/lib/cn";

interface Props {
  items: string[];
  separator?: string;
  className?: string;
}

export function Marquee({ items, separator = "·", className }: Props) {
  const doubled = [...items, ...items];
  return (
    <div className={cn("overflow-hidden border-y border-zinc-900 py-3", className)}>
      <div className="flex w-max items-center gap-8 whitespace-nowrap animate-marquee">
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-8 text-utility text-zinc-500">
            <span>{item}</span>
            <span aria-hidden className="text-zinc-700">{separator}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
