import { describe, expect, test } from 'vitest'
import { buildEntries, packPages, pageIndexOf, moveCursor, renderBody, renderHeader, type Entry } from './listing'
import type { Post } from './tabnews'

const WIDTH = 568
const MAX_LINES = 9

function post(title: string, extra: Partial<Post> = {}): Post {
  return { title, owner_username: 'ana', slug: 's', tabcoins: 4, children_deep_count: 0, published_at: '2026-09-08T00:00:00Z', source_url: null, ...extra }
}

describe('buildEntries', () => {
  test('primeira entrada é o seletor de modo, seguida dos posts', () => {
    const entries = buildEntries([post('A'), post('B')], 'relevant', WIDTH)
    expect(entries.map(e => e.kind)).toEqual(['mode', 'post', 'post'])
    expect(entries[0].lines).toEqual(['Modo: Relevantes · toque para ver Recentes'])
    expect(entries[1].lines).toEqual(['A'])
  })

  test('em modo recentes o seletor oferece Relevantes', () => {
    expect(buildEntries([], 'new', WIDTH)[0].lines[0]).toBe('Modo: Recentes · toque para ver Relevantes')
  })

  test('título longo quebra em duas linhas', () => {
    const t = 'O sandbox da OpenAI achava que GET era só leitura. Um wiki de 25 anos discordou.'
    const [, e] = buildEntries([post(t)], 'relevant', WIDTH)
    expect(e.lines).toHaveLength(2)
    expect(e.lines.join(' ')).toBe(t)
  })

  test('título maior que duas linhas é truncado com reticências na segunda', () => {
    const t = 'palavra '.repeat(40).trim()
    const [, e] = buildEntries([post(t)], 'relevant', WIDTH)
    expect(e.lines).toHaveLength(2)
    expect(e.lines[1].endsWith('...')).toBe(true)
  })
})

describe('packPages', () => {
  test('empacota entradas sem passar de maxLines por página', () => {
    const entries: Entry[] = [
      { kind: 'mode', mode: 'relevant', lines: ['m'] },
      ...Array.from({ length: 6 }, (_, i) => ({ kind: 'post', post: post('x'), position: i + 1, total: 6, lines: ['a', 'b'] }) as Entry),
    ]
    const pages = packPages(entries, MAX_LINES)
    expect(pages).toEqual([[0, 1, 2, 3, 4], [5, 6]])
  })
})

describe('pageIndexOf e moveCursor', () => {
  const pages = [[0, 1, 2], [3, 4], [5]]
  test('encontra a página do cursor', () => {
    expect(pageIndexOf(pages, 0)).toBe(0)
    expect(pageIndexOf(pages, 4)).toBe(1)
    expect(pageIndexOf(pages, 5)).toBe(2)
  })
  test('cursor anda e para nas pontas', () => {
    expect(moveCursor(0, -1, 6)).toBe(0)
    expect(moveCursor(0, 1, 6)).toBe(1)
    expect(moveCursor(5, 1, 6)).toBe(5)
    expect(moveCursor(3, -1, 6)).toBe(2)
  })
})

describe('renderBody', () => {
  test('marca a entrada selecionada com > e indenta as demais', () => {
    const entries: Entry[] = [
      { kind: 'mode', mode: 'relevant', lines: ['Modo'] },
      { kind: 'post', post: post('Um dois'), position: 1, total: 2, lines: ['Um', 'dois'] },
      { kind: 'post', post: post('Três'), position: 2, total: 2, lines: ['Três'] },
    ]
    expect(renderBody(entries, [0, 1, 2], 1)).toBe('  Modo\n> Um\n  dois\n  Três')
  })
})

describe('renderHeader', () => {
  test('post selecionado mostra posição e metadados', () => {
    const entries = buildEntries([post('A', { owner_username: 'bia', tabcoins: 9, children_deep_count: 3 })], 'relevant', WIDTH)
    expect(renderHeader(entries, 1, WIDTH)).toBe('Relevantes 1/1 · bia · ↑9 · 3 coment.')
  })
  test('seletor de modo mostra ajuda', () => {
    const entries = buildEntries([post('A')], 'new', WIDTH)
    expect(renderHeader(entries, 0, WIDTH)).toBe('TabNews · últimos 5 dias · duplo toque sai')
  })
})
