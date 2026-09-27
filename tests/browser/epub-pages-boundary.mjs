import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'
import JSZip from 'jszip'

const root = new URL('../../', import.meta.url).pathname.replace(/^\//, '').replaceAll('/', '\\')
const projectTemp = `${root}\\.local-cache\\tmp`
await mkdir(projectTemp, { recursive: true })
process.env.TEMP = projectTemp; process.env.TMP = projectTemp; process.env.TMPDIR = projectTemp
const port = 4317
const baseUrl = `http://127.0.0.1:${port}`
const evidence = new URL('../../.qa-artifacts/epub-pages-boundary/', import.meta.url).pathname.replace(/^\//, '').replaceAll('/', '\\')
const paragraphs = Array.from({ length: 150 }, (_, index) => {
  const tag = `CHK-${String(index + 1).padStart(4, '0')}`
  const words = Array.from({ length: 62 }, (_, word) => ['quiet', 'river', 'window', 'morning', 'traveler', 'lantern', 'garden', 'remember'][((word + index * 3) % 8)]).join(' ')
  return `${tag} ${words}. ${words}.`
})
const shortParagraph = 'SHORT-CHAPTER-END A brief final chapter fits on a single page.'

async function createEpub() {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`)
  zip.file('OEBPS/content.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="en"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">pages-boundary-fixture</dc:identifier><dc:title>Pages Boundary Fixture</dc:title><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="one" href="chapter-1.xhtml" media-type="application/xhtml+xml"/><item id="two" href="chapter-2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>`)
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="chapter-1.xhtml">Long chapter</a></li><li><a href="chapter-2.xhtml">Short chapter</a></li></ol></nav></body></html>`)
  zip.file('OEBPS/chapter-1.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Long chapter</title></head><body><h1>Long chapter</h1>${paragraphs.map((text) => `<p>${text}</p>`).join('')}</body></html>`)
  zip.file('OEBPS/chapter-2.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Short chapter</title></head><body><h1>Short chapter</h1><p>${shortParagraph}</p></body></html>`)
  return zip.generateAsync({ type: 'base64', compression: 'DEFLATE' })
}

function blocksFrom(texts, sectionIndex) {
  const title = sectionIndex === 0 ? 'Long chapter' : 'Short chapter'
  return [{ id: `heading-${sectionIndex}`, type: 'heading', level: 2, text: title, order: 0 }, ...texts.map((text, index) => ({ id: `s${sectionIndex}-p${index}`, type: 'paragraph', text, order: index + 1 }))]
}

async function seedPage(page, epubBase64) {
  await page.goto(baseUrl)
  await page.evaluate(async ({ epubBase64 }) => {
    localStorage.setItem('lumaread-reader-settings:v4', JSON.stringify({ fontFamily: 'serif', fontScale: 1, lineHeight: 'comfortable', textWidthCh: 64, mobileSideMargin: 'comfortable', textAlignment: 'auto', epubReadingMode: 'pages' }))
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('lumaread-documents', 7)
      request.onupgradeneeded = () => {
        const db = request.result
        const create = (name, options, indexes = []) => {
          if (db.objectStoreNames.contains(name)) return request.transaction.objectStore(name)
          const store = db.createObjectStore(name, options)
          for (const [index, keyPath, indexOptions] of indexes) store.createIndex(index, keyPath, indexOptions)
          return store
        }
        create('documents', { keyPath: 'document.id' }, [['fingerprint', 'document.fingerprint', { unique: true }]])
        create('locations', { keyPath: 'documentId' })
        create('readingActivity', { keyPath: 'key' }, [['lastOpenedAt', 'lastOpenedAt'], ['lastReadAt', 'lastReadAt']])
        create('bookmarks', { keyPath: 'id' }, [['resourceKey', 'resourceKey'], ['createdAt', 'createdAt'], ['updatedAt', 'updatedAt'], ['anchorKey', 'anchorKey', { unique: true }]])
        create('annotations', { keyPath: 'id' }, [['resourceKey', 'resourceKey'], ['createdAt', 'createdAt'], ['updatedAt', 'updatedAt'], ['anchorKey', 'anchorKey'], ['resourceAnchor', ['resourceKey', 'anchorKey'], { unique: true }]])
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const source = new Blob([Uint8Array.from(atob(epubBase64), (character) => character.charCodeAt(0))], { type: 'application/epub+zip' })
    const { adapterFor } = await import('/src/document-adapters/index.ts')
    const parsed = await (await adapterFor('epub')).parse({ blob: source, fileName: 'pages-boundary-fixture.epub', size: source.size })
    const record = {
      document: { id: 'pages-boundary-fixture', format: 'epub', fileName: 'pages-boundary-fixture.epub', fileSize: source.size, importedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), metadata: parsed.metadata, fingerprint: 'pages-boundary-fixture', status: 'ready' },
      source, sections: parsed.sections,
      capabilities: parsed.capabilities, contentSchemaVersion: 2,
    }
    const tx = database.transaction(['documents'], 'readwrite')
    tx.objectStore('documents').put(record)
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error) })
    database.close()
  }, { epubBase64 })
}

