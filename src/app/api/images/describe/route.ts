import { NextRequest, NextResponse } from "next/server"

import { VISION_MODEL } from "@/lib/models"

const API_BASE = "https://api.callmissed.com/v1"
/** ~5 MB of base64 covers a 1024px JPEG with room to spare. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DescribeRequest = {
  image?: string
  /** What the user wants, so the description can emphasise what matters. */
  intent?: string
}

/**
 * Reads an uploaded reference image and returns a rich textual description.
 *
 * The upstream image API has no edit/reference endpoint (`/images/edits`
 * returns 404 and `/images/generations` ignores an `image` field), so
 * reference-driven generation is built on top of a vision model instead: the
 * model describes the upload, and that description seeds the image prompt.
 * The result is a new image inspired by the upload, not an edit of its pixels.
 */
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

  let body: DescribeRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: { message: "Request body must be valid JSON." } },
      { status: 400 }
    )
  }

  const image = body?.image
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json(
      {
        error: {
          message: "`image` must be a base64 data URL.",
          type: "invalid_request_error",
          code: "invalid_image",
        },
      },
      { status: 400 }
    )
  }

  // Reject oversized payloads before spending an upstream call on them.
  const base64 = image.slice(image.indexOf(",") + 1)
  if (base64.length * 0.75 > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      {
        error: {
          message: "That image is too large to read. Try a smaller one.",
          type: "invalid_request_error",
          code: "image_too_large",
        },
      },
      { status: 413 }
    )
  }

  const intent = body.intent?.trim()

  const prompt = [
    "Describe this image for an image-generation model.",
    "Cover, in one compact paragraph: the subject, the composition and framing,",
    "lighting, colour palette, materials and textures, and the overall mood or style.",
    "Be specific and concrete — name actual colours and objects rather than",
    "generalities. Do not add commentary, questions, or markdown.",
    intent ? `The user wants to: ${intent}. Emphasise details relevant to that.` : "",
  ]
    .filter(Boolean)
    .join(" ")

  try {
    const upstream = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        stream: false,
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    })

    const data = await upstream.json().catch(() => null)

    if (!upstream.ok) {
      const err = (data as { error?: { message?: string; type?: string; code?: string } } | null)
        ?.error
      return NextResponse.json(
        {
          error: {
            message: err?.message ?? `Could not read that image (${upstream.status}).`,
            type: err?.type ?? "upstream_error",
            code: err?.code ?? "upstream_error",
          },
        },
        { status: upstream.status }
      )
    }

    const description = (
      data as { choices?: Array<{ message?: { content?: string } }> } | null
    )?.choices?.[0]?.message?.content?.trim()

    if (!description) {
      return NextResponse.json(
        {
          error: {
            message: "The vision model returned an empty description.",
            type: "upstream_error",
            code: "empty_description",
          },
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ description, model: VISION_MODEL })
  } catch (error) {
    console.error("Image describe error:", error)
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
