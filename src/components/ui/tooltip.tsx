"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Minimal tooltip for one-off hints.
 *
 * `@radix-ui/react-tooltip` is not a dependency here. The bubble is rendered
 * on hover *and* focus, is wired to the trigger with `aria-describedby`, and
 * dismisses on Escape — which covers the accessibility basics without a
 * positioning engine. Use it for short, non-essential hints only; anything
 * required to operate the UI belongs in visible text.
 */

type TooltipProps = {
  children: React.ReactNode
  content: React.ReactNode
  side?: "top" | "bottom"
  className?: string
}

export function Tooltip({
  children,
  content,
  side = "top",
  className,
}: TooltipProps) {
  const id = React.useId()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>

      <span
        role="tooltip"
        id={id}
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 w-max max-w-[16rem] -translate-x-1/2",
          "rounded-xl border border-border/60 bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-lift",
          "transition-[opacity,transform] duration-150 ease-out-expo",
          side === "top" ? "bottom-[calc(100%+0.5rem)]" : "top-[calc(100%+0.5rem)]",
          open
            ? "translate-y-0 opacity-100"
            : side === "top"
              ? "translate-y-1 opacity-0"
              : "-translate-y-1 opacity-0",
          className
        )}
      >
        {content}
      </span>
    </span>
  )
}
