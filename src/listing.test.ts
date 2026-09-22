import { describe, expect, test } from 'vitest'
import { getTextWidth } from '@evenrealities/pretext'
import { buildEntries, packPages, pageIndexOf, moveCursor, renderBody, renderHeader } from './listing'
import type { Post } from './tabnews'

const WIDTH = 568
function post(title: string, extra: Partial<Post> = {}): Post {
  return { title, owner_username: 'ana', slug: 's', tabcoins: 4, children_deep_count: 0, published_at: '2026-09-08T02:00:00Z', source_url: null, ...extra }
}

describe('lista espaçada', () => {
  test('abre na primeira notícia sem seletor misturado aos títulos', () => {
    const entries = buildEntries([post('A'), post('B')], 'newsletter', WIDTH)
    expect(entries.map(e => e.post.title)).toEqual(['A', 'B'])
  })
  test('separa até três títulos por página mesmo quando todos são curtos', () => {
    const entries = buildEntries(['A', 'B', 'C', 'D'].map(t => post(t)), 'newsletter', WIDTH)
    expect(packPages(entries, 8)).toEqual([[0, 1, 2], [3]])
    expect(renderBody(entries, [0, 1, 2], 1)).toBe('  A\n  \n\n> B\n  \n\n  C')
  })
  test('títulos longos cabem nas oito linhas sem cortar outra notícia', () => {
    const entries = buildEntries(Array.from({ length: 4 }, () => post('palavra '.repeat(40))), 'new', WIDTH)
    const pages = packPages(entries, 8)
    expect(pages).toEqual([[0, 1, 2], [3]])
    for (const page of pages) {
      const lines = renderBody(entries, page, page[0]).split('\n')
      expect(lines.length).toBeLessThanOrEqual(8)
      expect(lines.every(line => getTextWidth(line) <= WIDTH)).toBe(true)
    }
    expect(entries[0].lines).toHaveLength(2)
    expect(entries[0].lines[1].endsWith('...')).toBe(true)
  })
  test('cabeçalho usa fonte, data local e posição; metadados ficam no leitor', () => {
    const entries = buildEntries([post('A')], 'newsletter', WIDTH)
    expect(renderHeader(entries, 0, WIDTH)).toBe('Newsletter · 07/09 · 1/1')
  })
  test('navega entre páginas e limita o cursor nas duas pontas', () => {
    expect(pageIndexOf([[0, 1, 2], [3]], 3)).toBe(1)
    expect(moveCursor(2, 1, 4)).toBe(3)
    expect(moveCursor(3, 1, 4)).toBe(3)
    expect(moveCursor(0, -1, 4)).toBe(0)
    expect(moveCursor(0, 1, 0)).toBe(0)
  })
  test('lista vazia não produz páginas', () => {
    expect(packPages(buildEntries([], 'newsletter', WIDTH), 8)).toEqual([])
  })
})
