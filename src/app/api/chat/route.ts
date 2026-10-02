import { NextRequest, NextResponse } from "next/server"

const API_BASE = "https://api.callmissed.com/v1"
const DEFAULT_MODEL = "sarvam-105b"

// Streaming + auth header require the Node runtime.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ChatMessage = {
  role: string
  content: string
}

function missingKeyResponse() {
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

/** Forwards the upstream error envelope so the client can show the real reason. */
async function upstreamError(response: Response) {
  const body = ((await response.json().catch(() => null)) ?? {}) as {
    error?: { message?: string; type?: string; code?: string }
  }

  return NextResponse.json(
    {
      error: {
        message:
          body.error?.message ?? `Upstream request failed (${response.status}).`,
        type: body.error?.type ?? "upstream_error",
        code: body.error?.code ?? "upstream_error",
      },
    },
    { status: response.status }
  )
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.CALLMISSED_API_KEY
  if (!apiKey) return missingKeyResponse()

  let body: {
    model?: string
    messages?: ChatMessage[]
    stream?: boolean
    temperature?: number
    max_tokens?: number
  }

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
    messages,
    stream = false,
    temperature,
    max_tokens,
  } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: { message: "`messages` must be a non-empty array." } },
      { status: 400 }
    )
  }

  try {
    const upstream = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream,
        ...(temperature === undefined ? {} : { temperature }),
        ...(max_tokens === undefined ? {} : { max_tokens }),
      }),
    })

    if (!upstream.ok) return upstreamError(upstream)

    if (stream) {
      const reader = upstream.body?.getReader()
      if (!reader) {
        return NextResponse.json(
          { error: { message: "Upstream returned an empty stream." } },
          { status: 502 }
        )
      }

      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              controller.enqueue(value)
            }
          } catch (error) {
            console.error("Chat stream error:", error)
          } finally {
            controller.close()
          }
        },
        cancel() {
          void reader.cancel().catch(() => undefined)
        },
      })

      return new NextResponse(streamResponse, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      })
    }

    const data = await upstream.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Failed to reach the CallMissed API.",
        },
        type: "upstream_unreachable",
        code: "upstream_error",
      },
      { status: 502 }
    )
  }
}