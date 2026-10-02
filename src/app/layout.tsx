import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"

import "./globals.css"

import Footer from "@/components/layout/footer"
import Header from "@/components/layout/header"
import { Providers } from "@/components/Providers"
import { themeInitScript } from "@/components/ThemeProvider"

/**
 * Self-hosted variable fonts. Keeping them local removes the Google Fonts
 * network round-trip, which is the single biggest LCP cost in a demo build.
 */
const sans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
})

const mono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://docs.callmissed.com"),
  title: {
    default: "Voice Agent Demo — powered by CallMissed",
    template: "%s · Voice Agent Demo",
  },
  description:
    "Chat with AI, generate images, and start a live voice session — powered by CallMissed.",
  applicationName: "Voice Agent Demo",
  keywords: ["CallMissed", "voice agent", "chat", "text-to-image", "livekit"],
  openGraph: {
    title: "Voice Agent Demo — powered by CallMissed",
    description:
      "Chat with AI, generate images, and start a live voice session — powered by CallMissed.",
    type: "website",
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
  colorScheme: "dark light",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // suppressHydrationWarning: the theme script below mutates <html> before
    // React hydrates, which is intentional and safe.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body
        className={`${sans.variable} ${mono.variable} min-h-dvh bg-background font-sans text-foreground antialiased`}
      >
        <Providers>
          <div className="relative flex min-h-dvh flex-col">
            <Header />
            <main id="main" className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  )
}
