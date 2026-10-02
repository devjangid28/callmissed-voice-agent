import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Chat",
  description:
    "Streaming completions across 100+ models, with temperature, JSON mode and tool calls — powered by CallMissed.",
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
