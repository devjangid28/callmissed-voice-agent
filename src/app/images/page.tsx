"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowUpRight,
  Copy,
  Download,
  ImageIcon,
  ImagePlus,
  Lightbulb,
  Loader2,
  RotateCw,
  ScanEye,
  Wand2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ModelPicker } from "@/components/ui/model-picker"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  ACCEPTED_IMAGE_TYPES,
  extractImageFiles,
  fileToAttachment,
  type Attachment,
} from "@/lib/image"
import { DEFAULT_IMAGE_MODEL, IMAGE_MODELS } from "@/lib/models"
import { cn } from "@/lib/utils"

const STARTERS = [
  "A neon-lit Tokyo alley in the rain, cinematic, shallow depth of field",
  "Isometric illustration of a cosy coffee shop, warm muted palette",
  "Watercolour painting of a lighthouse during a storm",
]

const TIPS = [
  "Describe subject, style, lighting and lens in one sentence.",
  "Use the negative prompt to remove watermarks or extra limbs.",
  "Fix a seed to iterate on the same composition.",
]

const SIZES = [
  { value: "", label: "Model default" },
  { value: "1024x1024", label: "1024 × 1024 · square" },
  { value: "1024x1792", label: "1024 × 1792 · portrait" },
  { value: "1792x1024", label: "1792 × 1024 · landscape" },
] as const

const COUNTS = [1, 2, 3, 4] as const

type ImageResult = {
  id: string
  src: string
  remoteUrl: string | null
  mime: string
  revisedPrompt: string | null
}

/** Normalises either a remote URL or raw base64 into something an <img> can use. */
function toResult(
  item: {
    url?: string | null
    b64_json?: string | null
    revised_prompt?: string | null
  },
  index: number
): ImageResult {
  const b64 = item.b64_json ?? null

  if (!item.url && b64) {
    // The base64 prefix identifies the container for most providers.
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
      revisedPrompt: item.revised_prompt ?? null,
    }
  }

  return {
    id: `${index}-${item.url}`,
    src: item.url as string,
    remoteUrl: item.url ?? null,
    mime: "image/png",
    revisedPrompt: item.revised_prompt ?? null,
  }
}

