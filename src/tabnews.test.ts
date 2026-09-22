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


describe('newsletter e período', () => {
  const official = (extra: Partial<Post> = {}) => post({ owner_username: 'NewsletterOficial', parent_id: null, ...extra })

  test('consulta a conta oficial e mantém só publicações, nunca comentários ou outros autores', async () => {
    const calls: string[] = []
    const result = await loadFeed('newsletter', async url => {
      calls.push(url)
      return [official(), official({ slug: 'comentario', parent_id: 'parent' }), post(), official({ title: '' })]
    }, NOW)
    expect(calls).toEqual(['https://www.tabnews.com.br/api/v1/contents/NewsletterOficial?strategy=new&per_page=100&page=1'])
    expect(result.map(p => p.slug)).toEqual(['titulo'])
  })

  test('último dia usa São Paulo, inclusive quando a última publicação tem mais de 5 dias', async () => {
    const result = await loadFeed('newsletter', async () => [
      official({ slug: 'a', published_at: '2026-09-01T02:30:00Z' }),
      official({ slug: 'b', published_at: '2026-08-31T15:00:00Z' }),
      official({ slug: 'c', published_at: '2026-08-31T02:30:00Z' }),
    ], NOW, 5, 'latest')
    expect(result.map(p => p.slug)).toEqual(['a', 'b'])
  })

  test('busca a próxima página para completar o último dia, sem incluir o anterior', async () => {
    let calls = 0
    const result = await loadFeed('newsletter', async () => ++calls === 1
      ? Array.from({ length: 100 }, (_, i) => official({ slug: String(i) }))
      : [official({ slug: '100' }), official({ slug: 'old', published_at: '2026-09-07T10:00:00Z' })], NOW)
    expect(calls).toBe(2)
    expect(result).toHaveLength(101)
    expect(result.at(-1)?.slug).toBe('100')
  })

  test('janela de 5 dias continua disponível para a newsletter', async () => {
    const result = await loadFeed('newsletter', async () => [official(), official({ slug: 'old', published_at: '2026-08-01T00:00:00Z' })], NOW, 5, 'five')
    expect(result.map(p => p.slug)).toEqual(['titulo'])
  })

  test('feed relevante não para cedo ao encontrar uma data antiga', async () => {
    let calls = 0
    const result = await loadFeed('relevant', async () => ++calls === 1
      ? Array.from({ length: 100 }, (_, i) => post({ slug: String(i), published_at: '2026-09-07T12:00:00Z' }))
      : [post({ slug: 'newest', published_at: '2026-09-09T10:00:00Z' })], NOW, 5, 'latest')
    expect(calls).toBe(2)
    expect(result.map(p => p.slug)).toEqual(['newest'])
  })

  test('vazio continua vazio e falha da newsletter não consulta a comunidade', async () => {
    expect(await loadFeed('newsletter', async () => [], NOW)).toEqual([])
    let calls = 0
    await expect(loadFeed('newsletter', async () => { calls++; throw new Error('HTTP 503') }, NOW)).rejects.toThrow('HTTP 503')
    expect(calls).toBe(1)
  })
})
