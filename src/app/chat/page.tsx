"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Eraser, EyeOff, PanelLeft, Settings2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import { ChatComposer } from "@/components/chat/chat-composer"
import { ConversationList } from "@/components/chat/conversation-list"
import { MessageBubble } from "@/components/chat/message-bubble"
import { Button } from "@/components/ui/button"
import { ModelPicker } from "@/components/ui/model-picker"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  createConversation,
  createId,
  loadActiveId,
  loadConversations,
  NEW_CONVERSATION_TITLE,
  saveActiveId,
  saveConversations,
  type ChatMessage,
  type Conversation,
  type StreamStats,
} from "@/lib/chat"
import { streamChatReply, type ContentPart, type WireTurn } from "@/lib/chat-client"
import type { Attachment } from "@/lib/image"
import { toPlainText } from "@/lib/markdown"
import {
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL,
  findModel,
  suggestedVisionModel,
  supportsVision,
} from "@/lib/models"
import { CHAT_TOOLS, runTool } from "@/lib/tools"
import { cn } from "@/lib/utils"

const DEFAULT_SYSTEM_PROMPT =
  "You are a concise, friendly assistant. Prefer short answers unless asked for detail."

const STARTERS = [
  "Explain quantum computing in Hindi",
  "Write a haiku about network latency",
  "Compare a mutex and a channel in Rust",
  "Draft a two-sentence standup update",
]

const IMAGE_CONTEXT_KEY = "callmissed:image-context"

/** Guards against a model looping on tool calls. */
const MAX_TOOL_DEPTH = 1

/** Stable empty array so derived dependencies never change identity. */
const NO_MESSAGES: ChatMessage[] = []