export default function ImagesPage() {
  const router = useRouter()

  const [prompt, setPrompt] = React.useState("")
  const [negative, setNegative] = React.useState("")
  const [seed, setSeed] = React.useState("")
  const [steps, setSteps] = React.useState("20")
  const [count, setCount] = React.useState<number>(1)
  const [size, setSize] = React.useState<string>("")
  const [model, setModel] = React.useState(DEFAULT_IMAGE_MODEL)

  const [images, setImages] = React.useState<ImageResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [reference, setReference] = React.useState<Attachment | null>(null)
  const [description, setDescription] = React.useState<string | null>(null)
  const [describing, setDescribing] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const addReference = React.useCallback(async (files: File[]) => {
    const [file] = extractImageFiles(files)
    if (!file) {
      if (files.length > 0) {
        toast.error("Unsupported file", {
          description: "Attach an image (PNG, JPEG, WebP or GIF).",
        })
      }
      return
    }

    setDescribing(true)
    try {
      const attachment = await fileToAttachment(file)
      setReference(attachment)
      // The cached description goes stale as soon as the upload changes.
      setDescription(null)
    } catch (error) {
      toast.error("Could not read that image", {
        description:
          error instanceof Error ? error.message : "The file was rejected.",
      })
    } finally {
      setDescribing(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }, [])

  const clearReference = React.useCallback(() => {
    setReference(null)
    setDescription(null)
  }, [])

  const generate = React.useCallback(async () => {
    const trimmed = prompt.trim()
    if (!trimmed) {
      toast.error("Enter a prompt first")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // The image API cannot read a reference upload, so a vision model
      // describes it first and that description becomes part of the prompt.
      let referenceDescription = description
      if (reference && !referenceDescription) {
        setDescribing(true)
        const described = await fetch("/api/images/describe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: reference.url, intent: trimmed }),
        })
        const describedData = await described.json()
        if (!described.ok) {
          throw new Error(
            describedData?.error?.message || "Could not read the reference image."
          )
        }
        referenceDescription = describedData.description as string
        setDescription(referenceDescription)
      }
      setDescribing(false)

      const finalPrompt = referenceDescription
        ? `${trimmed}\n\nReference image to match: ${referenceDescription}`
        : trimmed

      const response = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: finalPrompt,
          ...(negative.trim() ? { negative_prompt: negative.trim() } : {}),
          ...(seed.trim() ? { seed: Number(seed) } : {}),
          ...(steps.trim() ? { steps: Number(steps) } : {}),
          ...(size ? { size } : {}),
          n: count,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message || `Request failed (${response.status})`)
      }

      const items: Array<{
        url?: string
        b64_json?: string
        revised_prompt?: string
      }> = data?.data ?? []
      if (items.length === 0) throw new Error("No images returned.")

      setImages(items.map(toResult))
      toast.success(
        `Generated ${items.length} image${items.length > 1 ? "s" : ""}`
      )
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unknown error"
      setError(message)
      toast.error("Image generation failed", { description: message })
    } finally {
      setDescribing(false)
      setLoading(false)
    }
  }, [count, description, model, negative, prompt, reference, seed, size, steps])

  const download = React.useCallback(async (image: ImageResult) => {
    const ext = image.mime.split("/")[1] ?? "png"
    const name = `callmissed-${image.id.replace(/[^\w-]/g, "").slice(0, 20)}.${ext}`

    try {
      const response = await fetch(image.src)
      if (!response.ok) throw new Error("fetch failed")

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
      toast.success("Image downloaded")
    } catch {
      // Signed cross-origin URLs can block blob downloads.
      window.open(image.src, "_blank", "noopener,noreferrer")
      toast.info("Opened in a new tab — save from there")
    }
  }, [])

  const copyUrl = React.useCallback(async (image: ImageResult) => {
    try {
      await navigator.clipboard.writeText(image.remoteUrl ?? image.src)
      toast.success("URL copied to clipboard")
    } catch {
      toast.error("Could not access the clipboard")
    }
  }, [])

  const saveForChat = React.useCallback(
    (image: ImageResult) => {
      try {
        window.sessionStorage.setItem(
          "callmissed:image-context",
          JSON.stringify({
            prompt: prompt.trim(),
            imageUrl: image.remoteUrl,
            addedAt: Date.now(),
          })
        )
        toast.success("Saved as chat context", {
          action: {
            label: "Open chat",
            onClick: () => router.push("/chat"),
          },
        })
      } catch {
        toast.error("Could not save chat context")
      }
    },
    [prompt, router]
  )

  const showEmpty = images.length === 0 && !loading && !error

  return (
    <div className="container-page py-8 sm:py-12">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          Generate images
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Describe what you want. Flux, GPT Image and more, through the
          CallMissed API.
        </p>
      </header>

      {/* Prompt composer — the single most important control on the page. */}
      <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-border/60 bg-card/60 p-3 shadow-soft transition-[border-color,box-shadow] duration-200 ease-out-expo focus-within:border-primary/50 focus-within:shadow-lift sm:p-4">
        <label htmlFor="prompt" className="sr-only">
          Image prompt
        </label>
        <Textarea
          id="prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              void generate()
            }
          }}
          placeholder="A neon-lit Tokyo alley in the rain, cinematic, shallow depth of field…"
          className="min-h-[7rem] resize-none border-0 bg-transparent px-1 py-1 text-base shadow-none focus-visible:border-transparent focus-visible:ring-0"
        />

        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <ModelPicker
              models={IMAGE_MODELS}
              value={model}
              onChange={setModel}
              disabled={loading}
              variant="compact"
              className="min-w-0 flex-1 sm:w-56 sm:flex-none"
            />

            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              className="sr-only"
              onChange={(event) =>
                void addReference(Array.from(event.target.files ?? []))
              }
            />

            {reference ? (
              <div className="animate-rise-in flex min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-card/70 py-1 pl-1 pr-1.5">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={reference.url}
                    alt={reference.name}
                    className="h-full w-full object-cover"
                  />
                  {describing && (
                    <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                      <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-[11px] font-medium">
                    <ScanEye aria-hidden className="h-3 w-3 text-primary" />
                    Reference set
                  </p>
                  <p className="max-w-[9rem] truncate text-[10px] text-muted-foreground">
                    {reference.name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearReference}
                  disabled={loading}
                  aria-label="Remove reference image"
                  className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground",
                    "transition-colors duration-200 ease-out-expo hover:bg-accent hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:pointer-events-none disabled:opacity-40"
                  )}
                >
                  <X aria-hidden className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                className="shrink-0"
              >
                {describing ? (
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus aria-hidden className="h-4 w-4" />
                )}
                Reference image
              </Button>
            )}
          </div>

          <Button
            onClick={() => void generate()}
            disabled={loading || describing || !prompt.trim()}
            size="lg"
            className="h-11 w-full rounded-2xl sm:w-44 sm:flex-none"
          >
            {loading ? (
              <>
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                Generating
              </>
            ) : (
              <>
                <Wand2 aria-hidden className="h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </div>

        {reference && (
          <div className="mt-2 rounded-lg bg-accent/50 px-2.5 py-2 text-[11px] leading-relaxed text-accent-foreground">
            <p className="flex items-start gap-1.5">
              <ScanEye aria-hidden className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                A vision model reads your upload and folds that description into
                the prompt, so the result is generated <em>in the style of</em>{" "}
                your image rather than editing its pixels.
              </span>
            </p>

            {description && (
              <details className="group/desc mt-2">
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span className="underline decoration-dotted underline-offset-2">
                    What the model saw
                  </span>
                </summary>
                <p className="mt-1.5 border-l-2 border-accent-foreground/25 pl-2.5 text-muted-foreground">
                  {description}
                </p>
              </details>
            )}
          </div>
        )}

        <Accordion className="mt-2 border-t border-border/60 pt-2">
          <AccordionItem value="advanced" className="border-0 bg-transparent">
            <AccordionTrigger className="px-1 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              <span className="text-xs font-medium">Advanced options</span>
            </AccordionTrigger>
            <AccordionContent className="px-1 pb-1 pt-2">
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="grid gap-3 sm:col-span-2">
                  <Field label="Negative prompt" htmlFor="negative">
                    <Input
                      id="negative"
                      value={negative}
                      onChange={(event) => setNegative(event.target.value)}
                      placeholder="blurry, watermark, extra fingers…"
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Seed" htmlFor="seed">
                      <Input
                        id="seed"
                        type="number"
                        value={seed}
                        onChange={(event) => setSeed(event.target.value)}
                        placeholder="Any"
                      />
                    </Field>

                    <Field label="Steps" htmlFor="steps">
                      <Input
                        id="steps"
                        type="number"
                        min={1}
                        max={50}
                        value={steps}
                        onChange={(event) => setSteps(event.target.value)}
                      />
                    </Field>

                    <Field label="Size" htmlFor="size">
                      <select
                        id="size"
                        value={size}
                        onChange={(event) => setSize(event.target.value)}
                        className={cn(
                          "h-10 w-full appearance-none rounded-xl border border-border/70 bg-background/60 px-3 pr-9 text-sm",
                          "transition-[background-color,border-color] duration-200 ease-out-expo",
                          "hover:border-border",
                          "focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/40"
                        )}
                      >
                        {SIZES.map((option) => (
                          <option key={option.label} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <fieldset className="sm:col-span-2">
                    <legend className="mb-2 text-xs font-medium text-muted-foreground">
                      Count
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {COUNTS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setCount(option)}
                          aria-pressed={count === option}
                          className={cn(
                            "h-9 min-w-11 rounded-xl border px-3 text-sm font-medium",
                            "transition-[background-color,border-color,color,transform] duration-200 ease-out-expo active:scale-[0.97]",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            count === option
                              ? "border-primary/40 bg-primary/15 text-foreground"
                              : "border-border/70 bg-card/60 text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
                          )}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Results */}
      <section aria-label="Generated images" className="mt-10">
        {loading && (
          <div
            role="status"
            aria-label="Generating images"
            className={cn(
              "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3",
              count > 1 && "lg:grid-cols-3"
            )}
          >
            {Array.from({ length: count }).map((_, index) => (
              <figure
                key={index}
                className="overflow-hidden rounded-2xl border border-border/60"
              >
                <Skeleton className="aspect-square w-full rounded-none" />
                <div className="space-y-2 border-t border-border/60 px-4 py-3">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </figure>
            ))}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-6 py-10 text-center"
          >
            <AlertCircle aria-hidden className="h-6 w-6 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Generation failed
              </p>
              <p className="mt-1 max-w-md text-pretty text-sm text-destructive/90">
                {error}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void generate()}
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <RotateCw aria-hidden className="h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        )}

        {showEmpty && (
          <div className="rounded-2xl border border-dashed border-border/70 px-6 py-10">
            <div className="mx-auto max-w-2xl text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground">
                <ImageIcon aria-hidden className="h-5 w-5" />
              </span>
              <p className="mt-4 text-base font-medium tracking-tight">
                Nothing generated yet
              </p>
              <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">
                Start from an example, or write your own prompt above.
              </p>
            </div>

            <div className="mx-auto mt-4 grid max-w-2xl gap-2 sm:mt-6 sm:grid-cols-3">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => {
                    setPrompt(starter)
                    document.getElementById("prompt")?.focus()
                  }}
                  className={cn(
                    "rounded-xl border border-border/60 bg-card/60 px-3.5 py-3 text-left text-xs leading-relaxed",
                    "transition-[transform,border-color,background-color] duration-200 ease-out-expo",
                    "hover:-translate-y-px hover:border-border hover:bg-accent/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                >
                  {starter}
                </button>
              ))}
            </div>

            <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-border/60 bg-card/40 p-4">
              <p className="flex items-center gap-2 text-xs font-medium">
                <Lightbulb aria-hidden className="h-3.5 w-3.5 text-warning" />
                Prompt tips
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {TIPS.map((tip) => (
                  <li
                    key={tip}
                    className="relative pl-4 text-xs leading-relaxed text-muted-foreground before:absolute before:left-0 before:top-[0.55em] before:h-1 before:w-1 before:rounded-full before:bg-muted-foreground/50"
                  >
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {images.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {images.map((image) => (
                <figure
                  key={image.id}
                  className="group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft transition-[transform,box-shadow,border-color] duration-200 ease-out-expo hover:-translate-y-0.5 hover:border-border hover:shadow-lift"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.src}
                    alt={
                      image.revisedPrompt ||
                      prompt.trim() ||
                      "Generated image"
                    }
                    className="aspect-square w-full bg-muted/40 object-cover"
                    loading="lazy"
                  />

                  <figcaption className="space-y-2 border-t border-border/60 px-4 py-3">
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {image.revisedPrompt ?? prompt.trim()}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <CardAction
                        label="Download"
                        onClick={() => void download(image)}
                      >
                        <Download aria-hidden className="h-3.5 w-3.5" />
                      </CardAction>

                      <CardAction
                        label="Copy URL"
                        onClick={() => void copyUrl(image)}
                      >
                        <Copy aria-hidden className="h-3.5 w-3.5" />
                      </CardAction>

                      <CardAction
                        label="Use in chat"
                        onClick={() => saveForChat(image)}
                        className="ml-auto"
                      >
                        Use in chat
                        <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
                      </CardAction>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>

            <div className="mt-8 flex justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setImages([])
                  setError(null)
                  document.getElementById("prompt")?.focus()
                }}
              >
                Start a new image
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function CardAction({
  label,
  onClick,
  className,
  children,
}: {
  label: string
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground",
        "transition-colors duration-200 ease-out-expo hover:bg-accent hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {children}
    </button>
  )
}
