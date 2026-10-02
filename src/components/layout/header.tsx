"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"

import { ThemeToggle } from "@/components/ThemeToggle"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/chat", label: "Chat" },
  { href: "/images", label: "Images" },
  { href: "/voice", label: "Voice" },
] as const

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href)
}

function NavLink({
  href,
  label,
  pathname,
  className,
}: {
  href: string
  label: string
  pathname: string
  className?: string
}) {
  const active = isActive(pathname, href)

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex h-9 items-center rounded-xl px-3 text-sm font-medium",
        "transition-colors duration-200 ease-out-expo",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        className
      )}
    >
      {label}
    </Link>
  )
}

export function Header() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  // Route changes should never leave the mobile drawer hanging open.
  React.useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 surface-glass">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="group inline-flex items-center gap-2.5 rounded-xl py-1 pr-2 transition-opacity duration-200 ease-out-expo hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow transition-transform duration-200 ease-out-expo group-hover:scale-105">
            <Waveform aria-hidden className="h-4 w-4" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight">
              Voice Agent
            </span>
            <span className="mt-0.5 hidden text-[11px] font-medium text-muted-foreground sm:block">
              powered by CallMissed
            </span>
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Main navigation"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              pathname={pathname}
            />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open navigation menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card/60 text-muted-foreground transition-colors duration-200 ease-out-expo hover:bg-accent hover:text-foreground md:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
            </SheetTrigger>

            <SheetContent side="right" className="p-0">
              <SheetHeader>
                <SheetTitle>Navigate</SheetTitle>
                <SheetDescription>
                  Jump to any mode of the CallMissed demo.
                </SheetDescription>
              </SheetHeader>

              <nav className="flex flex-col gap-1 p-3" aria-label="Mobile">
                {NAV_ITEMS.map((item) => (
                  <SheetClose asChild key={item.href}>
                    <NavLink
                      href={item.href}
                      label={item.label}
                      pathname={pathname}
                      className="h-11 justify-start text-[15px]"
                    />
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

/** Tiny inline glyph — three bars that suggest an audio waveform. */
function Waveform({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className={className}
    >
      <path d="M2 6.5v3" />
      <path d="M5.5 4v8" />
      <path d="M9 2.5v11" />
      <path d="M12.5 6v4" />
    </svg>
  )
}

export default Header
