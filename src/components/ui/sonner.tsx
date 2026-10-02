"use client"

import { Toaster as Sonner } from "sonner"

import type { ToasterProps } from "sonner"

import { useTheme } from "@/components/ThemeProvider"

/**
 * Rendered exactly once, from the root layout. Follows the active theme so
 * toasts match the surrounding surface in both light and dark mode.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme}
      position="bottom-right"
      closeButton
      visibleToasts={3}
      duration={4200}
      toastOptions={{
        classNames: {
          toast:
            "group rounded-xl border border-border/70 bg-popover text-popover-foreground shadow-lift",
          title: "font-medium tracking-tight",
          description: "text-muted-foreground",
          actionButton:
            "rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90",
          cancelButton:
            "rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground",
          closeButton:
            "border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          error: "[&_[data-title]]:text-destructive",
          success: "[&_[data-title]]:text-success",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
