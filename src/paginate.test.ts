import { describe, expect, test } from 'vitest'
import { paginate } from './paginate'

describe('paginate', () => {
  test('junta parágrafos curtos numa página e respeita o limite de linhas', () => {
    const pages = paginate('um\n\ndois\n\ntrês', { width: 568, height: 27 * 3 })
    expect(pages).toEqual(['um\n\ndois', 'três'])
  })

  test('parágrafo maior que a página é dividido em pedaços', () => {
    const longo = 'palavra '.repeat(200).trim()
    const pages = paginate(longo, { width: 568, height: 27 * 2 })
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.join(' ')).toBe(longo)
  })
})