async function pageGeometry(page) {
  return page.locator('.reader-article--pages').evaluate((article) => {
    const style = getComputedStyle(article)
    const allParagraphs = [...article.querySelectorAll('.reader-prose p[data-reader-block-id]')]
    const starts = allParagraphs.slice(1).map((paragraph) => {
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
      const node = walker.nextNode()
      if (!node?.textContent) return undefined
      const range = document.createRange()
      range.setStart(node, 0); range.setEnd(node, Math.min(node.textContent.length, 8))
      return range.getBoundingClientRect().left + article.scrollLeft
    }).filter((value) => value !== undefined).sort((a, b) => a - b)
    const clusters = []
    for (const value of starts) {
      const last = clusters.at(-1)
      if (last && Math.abs(last.center - value) < 3) { last.sum += value; last.count += 1; last.center = last.sum / last.count }
      else clusters.push({ center: value, sum: value, count: 1 })
    }
    const differences = clusters.slice(1).map((cluster, index) => cluster.center - clusters[index].center).filter((value) => value > 10)
    const bins = new Map()
    for (const difference of differences) { const bin = Math.round(difference); bins.set(bin, (bins.get(bin) ?? 0) + 1) }
    const modeBin = [...bins].sort((a, b) => b[1] - a[1])[0]?.[0]; const pitchSamples = differences.filter((value) => Math.round(value) === modeBin); const measuredColumnPitch = pitchSamples.length ? pitchSamples.reduce((sum, value) => sum + value, 0) / pitchSamples.length : null
    const rect = article.getBoundingClientRect()
    const contentAreaWidth = rect.width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth) - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const stride = (Number.parseFloat(style.columnWidth) || article.clientWidth) + (Number.parseFloat(style.columnGap) || 0)
    const visibleColumnIndices = new Set()
    const visibleBlockIds = []
    for (const paragraph of allParagraphs) {
      const range = document.createRange(); range.selectNodeContents(paragraph)
      let visible = false
      for (const line of range.getClientRects()) {
        if (line.right <= rect.left + 1 || line.left >= rect.right - 1 || line.bottom <= rect.top || line.top >= rect.bottom) continue
        visible = true
        const index = Math.floor((line.left - rect.left + article.scrollLeft) / Math.max(1, stride))
        visibleColumnIndices.add(index)
      }
      if (visible) visibleBlockIds.push(paragraph.dataset.readerBlockId)
    }
    return {
      viewport: { width: innerWidth, height: innerHeight },
      clientWidth: article.clientWidth, clientHeight: article.clientHeight,
      contentWidth: contentAreaWidth,
      paddingLeft: parseFloat(style.paddingLeft), paddingRight: parseFloat(style.paddingRight),
      computedColumnWidth: style.columnWidth, columnGap: style.columnGap,
      computedStride: stride, measuredColumnPitch, measuredColumnWidth: measuredColumnPitch === null ? null : measuredColumnPitch - parseFloat(style.columnGap), scrollLeft: article.scrollLeft,
      scrollWidth: article.scrollWidth, pageCountLabel: document.querySelector('.reader-page-navigation span')?.textContent,
      visibleColumnIndices: [...visibleColumnIndices], visibleBlockIds, rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
      scrollOverflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
    }
  })
}

