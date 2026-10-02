"use client"

import * as React from "react"

import { CodeBlock } from "@/components/chat/code-block"
import { parseInline, parseMarkdown, type InlineNode } from "@/lib/markdown"
import { cn } from "@/lib/utils"

const HEADING_CLASSES: Record<number, string> = {
  1: "mt-5 mb-2 text-lg font-semibold tracking-tight",
  2: "mt-5 mb-2 text-base font-semibold tracking-tight",
  3: "mt-4 mb-1.5 text-[15px] font-semibold tracking-tight",
  4: "mt-4 mb-1.5 text-sm font-semibold tracking-tight",
  5: "mt-3 mb-1 text-sm font-semibold",
  6: "mt-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
}

const ALIGN_CLASSES = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const

function renderInline(nodes: InlineNode[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`

    switch (node.type) {
      case "text":
        return <span key={key}>{node.text}</span>

      case "code":
        return (
          <code
            key={key}
            className="rounded-md border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
          >
            {node.text}
          </code>
        )

      case "strong":
        return (
          <strong key={key} className="font-semibold text-foreground">
            {renderInline(node.children, key)}
          </strong>
        )

      case "em":
        return <em key={key}>{renderInline(node.children, key)}</em>

      case "del":
        return (
          <del key={key} className="text-muted-foreground">
            {renderInline(node.children, key)}
          </del>
        )

      case "link":
        return (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors duration-200 ease-out-expo hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {renderInline(node.children, key)}
          </a>
        )

      case "break":
        return <br key={key} />

      default:
        return null
    }
  })
}

/**
 * Renders a completed assistant reply as Markdown.
 *
 * While tokens are still streaming the caller passes `streaming` and we show
 * plain text instead: re-parsing on every token makes the text reflow
 * mid-word, which reads worse than a caret on a wall of plain text.
 */
export function MessageContent({
  content,
  streaming = false,
  className,
}: {
  content: string
  streaming?: boolean
  className?: string
}) {
  const blocks = React.useMemo(
    () => (streaming ? [] : parseMarkdown(content)),
    [content, streaming]
  )

  if (streaming) {
    return (
      <p
        className={cn(
          "whitespace-pre-wrap break-words text-sm leading-7 text-foreground",
          className
        )}
      >
        {content}
      </p>
    )
  }

  return (
    <div
      className={cn(
        "space-y-3 text-sm leading-7 text-foreground [&_p]:text-pretty",
        className
      )}
    >
      {blocks.map((block, index) => {
        const key = `block-${index}`

        switch (block.type) {
          case "code":
            return <CodeBlock key={key} code={block.code} lang={block.lang} />

          case "heading": {
            const Tag = `h${block.level}` as "h1"
            return (
              <Tag key={key} className={HEADING_CLASSES[block.level]}>
                {renderInline(parseInline(block.text), key)}
              </Tag>
            )
          }

          case "paragraph":
            return (
              <p key={key}>
                {renderInline(parseInline(block.text), key)}
              </p>
            )

          case "list":
            return block.ordered ? (
              <ol
                key={key}
                className="list-decimal space-y-1.5 pl-5 marker:text-muted-foreground"
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>
                    {renderInline(parseInline(item), `${key}-${itemIndex}`)}
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={key} className="space-y-1.5 pl-5">
                {block.items.map((item, itemIndex) => (
                  <li
                    key={`${key}-${itemIndex}`}
                    className="relative before:absolute before:-left-4 before:top-[0.7em] before:h-1 before:w-1 before:rounded-full before:bg-primary/50"
                  >
                    {renderInline(parseInline(item), `${key}-${itemIndex}`)}
                  </li>
                ))}
              </ul>
            )

          case "quote":
            return (
              <blockquote
                key={key}
                className="border-l-2 border-primary/40 pl-3.5 text-muted-foreground [&_p]:text-pretty"
              >
                {renderInline(parseInline(block.text), key)}
              </blockquote>
            )

          case "table":
            return (
              <div key={key} className="scroll-slim overflow-x-auto">
                <table className="w-full min-w-[20rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border/70">
                      {block.header.map((cell, cellIndex) => (
                        <th
                          key={`${key}-th-${cellIndex}`}
                          className={cn(
                            "whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                            ALIGN_CLASSES[block.align[cellIndex] ?? "left"]
                          )}
                        >
                          {renderInline(
                            parseInline(cell),
                            `${key}-th-${cellIndex}`
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr
                        key={`${key}-tr-${rowIndex}`}
                        className="border-b border-border/40 last:border-0"
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`${key}-td-${rowIndex}-${cellIndex}`}
                            className={cn(
                              "px-3 py-2 align-top",
                              ALIGN_CLASSES[block.align[cellIndex] ?? "left"]
                            )}
                          >
                            {renderInline(
                              parseInline(cell),
                              `${key}-td-${rowIndex}-${cellIndex}`
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )

          case "hr":
            return <hr key={key} className="border-border/60" />

          default:
            return null
        }
      })}
    </div>
  )
}
