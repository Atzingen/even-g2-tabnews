import { expect, test } from 'vitest'
import { readPreferences, savePreferences } from './preferences'

test('primeira execução e dados inválidos usam newsletter e último dia', () => {
  for (const value of [null, '{', JSON.stringify({ mode: 'unknown', period: 'year' })]) {
    expect(readPreferences({ getItem: () => value })).toEqual({ mode: 'newsletter', period: 'latest' })
  }
})

test('salva e recupera fonte e período escolhidos', () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  savePreferences(storage, { mode: 'new', period: 'five' })
  expect(readPreferences(storage)).toEqual({ mode: 'new', period: 'five' })
})

test('armazenamento indisponível não impede leitura', () => {
  const storage = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
  expect(readPreferences(storage)).toEqual({ mode: 'newsletter', period: 'latest' })
  expect(() => savePreferences(storage, { mode: 'relevant', period: 'five' })).not.toThrow()
})
