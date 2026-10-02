/**
 * Curated model catalogue for the playground pickers.
 *
 * Labels and blurbs describe the real upstream models from
 * https://api.callmissed.com/v1/models — showing a bare model ID with no
 * explanation is a known anti-pattern, so each entry carries a one-line role.
 */

export type ModelInfo = {
  value: string
  label: string
  hint: string
  /**
   * Whether the model accepts `image_url` content parts. Verified against the
   * live API: non-vision models reject an image with HTTP 400, so the chat
   * composer blocks sending and offers a switch rather than failing mid-send.
   */
  supportsVision?: boolean
  /** Reliable for long, detailed image descriptions (used by the Images page). */
  strongVision?: boolean
}

export const CHAT_MODELS: ModelInfo[] = [
  {
    value: "sarvam-105b",
    label: "Sarvam 105B",
    hint: "105B MoE — 128K context, flagship reasoning",
  },
  {
    value: "gpt-5.6-sol",
    label: "GPT-5.6 Sol",
    hint: "Frontier professional work — 1.05M context",
    supportsVision: true,
    strongVision: true,
  },
  {
    value: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    hint: "Fast multimodal — 1M context",
    supportsVision: true,
    strongVision: true,
  },
  {
    value: "DeepSeek-V4-Pro",
    label: "DeepSeek V4 Pro",
    hint: "Deep reasoning — 1M context, tool calling",
  },
  {
    value: "kimi-k2.5",
    label: "Kimi K2.5",
    hint: "Coding and maths — 256K context",
    supportsVision: true,
  },
  {
    value: "glm-5.3",
    label: "GLM 5.3",
    hint: "1M context — reasoning effort levels",
  },
  {
    value: "gpt-4o",
    label: "GPT-4o",
    hint: "Multimodal — 128K context",
    supportsVision: true,
  },
]

export const IMAGE_MODELS: ModelInfo[] = [
  {
    value: "flux-2-dev",
    label: "Flux 2 Dev",
    hint: "Higher fidelity — 50-step inference",
  },
  {
    value: "nano-banana-2",
    label: "Nano Banana 2",
    hint: "Gemini 3.1 Flash Image — fast, strong prompt adherence",
  },
  {
    value: "gpt-image-2",
    label: "GPT Image 2",
    hint: "Flagship — accurate on-image text",
  },
  {
    value: "flux-1.1-pro",
    label: "FLUX 1.1 Pro",
    hint: "Fast, production-grade — 1024x1024",
  },
  {
    value: "sdxl-lightning",
    label: "SDXL Lightning",
    hint: "4-step — fastest for iteration",
  },
]

export const DEFAULT_CHAT_MODEL = "sarvam-105b"
export const DEFAULT_IMAGE_MODEL = "flux-2-dev"

/**
 * Vision model used to read an uploaded reference image on the Images page.
 * `strongVision` is preferred; Gemini is the verified fallback.
 */
export const VISION_MODEL = "gemini-3.8-flash"

export function findModel(models: ModelInfo[], value: string) {
  return models.find((m) => m.value === value)
}

export function supportsVision(value: string): boolean {
  return Boolean(findModel(CHAT_MODELS, value)?.supportsVision)
}

/** A vision-capable chat model the UI can offer as a one-tap fix. */
export function suggestedVisionModel(current: string): ModelInfo | undefined {
  if (supportsVision(current)) return undefined
  return CHAT_MODELS.find(
    (model) => model.supportsVision && model.strongVision && model.value !== current
  )
}
