import Link from "next/link"
import { ThemeToggle } from "@/components/ThemeToggle"

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="font-semibold text-xl hover:opacity-80 transition-opacity">
            Voice Agent
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/chat" className="text-sm hover:underline">Chat</Link>
            <Link href="/images" className="text-sm hover:underline">Images</Link>
            <Link href="/voice" className="text-sm hover:underline">Voice</Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <a href="https://docs.callmissed.com" target="_blank" rel="noopener noreferrer" className="hover:underline">
          Powered by CallMissed API
        </a>
      </footer>
    </div>
  )
}
