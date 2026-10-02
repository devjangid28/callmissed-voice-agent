"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { toast } from "sonner"

import { cn } from "@/lib/utils"

/**
 * Minimal code block: language label, monospace body, and a copy button.
 * Horizontal scrolling is kept on the <pre> so long lines never widen the
 * message column.
 */
export function CodeBlock({
  code,
  lang,
  className,
}: {
  code: string
  lang?: string
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<number | null>(null)

  React.useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    []
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error("Could not access the clipboard")
    }
  }

  const label = lang?.trim() ? lang.trim() : "code"

  return (
    <figure
      className={cn(
        "group/code relative my-3 overflow-hidden rounded-xl border border-border/60 bg-muted/50",
        className
      )}
    >
      <figcaption className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>

        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? "Code copied" : "Copy code"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium",
            "text-muted-foreground transition-colors duration-200 ease-out-expo",
            "hover:bg-accent hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          {copied ? (
            <Check aria-hidden className="h-3 w-3 text-success" />
          ) : (
            <Copy aria-hidden className="h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>

      <pre className="scroll-slim overflow-x-auto p-3.5 text-[13px] leading-relaxed">
        <code className="font-mono text-foreground">{code}</code>
      </pre>
    </figure>
  )
}
