import { cn } from "@/lib/utils";

export function WakaWordmark({ className, suffix }: { className?: string; suffix?: string }) {
  return (
    <span className={cn("waka-display inline-flex items-baseline gap-[0.18em] leading-none", className)} aria-label={suffix ? `WAKA ${suffix}` : "WAKA"}>
      <span>WAKA</span>
      {suffix && <span className="waka-steel">{suffix}</span>}
    </span>
  );
}
