import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import { paginate } from './paginate'
import { buildEntries, packPages, pageIndexOf, moveCursor, renderBody, renderHeader, otherMode, type Entry } from './listing'
import { loadFeed, postUrl, readerText, type FeedMode, type Post, type PostContent } from './tabnews'

// Geometria: cabeçalho de uma linha em cima, corpo ocupando o resto da tela.
const SCREEN_W = 576
const SCREEN_H = 288
const HEADER_H = 35
const PAD = 4
const BODY_H = SCREEN_H - HEADER_H
const INNER_W = SCREEN_W - 2 * PAD
const INNER_H = BODY_H - 2 * PAD
const LINE_H = 27
// O LVGL soma folga entre linhas: com 9 linhas em 245 px o corpo transborda ~13 px e o
// firmware rola o texto no swipe. Um passo de 29 px por linha deixa 8 linhas com margem.
const LINE_PITCH = 29
const MAX_LINES = Math.floor(INNER_H / LINE_PITCH)

const DAYS = 5
const REFRESH_MS = 30 * 60 * 1000

type Screen = 'list' | 'reader'
type Status = 'loading' | 'ready' | 'error'

let mode: FeedMode = 'relevant'
let screen: Screen = 'list'
let status: Status = 'loading'
let errorMessage = ''
let posts: Post[] = []
let entries: Entry[] = []
let pages: number[][] = []
let cursor = 0
let openPost: Post | null = null
let readerPages: string[] = []
let readerPage = 0

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

const bridge = await waitForEvenAppBridge()

const header = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: SCREEN_W,
  height: HEADER_H,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: PAD,
  containerID: 2,
  containerName: 'header',
  content: 'TabNews',
  isEventCapture: 0,
})

const body = new TextContainerProperty({
  xPosition: 0,
  yPosition: HEADER_H,
  width: SCREEN_W,
  height: BODY_H,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: PAD,
  containerID: 1,
  containerName: 'body',
  content: 'Carregando TabNews...',
  isEventCapture: 1,
})

const created = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({ containerTotalNum: 2, textObject: [header, body] }),
)
console.log('Page created:', created === 0 ? 'success' : `failed (${created})`)

// Escritas na ponte são serializadas: toques rápidos não podem sobrepor upgrades.
let rendering: Promise<unknown> = Promise.resolve()
function render(): Promise<unknown> {
  const { headerText, bodyText } = currentTexts()
  rendering = rendering.then(async () => {
    await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 2, containerName: 'header', content: headerText }))
    await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, containerName: 'body', content: bodyText }))
  })
  mirrorCompanion(headerText, bodyText)
  return rendering
}

function currentTexts(): { headerText: string; bodyText: string } {
  if (status === 'loading') return { headerText: 'TabNews', bodyText: 'Carregando TabNews...' }
  if (status === 'error') return { headerText: 'TabNews · erro', bodyText: `Falha ao carregar: ${errorMessage}\n\nToque para tentar de novo.` }
  if (screen === 'reader') {
    return {
      headerText: `${readerPage + 1}/${readerPages.length} · toque: próxima · cima: anterior · duplo: voltar`,
      bodyText: readerPages[readerPage] ?? '',
    }
  }
  if (posts.length === 0) return { headerText: 'TabNews', bodyText: `Nenhum post nos últimos ${DAYS} dias.` }
  const page = pages[pageIndexOf(pages, cursor)] ?? []
  return { headerText: renderHeader(entries, cursor, INNER_W), bodyText: renderBody(entries, page, cursor) }
}

async function loadList(): Promise<void> {
  status = 'loading'
  await render()
  try {
    posts = await loadFeed(mode, fetchJson, new Date(), DAYS)
    entries = buildEntries(posts, mode, INNER_W)
    pages = packPages(entries, MAX_LINES)
    cursor = moveCursor(cursor, 0, entries.length)
    status = 'ready'
  } catch (error) {
    status = 'error'
    errorMessage = error instanceof Error ? error.message : String(error)
  }
  await render()
}

async function openReader(post: Post): Promise<void> {
  openPost = post
  status = 'loading'
  await render()
  try {
    const content = (await fetchJson(postUrl(post))) as PostContent
    readerPages = paginate(readerText(post, content.body ?? ''), { width: INNER_W, height: MAX_LINES * LINE_H })
    readerPage = Math.min(readerPage, readerPages.length - 1)
    screen = 'reader'
    status = 'ready'
  } catch (error) {
    status = 'error'
    errorMessage = error instanceof Error ? error.message : String(error)
  }
  await render()
}

function backToList(): Promise<unknown> {
  screen = 'list'
  openPost = null
  readerPage = 0
  status = 'ready'
  return render()
}

async function onClick(): Promise<void> {
  if (status === 'loading') return
  if (status === 'error') {
    if (screen === 'reader' && openPost) return openReader(openPost)
    return loadList()
  }
  if (screen === 'reader') {
    if (readerPage + 1 < readerPages.length) {
      readerPage += 1
      await render()
    } else {
      await backToList()
    }
    return
  }
  const entry = entries[cursor]
  if (!entry) return
  if (entry.kind === 'mode') {
    mode = otherMode(mode)
    cursor = 0
    return loadList()
  }
  readerPage = 0
  return openReader(entry.post)
}

function onScroll(delta: number): Promise<unknown> {
  if (status !== 'ready') return Promise.resolve()
  if (screen === 'reader') {
    readerPage = Math.min(Math.max(readerPage + delta, 0), readerPages.length - 1)
  } else {
    cursor = moveCursor(cursor, delta, entries.length)
  }
  return render()
}

// CLICK_EVENT é 0 e o protobuf omite zeros: um toque chega como envelope sem eventType.
function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

let cleanedUp = false
function cleanup(): void {
  if (cleanedUp) return
  cleanedUp = true
  clearInterval(refreshTimer)
  unsubscribe()
}

const unsubscribe = bridge.onEvenHubEvent(event => {
  const sysType = eventTypeOf(event.sysEvent)
  const textType = eventTypeOf(event.textEvent)

  if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT || textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    if (screen === 'reader') backToList().catch(console.error)
    else bridge.shutDownPageContainer(1)
    return
  }
  if (textType === OsEventTypeList.SCROLL_TOP_EVENT) {
    onScroll(-1).catch(console.error)
    return
  }
  if (textType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
    onScroll(1).catch(console.error)
    return
  }
  if (sysType === OsEventTypeList.CLICK_EVENT || textType === OsEventTypeList.CLICK_EVENT) {
    onClick().catch(console.error)
    return
  }
  if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
    cleanup()
  }
})

const refreshTimer = setInterval(() => {
  if (screen === 'list' && status === 'ready') loadList().catch(console.error)
}, REFRESH_MS)

window.addEventListener('beforeunload', cleanup)

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main style="margin:auto;padding:24px;max-width:680px;box-sizing:border-box;text-align:left;">
    <h1 style="font-size:18px;font-weight:600;margin:0 0 12px;">TabNews no G2</h1>
    <pre id="mirror-header" style="margin:0 0 8px;color:#8A8A8A;white-space:pre-wrap;"></pre>
    <pre id="mirror-body" style="background:#2E2E2E;border-radius:12px;padding:16px;white-space:pre-wrap;word-break:break-word;margin:0;"></pre>
  </main>
`
function mirrorCompanion(headerText: string, bodyText: string): void {
  const h = document.getElementById('mirror-header')
  const b = document.getElementById('mirror-body')
  if (h) h.textContent = headerText
  if (b) b.textContent = bodyText
}

await loadList()
console.log('TABNEWS_READY')
