import type { Metadata } from "next"
import { Inter } from "next/font/google"

import "./globals.css"

import Header from "@/components/layout/header"
import Footer from "@/components/layout/footer"
import { Providers } from "@/components/Providers"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: {
    default: "Voice Agent Demo",
    template: "%s · Voice Agent Demo",
  },
  description:
    "Chat with frontier LLMs, generate images, and talk to a live voice agent — powered by CallMissed.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.className} min-h-dvh bg-background font-sans text-foreground antialiased`}
      >
        <Providers>
          <div className="flex min-h-dvh flex-col">
            <Header />
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
        <Toaster />
      </body>
    </html>
  )
}