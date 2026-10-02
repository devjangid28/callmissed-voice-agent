"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Dependency-free accordion.
 *
 * Radix's accordion package is not a dependency here, and this control only
 * needs one open item at a time, so it is built on plain buttons. Height is
 * animated with the `0fr → 1fr` grid trick, which needs no measurement.
 *
 * `AccordionItem` owns its `value` through context, so a trigger and its panel
 * cannot drift apart.
 */

type AccordionContextValue = {
  value: string | null
  setValue: (value: string) => void
  baseId: string
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null)
const AccordionItemContext = React.createContext<string | null>(null)

function useAccordion(component: string) {
  const context = React.useContext(AccordionContext)
  if (!context) {
    throw new Error(`<${component}> must be used inside <Accordion>`)
  }
  return context
}

function useAccordionItem(component: string) {
  const value = React.useContext(AccordionItemContext)
  if (value === null) {
    throw new Error(`<${component}> must be used inside <AccordionItem>`)
  }
  return value
}

type AccordionProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Item `value` that starts open. Defaults to none. */
  defaultValue?: string
  /** Controlled open item. Use with `onValueChange`. */
  value?: string | null
  onValueChange?: (value: string | null) => void
}

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  (
    { className, children, defaultValue = null, value, onValueChange, ...props },
    ref
  ) => {
    const baseId = React.useId()
    const [uncontrolled, setUncontrolled] = React.useState<string | null>(
      defaultValue
    )
    const open = value === undefined ? uncontrolled : value

    const setValue = React.useCallback(
      (next: string) => {
        // Clicking the open item closes it.
        const resolved = open === next ? null : next
        if (value === undefined) setUncontrolled(resolved)
        onValueChange?.(resolved)
      },
      [open, onValueChange, value]
    )

    const context = React.useMemo(
      () => ({ value: open, setValue, baseId }),
      [open, setValue, baseId]
    )

    return (
      <AccordionContext.Provider value={context}>
        <div ref={ref} className={cn("w-full", className)} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    )
  }
)
Accordion.displayName = "Accordion"

const AccordionItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, children, value, ...props }, ref) => (
  <AccordionItemContext.Provider value={value}>
    <div
      ref={ref}
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-card/40",
        className
      )}
      {...props}
    >
      {children}
    </div>
  </AccordionItemContext.Provider>
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { value: open, setValue, baseId } = useAccordion("AccordionTrigger")
  const value = useAccordionItem("AccordionTrigger")
  const expanded = open === value

  return (
    <h3 className="m-0">
      <button
        ref={ref}
        type="button"
        id={`${baseId}-trigger-${value}`}
        aria-expanded={expanded}
        aria-controls={`${baseId}-panel-${value}`}
        onClick={() => setValue(value)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium",
          "transition-colors duration-200 ease-out-expo hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          className
        )}
        {...props}
      >
        <span className="flex items-center gap-2">{children}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out-expo",
            expanded && "rotate-180"
          )}
        />
      </button>
    </h3>
  )
})
AccordionTrigger.displayName = "AccordionTrigger"

const AccordionContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { value: open, baseId } = useAccordion("AccordionContent")
  const itemValue = useAccordionItem("AccordionContent")
  const expanded = open === itemValue

  // Children stay mounted through the close animation, then unmount. That
  // keeps the reveal smooth while ensuring collapsed content is never
  // reachable by keyboard or screen reader.
  const [mounted, setMounted] = React.useState(expanded)
  React.useEffect(() => {
    if (expanded) {
      setMounted(true)
      return
    }
    const timer = window.setTimeout(() => setMounted(false), 200)
    return () => window.clearTimeout(timer)
  }, [expanded])

  return (
    <div
      id={`${baseId}-panel-${itemValue}`}
      role="region"
      aria-labelledby={`${baseId}-trigger-${itemValue}`}
      data-state={expanded ? "open" : "closed"}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out-expo",
        expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
    >
      <div className="overflow-hidden">
        {mounted && (
          <div ref={ref} className={cn("px-4 pb-4 pt-0", className)} {...props}>
            {children}
          </div>
        )}
      </div>
    </div>
  )
})
AccordionContent.displayName = "AccordionContent"

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
