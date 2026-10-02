/**
 * Shared chat types and lightweight conversation storage.
 *
 * Conversations live in `localStorage` so the demo survives a reload without
 * needing a database. Nothing here contains secrets — the API key is read
 * only by the server-side route handlers.
 */

import { MAX_PERSISTED_ATTACHMENTS, type Attachment } from "@/lib/image"

export type ChatRole = "user" | "assistant"

export type ToolCall = {
  id: string
  name: string
  arguments: string
}

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  /** Set when the request failed; the bubble renders a Retry action. */
  error?: string
  /** Tool calls the model emitted before this (final) reply. */
  toolCalls?: ToolCall[]
  /**
   * Images the user attached, as downscaled data URLs. Only sent to models
   * that accept image input — see `supportsVision` in the model catalogue.
   */
  attachments?: Attachment[]
}

export type Conversation = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

export const STORAGE_KEY = "callmissed:conversations"
export const ACTIVE_KEY = "callmissed:active-conversation"
export const MAX_CONVERSATIONS = 40

export const NEW_CONVERSATION_TITLE = "New chat"

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function createConversation(): Conversation {
  const now = Date.now()
  return {
    id: createId(),
    title: NEW_CONVERSATION_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: [],
  }
}

function isConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<Conversation>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.messages)
  )
}

/** Returns only well-formed conversations, newest first. */
export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(isConversation)
      .map((conversation) => ({
        ...conversation,
        createdAt: conversation.createdAt ?? Date.now(),
        updatedAt: conversation.updatedAt ?? conversation.createdAt ?? Date.now(),
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONVERSATIONS)
  } catch {
    // Corrupt payload or storage disabled — start clean rather than crash.
    return []
  }
}

export function saveConversations(conversations: Conversation[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimAttachments(conversations)))
  } catch {
    // Quota exceeded or private mode — the in-memory state still works.
  }
}

/**
 * Keeps attachment bytes for only the most recent image-bearing turns.
 *
 * A single downscaled screenshot is ~100 KB of base64, so persisting every
 * image in every one of the 40 stored conversations would blow the ~5 MB
 * `localStorage` quota within a few messages. Older turns keep their text and
 * simply lose the picture, which is a fair trade for reliable persistence.
 */
function trimAttachments(conversations: Conversation[]): Conversation[] {
  let budget = MAX_PERSISTED_ATTACHMENTS

  return conversations.map((conversation) => ({
    ...conversation,
    messages: conversation.messages.map((message) => {
      if (!message.attachments?.length) return message
      if (budget <= 0) {
        const trimmed = { ...message }
        delete trimmed.attachments
        return trimmed
      }
      budget -= message.attachments.length
      return message
    }),
  }))
}

export function loadActiveId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function saveActiveId(id: string | null) {
  if (typeof window === "undefined") return
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id)
    else window.localStorage.removeItem(ACTIVE_KEY)
  } catch {
    // Ignore storage failures.
  }
}

export type StreamStats = { tps: number; chars: number } | null
