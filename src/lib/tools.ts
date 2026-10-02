/**
 * One built-in function for the chat "Tools" toggle.
 *
 * The tool is executed locally in the browser and the result is fed back to
 * the model as a `tool` turn, so the demo shows a real tool-call round trip
 * without needing a server-side tool runtime.
 */

export type ToolDefinition = {
  type: "function"
  function: {
    name: string
    description: string
    parameters: {
      type: "object"
      properties: Record<string, { type: string; description: string }>
      required?: string[]
    }
  }
}

export const CHAT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_current_time",
      description:
        "Return the current date and time. Use this whenever the user asks what time it is, what day it is, or asks you to stamp something with the current date.",
      parameters: {
        type: "object",
        properties: {
          timezone: {
            type: "string",
            description:
              'IANA timezone such as "Europe/Berlin" or "Asia/Kolkata". Defaults to UTC.',
          },
        },
      },
    },
  },
]

/**
 * Runs a tool by name. Returns a JSON string, because OpenAI-compatible
 * endpoints expect the tool message content to be a string.
 */
export function runTool(name: string, rawArguments: string): string {
  if (name !== "get_current_time") {
    return JSON.stringify({ error: `Unknown tool: ${name}` })
  }

  let timezone = "UTC"
  try {
    const args = rawArguments ? (JSON.parse(rawArguments) as { timezone?: string }) : {}
    if (typeof args.timezone === "string" && args.timezone.trim()) {
      timezone = args.timezone.trim()
    }
  } catch {
    // Malformed arguments — fall back to UTC rather than failing the turn.
  }

  try {
    const now = new Date()
    const formatted = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "medium",
    }).format(now)

    return JSON.stringify({
      timezone,
      iso: now.toISOString(),
      formatted,
    })
  } catch {
    // An invalid IANA zone throws — report it so the model can recover.
    return JSON.stringify({ error: `Unknown timezone: ${timezone}` })
  }
}
