/**
 * Minimal Server-Sent Events parser for streaming chat completions.
 *
 * The upstream sends OpenAI-compatible chunks:
 *   data: {"choices":[{"delta":{"content":"Hello"}}]}
 *   data: [DONE]
 *
 * Raw chunks must NOT be appended directly to the UI, otherwise the literal
 * `data: {...}` envelopes become visible text.
 */

export interface SseToolCallDelta {
  index?: number
  id?: string
  type?: string
  function?: { name?: string; arguments?: string }
}

/**
 * Splits an arbitrary stream chunk into SSE payloads, buffering any partial
 * trailing line between reads. Returns the complete `data:` values found and
 * leaves any incomplete remainder in `buffer`.
 */
export function extractSseData(
  buffer: string,
  chunk: string
): { data: string[]; buffer: string } {
  const combined = buffer + chunk
  const blocks = combined.split(/\r?\n\r?\n/)

  // The last block may be incomplete — keep it buffered for the next read.
  const remainder = blocks.pop() ?? ""
  const data: string[] = []

  for (const block of blocks) {
    for (const line of block.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue
      const value = line.slice(5).trim()
      if (value) data.push(value)
    }
  }

  return { data, buffer: remainder }
}

export interface SseDelta {
  content: string
  reasoning: string
  finishReason: string | null
  toolCalls: SseToolCallDelta[]
}

type StreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null
      reasoning_content?: string | null
      tool_calls?: SseToolCallDelta[] | null
    } | null
    finish_reason?: string | null
  }>
}

/**
 * Converts one raw SSE payload into plain text.
 * Returns null for `[DONE]` and unparseable payloads.
 */
export function parseSsePayload(payload: string): SseDelta | null {
  if (payload === "[DONE]") return null

  let parsed: StreamChunk
  try {
    parsed = JSON.parse(payload) as StreamChunk
  } catch {
    return null
  }

  const choice = parsed.choices?.[0]
  if (!choice) return null

  return {
    // Some providers send `null` for content on role-only chunks.
    content: choice.delta?.content ?? "",
    reasoning: choice.delta?.reasoning_content ?? "",
    finishReason: choice.finish_reason ?? null,
    toolCalls: choice.delta?.tool_calls ?? [],
  }
}

/**
 * Tool calls arrive as fragments keyed by `index`, each one adding to the
 * arguments string. This folds them into complete calls.
 */
export function accumulateToolCalls(
  fragments: SseToolCallDelta[]
): Map<number, { id: string; name: string; arguments: string }> {
  const accumulated = new Map<
    number,
    { id: string; name: string; arguments: string }
  >()

  const merge = (
    index: number,
    id: string | undefined,
    name: string | undefined,
    args: string | undefined
  ) => {
    const existing = accumulated.get(index)
    accumulated.set(index, {
      id: id ?? existing?.id ?? "",
      name: name ?? existing?.name ?? "",
      arguments: (existing?.arguments ?? "") + (args ?? ""),
    })
  }

  fragments.forEach((fragment, position) => {
    const index = fragment.index ?? position
    merge(
      index,
      fragment.id,
      fragment.function?.name,
      fragment.function?.arguments
    )
  })

  return accumulated
}
