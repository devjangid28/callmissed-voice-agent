import {
  accumulateToolCalls,
  extractSseData,
  parseSsePayload,
} from "@/lib/sse"
import type { ToolCall } from "@/lib/chat"

/** An image part of a multimodal turn. */
export type ImagePart = { type: "image_url"; image_url: { url: string } }
export type TextPart = { type: "text"; text: string }
export type ContentPart = TextPart | ImagePart

/**
 * A single upstream turn. Mirrors the OpenAI-compatible message shape that
 * /api/chat forwards, including the optional `tool_calls` payload.
 *
 * `content` is a string for text-only turns and a part array for a user turn
 * that carries image attachments.
 */
export type WireTurn = {
  role: "system" | "user" | "assistant" | "tool"
  content: string | ContentPart[]
  name?: string
  tool_call_id?: string
  tool_calls?: Array<{
    id: string
    type: "function"
    function: { name: string; arguments: string }
  }>
}

export type StreamOptions = {
  model: string
  temperature: number
  jsonMode: boolean
  tools?: unknown[]
  turns: WireTurn[]
  signal: AbortSignal
  /** Called with the full accumulated text on every chunk. */
  onText: (text: string) => void
  onStats?: (stats: { tps: number; chars: number }) => void
}

export type StreamOutcome = {
  text: string
  toolCalls: ToolCall[]
}

/**
 * Streams one assistant reply from `/api/chat`.
 *
 * Raw SSE envelopes are decoded here rather than in the component so the UI
 * only ever receives plain text. The API key stays server-side — this module
 * only talks to our own route.
 */
export async function streamChatReply({
  model,
  temperature,
  jsonMode,
  tools,
  turns,
  signal,
  onText,
  onStats,
}: StreamOptions): Promise<StreamOutcome> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model,
      stream: true,
      temperature,
      jsonMode,
      ...(tools && tools.length > 0 ? { tools } : {}),
      messages: turns,
    }),
  })

  if (!response.ok || !response.body) {
    const detail = await response
      .json()
      .then((data: { error?: { message?: string } }) => data?.error?.message)
      .catch(() => undefined)
    throw new Error(detail || `Request failed (${response.status})`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  let buffer = ""
  let text = ""
  let startedAt: number | null = null
  const toolFragments = new Map<number, ToolCall>()

  const consume = (payload: string) => {
    const delta = parseSsePayload(payload)
    if (!delta) return

    if (delta.content) {
      if (startedAt === null) startedAt = performance.now()
      text += delta.content
      onText(text)

      // Approximate throughput: ~4 characters per token.
      const elapsed = (performance.now() - startedAt) / 1000
      if (elapsed > 0.15 && onStats) {
        onStats({
          chars: text.length,
          tps: Math.max(1, Math.round(text.length / 4 / elapsed)),
        })
      }
    }

    if (delta.toolCalls.length > 0) {
      for (const [index, call] of accumulateToolCalls(delta.toolCalls)) {
        toolFragments.set(index, call)
      }
    }
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const parsed = extractSseData(buffer, decoder.decode(value, { stream: true }))
    buffer = parsed.buffer
    parsed.data.forEach(consume)
  }

  // Drain a trailing partial line if the stream ended without a blank line.
  if (buffer.trim()) {
    extractSseData(buffer, "\n\n").data.forEach(consume)
  }

  return {
    text,
    toolCalls: [...toolFragments.values()].filter((call) => call.name),
  }
}
