import Link from "next/link"
import { ArrowRight, MessageSquare, ImageIcon, Phone } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const FEATURES = [
  {
    href: "/chat",
    title: "Chat",
    description:
      "Stream tokens from frontier models like Sarvam, GPT and Claude with a system prompt and model picker.",
    icon: MessageSquare,
    accent: "from-sky-500/20 to-sky-500/0",
  },
  {
    href: "/images",
    title: "Images",
    description:
      "Generate images with Flux, GPT Image or Nano Banana. Tune prompt, steps, seed and count.",
    icon: ImageIcon,
    accent: "from-violet-500/20 to-violet-500/0",
  },
  {
    href: "/voice",
    title: "Voice",
    description:
      "Start a live, full-duplex voice session over LiveKit with a running transcript.",
    icon: Phone,
    accent: "from-emerald-500/20 to-emerald-500/0",
  },
] as const

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 px-6 py-16 text-center sm:px-10 sm:py-24">
        <div className="pointer-events-none absolute inset-0 bg-grid" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-glow" aria-hidden />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Powered by CallMissed
          </span>

          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Talk. Create. Call.
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            One minimal playground for three AI modalities — streaming chat,
            image generation, and a live voice agent. Every request is proxied
            server-side, so the API key never reaches the browser.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/chat"
              className={cn(buttonVariants({ size: "lg" }), "h-11 w-full rounded-xl sm:w-auto")}
            >
              Start chatting
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/voice"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "h-11 w-full rounded-xl sm:w-auto"
              )}
            >
              Try the voice agent
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ href, title, description, icon: Icon, accent }) => (
          <Link
            key={href}
            href={href}
            className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-border hover:shadow-lg focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div
              className={cn(
                "pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br blur-2xl transition-opacity duration-200",
                accent
              )}
              aria-hidden
            />

            <div className="relative">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-background transition-transform duration-200 group-hover:scale-105">
                <Icon className="h-5 w-5" />
              </span>

              <h2 className="mt-4 text-lg font-semibold tracking-tight">
                {title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>

              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground">
                Open
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  )
}