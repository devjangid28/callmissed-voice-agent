import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Images",
  description:
    "Text-to-image generation with Flux, GPT Image and more — powered by CallMissed.",
}

export default function ImagesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
