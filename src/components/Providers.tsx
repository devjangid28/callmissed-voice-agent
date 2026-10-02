"use client"

import { QueryProvider } from "@/components/QueryProvider"
import { ThemeProvider } from "@/components/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>
        {children}
        {/* Rendered exactly once in the app tree. */}
        <Toaster />
      </ThemeProvider>
    </QueryProvider>
  )
}