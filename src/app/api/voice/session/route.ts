import { NextRequest, NextResponse } from "next/server"

const API_BASE = "https://api.callmissed.com/v1"
const DEFAULT_SYSTEM_PROMPT =
  "You are a friendly assistant for a demo app. Keep replies short and conversational."

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type VoiceSessionRequest = {
  system_prompt?: string
  config?: Record<string, unknown>
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

  let body: VoiceSessionRequest
  try {
    body = await req.json()
  } catch {
    // An empty body is fine — fall back to the default prompt.
    body = {}
  }

  const { system_prompt, config } = body ?? {}

  try {
    const upstream = await fetch(`${API_BASE}/voice/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_prompt: system_prompt?.trim() || DEFAULT_SYSTEM_PROMPT,
        ...(config
          ? { config }
          : {
              config: {
                enable_stt: true,
                enable_llm: true,
                enable_tts: true,
              },
            }),
      }),
    })

    const data = await upstream.json()

    if (!upstream.ok) {
      const err = (data as { error?: { message?: string; type?: string; code?: string } })
        .error
      return NextResponse.json(
        {
          error: {
            message: err?.message ?? `Voice session failed (${upstream.status}).`,
            type: err?.type ?? "upstream_error",
            code: err?.code ?? "upstream_error",
          },
        },
        { status: upstream.status }
      )
    }

    const session = data as { ws_url?: string; token?: string }
    if (!session?.ws_url || !session?.token) {
      return NextResponse.json(
        {
          error: {
            message: "Voice session response did not include ws_url and token.",
          },
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ ws_url: session.ws_url, token: session.token })
  } catch (error) {
    console.error("Voice session API error:", error)
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