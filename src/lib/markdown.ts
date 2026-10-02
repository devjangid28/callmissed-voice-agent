/**
 * A small, dependency-free Markdown parser for chat output.
 *
 * Model replies are plain text with a few conventions worth honouring:
 * fenced code, headings, lists, blockquotes, tables and inline emphasis.
 * `react-markdown` is not a dependency here, so this parses to a plain data
 * AST (no HTML strings) which `MessageContent` renders as React elements —
 * there is no `dangerouslySetInnerHTML` anywhere in the pipeline.
 *
 * Streaming responses re-parse on every token, so the implementation favours
 * single forward passes over cleverness.
 */

export type InlineNode =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "del"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] }
  | { type: "break" }

export type BlockNode =
  | { type: "code"; lang: string; code: string }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "table"; header: string[]; align: Align[]; rows: string[][] }
  | { type: "hr" }

type Align = "left" | "center" | "right"

const UNORDERED = /^[-*+]\s+/
const ORDERED = /^\d+[.)]\s+/
const HEADING = /^(#{1,6})\s+(.*)$/
const FENCE = /^(```|~~~)\s*([\w.+-]*)\s*$/
const QUOTE = /^>\s?(.*)$/
const TABLE_DIVIDER = /^\s*\|?[\s:-]*-[-\s:|]*\|?\s*$/
const HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/

/* -------------------------------------------------------------------------- */
/* Inline                                                                     */
/* -------------------------------------------------------------------------- */

type Match = { node: InlineNode; length: number }

/** Only these schemes survive; anything else (e.g. `javascript:`) is dropped. */
function safeHref(raw: string): string | null {
  const href = raw.trim()
  if (!href) return null
  if (href.startsWith("/") || href.startsWith("#")) return href
  return /^https?:\/\//i.test(href) || /^mailto:/i.test(href) ? href : null
}

/** Finds the closing marker for `open`, skipping escaped characters. */
function findClosing(input: string, open: string, from: number): number {
  let i = from
  while (i < input.length) {
    if (input[i] === "\\") {
      i += 2
      continue
    }
    if (input.startsWith(open, i)) return i
    i += 1
  }
  return -1
}

const AUTOLINK = /^https?:\/\/[^\s<>()]+[^\s<>().,;:!?]/i

function matchAt(input: string, index: number): Match | null {
  const rest = input.slice(index)
  const char = rest[0]

  // Backslash escape — keep the escaped character, drop the backslash.
  if (char === "\\" && rest.length > 1) {
    return { node: { type: "text", text: rest[1] }, length: 2 }
  }

  // Hard line break.
  if (char === "\n") {
    return { node: { type: "break" }, length: 1 }
  }

  // Inline code — highest precedence so `**` inside code stays literal.
  if (char === "`") {
    const end = findClosing(rest, "`", 1)
    if (end > 0) {
      return {
        node: { type: "code", text: rest.slice(1, end).trim() },
        length: end + 1,
      }
    }
  }

  if (rest.startsWith("**")) {
    const end = findClosing(rest, "**", 2)
    if (end > 1) {
      return {
        node: { type: "strong", children: parseInline(rest.slice(2, end)) },
        length: end + 2,
      }
    }
  }

  if (rest.startsWith("~~")) {
    const end = findClosing(rest, "~~", 2)
    if (end > 1) {
      return {
        node: { type: "del", children: parseInline(rest.slice(2, end)) },
        length: end + 2,
      }
    }
  }

  // `*emphasis*` only — `*` inside prose is far more likely to be a bullet or
  // a multiplication sign than emphasis.
  if (char === "*" && rest[1] !== "*" && rest[1] !== " ") {
    const end = findClosing(rest, "*", 1)
    if (end > 1) {
      return {
        node: { type: "em", children: parseInline(rest.slice(1, end)) },
        length: end + 1,
      }
    }
  }

  // [label](href)
  if (char === "[") {
    const labelEnd = findClosing(rest, "]", 1)
    if (labelEnd > 1 && rest[labelEnd + 1] === "(") {
      const hrefEnd = findClosing(rest, ")", labelEnd + 2)
      if (hrefEnd > 0) {
        const href = safeHref(rest.slice(labelEnd + 2, hrefEnd))
        if (href) {
          return {
            node: {
              type: "link",
              href,
              children: parseInline(rest.slice(1, labelEnd)),
            },
            length: hrefEnd + 1,
          }
        }
      }
    }
  }

  // Bare URL.
  const auto = AUTOLINK.exec(rest)
  if (auto) {
    return {
      node: {
        type: "link",
        href: auto[0],
        children: [{ type: "text", text: auto[0] }],
      },
      length: auto[0].length,
    }
  }

  return null
}

