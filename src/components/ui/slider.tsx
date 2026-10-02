"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Slider built on the native `range` input.
 *
 * A native range gives us keyboard support (arrows, Home/End, PageUp/PageDown)
 * and screen-reader announcements for free, so only the track and thumb are
 * restyled. `@radix-ui/react-slider` is not a dependency in this project.
 * Callers must pass an `aria-label` (or `aria-labelledby`).
 */
export interface SliderProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    { className, value, onValueChange, min = 0, max = 2, step = 0.1, ...props },
    ref
  ) => {
    const percent = max === min ? 0 : ((value - min) / (max - min)) * 100

    return (
      <div className={cn("flex items-center gap-3", className)}>
        <input
          ref={ref}
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onValueChange(Number(event.target.value))}
          // `--percent` fills the left portion of the track.
          style={{ "--percent": `${percent}%` } as React.CSSProperties}
          className={cn(
            "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border",
            "bg-[linear-gradient(to_right,oklch(var(--primary))_var(--percent),transparent_var(--percent))]",
            "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
            "[&::-webkit-slider-thumb]:shadow-soft [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150",
            "hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95",
            "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
          {...props}
        />
        <span
          aria-hidden
          className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground"
        >
          {value.toFixed(1)}
        </span>
      </div>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }
