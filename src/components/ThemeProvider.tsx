"use client"

import * as React from "react"

export type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "voice-agent-theme"

/** The demo ships dark-first; light mode is opt-in. */
export const DEFAULT_THEME: Theme = "dark"

type ThemeContextValue = {
  theme: Theme
  /** The theme actually applied to <html>, after resolving "system". */
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === "light" || stored === "dark" ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

function systemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? systemTheme() : theme
  const root = window.document.documentElement

  root.classList.remove("light", "dark")
  root.classList.add(resolved)
  // Tells the browser to render native widgets (scrollbars, inputs) to match.
  root.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start from the default so server and client markup agree, then adopt the
  // stored preference after mount. The inline script in the root layout has
  // already painted the correct theme, so there is no visible flash.
  const [theme, setThemeState] = React.useState<Theme>(DEFAULT_THEME)

  React.useEffect(() => {
    setThemeState(readStoredTheme())
  }, [])

  const resolvedTheme = theme === "system" ? systemTheme() : theme

  // Track OS changes only while the user has not picked explicitly.
  React.useEffect(() => {
    if (theme !== "system") return

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => applyTheme("system")
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [theme])

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private browsing — the in-memory value still applies.
    }
    applyTheme(next)
  }, [])

  const toggleTheme = React.useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }, [resolvedTheme, setTheme])

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>")
  }
  return context
}

/**
 * Runs before first paint in the root layout so the correct theme class is
 * present on <html> immediately — no flash, no hydration mismatch.
 */
export const themeInitScript = `(function(){try{var k="${STORAGE_KEY}";var s=localStorage.getItem(k);var d=s==="light"?"light":"dark";var e=document.documentElement;e.classList.remove("light","dark");e.classList.add(d);e.style.colorScheme=d;}catch(e){}})()`
