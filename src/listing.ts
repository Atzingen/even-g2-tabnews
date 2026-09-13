// Lista de notícias desenhada num container de texto, com cursor movido por swipe.
import { getTextWidth, pxTruncate } from '@evenrealities/pretext'
import type { FeedMode, Post } from './tabnews'

export type Entry =
  | { kind: 'mode'; mode: FeedMode; lines: string[] }
  | { kind: 'post'; post: Post; position: number; total: number; lines: string[] }

const CURSOR = '> '
const INDENT = '  '
const TITLE_MAX_LINES = 2

const MODE_LABEL: Record<FeedMode, string> = { relevant: 'Relevantes', new: 'Recentes' }

export function otherMode(mode: FeedMode): FeedMode {
  return mode === 'relevant' ? 'new' : 'relevant'
}

// Quebra o título em até duas linhas na largura útil (descontado o cursor),
// truncando com reticências o que não cabe na última linha.
function wrapTitle(title: string, width: number): string[] {
  const usable = width - getTextWidth(CURSOR)
  const words = title.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let next = 0
  while (next < words.length && lines.length < TITLE_MAX_LINES) {
    let line = words[next]
    next += 1
    while (next < words.length && getTextWidth(`${line} ${words[next]}`) <= usable) {
      line = `${line} ${words[next]}`
      next += 1
    }
    lines.push(line)
  }
  const last = lines.length - 1
  if (next < words.length) lines[last] = [lines[last], ...words.slice(next)].join(' ')
  lines[last] = pxTruncate(lines[last], usable)
  return lines
}

export function buildEntries(posts: Post[], mode: FeedMode, width: number): Entry[] {
  const modeEntry: Entry = {
    kind: 'mode',
    mode,
    lines: [`Modo: ${MODE_LABEL[mode]} · toque para ver ${MODE_LABEL[otherMode(mode)]}`],
  }
  const postEntries = posts.map(
    (post, index): Entry => ({ kind: 'post', post, position: index + 1, total: posts.length, lines: wrapTitle(post.title, width) }),
  )
  return [modeEntry, ...postEntries]
}

export function packPages(entries: Entry[], maxLines: number): number[][] {
  const pages: number[][] = []
  let page: number[] = []
  let used = 0
  entries.forEach((entry, index) => {
    if (page.length && used + entry.lines.length > maxLines) {
      pages.push(page)
      page = []
      used = 0
    }
    page.push(index)
    used += entry.lines.length
  })
  if (page.length) pages.push(page)
  return pages
}

export function pageIndexOf(pages: number[][], cursor: number): number {
  return pages.findIndex(page => page.includes(cursor))
}

export function moveCursor(cursor: number, delta: number, total: number): number {
  return Math.min(Math.max(cursor + delta, 0), total - 1)
}

export function renderBody(entries: Entry[], page: number[], cursor: number): string {
  return page
    .flatMap(index => entries[index].lines.map((line, i) => `${index === cursor && i === 0 ? CURSOR : INDENT}${line}`))
    .join('\n')
}

export function renderHeader(entries: Entry[], cursor: number, width: number): string {
  const entry = entries[cursor]
  if (entry.kind === 'mode') return 'TabNews · últimos 5 dias · duplo toque sai'
  const { post } = entry
  const mode = (entries[0] as Extract<Entry, { kind: 'mode' }>).mode
  const text = `${MODE_LABEL[mode]} ${entry.position}/${entry.total} · ${post.owner_username} · ↑${post.tabcoins} · ${post.children_deep_count} coment.`
  return pxTruncate(text, width)
}
