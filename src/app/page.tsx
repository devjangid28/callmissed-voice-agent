import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, ArrowUpRight, ImageIcon, MessagesSquare, PhoneCall } from "lucide-react"

export const metadata: Metadata = {
  title: "Talk. Create. Call.",
  description:
    "Chat with AI, generate images, and start a live voice session — powered by CallMissed.",
}

const MODES = [
  {
    href: "/chat",
    name: "Chat",
    icon: MessagesSquare,
    summary: "Streaming completions from 100+ models.",
    detail:
      "Pick a model, dial in the temperature, and watch tokens arrive. Switch models mid-thread to compare answers.",
  },
  {
    href: "/images",
    name: "Images",
    icon: ImageIcon,
    summary: "Text-to-image with Flux, GPT Image and more.",
    detail:
      "Tune negative prompt, seed, steps and count. Download a result or hand it straight to chat as context.",
  },
  {
    href: "/voice",
    name: "Voice",
    icon: PhoneCall,
    summary: "A real-time agent that listens and replies.",
    detail:
      "Full-duplex audio over WebRTC with a live transcript, mute control, and a mic level meter.",
  },
] as const

const STEPS = [
  {
    title: "Choose a mode",
    body: "Chat, images, or voice — each one a single screen with only the controls that matter.",
  },
  {
    title: "Interact with AI",
    body: "Send a prompt, render one, or start talking. Requests are proxied through server-side routes.",
  },
  {
    title: "See results in real time",
    body: "Tokens stream, images fill a grid, and speech lands as a live transcript you can read back.",
  },
] as const

export default function HomePage() {
  return (
    <div className="relative">
      {/* Ambient accent wash — purely decorative. */}
      <div
        aria-hidden
        className="hero-glow pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[32rem]"
      />

      <div className="container-page py-12 sm:py-16 lg:py-20">
        {/* Hero */}
        <section className="flex flex-col items-center text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            Powered by CallMissed
          </p>

          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.03em] sm:mt-6 sm:text-6xl lg:text-7xl">
            Talk. Create. Call.
          </h1>

          <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Chat with AI, generate images, and start a live voice session —
            powered by CallMissed.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3 sm:mt-9 sm:flex-row">
            <Link
              href="#modes"
              className="group inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-soft transition-[transform,box-shadow,filter] duration-200 ease-out-expo hover:-translate-y-0.5 hover:shadow-glow hover:brightness-110 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Get started
              <ArrowRight
                aria-hidden
                className="h-4 w-4 transition-transform duration-200 ease-out-expo group-hover:translate-x-0.5"
              />
            </Link>

            <Link
              href="/voice"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border/70 bg-card/60 px-6 text-sm font-medium transition-[transform,background-color,border-color] duration-200 ease-out-expo hover:-translate-y-0.5 hover:border-border hover:bg-accent active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Talk to the agent
            </Link>
          </div>
        </section>

        {/* Feature cards */}
        <section
          id="modes"
          aria-labelledby="modes-heading"
          className="mt-12 scroll-mt-24 sm:mt-20 lg:mt-28"
        >
          <h2 id="modes-heading" className="sr-only">
            Demo modes
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {MODES.map((mode) => (
              <Link
                key={mode.href}
                href={mode.href}
                className="group flex flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-soft transition-[transform,box-shadow,border-color] duration-200 ease-out-expo hover:-translate-y-1 hover:border-border hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-colors duration-200 ease-out-expo group-hover:bg-primary group-hover:text-primary-foreground">
                  <mode.icon aria-hidden className="h-5 w-5" />
                </span>

                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                  {mode.name}
                </h3>
                <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">
                  {mode.detail}
                </p>

                <span className="mt-6 flex items-center justify-between gap-2 pt-1 text-sm font-medium">
                  <span>{mode.summary}</span>
                  <ArrowUpRight
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out-expo group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section
          aria-labelledby="how-heading"
          className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-4 sm:mt-20 sm:p-10 lg:mt-28"
        >
          <div className="max-w-2xl">
            <h2
              id="how-heading"
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              How it works
            </h2>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              Three steps, no setup. Every request is proxied server-side
              through <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">/api</code>{" "}
              routes, so the API key never reaches the browser.
            </p>
          </div>

          <ol className="mt-6 grid gap-4 sm:mt-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative flex gap-4">
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-accent font-mono text-xs font-medium tabular-nums text-accent-foreground"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
