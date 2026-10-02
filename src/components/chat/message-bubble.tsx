"use client"

import * as React from "react"
import { AlertCircle, Check, Copy, RotateCw, Wrench } from "lucide-react"

import { MessageContent } from "@/components/chat/message-content"
import type { ChatMessage } from "@/lib/chat"
import { cn } from "@/lib/utils"

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<number | null>(null)

  React.useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    []
  )

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true)
            if (timer.current) window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => setCopied(false), 1600)
          })
          .catch(() => undefined)
      }}
      aria-label={copied ? "Copied" : "Copy message"}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground",
        "opacity-0 transition-[opacity,background-color,color] duration-200 ease-out-expo",
        "hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "group-hover/message:opacity-100",
        copied && "opacity-100 text-success"
      )}
    >
      {copied ? (
        <Check aria-hidden className="h-3.5 w-3.5" />
      ) : (
        <Copy aria-hidden className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

export function MessageBubble({
  message,
  streaming = false,
  onRetry,
}: {
  message: ChatMessage
  streaming?: boolean
  onRetry?: () => void
}) {
  const isUser = message.role === "user"
  const failed = Boolean(message.error)

  return (
    <div
      className={cn(
        "group/message flex animate-rise-in gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "flex min-w-0 max-w-[85%] flex-col gap-2 sm:max-w-[78%]",
          isUser && "items-end"
        )}
      >
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div
            className={cn(
              "flex w-full flex-wrap gap-1.5",
              !message.content && "rounded-xl border border-border/60 bg-muted/40 px-3 py-2"
            )}
          >
            {message.toolCalls.map((call) => (
              <span
                key={call.id || call.name}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2 py-1 font-mono text-[11px] text-muted-foreground"
              >
                <Wrench aria-hidden className="h-3 w-3" />
                {call.name}(
                {call.arguments.length > 48
                  ? `${call.arguments.slice(0, 48)}…`
                  : call.arguments}
                )
              </span>
            ))}
          </div>
        )}

        {message.attachments && message.attachments.length > 0 && (
          <div
            className={cn(
              "flex flex-wrap gap-1.5",
              isUser && "justify-end"
            )}
          >
            {message.attachments.map((attachment, index) => (
              <a
                key={`${attachment.name}-${index}`}
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "block overflow-hidden rounded-xl border border-border/60",
                  "transition-[transform,opacity] duration-200 ease-out-expo hover:opacity-90",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                {/* Attachments are data URLs, which the next/image optimizer
                    cannot process. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="h-28 w-28 object-cover"
                />
              </a>
            ))}
          </div>
        )}

        <div
          className={cn(
            "rounded-2xl px-4 py-2.5",
            "transition-colors duration-200 ease-out-expo",
            isUser
              ? "rounded-br-md bg-primary text-primary-foreground shadow-soft"
              : "rounded-bl-md border border-border/60 bg-muted/50 text-foreground",
            failed && "border-destructive/40 bg-destructive/10"
          )}
        >
          {failed ? (
            <div className="flex items-start gap-2 text-sm">
              <AlertCircle
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
              />
              <div className="min-w-0">
                <p className="font-medium text-destructive">Request failed</p>
                <p className="mt-1 break-words text-destructive/90">
                  {message.error}
                </p>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className={cn(
                      "mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-destructive px-3 text-xs font-medium text-destructive-foreground",
                      "transition-[filter,transform] duration-200 ease-out-expo hover:brightness-110 active:scale-[0.98]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    )}
                  >
                    <RotateCw aria-hidden className="h-3.5 w-3.5" />
                    Retry
                  </button>
                )}
              </div>
            </div>
          ) : message.content ? (
            <>
              <MessageContent content={message.content} streaming={streaming} />
              {streaming && (
                <span
                  aria-hidden
                  className="ml-0.5 inline-block h-4 w-[2px] animate-caret-blink bg-primary align-middle"
                />
              )}
            </>
          ) : (
            /* Placeholder while the first tokens arrive. */
            <span
              role="status"
              aria-label="Assistant is responding"
              className="flex items-center gap-1.5 py-1"
            >
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60"
                  style={{ animationDelay: `${dot * 160}ms` }}
                />
              ))}
            </span>
          )}
        </div>

        {!isUser && !failed && !streaming && message.content && (
          <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 ease-out-expo group-hover/message:opacity-100 focus-within:opacity-100">
            <CopyButton text={message.content} />
          </div>
        )}
      </div>
    </div>
  )
}
