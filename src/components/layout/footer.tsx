import Link from "next/link"

const DOCS_URL = "https://docs.callmissed.com"

const PRODUCT_LINKS = [
  { href: "/chat", label: "Chat" },
  { href: "/images", label: "Images" },
  { href: "/voice", label: "Voice" },
] as const

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60">
      <div className="container-page flex flex-col items-center justify-between gap-3 py-6 sm:flex-row sm:items-start sm:gap-4 sm:py-8">
        <div className="flex flex-col items-center gap-1 text-center sm:items-start sm:text-left">
          <p className="text-xs text-muted-foreground">
            Powered by{" "}
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-colors duration-200 ease-out-expo hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              CallMissed API
            </a>
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            Every request is proxied server-side — no API key in the browser.
          </p>
        </div>

        <nav
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
          aria-label="Footer"
        >
          {PRODUCT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-sm text-xs text-muted-foreground underline-offset-4 transition-colors duration-200 ease-out-expo hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
            </Link>
          ))}
          <span aria-hidden className="h-3 w-px bg-border" />
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm text-xs text-muted-foreground underline-offset-4 transition-colors duration-200 ease-out-expo hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Docs
          </a>
        </nav>
      </div>
    </footer>
  )
}

export default Footer
