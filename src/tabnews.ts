// Acesso à API pública do TabNews e conversão do conteúdo para texto plano.

export type FeedMode = 'newsletter' | 'relevant' | 'new'
export type FeedPeriod = 'latest' | 'five'
export const FEED_LABEL: Record<FeedMode, string> = { newsletter: 'Newsletter', relevant: 'Relevantes', new: 'Recentes' }

export interface Post {
  parent_id?: string | null
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

const publicationDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function dayOf(date: string): string {
  return publicationDay.format(new Date(date))
}

function latestDay(posts: Post[]): Post[] {
  if (!posts.length) return []
  const newest = posts.reduce((a, b) => Date.parse(a.published_at) > Date.parse(b.published_at) ? a : b)
  const day = dayOf(newest.published_at)
  return posts.filter(post => dayOf(post.published_at) === day)
}

export async function loadFeed(
  mode: FeedMode, fetchJson: FetchJson, now: Date, days = 5,
  period: FeedPeriod = mode === 'newsletter' ? 'latest' : 'five',
): Promise<Post[]> {
  const collected: Post[] = []
  const chronological = mode !== 'relevant'
  const base = mode === 'newsletter' ? `${API_BASE}/NewsletterOficial` : API_BASE
  const strategy = mode === 'newsletter' ? 'new' : mode
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await fetchJson(`${base}?strategy=${strategy}&per_page=${PER_PAGE}&page=${page}`)
    if (!Array.isArray(response)) throw new Error('Resposta inválida do TabNews')
    const batch = (response as Post[]).filter(post =>
      post && post.parent_id == null && typeof post.title === 'string' && post.title.trim() &&
      typeof post.slug === 'string' && typeof post.owner_username === 'string' &&
      Number.isFinite(Date.parse(post.published_at)) && Date.parse(post.published_at) <= now.getTime() &&
      (mode !== 'newsletter' || post.owner_username === 'NewsletterOficial'),
    )
    const inWindow = period === 'latest' ? batch : filterLastDays(batch, now, days)
    collected.push(...inWindow)
    const crossedDay = period === 'latest' && collected.length > latestDay(collected).length
    const crossedWindow = period === 'five' && inWindow.length < batch.length
    if (response.length < PER_PAGE || (chronological && (crossedDay || crossedWindow))) break
  }
  return period === 'latest' ? latestDay(collected) : collected
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