export function parseInline(input: string): InlineNode[] {
  const nodes: InlineNode[] = []
  let buffer = ""
  let i = 0

  const flush = () => {
    if (buffer) {
      nodes.push({ type: "text", text: buffer })
      buffer = ""
    }
  }

  while (i < input.length) {
    const match = matchAt(input, i)
    if (!match) {
      buffer += input[i]
      i += 1
      continue
    }
    flush()
    nodes.push(match.node)
    i += match.length
  }

  flush()
  return nodes
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "")
  const cells: string[] = []
  let current = ""

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i]
    if (char === "\\" && trimmed[i + 1] === "|") {
      current += "|"
      i += 1
      continue
    }
    if (char === "|") {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

function alignments(divider: string): Align[] {
  return splitRow(divider).map((cell) => {
    const left = cell.startsWith(":")
    const right = cell.endsWith(":")
    if (left && right) return "center"
    if (right) return "right"
    return "left"
  })
}

function isTableLine(line: string) {
  return line.includes("|") && line.trim().length > 1
}

export function parseMarkdown(source: string): BlockNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n")
  const blocks: BlockNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Blank line.
    if (!line.trim()) {
      i += 1
      continue
    }

    // Fenced code block.
    const fence = FENCE.exec(line.trim())
    if (fence) {
      const marker = fence[1]
      const lang = fence[2] ?? ""
      const body: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        body.push(lines[i])
        i += 1
      }
      i += 1 // consume the closing fence (or run off the end)
      blocks.push({ type: "code", lang, code: body.join("\n").replace(/\n+$/, "") })
      continue
    }

    // Horizontal rule.
    if (HR.test(line) && !UNORDERED.test(line)) {
      blocks.push({ type: "hr" })
      i += 1
      continue
    }

    // ATX heading.
    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        text: heading[2].replace(/\s+#+\s*$/, ""),
      })
      i += 1
      continue
    }

    // Table: a row of pipes followed by a divider row.
    if (isTableLine(line) && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const header = splitRow(line)
      const align = alignments(lines[i + 1])
      const rows: string[][] = []
      i += 2
      while (i < lines.length && isTableLine(lines[i])) {
        rows.push(splitRow(lines[i]))
        i += 1
      }
      blocks.push({ type: "table", header, align, rows })
      continue
    }

    // Blockquote — merge consecutive `>` lines.
    if (QUOTE.test(line)) {
      const body: string[] = []
      while (i < lines.length && QUOTE.test(lines[i])) {
        body.push(QUOTE.exec(lines[i])?.[1] ?? "")
        i += 1
      }
      blocks.push({ type: "quote", text: body.join("\n") })
      continue
    }

    // Lists.
    if (UNORDERED.test(line) || ORDERED.test(line)) {
      const ordered = ORDERED.test(line)
      const pattern = ordered ? ORDERED : UNORDERED
      const items: string[] = []
      while (i < lines.length) {
        const current = lines[i]
        const match = pattern.exec(current)
        if (match) {
          items.push(match ? current.slice(match[0].length) : current)
          i += 1
          continue
        }
        // A wrapped continuation line belongs to the previous item.
        if (current.trim() && !UNORDERED.test(current) && !ORDERED.test(current) && !HEADING.test(current) && items.length > 0) {
          items[items.length - 1] += `\n${current.trim()}`
          i += 1
          continue
        }
        break
      }
      blocks.push({ type: "list", ordered, items })
      continue
    }

    // Paragraph — consume until a blank line or the start of another block.
    const paragraph: string[] = []
    while (i < lines.length) {
      const current = lines[i]
      if (
        !current.trim() ||
        HEADING.test(current) ||
        FENCE.test(current.trim()) ||
        QUOTE.test(current) ||
        UNORDERED.test(current) ||
        ORDERED.test(current) ||
        (paragraph.length > 0 && HR.test(current))
      ) {
        break
      }
      paragraph.push(current)
      i += 1
    }
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join("\n") })
    } else {
      // Defensive: never spin on a line no rule consumed.
      i += 1
    }
  }

  return blocks
}

/** Strips Markdown syntax down to a single line, for conversation titles. */
export function toPlainText(source: string, maxLength = 48): string {
  const flattened = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[>#\-*+]\s+/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim()

  return flattened.length > maxLength
    ? `${flattened.slice(0, maxLength - 1).trimEnd()}…`
    : flattened
}
