import { NextRequest, NextResponse } from "next/server"

const API_BASE = "https://api.callmissed.com/v1"
const DEFAULT_MODEL = "flux-2-dev"
const SUPPORTED_MODELS = [
  "dreamshaper-8-lcm",
  "flux-1.1-pro",
  "flux-2-dev",
  "flux-2-klein-9b",
  "flux-2-pro",
  "gemini-3.1-flash-lite-image",
  "gpt-image-1.5",
  "gpt-image-2",
  "gpt-image-2.5-flare",
  "gpt-image-2.5-sunburst",
  "lucid-origin",
  "nano-banana-2",
  "nano-banana-pro",
  "phoenix-1.0",
  "sdxl-lightning",
] as const

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type GenerateRequest = {
  model?: string
  prompt?: string
  negative_prompt?: string
  seed?: number
  steps?: number
  n?: number
  size?: string
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.CALLMISSED_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error: {
          message: "CALLMISSED_API_KEY is not configured on the server.",
          type: "configuration_error",
          code: "missing_api_key",
        },
      },
      { status: 500 }
    )
  }

  let body: GenerateRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: { message: "Request body must be valid JSON." } },
      { status: 400 }
    )
  }

  const {
    model = DEFAULT_MODEL,
    prompt,
    negative_prompt,
    seed,
    steps,
    n = 1,
    size,
  } = body ?? {}

  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json(
      { error: { message: "`prompt` is required." } },
      { status: 400 }
    )
  }

  const count = Math.min(4, Math.max(1, Number(n) || 1))

  try {
    const upstream = await fetch(`${API_BASE}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: prompt.trim(),
        ...(negative_prompt ? { negative_prompt } : {}),
        ...(Number.isFinite(seed) ? { seed } : {}),
        ...(Number.isFinite(steps) ? { steps } : {}),
        n: count,
        ...(size ? { size } : {}),
      }),
    })

    const data = await upstream.json()

    if (!upstream.ok) {
      const err = (data as { error?: { message?: string; type?: string; code?: string } })
        .error
      return NextResponse.json(
        {
          error: {
            message:
              err?.message ?? `Image generation failed (${upstream.status}).`,
            type: err?.type ?? "upstream_error",
            code: err?.code ?? "upstream_error",
          },
        },
        { status: upstream.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Images API error:", error)
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Failed to reach the CallMissed API.",
          type: "upstream_unreachable",
          code: "upstream_error",
        },
      },
      { status: 502 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ models: SUPPORTED_MODELS })
}