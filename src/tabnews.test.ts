import { describe, expect, test } from 'vitest'
import { filterLastDays, loadFeed, markdownToPlain, readerText, type Post } from './tabnews'

const NOW = new Date('2026-09-09T12:00:00Z')

function post(overrides: Partial<Post> = {}): Post {
  return {
    title: 'Título',
    owner_username: 'alguem',
    slug: 'titulo',
    tabcoins: 3,
    children_deep_count: 2,
    published_at: '2026-09-08T10:00:00Z',
    source_url: null,
    ...overrides,
  }
}

describe('filterLastDays', () => {
  test('mantém só posts publicados dentro da janela, na ordem original', () => {
    const recente = post({ slug: 'a', published_at: '2026-09-07T00:00:00Z' })
    const noLimite = post({ slug: 'b', published_at: '2026-09-04T12:00:01Z' })
    const velho = post({ slug: 'c', published_at: '2026-09-04T11:59:59Z' })
    expect(filterLastDays([velho, recente, noLimite], NOW, 5)).toEqual([recente, noLimite])
  })
})

describe('loadFeed', () => {
  test('relevantes: pede páginas de 100 até vir uma incompleta e filtra a janela', async () => {
    const chamadas: string[] = []
    const fetchJson = async (url: string) => {
      chamadas.push(url)
      const page = Number(new URL(url).searchParams.get('page'))
      if (page === 1) return Array.from({ length: 100 }, (_, i) => post({ slug: `p1-${i}` }))
      return [post({ slug: 'p2-0' }), post({ slug: 'p2-velho', published_at: '2026-08-01T00:00:00Z' })]
    }
    const posts = await loadFeed('relevant', fetchJson, NOW)
    expect(chamadas).toEqual([
      'https://www.tabnews.com.br/api/v1/contents?strategy=relevant&per_page=100&page=1',
      'https://www.tabnews.com.br/api/v1/contents?strategy=relevant&per_page=100&page=2',
    ])
    expect(posts).toHaveLength(101)
    expect(posts[100].slug).toBe('p2-0')
  })

  test('recentes: para quando a página já contém um post fora da janela', async () => {
    const chamadas: string[] = []
    const fetchJson = async (url: string) => {
      chamadas.push(url)
      return [
        ...Array.from({ length: 99 }, (_, i) => post({ slug: `n-${i}` })),
        post({ slug: 'fora', published_at: '2026-09-01T00:00:00Z' }),
      ]
    }
    const posts = await loadFeed('new', fetchJson, NOW)
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0]).toContain('strategy=new')
    expect(posts).toHaveLength(99)
  })

  test('nunca passa de 3 páginas', async () => {
    let n = 0
    const fetchJson = async () => {
      n += 1
      return Array.from({ length: 100 }, (_, i) => post({ slug: `${n}-${i}` }))
    }
    await loadFeed('relevant', fetchJson, NOW)
    expect(n).toBe(3)
  })
})

describe('markdownToPlain', () => {
  test('remove marcação mantendo o texto', () => {
    const md = [
      '## Um título',
      '',
      'Texto com **negrito**, *itálico*, `código` e [um link](https://x.y/z).',
      '',
      '![alt da imagem](https://x.y/img.png)',
      '',
      '> citação',
      '',
      '- item um',
      '1. item numerado',
      '',
      '---',
      '',
      '```js',
      'const a = 1',
      '```',
      '',
      '<br>Tag <b>html</b>',
    ].join('\n')
    expect(markdownToPlain(md)).toBe(
      [
        'Um título',
        '',
        'Texto com negrito, itálico, código e um link.',
        '',
        '[imagem: alt da imagem]',
        '',
        'citação',
        '',
        '- item um',
        '1. item numerado',
        '',
        'const a = 1',
        '',
        'Tag html',
      ].join('\n'),
    )
  })

  test('achata tabelas e colapsa linhas em branco repetidas', () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |\n\n\n\nfim'
    expect(markdownToPlain(md)).toBe('a  b\n1  2\n\nfim')
  })

  test('não mexe em snake_case', () => {
    expect(markdownToPlain('use owner_username aqui')).toBe('use owner_username aqui')
  })
})

describe('readerText', () => {
  test('monta título, metadados, corpo e fonte', () => {
    const p = post({ title: 'T', owner_username: 'ana', tabcoins: 7, children_deep_count: 1, source_url: 'https://f.o/nte' })
    expect(readerText(p, '# Corpo\n\nParágrafo.')).toBe('T\n\nana · ↑7 · 1 comentário\n\nCorpo\n\nParágrafo.\n\nFonte: https://f.o/nte')
  })

  test('plural de comentários e sem fonte', () => {
    const p = post({ title: 'T', owner_username: 'ana', tabcoins: 0, children_deep_count: 2 })
    expect(readerText(p, 'x')).toBe('T\n\nana · ↑0 · 2 comentários\n\nx')
  })
})
