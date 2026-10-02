"use client"

import * as React from "react"
import { ArrowUp, ImagePlus, Square } from "lucide-react"
import { toast } from "sonner"

import { AttachmentTray, useImageDrop } from "@/components/chat/attachment-tray"
import {
  ACCEPTED_IMAGE_TYPES,
  extractImageFiles,
  fileToAttachment,
  MAX_ATTACHMENTS,
  type Attachment,
} from "@/lib/image"
import { cn } from "@/lib/utils"

/**
 * Chat composer: auto-growing textarea, image attachments, and a send/stop
 * button. Enter sends, Shift+Enter inserts a newline.
 *
 * Images are staged here (downscaled to data URLs) rather than uploaded, so
 * the send path stays a single JSON request.
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  streaming = false,
  disabled = false,
  inputRef,
  attachments,
  onAttachmentsChange,
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  streaming?: boolean
  disabled?: boolean
  inputRef?: React.RefObject<HTMLTextAreaElement>
  attachments: Attachment[]
  onAttachmentsChange: (attachments: Attachment[]) => void
}) {
  const localRef = React.useRef<HTMLTextAreaElement>(null)
  const textareaRef = inputRef ?? localRef
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)

  const locked = disabled || streaming || busy
  const canSend =
    (value.trim().length > 0 || attachments.length > 0) && !disabled && !busy

  // Grow with the content, up to the CSS max-height, then scroll.
  React.useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${el.scrollHeight}px`
  }, [value, textareaRef])

  const addFiles = React.useCallback(
    async (files: File[]) => {
      const images = extractImageFiles(files)
      if (images.length === 0) {
        if (files.length > 0) {
          toast.error("Unsupported file", {
            description: `Attach an image (${ACCEPTED_IMAGE_TYPES
              .map((type) => type.replace("image/", "").toUpperCase())
              .join(", ")}).`,
          })
        }
        return
      }

      setBusy(true)
      try {
        const room = Math.max(0, MAX_ATTACHMENTS - attachments.length)
        const accepted = images.slice(0, room)

        if (accepted.length < images.length) {
          toast.warning(`Only ${MAX_ATTACHMENTS} images per message`, {
            description: `Added the first ${accepted.length}.`,
          })
        }

        const converted = await Promise.all(accepted.map(fileToAttachment))
        onAttachmentsChange([...attachments, ...converted])
      } catch (error) {
        toast.error("Could not attach that image", {
          description:
            error instanceof Error ? error.message : "The file was rejected.",
        })
      } finally {
        setBusy(false)
        // Allow re-selecting the same file.
        if (fileRef.current) fileRef.current.value = ""
      }
    },
    [attachments, onAttachmentsChange]
  )

  const { active, handlers: dropHandlers } = useImageDrop(
    (files) => void addFiles(files),
    !locked
  )

  // Paste an image straight from the clipboard.
  const onPaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (locked) return
      const files = extractImageFiles(event.clipboardData.files)
      if (files.length === 0) return
      event.preventDefault()
      void addFiles(files)
    },
    [addFiles, locked]
  )

  return (
    <div className="relative" {...dropHandlers}>
      {active && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 text-xs font-medium text-primary-foreground"
          aria-hidden
        >
          Drop images to attach
        </div>
      )}

      <AttachmentTray
        attachments={attachments}
        disabled={locked}
        onRemove={(index) =>
          onAttachmentsChange(attachments.filter((_, i) => i !== index))
        }
      />

      <div className="flex items-end gap-2 px-2 py-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          multiple
          className="sr-only"
          onChange={(event) =>
            void addFiles(Array.from(event.target.files ?? []))
          }
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={locked || attachments.length >= MAX_ATTACHMENTS}
          aria-label="Attach an image"
          title="Attach an image (or paste / drop one)"
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground",
            "transition-[background-color,color,transform] duration-200 ease-out-expo",
            "hover:bg-accent hover:text-foreground active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-40"
          )}
        >
          <ImagePlus aria-hidden className="h-4 w-4" />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onPaste={onPaste}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              if (canSend) onSend()
            }
          }}
          placeholder="Ask anything, or attach an image…"
          aria-label="Message"
          className={cn(
            "max-h-40 min-h-[36px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6",
            "shadow-none placeholder:text-muted-foreground/70",
            "focus-visible:outline-none focus-visible:ring-0",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        />

        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop generating"
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background",
              "transition-[transform,opacity] duration-200 ease-out-expo hover:opacity-85 active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            <Square aria-hidden className="h-3 w-3 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send message"
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              "transition-[background-color,transform,opacity] duration-200 ease-out-expo active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              canSend
                ? "bg-primary text-primary-foreground shadow-soft hover:brightness-110"
                : "bg-muted text-muted-foreground opacity-60"
            )}
          >
            <ArrowUp aria-hidden className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