export default function ChatPage() {
  const router = useRouter()

  const [conversations, setConversations] = React.useState<Conversation[]>([])
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [hydrated, setHydrated] = React.useState(false)

  const [input, setInput] = React.useState("")
  const [model, setModel] = React.useState(DEFAULT_CHAT_MODEL)
  const [temperature, setTemperature] = React.useState(0.7)
  const [jsonMode, setJsonMode] = React.useState(false)
  const [toolsEnabled, setToolsEnabled] = React.useState(false)
  const [systemPrompt, setSystemPrompt] = React.useState(DEFAULT_SYSTEM_PROMPT)
  const [showSystem, setShowSystem] = React.useState(false)

  const [streaming, setStreaming] = React.useState(false)
  const [stats, setStats] = React.useState<StreamStats>(null)
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [imageContext, setImageContext] = React.useState<string | null>(null)
  const [attachments, setAttachments] = React.useState<Attachment[]>([])

  const abortRef = React.useRef<AbortController | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  const active = React.useMemo(
    () => conversations.find((item) => item.id === activeId) ?? null,
    [conversations, activeId]
  )
  const messages = active?.messages ?? NO_MESSAGES

  /* ---------------------------------------------------------------------- */
  /* Persistence                                                            */
  /* ---------------------------------------------------------------------- */

  React.useEffect(() => {
    const stored = loadConversations()
    if (stored.length > 0) {
      const storedActive = loadActiveId()
      setConversations(stored)
      setActiveId(
        stored.some((conversation) => conversation.id === storedActive)
          ? storedActive
          : stored[0].id
      )
    } else {
      const conversation = createConversation()
      setConversations([conversation])
      setActiveId(conversation.id)
    }
    setHydrated(true)
  }, [])

  React.useEffect(() => {
    if (!hydrated) return
    saveConversations(conversations)
    saveActiveId(activeId)
  }, [conversations, activeId, hydrated])

  // Pick up an image handed over from the Images page.
  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(IMAGE_CONTEXT_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { prompt?: string }
      if (parsed.prompt) setImageContext(parsed.prompt)
    } catch {
      // Malformed handoff — ignore it.
    }
  }, [])

  const dismissImageContext = React.useCallback(() => {
    setImageContext(null)
    try {
      window.sessionStorage.removeItem(IMAGE_CONTEXT_KEY)
    } catch {
      // Ignore storage failures.
    }
  }, [])

  React.useEffect(() => () => abortRef.current?.abort(), [])

  /* ---------------------------------------------------------------------- */
  /* Scrolling                                                              */
  /* ---------------------------------------------------------------------- */

  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  /* ---------------------------------------------------------------------- */
  /* Conversation actions                                                   */
  /* ---------------------------------------------------------------------- */

  const patchConversation = React.useCallback(
    (id: string, updater: (conversation: Conversation) => Conversation) => {
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === id ? updater(conversation) : conversation
        )
      )
    },
    []
  )

  const newConversation = React.useCallback((): string => {
    // Reuse an untouched empty chat instead of stacking duplicates.
    const empty = conversations.find(
      (conversation) => conversation.messages.length === 0
    )
    if (empty) {
      setActiveId(empty.id)
      return empty.id
    }

    const conversation = createConversation()
    setConversations((prev) => [conversation, ...prev])
    setActiveId(conversation.id)
    return conversation.id
  }, [conversations])

  const renameConversation = React.useCallback(
    (id: string, title: string) => {
      patchConversation(id, (conversation) => ({
        ...conversation,
        title,
        updatedAt: Date.now(),
      }))
      toast.success("Conversation renamed", { description: title })
    },
    [patchConversation]
  )

  const deleteConversation = React.useCallback(
    (id: string) => {
      const target = conversations.find((conversation) => conversation.id === id)
      if (!target) return

      const remaining = conversations.filter((item) => item.id !== id)
      setConversations(remaining)
      if (activeId === id) setActiveId(remaining[0]?.id ?? null)

      toast.success("Conversation deleted", {
        description: target.title,
        action: {
          label: "Undo",
          onClick: () => {
            setConversations((prev) => [target, ...prev])
            setActiveId(target.id)
          },
        },
      })
    },
    [activeId, conversations]
  )

  const clearConversation = React.useCallback(() => {
    if (!activeId) return
    abortRef.current?.abort()
    patchConversation(activeId, (conversation) => ({
      ...conversation,
      title: NEW_CONVERSATION_TITLE,
      messages: [],
      updatedAt: Date.now(),
    }))
    setStats(null)
    inputRef.current?.focus()
    toast.info("Conversation cleared")
  }, [activeId, patchConversation])

  const stop = React.useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
    setStats(null)
  }, [])

  /* ---------------------------------------------------------------------- */
  /* One assistant turn                                                     */
  /* ---------------------------------------------------------------------- */

  const runTurn = React.useCallback(
    async (targetId: string, turns: WireTurn[], depth = 0) => {
      const assistantId = createId()

      patchConversation(targetId, (conversation) => ({
        ...conversation,
        updatedAt: Date.now(),
        messages: [
          ...conversation.messages,
          {
            id: assistantId,
            role: "assistant",
            content: "",
            createdAt: Date.now(),
          },
        ],
      }))

      const controller = new AbortController()
      abortRef.current = controller

      const setAssistant = (patch: Partial<ChatMessage>) => {
        patchConversation(targetId, (conversation) => ({
          ...conversation,
          updatedAt: Date.now(),
          messages: conversation.messages.map((message) =>
            message.id === assistantId ? { ...message, ...patch } : message
          ),
        }))
      }

      try {
        const { text, toolCalls } = await streamChatReply({
          model,
          temperature,
          jsonMode,
          ...(toolsEnabled ? { tools: CHAT_TOOLS } : {}),
          turns: [
            ...(systemPrompt.trim()
              ? [{ role: "system" as const, content: systemPrompt.trim() }]
              : []),
            ...turns,
          ],
          signal: controller.signal,
          onText: (value) => setAssistant({ content: value }),
          onStats: setStats,
        })

        setAssistant({ content: text, toolCalls })

        // Tool round trip: feed the results back so the model can finish.
        if (toolCalls.length > 0 && depth < MAX_TOOL_DEPTH) {
          await runTurn(
            targetId,
            [
              ...turns,
              {
                role: "assistant",
                content: text,
                tool_calls: toolCalls.map((call) => ({
                  id: call.id,
                  type: "function" as const,
                  function: { name: call.name, arguments: call.arguments },
                })),
              },
              ...toolCalls.map((call) => ({
                role: "tool" as const,
                content: runTool(call.name, call.arguments),
                tool_call_id: call.id || call.name,
                name: call.name,
              })),
            ],
            depth + 1
          )
          return
        }

        if (!text.trim() && toolCalls.length === 0) {
          throw new Error("The model returned an empty response.")
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return

        const message =
          error instanceof Error ? error.message : "Unknown error"
        setAssistant({ error: message })
        toast.error("Chat request failed", { description: message })
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        setStreaming(false)
        setStats(null)
      }
    },
    [
      jsonMode,
      model,
      patchConversation,
      systemPrompt,
      temperature,
      toolsEnabled,
    ]
  )

  /**
   * Turns stored messages into upstream turns.
   *
   * A user message with attachments becomes a multimodal part array so the
   * model actually sees the image. Attachments are dropped for models that
   * reject image input, with a warning rather than a silent text-only send.
   */
  const toWireTurns = React.useCallback(
    (history: ChatMessage[]): WireTurn[] =>
      history
        .filter((message) => !message.error)
        .map(({ role, content, attachments: images }) => {
          if (role === "user" && images && images.length > 0) {
            if (!supportsVision(model)) {
              return { role, content }
            }
            const parts: ContentPart[] = []
            // Text first, then images: matches how the vision models are
            // trained to read a prompt alongside its attachments.
            if (content.trim()) parts.push({ type: "text", text: content })
            for (const image of images) {
              parts.push({ type: "image_url", image_url: { url: image.url } })
            }
            return { role, content: parts }
          }
          return { role, content }
        }),
    [model]
  )

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      const staged = attachments
      if ((!trimmed && staged.length === 0) || streaming) return

      // The model must be able to read the images, or the send is pointless.
      if (staged.length > 0 && !supportsVision(model)) {
        const suggestion = suggestedVisionModel(model)
        toast.error(`${findModel(CHAT_MODELS, model)?.label ?? model} cannot read images`, {
          description: suggestion
            ? `Switch to ${suggestion.label} to send image attachments.`
            : "Pick a vision-capable model to send image attachments.",
        })
        return
      }

      const targetId = activeId ?? newConversation()
      const target = conversations.find(
        (conversation) => conversation.id === targetId
      )
      const history: ChatMessage[] = target?.messages ?? []
      const next: ChatMessage[] = [
        ...history,
        {
          id: createId(),
          role: "user",
          content: trimmed,
          createdAt: Date.now(),
          ...(staged.length > 0 ? { attachments: staged } : {}),
        },
      ]

      patchConversation(targetId, (conversation) => ({
        ...conversation,
        title:
          conversation.title === NEW_CONVERSATION_TITLE
            ? toPlainText(trimmed, 40) ||
              (staged.length > 0 ? "Image" : NEW_CONVERSATION_TITLE)
            : conversation.title,
        updatedAt: Date.now(),
        messages: next,
      }))

      setInput("")
      setAttachments([])
      setStats(null)
      setStreaming(true)

      await runTurn(targetId, toWireTurns(next))
    },
    [
      activeId,
      attachments,
      conversations,
      model,
      newConversation,
      patchConversation,
      runTurn,
      streaming,
      toWireTurns,
    ]
  )

  const retry = React.useCallback(
    (messageId: string) => {
      if (streaming || !activeId) return

      const history = messages
        .filter((message) => message.id !== messageId)
        .filter((message) => !message.error)

      patchConversation(activeId, (conversation) => ({
        ...conversation,
        messages: history,
        updatedAt: Date.now(),
      }))

      setStreaming(true)
      void runTurn(activeId, toWireTurns(history))
    },
    [activeId, messages, patchConversation, runTurn, streaming, toWireTurns]
  )

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  const lastId = messages[messages.length - 1]?.id
  const empty = messages.length === 0

  const currentModelLabel = findModel(CHAT_MODELS, model)?.label ?? model
  const visionReady = supportsVision(model)
  const visionSuggestion = React.useMemo(
    () => suggestedVisionModel(model),
    [model]
  )

  const conversationItems = React.useMemo(
    () =>
      conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updatedAt,
        messageCount: conversation.messages.length,
      })),
    [conversations]
  )

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border/60 bg-card/40">
      <ConversationList
        conversations={conversationItems}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id)
          setSidebarOpen(false)
        }}
        onCreate={() => {
          newConversation()
          setSidebarOpen(false)
        }}
        onRename={renameConversation}
        onDelete={deleteConversation}
      />
    </div>
  )

  return (
    <div className="container-page py-6 sm:py-8">
      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-6">
        {/* Sidebar — sticky column on desktop, drawer on mobile. */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 h-[calc(100dvh-9rem)]">{sidebar}</div>
        </aside>

        <div className="flex min-w-0 flex-col gap-3">
          {/* Top bar */}
          <div className="rounded-2xl border border-border/60 bg-card/60 p-3 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open conversations"
                  className="lg:hidden"
                >
                  <PanelLeft aria-hidden className="h-4 w-4" />
                </Button>

                <ModelPicker
                  models={CHAT_MODELS}
                  value={model}
                  onChange={setModel}
                  disabled={streaming}
                  variant="compact"
                  className="min-w-0 flex-1 sm:w-56 sm:flex-none"
                />
              </div>

              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-5">
                <div className="flex items-center gap-2.5 sm:w-40">
                  <label
                    htmlFor="temperature"
                    className="shrink-0 text-xs font-medium text-muted-foreground"
                  >
                    Temp
                  </label>
                  <Slider
                    id="temperature"
                    aria-label="Temperature"
                    value={temperature}
                    onValueChange={setTemperature}
                    min={0}
                    max={2}
                    step={0.1}
                    disabled={streaming}
                    className="flex-1"
                  />
                </div>

                <div className="flex items-center gap-4 sm:gap-5">
                  <ControlToggle
                    id="json-mode"
                    label="JSON"
                    checked={jsonMode}
                    onCheckedChange={setJsonMode}
                    disabled={streaming}
                  />
                  <ControlToggle
                    id="tools-mode"
                    label="Tools"
                    checked={toolsEnabled}
                    onCheckedChange={setToolsEnabled}
                    disabled={streaming}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Chat container */}
          <div className="flex h-[70vh] min-h-[26rem] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-soft sm:min-h-[30rem]">
            <div
              ref={scrollRef}
              role="log"
              aria-live="polite"
              aria-label="Conversation"
              className="scroll-slim flex-1 overflow-y-auto px-4 py-5 sm:px-6"
            >
              {empty ? (
                <EmptyState onPick={(starter) => void send(starter)} />
              ) : (
                <div className="flex flex-col gap-5">
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      streaming={streaming && message.id === lastId}
                      onRetry={
                        message.error ? () => retry(message.id) : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-border/60 bg-background/40 p-2.5 backdrop-blur sm:p-3">
              {attachments.length > 0 && !visionReady && (
                <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2">
                  <EyeOff aria-hidden className="h-3.5 w-3.5 shrink-0 text-warning" />
                  <p className="min-w-0 flex-1 text-xs text-foreground">
                    {currentModelLabel} can&apos;t read images.
                  </p>
                  {visionSuggestion && (
                    <Button
                      size="xs"
                      onClick={() => setModel(visionSuggestion.value)}
                      className="shrink-0"
                    >
                      Use {visionSuggestion.label}
                    </Button>
                  )}
                </div>
              )}

              {imageContext && (
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/25 bg-accent/60 px-3 py-2">
                  <Sparkles
                    aria-hidden
                    className="h-3.5 w-3.5 shrink-0 text-accent-foreground"
                  />
                  <p className="min-w-0 flex-1 truncate text-xs text-accent-foreground">
                    Image context: {imageContext}
                  </p>
                  <button
                    type="button"
                    onClick={dismissImageContext}
                    aria-label="Dismiss image context"
                    className="shrink-0 rounded-md p-0.5 text-accent-foreground transition-colors duration-200 hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X aria-hidden className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="rounded-2xl border border-border/70 bg-background/60 shadow-soft transition-[border-color,box-shadow] duration-200 ease-out-expo focus-within:border-primary/50 focus-within:shadow-lift">
                <div className="flex items-center gap-1 border-b border-border/60 px-2.5 py-1.5">
                  <ToolbarButton
                    active={showSystem}
                    onClick={() => setShowSystem((value) => !value)}
                    aria-expanded={showSystem}
                    aria-controls="system-prompt"
                  >
                    <Settings2 aria-hidden className="h-3.5 w-3.5" />
                    System
                  </ToolbarButton>

                  <ToolbarButton onClick={() => router.push("/images")}>
                    <Sparkles aria-hidden className="h-3.5 w-3.5" />
                    Images
                  </ToolbarButton>

                  {!empty && (
                    <button
                      type="button"
                      onClick={clearConversation}
                      disabled={streaming}
                      aria-label="Clear conversation"
                      title="Clear conversation"
                      className={cn(
                        "ml-auto inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground",
                        "transition-colors duration-200 ease-out-expo hover:bg-accent hover:text-accent-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "disabled:pointer-events-none disabled:opacity-40"
                      )}
                    >
                      <Eraser aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {showSystem && (
                  <div
                    id="system-prompt"
                    className="border-b border-border/60 px-3 pb-1 pt-2"
                  >
                    <label
                      htmlFor="system"
                      className="mb-1 block text-xs font-medium text-muted-foreground"
                    >
                      System prompt
                    </label>
                    <Textarea
                      id="system"
                      value={systemPrompt}
                      onChange={(event) => setSystemPrompt(event.target.value)}
                      placeholder="Optional system prompt"
                      className="min-h-[64px] resize-none border-0 bg-transparent p-0 shadow-none focus-visible:border-transparent focus-visible:ring-0"
                    />
                  </div>
                )}

                <ChatComposer
                  value={input}
                  onChange={setInput}
                  onSend={() => void send(input)}
                  onStop={stop}
                  streaming={streaming}
                  inputRef={inputRef}
                  attachments={attachments}
                  onAttachmentsChange={setAttachments}
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 px-1">
                <p className="text-[11px] text-muted-foreground">
                  Enter to send · Shift + Enter for a new line
                </p>
                {streaming && stats && (
                  <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {stats.tps} tok/s · {stats.chars} chars
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile conversation drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0">
          <SheetHeader>
            <SheetTitle>Conversations</SheetTitle>
            <SheetDescription>
              Start a new chat or switch between threads.
            </SheetDescription>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function ToolbarButton({
  active = false,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium",
        "transition-colors duration-200 ease-out-expo",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function ControlToggle({
  id,
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
      <label
        htmlFor={id}
        className={cn(
          "cursor-pointer select-none text-xs font-medium text-muted-foreground",
          "transition-colors duration-200 ease-out-expo hover:text-foreground",
          checked && "text-foreground"
        )}
      >
        {label}
      </label>
    </div>
  )
}

function EmptyState({ onPick }: { onPick: (starter: string) => void }) {
  return (
    <div className="flex h-full flex-col justify-center py-4">
      <h2 className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">
        Ask anything.
      </h2>
      <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
        Try:{" "}
        <span className="text-foreground">
          “Explain quantum computing in Hindi”
        </span>
      </p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {STARTERS.map((starter) => (
          <button
            key={starter}
            type="button"
            onClick={() => onPick(starter)}
            className={cn(
              "rounded-xl border border-border/60 bg-card/60 px-3.5 py-3 text-left text-sm",
              "transition-[transform,border-color,background-color] duration-200 ease-out-expo",
              "hover:-translate-y-px hover:border-border hover:bg-accent/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            {starter}
          </button>
        ))}
      </div>
    </div>
  )
}
