import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Voice",
  description:
    "Start a live, full-duplex voice session with an AI agent over WebRTC — powered by CallMissed.",
}

export default function VoiceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
