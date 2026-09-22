// Lista de notícias desenhada num container de texto, com cursor movido por swipe.
import { getTextWidth, pxTruncate } from '@evenrealities/pretext'
import { FEED_LABEL, type FeedMode, type Post } from './tabnews'

export interface Entry {
  post: Post
  mode: FeedMode
  position: number
  total: number
  lines: string[]
}

const CURSOR = '> '
const INDENT = '  '
const TITLE_MAX_LINES = 2

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
  return posts.map((post, index) => ({ post, mode, position: index + 1, total: posts.length, lines: wrapTitle(post.title, width) }))
}

export function packPages(entries: Entry[], maxLines: number): number[][] {
  // Dois espaços de título e uma linha vazia por notícia, sem vazio após a última.
  const perPage = Math.max(1, Math.min(3, Math.floor((maxLines + 1) / 3)))
  const pages: number[][] = []
  for (let start = 0; start < entries.length; start += perPage) {
    pages.push(entries.slice(start, start + perPage).map((_, offset) => start + offset))
  }
  return pages
}

export function pageIndexOf(pages: number[][], cursor: number): number {
  return pages.findIndex(page => page.includes(cursor))
}

export function moveCursor(cursor: number, delta: number, total: number): number {
  return Math.max(0, Math.min(cursor + delta, total - 1))
}

export function renderBody(entries: Entry[], page: number[], cursor: number): string {
  return page.map((index, slot) => {
    const lines = [...entries[index].lines]
    if (slot < page.length - 1 && lines.length < TITLE_MAX_LINES) lines.push('')
    return lines.map((line, i) => `${index === cursor && i === 0 ? CURSOR : INDENT}${line}`).join('\n')
  }).join('\n\n')
}

export function renderHeader(entries: Entry[], cursor: number, width: number): string {
  const entry = entries[cursor]
  if (!entry) return 'TabNews'
  const date = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
  }).format(new Date(entry.post.published_at))
  return pxTruncate(`${FEED_LABEL[entry.mode]} · ${date} · ${entry.position}/${entry.total}`, width)
}
