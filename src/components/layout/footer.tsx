import Link from "next/link"

const LINKS = [
  { href: "/chat", label: "Chat" },
  { href: "/images", label: "Images" },
  { href: "/voice", label: "Voice" },
]

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Powered by{" "}
            <a
              href="https://docs.callmissed.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
            >
              CallMissed
            </a>
          </p>

          <nav className="flex items-center gap-4">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="my-6 h-px w-full bg-border" />

        <p className="text-center text-xs text-muted-foreground">
          Demo application. All model calls are proxied server-side.
        </p>
      </div>
    </footer>
  )
}

export default Footer