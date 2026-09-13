// Acesso à API pública do TabNews e conversão do conteúdo para texto plano.

export type FeedMode = 'relevant' | 'new'

export interface Post {
  title: string
  owner_username: string
  slug: string
  tabcoins: number
  children_deep_count: number
  published_at: string
  source_url: string | null
}

export interface PostContent extends Post {
  body: string
}

const API_BASE = 'https://www.tabnews.com.br/api/v1/contents'
const PER_PAGE = 100
const MAX_PAGES = 3

export type FetchJson = (url: string) => Promise<unknown>

export function filterLastDays(posts: Post[], now: Date, days: number): Post[] {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000
  return posts.filter(post => Date.parse(post.published_at) >= cutoff)
}

export async function loadFeed(mode: FeedMode, fetchJson: FetchJson, now: Date, days = 5): Promise<Post[]> {
  const collected: Post[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${API_BASE}?strategy=${mode}&per_page=${PER_PAGE}&page=${page}`
    const batch = (await fetchJson(url)) as Post[]
    const inWindow = filterLastDays(batch, now, days)
    collected.push(...inWindow)
    const pageIsIncomplete = batch.length < PER_PAGE
    const pageLeftTheWindow = mode === 'new' && inWindow.length < batch.length
    if (pageIsIncomplete || pageLeftTheWindow) break
  }
  return collected
}

export function postUrl(post: Post): string {
  return `${API_BASE}/${post.owner_username}/${post.slug}`
}

export function markdownToPlain(markdown: string): string {
  const withoutFences = markdown.replace(/^```[^\n]*\n([\s\S]*?)^```[ \t]*$/gm, '$1')
  const lines = withoutFences.split('\n').map(line => {
    let text = line
    if (/^\s*\|.*\|\s*$/.test(text)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(text)) return null
      return text
        .trim()
        .slice(1, -1)
        .split('|')
        .map(cell => cell.trim())
        .join('  ')
    }
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(text)) return null
    text = text.replace(/^\s{0,3}#{1,6}\s+/, '')
    text = text.replace(/^\s{0,3}>\s?/, '')
    text = text.replace(/^(\s*)[*+]\s+/, '$1- ')
    text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_m, alt: string) => (alt ? `[imagem: ${alt}]` : '[imagem]'))
    text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    text = text.replace(/<[^>]+>/g, '')
    text = text.replace(/(\*\*|__)(.+?)\1/g, '$2')
    text = text.replace(/\*(.+?)\*/g, '$1')
    text = text.replace(/`([^`]+)`/g, '$1')
    return text.replace(/\s+$/, '')
  })
  return lines
    .filter((line): line is string => line !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function readerText(post: Post, body: string): string {
  const comments = post.children_deep_count === 1 ? '1 comentário' : `${post.children_deep_count} comentários`
  const parts = [post.title, `${post.owner_username} · ↑${post.tabcoins} · ${comments}`, markdownToPlain(body)]
  if (post.source_url) parts.push(`Fonte: ${post.source_url}`)
  return parts.join('\n\n')
}
