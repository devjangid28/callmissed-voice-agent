/**
 * Client-side image helpers.
 *
 * Attachments are inlined as data URLs so they can ride along in the request
 * body — that keeps the demo free of an upload endpoint and avoids sending
 * bytes to a third party. The cost is payload size, so every image is
 * downscaled and re-encoded before it is stored or sent.
 */

/** Longest edge, in pixels, after downscaling. */
const MAX_EDGE = 1024
/** JPEG quality. 0.8 keeps screenshots legible at a fraction of the bytes. */
const JPEG_QUALITY = 0.8

export type Attachment = {
  /** `data:image/...;base64,...` — sent to the model as-is. */
  url: string
  name: string
  /** Approximate encoded size in bytes, for the UI and the storage budget. */
  bytes: number
}

export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]

/**
 * `localStorage` holds roughly 5 MB. Base64 inflates by ~4/3, so a handful of
 * full-resolution screenshots would blow the quota and silently break
 * persistence. Only the most recent image-bearing turns keep their pixels.
 */
export const MAX_PERSISTED_ATTACHMENTS = 6

/** Vision models get fewer images per turn before the payload gets silly. */
export const MAX_ATTACHMENTS = 4

export function isAcceptedImage(file: File) {
  return ACCEPTED_IMAGE_TYPES.includes(file.type)
}

/**
 * Reads an image file, downscales it so its longest edge is at most
 * `MAX_EDGE`, and returns a JPEG data URL.
 *
 * GIFs are re-encoded as stills: animation is not useful to a vision model and
 * re-encoding is what keeps the payload small.
 */
export async function fileToAttachment(file: File): Promise<Attachment> {
  const dataUrl = await readAsDataUrl(file)
  const downscaled = await downscale(dataUrl, MAX_EDGE, JPEG_QUALITY)

  // `downscale` returns the input untouched if canvas is unavailable, so fall
  // back to the original bytes rather than losing the attachment.
  const url = downscaled ?? dataUrl

  return {
    url,
    name: file.name || "pasted-image",
    bytes: approximateBytes(url),
  }
}

/** Approximate decoded byte length of a base64 data URL. */
export function approximateBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",")
  if (commaIndex < 0) return 0
  const base64 = dataUrl.slice(commaIndex + 1)
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("That file is not a readable image."))
    image.src = src
  })
}

async function downscale(
  dataUrl: string,
  maxEdge: number,
  quality: number
): Promise<string | null> {
  if (typeof document === "undefined") return null

  let image: HTMLImageElement
  try {
    image = await loadImage(dataUrl)
  } catch {
    return null
  }

  const { naturalWidth: width, naturalHeight: height } = image
  if (!width || !height) return null

  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight)

  return canvas.toDataURL("image/jpeg", quality)
}

/**
 * Keeps only the image files from a paste, drop, or file input.
 * Clipboard items only expose files under the `files` list, never `items`.
 */
export function extractImageFiles(
  list: FileList | File[] | null | undefined
): File[] {
  if (!list) return []
  return Array.from(list).filter(isAcceptedImage)
}
