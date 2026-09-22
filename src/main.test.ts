// @vitest-environment happy-dom
import { Storage } from 'happy-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const bridge = vi.hoisted(() => ({
  receive: (_event: unknown) => {},
  unsubscribe: vi.fn(),
  createStartUpPageContainer: vi.fn(async () => 0),
  textContainerUpgrade: vi.fn(async () => 0),
  shutDownPageContainer: vi.fn(async () => 0),
}))
vi.mock('@evenrealities/even_hub_sdk', async importOriginal => {
  const sdk = await importOriginal<typeof import('@evenrealities/even_hub_sdk')>()
  return {
    ...sdk,
    waitForEvenAppBridge: async () => ({
      ...bridge,
      onEvenHubEvent: (callback: (event: unknown) => void) => { bridge.receive = callback; return bridge.unsubscribe },
    }),
  }
})

const sample = (title: string, slug = title, author = 'NewsletterOficial') => ({
  title, slug, owner_username: author, parent_id: null, tabcoins: 2, children_deep_count: 0,
  published_at: new Date(Date.now() - 60_000).toISOString(), source_url: null,
})
const response = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status }))
const text = (id: string) => document.getElementById(id)!.textContent ?? ''
async function select(id: string, value: string): Promise<void> {
  const element = document.querySelector<HTMLSelectElement>(id)!
  element.value = value
  element.dispatchEvent(new Event('change'))
  await vi.waitFor(() => expect(element.disabled).toBe(false))
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  document.body.innerHTML = '<div id="app"></div>'
  vi.stubGlobal('localStorage', new Storage())
})
afterEach(() => {
  window.dispatchEvent(new Event('beforeunload'))
  vi.unstubAllGlobals()
})

test('carrega newsletter, abre o primeiro título com evento zero omitido e retorna à mesma posição', async () => {
  vi.stubGlobal('fetch', vi.fn((url: string) => response(url.includes('?')
    ? ['A', 'B', 'C', 'D'].map(t => sample(t)) : { ...sample('A'), body: 'Conteúdo completo da primeira notícia.' })))
  await import('./main')
  expect(text('mirror-header')).toContain('Newsletter')
  expect(text('mirror-body')).toBe('> A\n  \n\n  B\n  \n\n  C')
  bridge.receive({ textEvent: {} })
  await vi.waitFor(() => expect(text('mirror-body')).toContain('Conteúdo completo'))
  bridge.receive({ textEvent: { eventType: 3 } })
  await vi.waitFor(() => expect(text('mirror-header')).toContain('1/4'))
  for (let i = 0; i < 3; i++) bridge.receive({ textEvent: { eventType: 2 } })
  await vi.waitFor(() => expect(text('mirror-body')).toBe('> D'))
  bridge.receive({ textEvent: { eventType: 3 } })
  expect(bridge.shutDownPageContainer).toHaveBeenCalledWith(1)
  expect(bridge.unsubscribe).not.toHaveBeenCalled()
  bridge.receive({ sysEvent: { eventType: 7 } })
  expect(bridge.unsubscribe).toHaveBeenCalledOnce()
})

test('fonte e período no celular alteram a consulta e são lembrados ao reabrir', async () => {
  const fetcher = vi.fn((url: string) => response([sample(url.includes('NewsletterOficial') ? 'Editorial' : 'Comunidade', 'p', url.includes('NewsletterOficial') ? 'NewsletterOficial' : 'ana')]))
  vi.stubGlobal('fetch', fetcher)
  await import('./main')
  await select('#feed-mode', 'new')
  await select('#feed-period', 'five')
  expect(text('mirror-body')).toContain('Comunidade')
  expect(fetcher.mock.calls.at(-1)?.[0]).toContain('contents?strategy=new')
  window.dispatchEvent(new Event('beforeunload'))
  vi.resetModules()
  await import('./main')
  expect(document.querySelector<HTMLSelectElement>('#feed-mode')!.value).toBe('new')
  expect(document.querySelector<HTMLSelectElement>('#feed-period')!.value).toBe('five')
  expect(text('mirror-header')).toContain('Recentes')
})

test('erro ao abrir artigo oferece nova tentativa do mesmo artigo, sem recarregar o feed', async () => {
  let articleCalls = 0
  const fetcher = vi.fn((url: string) => url.includes('?') ? response([sample('A')])
    : ++articleCalls === 1 ? response({}, 503) : response({ ...sample('A'), body: 'Artigo recuperado' }))
  vi.stubGlobal('fetch', fetcher)
  await import('./main')
  bridge.receive({ textEvent: {} })
  await vi.waitFor(() => expect(text('mirror-body')).toContain('HTTP 503'))
  bridge.receive({ textEvent: {} })
  await vi.waitFor(() => expect(text('mirror-body')).toContain('Artigo recuperado'))
  expect(fetcher.mock.calls.filter(([url]) => url.includes('?'))).toHaveLength(1)
})

test('sair do leitor durante download impede uma resposta atrasada de reabrir o artigo', async () => {
  let finish!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn((url: string) => url.includes('?') ? response([sample('A')])
    : new Promise<Response>(resolve => { finish = resolve })))
  await import('./main')
  bridge.receive({ textEvent: {} })
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  bridge.receive({ textEvent: { eventType: 3 } })
  finish(new Response(JSON.stringify({ ...sample('A'), body: 'Resposta atrasada' })))
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(text('mirror-header')).toContain('Newsletter')
  expect(text('mirror-body')).toBe('> A')
})
