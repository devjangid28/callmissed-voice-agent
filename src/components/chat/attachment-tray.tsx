"use client"

import * as React from "react"
import { FileImage, X } from "lucide-react"

import { formatBytes, type Attachment } from "@/lib/image"
import { cn } from "@/lib/utils"

/**
 * Thumbnail strip for images staged on the composer.
 *
 * Each tile previews the downscaled data URL directly, so there is no extra
 * object URL to revoke.
 */
export function AttachmentTray({
  attachments,
  onRemove,
  disabled = false,
}: {
  attachments: Attachment[]
  onRemove: (index: number) => void
  disabled?: boolean
}) {
  if (attachments.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2 px-2.5 pb-1 pt-2">
      {attachments.map((attachment, index) => (
        <li
          key={`${attachment.name}-${index}`}
          className="group/attach relative animate-rise-in"
        >
          <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-border/70 bg-muted/40">
            {/* Data URLs cannot go through the next/image optimizer, which
                requires a fetchable src plus intrinsic dimensions. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.url}
              alt={attachment.name}
              className="h-full w-full object-cover"
            />
          </div>

          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={disabled}
            aria-label={`Remove ${attachment.name}`}
            title={`Remove ${attachment.name} (${formatBytes(attachment.bytes)})`}
            className={cn(
              "absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full",
              "border border-border bg-card text-foreground shadow-soft",
              "transition-[transform,background-color] duration-200 ease-out-expo",
              "hover:bg-destructive hover:text-destructive-foreground active:scale-90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            <X aria-hidden className="h-3 w-3" />
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * Wraps a child with image drop handling and renders nothing on its own, so
 * callers can decide where the drop zone lives.
 */
export function useImageDrop(onFiles: (files: File[]) => void, enabled = true) {
  const [active, setActive] = React.useState(false)
  // Drag events fire for every child element, so nesting has to be counted
  // rather than simply set/cleared.
  const depth = React.useRef(0)

  return {
    active,
    handlers: {
      onDragEnter: (event: React.DragEvent) => {
        if (!enabled || !event.dataTransfer.types.includes("Files")) return
        depth.current += 1
        setActive(true)
      },
      onDragOver: (event: React.DragEvent) => {
        if (!enabled || !event.dataTransfer.types.includes("Files")) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
      },
      onDragLeave: () => {
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setActive(false)
      },
      onDrop: (event: React.DragEvent) => {
        depth.current = 0
        setActive(false)
        if (!enabled) return
        event.preventDefault()
        onFiles(Array.from(event.dataTransfer.files))
      },
    },
  }
}

/** Icon + label used by the "add image" affordances. */
export function AttachIcon({ className }: { className?: string }) {
  return <FileImage aria-hidden className={className} />
}
