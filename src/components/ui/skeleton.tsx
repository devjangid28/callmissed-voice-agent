import { cn } from "@/lib/utils"

/**
 * Loading placeholder with a slow shimmer. Announced as decorative — the live
 * region next to it carries the "Loading…" text for assistive technology.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-xl bg-muted/70",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer",
        "after:bg-[linear-gradient(90deg,transparent,oklch(var(--foreground)/0.06),transparent)]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