async function assertBoundary(page, label) {
  const geometry = await pageGeometry(page)
  if (geometry.visibleColumnIndices.length !== 1) throw new Error(`${label}: adjacent columns share the viewport: ${JSON.stringify(geometry)}`)
  if (geometry.scrollOverflow) throw new Error(`${label}: document has horizontal window overflow: ${JSON.stringify(geometry)}`)
  if (geometry.measuredColumnPitch !== null && Math.abs(geometry.measuredColumnPitch - geometry.computedStride) > 2) throw new Error(`${label}: actual rendered column pitch differs from computed stride: ${JSON.stringify(geometry)}`)
  return geometry
}

const edgePath = process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true })
let browser
try {
  await mkdir(evidence, { recursive: true })
  for (let attempts = 0; attempts < 80; attempts += 1) {
    try { const response = await fetch(baseUrl); if (response.ok) break } catch { await delay(250) }
  }
  browser = await chromium.launch({ headless: true, executablePath: edgePath, args: ['--disable-gpu'] })
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  const epubBase64 = await createEpub()
  await seedPage(page, epubBase64)
  await page.goto(`${baseUrl}/reader/pages-boundary-fixture`)
  await page.getByRole('navigation', { name: 'Page navigation' }).waitFor()
  await page.locator('.reader-article--pages').waitFor()
  const evidenceRows = []
  const turn = async (name) => { await page.locator(`.reader-page-navigation button[aria-label=\"${name}\"]`).evaluate((button) => button.click()); await page.waitForTimeout(30) }

  // Save a reproducible baseline visual and record its computed stride against the rendered pitch.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addStyleTag({ content: `@media(max-width:767px){.reader-article--pages{padding:28px 20px!important;--reader-page-column-width:calc(100vw - 108px)!important}}` })
  const baselineFirst = await pageGeometry(page)
  await page.screenshot({ path: `${evidence}baseline-390-first.png`, fullPage: false })
  await turn('Next page'); await turn('Next page')
  await page.locator('.reader-article--pages').evaluate((article) => { const style = getComputedStyle(article); const oldStride = parseFloat(style.columnWidth) + parseFloat(style.columnGap); article.scrollTo({ left: oldStride * 2, behavior: 'auto' }) })
  await page.waitForTimeout(50)
  const baselineThird = await pageGeometry(page)
  if (baselineThird.visibleColumnIndices.length < 2 || baselineThird.measuredColumnPitch === baselineThird.computedStride) throw new Error(`The original page-3 geometry did not reproduce adjacent-page leakage: ${JSON.stringify(baselineThird)}`)
  await page.screenshot({ path: `${evidence}baseline-390-page3.png`, fullPage: false })
  evidenceRows.push({ phase: 'baseline-css-page1', ...baselineFirst }, { phase: 'baseline-css-page3', ...baselineThird })
  await page.evaluate(() => document.querySelector('.reader-article--pages').style.removeProperty('column-width'))
  await page.reload()
  await page.locator('.reader-article--pages').waitFor()

  for (const viewport of (process.env.E2E_RESIZE_ONLY ? [{ width: 1440, height: 900 }] : process.env.E2E_VIEWPORT_ONLY ? [{ width: Number(process.env.E2E_VIEWPORT_ONLY), height: Number(({ 390: 844, 413: 699, 834: 1112, 1440: 900 })[process.env.E2E_VIEWPORT_ONLY]) }] : [{ width: 390, height: 844 }, { width: 413, height: 699 }, { width: 834, height: 1112 }, { width: 1440, height: 900 }])) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(180)
    const article = page.locator('.reader-article--pages')
    const navLabel = page.locator('.reader-page-navigation span')
    await page.waitForFunction(() => document.querySelector('.reader-page-navigation span')?.textContent?.includes(' / '))
    const getIndex = async () => Number((await navLabel.textContent()).match(/^(\d+)/)?.[1] ?? 0) - 1
    const pages = Number((await navLabel.textContent()).match(/\/\s*(\d+)/)?.[1] ?? 1)

    const positions = [0, Math.floor((pages - 1) / 2), pages - 1]
    for (const target of [...new Set(positions)]) {
      let current = await getIndex()
      while (current < target) { await turn('Next page'); current = await getIndex() }
      while (current > target) { await turn('Previous page'); current = await getIndex() }
      const label = `${viewport.width}x${viewport.height}-page-${target + 1}`
      const geometry = await assertBoundary(page, label)
      if (target === pages - 1 && Math.abs(geometry.scrollLeft - target * geometry.measuredColumnPitch) > 2) throw new Error(`${label}: accumulated page-position drift exceeded 2px: ${JSON.stringify(geometry)}`)
      if (target === positions[0] && viewport.width === 390) {
        await turn('Next page'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(30)
        if (await getIndex() !== 2) throw new Error('ArrowRight did not advance exactly one page')
        await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(30)
        if (await getIndex() !== 1) throw new Error('ArrowLeft did not return exactly one page')
        await turn('Previous page')
      }
      await page.screenshot({ path: `${evidence}${label}.png`, fullPage: false })
      evidenceRows.push({ phase: 'after-fix', label, ...geometry })
      if (target + 1 < pages) {
        const before = await article.evaluate((element) => element.scrollLeft)
        await turn('Next page')
        const after = await article.evaluate((element) => element.scrollLeft)
        const moved = after - before
        const expectedPitch = geometry.measuredColumnPitch ?? geometry.computedStride
        if (Math.abs(moved - expectedPitch) > 2) throw new Error(`${label}: page movement ${moved}px differs from measured column pitch ${expectedPitch}px; ${JSON.stringify(geometry)}`)
        await turn('Previous page')
      }
    }

    if (viewport.width === 1440 && pages >= 4) {
      let index = await getIndex()
      while (index > 2) { await turn('Previous page'); index = await getIndex() }
      while (index < 2) { await turn('Next page'); index = await getIndex() }
      evidenceRows.push({ phase: 'before-midpage-resize', ...(await pageGeometry(page)) })
      if (await getIndex() !== 2) throw new Error(`Expected to be on chapter page 3 before resizing, found ${await navLabel.textContent()}`)
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(180)
      const narrowAfterResize = await assertBoundary(page, 'resize-midpage-narrow')
      if (Number(narrowAfterResize.pageCountLabel.match(/^(\d+)/)?.[1]) <= 1) throw new Error('Shrinking at page 3 reset the reader to the beginning')
      evidenceRows.push({ phase: 'resize-midpage-narrow', ...narrowAfterResize })
      await page.screenshot({ path: `${evidence}resize-midpage-narrow.png`, fullPage: false })
      await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(180)
      const wideAfterResize = await assertBoundary(page, 'resize-midpage-wide')
      if (Number(wideAfterResize.pageCountLabel.match(/^(\d+)/)?.[1]) <= 1) throw new Error('Widening after the shrink reset the reader to the beginning')
      evidenceRows.push({ phase: 'resize-midpage-wide', ...wideAfterResize })
      await page.screenshot({ path: `${evidence}resize-midpage-wide.png`, fullPage: false })

      let at = await getIndex()
      while (at < pages - 1) { await turn('Next page'); at = await getIndex() }
      await turn('Next page')
      await page.waitForFunction(() => document.querySelector('.reader-article--pages')?.dataset.readerSectionId === 'section-1')
      if (!(await navLabel.textContent()).startsWith('1 / 1')) throw new Error(`Short chapter should be one page, got ${await navLabel.textContent()}`)
      if (!(await article.innerText()).includes('SHORT-CHAPTER-END')) throw new Error('Short chapter content did not render at the chapter boundary')
      evidenceRows.push({ phase: 'short-chapter', ...(await assertBoundary(page, 'short-chapter')) })
      await page.screenshot({ path: `${evidence}short-chapter-one-page.png`, fullPage: false })
      await turn('Previous page')
      await page.waitForFunction(() => document.querySelector('.reader-article--pages')?.dataset.readerSectionId === 'section-0')
      at = await getIndex()
      while (at > 2) { await turn('Previous page'); at = await getIndex() }
      while (at < 2) { await turn('Next page'); at = await getIndex() }
      await page.waitForTimeout(650)
      const beforeReopen = await pageGeometry(page)
      const persistedBeforeReopen = await page.evaluate(async () => {
        const database = await new Promise((resolve, reject) => { const request = indexedDB.open('lumaread-documents', 7); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
        const location = await new Promise((resolve, reject) => { const request = database.transaction(['locations']).objectStore('locations').get('pages-boundary-fixture'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
        database.close()
        return location
      })
      evidenceRows.push({ phase: 'persisted-before-reopen', sectionId: persistedBeforeReopen?.sectionId, progressPercent: persistedBeforeReopen?.progressPercent, locator: persistedBeforeReopen?.locator })
      if (persistedBeforeReopen?.sectionId !== 'section-0' || persistedBeforeReopen.progressPercent <= 0) throw new Error(`The current long-chapter location was not persisted before reopening: ${JSON.stringify(persistedBeforeReopen)}`)
      await page.screenshot({ path: `${evidence}before-reopen-page3.png`, fullPage: false })
      await page.reload(); await page.locator('.reader-article--pages').waitFor()
      await page.waitForFunction(() => document.querySelector('.reader-page-navigation span')?.textContent?.includes(' / '))
      await page.waitForTimeout(100)
      const afterReopen = await assertBoundary(page, 'reopen-location')
      evidenceRows.push({ phase: 'reopen-location', before: beforeReopen, after: afterReopen })
      if (afterReopen.pageCountLabel.startsWith('1 /') || !afterReopen.visibleBlockIds.some((id) => beforeReopen.visibleBlockIds.includes(id))) throw new Error(`Reopening did not restore the visible source text: before=${JSON.stringify(beforeReopen)} after=${JSON.stringify(afterReopen)}`)
      await page.screenshot({ path: `${evidence}after-reopen-page3.png`, fullPage: false })
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.reload(); await page.locator('.reader-article--pages').waitFor()
  const pageBeforeFont = await pageGeometry(page)
  await page.locator('button[aria-label=\"Reading settings\"]').evaluate((button) => button.click())
  await page.locator('button[aria-label=\"Increase text size\"]').evaluate((button) => button.click())
  await page.waitForTimeout(100)
  evidenceRows.push({ phase: 'font-resize', before: pageBeforeFont, after: await assertBoundary(page, 'font-resize') })
  await page.getByRole('button', { name: 'Sans', exact: true }).click()
  await page.getByRole('button', { name: 'Relaxed', exact: true }).click()
  await page.waitForTimeout(100)
  evidenceRows.push({ phase: 'font-family-and-line-height', ...(await assertBoundary(page, 'font-family-and-line-height')) })
  await page.getByRole('button', { name: 'Scroll', exact: true }).click()
  if (await page.locator('.reader-main--pages').count()) throw new Error('Switching back to Scroll mode left the Pages viewport active')
  await page.getByRole('button', { name: 'Pages', exact: true }).click()
  await page.locator('.reader-article--pages').waitFor()
  await page.waitForTimeout(100)
  evidenceRows.push({ phase: 'return-to-pages-mode', ...(await assertBoundary(page, 'return-to-pages-mode')) })
  const widthInput = page.locator('input[aria-label=\"Text width\"]')
  for (const width of [48, 64, 80]) {
    await widthInput.evaluate((element, value) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(element, String(value)); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })) }, width)
    await page.waitForTimeout(100)
    evidenceRows.push({ phase: `text-width-${width}ch`, ...(await assertBoundary(page, `${width}ch`)) })
  }

  await page.evaluate((rows) => localStorage.setItem('luma-boundary-evidence', JSON.stringify(rows)), evidenceRows)
  await page.screenshot({ path: `${evidence}settings-width-80ch.png`, fullPage: false })
  await import('node:fs/promises').then(({ writeFile }) => writeFile(`${evidence}measurements.json`, `${JSON.stringify(evidenceRows, null, 2)}\n`))
  console.log(JSON.stringify(evidenceRows, null, 2))
} catch (error) {
  await import('node:fs/promises').then(({ writeFile }) => writeFile(`${evidence}measurements-partial.json`, `${JSON.stringify(evidenceRows, null, 2)}\n`)).catch(() => undefined)
  throw error
} finally {
  await browser?.close()
  server.kill()
}
