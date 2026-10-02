"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Eraser, Send, Sparkles, Square } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { extractSseData, parseSsePayload } from "@/lib/sse"
import { cn } from "@/lib/utils"

const MODELS = [
  { value: "sarvam-105b", label: "sarvam-105b" },
  { value: "gpt-5.6-sol", label: "gpt-5.6-sol" },
  { value: "gemini-3.8-flash", label: "gemini-3.8-flash" },
  { value: "kimi-k2.5", label: "kimi-k2.5" },
  { value: "DeepSeek-V4-Pro", label: "DeepSeek-V4-Pro" },
  { value: "gpt-4o", label: "gpt-4o" },
] as const

const DEFAULT_SYSTEM_PROMPT =
  "You are a concise, friendly assistant. Prefer short answers unless asked for detail."

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
}

const SUGGESTIONS = [
  "Explain streaming LLMs in one paragraph",
  "Write a haiku about latency",
  "Give me three ideas for a weekend project",
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [model, setModel] = useState<string>("sarvam-105b")
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT)
  const [loading, setLoading] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Keep the newest message in view while tokens stream in.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
  }, [])

  const clear = useCallback(() => {
    stop()
    setMessages([])
    setInput("")
  }, [stop])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      }
      const assistantId = crypto.randomUUID()

      const history = [...messages, userMessage]
      setMessages([...history, { id: assistantId, role: "assistant", content: "" }])
      setInput("")
      setLoading(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            stream: true,
            messages: [
              ...(systemPrompt.trim()
                ? [{ role: "system", content: systemPrompt.trim() }]
                : []),
              ...history.map(({ role, content }) => ({ role, content })),
            ],
          }),
        })

        if (!res.ok || !res.body) {
          const detail = await res
            .json()
            .then((d: { error?: { message?: string } }) => d?.error?.message)
            .catch(() => undefined)
          throw new Error(detail || `Request failed (${res.status})`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        let buffer = ""
        let assistantText = ""
        let sawContent = false

        const appendTo = (text: string) => {
          assistantText += text
          const next = assistantText
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: next } : m))
          )
        }

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const { data, buffer: nextBuffer } = extractSseData(
            buffer,
            decoder.decode(value, { stream: true })
          )
          buffer = nextBuffer

          for (const payload of data) {
            const delta = parseSsePayload(payload)
            if (!delta) continue
            if (delta.content) {
              sawContent = true
              appendTo(delta.content)
            }
          }
        }

        // Drain a final partial line if the stream ended without a blank line.
        if (buffer.trim()) {
          for (const payload of extractSseData(buffer, "\n\n").data) {
            const delta = parseSsePayload(payload)
            if (delta?.content) {
              sawContent = true
              appendTo(delta.content)
            }
          }
        }

        if (!sawContent) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId && !m.content
                ? { ...m, content: "(no content returned)" }
                : m
            )
          )
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return

        const message =
          error instanceof Error ? error.message : "Unknown error"

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.content
              ? { ...m, content: `⚠️ ${message}` }
              : m
          )
        )
        toast.error("Chat request failed", { description: message })
      } finally {
        abortRef.current = null
        setLoading(false)
      }
    },
    [loading, messages, model, systemPrompt]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid gap-1.5 sm:w-56">
          <label htmlFor="model" className="text-sm font-medium text-muted-foreground">
            Model
          </label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger id="model">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid flex-1 gap-1.5">
          <label
            htmlFor="system"
            className="text-sm font-medium text-muted-foreground"
          >
            System prompt
          </label>
          <Textarea
            id="system"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="min-h-[40px] resize-none"
            placeholder="Optional system prompt"
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={clear}
          disabled={messages.length === 0 || loading}
          aria-label="Clear conversation"
          className="hidden sm:inline-flex"
        >
          <Eraser className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="h-[55vh] min-h-[320px] overflow-y-auto rounded-2xl border border-border/60 bg-card/40 p-4 sm:h-[60vh]"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-background">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium">Start a conversation</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Messages stream token by token from the selected model.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => {
              const isUser = m.role === "user"
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex",
                    isUser ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm sm:max-w-[75%]",
                      isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {m.content || (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void send(input)
            }
          }}
          placeholder="Type a message…  (Enter to send, Shift+Enter for a new line)"
          className="max-h-40 min-h-[44px] resize-none"
          disabled={loading}
        />

        {loading ? (
          <Button
            size="icon"
            variant="destructive"
            onClick={stop}
            aria-label="Stop generating"
            className="h-11 w-11 shrink-0"
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={() => void send(input)}
            disabled={!input.trim()}
            aria-label="Send message"
            className="h-11 w-11 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}