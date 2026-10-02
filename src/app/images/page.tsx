"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ChevronDown,
  Download,
  Loader2,
  MessageSquare,
  Sparkles,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const MODELS = [
  { value: "flux-2-dev", label: "flux-2-dev" },
  { value: "nano-banana-2", label: "nano-banana-2" },
  { value: "gpt-image-2", label: "gpt-image-2" },
  { value: "flux-1.1-pro", label: "flux-1.1-pro" },
  { value: "sdxl-lightning", label: "sdxl-lightning" },
] as const

const EXAMPLES = [
  "A neon-lit Tokyo alley in the rain, cinematic, shallow depth of field",
  "Isometric illustration of a cozy coffee shop, warm palette",
  "Watercolour painting of a lighthouse during a storm",
] as const

type ImageResult = {
  id: string
  src: string
  remoteUrl: string | null
  mime: string
}

/** Builds an object/data URL from either a remote URL or raw base64. */
function toResult(item: {
  url?: string | null
  b64_json?: string | null
}, index: number): ImageResult {
  const b64 = item.b64_json ?? null

  if (!item.url && b64) {
    const mime = b64.startsWith("iVBORw0KGgo")
      ? "image/png"
      : b64.startsWith("/9j/")
        ? "image/jpeg"
        : b64.startsWith("R0lGOD")
          ? "image/gif"
          : b64.startsWith("UklGR")
            ? "image/webp"
            : "image/png"

    return {
      id: `${index}-${b64.length}`,
      src: `data:${mime};base64,${b64}`,
      remoteUrl: null,
      mime,
    }
  }

  return {
    id: `${index}-${item.url}`,
    src: item.url as string,
    remoteUrl: item.url ?? null,
    mime: "image/png",
  }
}

export default function ImagesPage() {
  const [prompt, setPrompt] = useState("")
  const [negative, setNegative] = useState("")
  const [seed, setSeed] = useState("")
  const [steps, setSteps] = useState("20")
  const [count, setCount] = useState("1")
  const [model, setModel] = useState<string>("flux-2-dev")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [imgs, setImgs] = useState<ImageResult[]>([])
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error("Enter a prompt first")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: prompt.trim(),
          negative_prompt: negative.trim() || undefined,
          seed: seed.trim() ? Number(seed) : undefined,
          steps: steps.trim() ? Number(steps) : undefined,
          n: Math.min(4, Math.max(1, Number(count) || 1)),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error?.message || `Request failed (${res.status})`)
      }

      const items: Array<{ url?: string; b64_json?: string }> = data?.data ?? []
      if (items.length === 0) throw new Error("No images returned")

      setImgs(items.map(toResult))
      toast.success(`Generated ${items.length} image${items.length > 1 ? "s" : ""}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error("Image generation failed", { description: message })
    } finally {
      setLoading(false)
    }
  }

  const download = async (image: ImageResult) => {
    const name = `callmissed-${image.id.replace(/[^\w-]/g, "").slice(0, 24)}.${image.mime.split("/")[1]}`

    try {
      const res = await fetch(image.src)
      if (!res.ok) throw new Error("fetch failed")

      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
      toast.success("Download started")
    } catch {
      // Cross-origin signed URLs can block blob downloads — fall back to open.
      window.open(image.src, "_blank", "noopener,noreferrer")
      toast.info("Opened in a new tab — save from there")
    }
  }

  const copyUrl = async (image: ImageResult) => {
    try {
      if (image.remoteUrl) {
        await navigator.clipboard.writeText(image.remoteUrl)
      } else {
        await navigator.clipboard.writeText(image.src)
      }
      toast.success("URL copied to clipboard")
    } catch {
      toast.error("Could not access the clipboard")
    }
  }

  const addToChat = (image: ImageResult) => {
    const attachment = {
      prompt: prompt.trim(),
      imageUrl: image.remoteUrl,
      addedAt: Date.now(),
    }
    try {
      sessionStorage.setItem("voice-agent:image-context", JSON.stringify(attachment))
      toast.success("Added to chat context")
    } catch {
      toast.error("Could not save chat context")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want…"
          className="min-h-[92px] resize-none text-base"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
          >
            Advanced
            <ChevronDown
              className={cn(
                "transition-transform duration-200",
                showAdvanced && "rotate-180"
              )}
            />
          </Button>

          <Button
            onClick={() => void generate()}
            disabled={loading || !prompt.trim()}
            className="ml-auto h-10"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </div>

        {showAdvanced && (
          <div className="grid animate-in fade-in-0 slide-in-from-top-2 gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <label
                htmlFor="negative"
                className="text-sm font-medium text-muted-foreground"
              >
                Negative prompt
              </label>
              <Input
                id="negative"
                value={negative}
                onChange={(e) => setNegative(e.target.value)}
                placeholder="blurry, low quality, watermark…"
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="seed" className="text-sm font-medium text-muted-foreground">
                Seed
              </label>
              <Input
                id="seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Random"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <label htmlFor="steps" className="text-sm font-medium text-muted-foreground">
                  Steps
                </label>
                <Input
                  id="steps"
                  type="number"
                  min={1}
                  max={50}
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="count" className="text-sm font-medium text-muted-foreground">
                  Count
                </label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={4}
                  value={count}
                  onChange={(e) =>
                    setCount(String(Math.min(4, Math.max(1, Number(e.target.value) || 1))))
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {imgs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/60 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-card">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium">No images yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try one of these prompts to get started.
            </p>
          </div>
          <div className="flex max-w-2xl flex-wrap items-center justify-center gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
                className="max-w-xs rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {imgs.map((image) => (
            <Card
              key={image.id}
              className="overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <CardContent className="p-3">
                <div className="overflow-hidden rounded-xl bg-muted/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.src}
                    alt={prompt.trim() || "Generated image"}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void download(image)}>
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void copyUrl(image)}>
                    Copy URL
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => addToChat(image)}>
                    <MessageSquare className="h-3.5 w-3.5" />
                    Use in chat
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {imgs.length > 0 && (
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/chat">Open chat</Link>
          </Button>
        </div>
      )}
    </div>
  )
}