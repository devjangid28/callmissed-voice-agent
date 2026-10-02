"use client"

import { ChevronsUpDown } from "lucide-react"

import type { ModelInfo } from "@/lib/models"
import { findModel } from "@/lib/models"
import { cn } from "@/lib/utils"

type ModelPickerProps = {
  models: ModelInfo[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  /** `field` shows a stacked label + model-ID hint; `compact` is a toolbar pill. */
  variant?: "field" | "compact"
  label?: string
}

/**
 * Lightweight model picker built on the native select element.
 *
 * A native <select> keeps the control keyboard accessible and mobile-native
 * without extra popover plumbing, while the label + one-line hint give each
 * option the context a bare model ID cannot.
 */
export function ModelPicker({
  models,
  value,
  onChange,
  disabled,
  className,
  variant = "field",
  label = "Model",
}: ModelPickerProps) {
  const current = findModel(models, value)
  const compact = variant === "compact"

  return (
    <div
      className={cn(
        compact ? "min-w-0" : "grid gap-1.5",
        className
      )}
    >
      {!compact && (
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      )}

      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-label={compact ? `${label}: ${current?.label ?? value}` : undefined}
          className={cn(
            "w-full appearance-none border border-border/70 bg-card/60 text-foreground",
            "transition-[background-color,border-color,box-shadow] duration-200 ease-out-expo",
            "hover:border-border hover:bg-accent/50",
            "focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/40",
            "disabled:cursor-not-allowed disabled:opacity-50",
            compact
              ? "h-9 max-w-[13rem] rounded-xl pl-3 pr-8 text-[13px] sm:max-w-none"
              : "h-10 rounded-xl pl-3 pr-9 text-sm"
          )}
        >
          {models.map((model) => (
            <option key={model.value} value={model.value}>
              {model.label} — {model.hint}
            </option>
          ))}
        </select>

        <ChevronsUpDown
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground",
            compact ? "h-3.5 w-3.5" : "h-4 w-4"
          )}
        />
      </div>

      {!compact && current && (
        <p className="truncate text-xs text-muted-foreground" title={current.hint}>
          {current.value}
        </p>
      )}
    </div>
  )
}
