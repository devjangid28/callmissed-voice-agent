"use client"

import * as React from "react"
import { MessageSquare, Pencil, Plus, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"

export type ConversationItem = {
  id: string
  title: string
  updatedAt: number
  messageCount: number
}

function relativeTime(timestamp: number) {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

/**
 * Conversation list for the chat sidebar.
 *
 * Rename is an inline edit rather than a dialog — it is a one-word action and
 * a modal would be heavier than the task. Delete is undoable from a toast so a
 * mis-click is never destructive.
 */
export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  className,
}: {
  conversations: ConversationItem[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  className?: string
}) {
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState("")

  const startRename = (id: string, title: string) => {
    setEditingId(id)
    setDraft(title === "New chat" ? "" : title)
  }

  const commitRename = (id: string) => {
    const next = draft.trim()
    setEditingId(null)
    if (next) onRename(id, next)
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="shrink-0 p-2 sm:p-3">
        <button
          type="button"
          onClick={onCreate}
          className={cn(
            "flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/60 text-sm font-medium",
            "transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out-expo",
            "hover:-translate-y-px hover:border-border hover:bg-accent hover:shadow-soft active:translate-y-0",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        >
          <Plus aria-hidden className="h-4 w-4" />
          New chat
        </button>
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-2 pb-2 sm:px-3 sm:pb-3">
        {conversations.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs leading-relaxed text-muted-foreground">
            No conversations yet.
            <br />
            Start one below.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeId
              const isEditing = editingId === conversation.id

              return (
                <li key={conversation.id}>
                  <div
                    className={cn(
                      "group/row relative flex items-center gap-1 rounded-xl pr-1 transition-colors duration-200 ease-out-expo",
                      isActive
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    )}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={draft}
                        placeholder="Conversation name"
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            commitRename(conversation.id)
                          }
                          if (event.key === "Escape") setEditingId(null)
                        }}
                        onBlur={() => commitRename(conversation.id)}
                        aria-label="Conversation name"
                        className={cn(
                          "my-1.5 h-8 w-full min-w-0 rounded-lg border border-primary/40 bg-background px-2 text-sm",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        )}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelect(conversation.id)}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "flex min-w-0 flex-1 items-start gap-2.5 rounded-xl px-2.5 py-2 text-left",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        )}
                      >
                        <MessageSquare
                          aria-hidden
                          className={cn(
                            "mt-0.5 h-3.5 w-3.5 shrink-0",
                            isActive
                              ? "text-accent-foreground"
                              : "text-muted-foreground"
                          )}
                        />

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {conversation.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {relativeTime(conversation.updatedAt)}
                            {conversation.messageCount > 0 &&
                              ` · ${conversation.messageCount} message${
                                conversation.messageCount === 1 ? "" : "s"
                              }`}
                          </span>
                        </span>
                      </button>
                    )}

                    {!isEditing && (
                      <span className="flex shrink-0 items-center gap-0.5">
                        <IconAction
                          label={`Rename ${conversation.title}`}
                          onClick={() =>
                            startRename(conversation.id, conversation.title)
                          }
                        >
                          <Pencil aria-hidden className="h-3.5 w-3.5" />
                        </IconAction>
                        <IconAction
                          label={`Delete ${conversation.title}`}
                          onClick={() => onDelete(conversation.id)}
                        >
                          <Trash2 aria-hidden className="h-3.5 w-3.5" />
                        </IconAction>
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground",
        "opacity-0 transition-[opacity,background-color,color] duration-200 ease-out-expo",
        "hover:bg-background hover:text-foreground hover:opacity-100",
        "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "group-hover/row:opacity-100 sm:h-7 sm:w-7"
      )}
    >
      {children}
    </button>
  )
}
