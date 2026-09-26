import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'
import JSZip from 'jszip'

const root = fileURLToPath(new URL('../../', import.meta.url))
const artifacts = fileURLToPath(new URL('../../.qa-artifacts/reading-help/', import.meta.url))
const base = 'http://127.0.0.1:4329'
const requests = [], errors = [], results = []
const modelServer = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', base); res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  let body = ''; for await (const chunk of req) body += chunk
  const data = JSON.parse(body); requests.push({ model: data.model, messages: data.messages })
  await delay(180)
  const simplified = data.messages[0].content.includes('Rewrite')
  res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: simplified ? 'She sat beside the river.' : '这里 bank 指河岸。of the river 说明它不是银行。' } }] }))
})
const sentence = 'She reluctantly sat on the bank of the river. She went home before sunset.'
async function docx() {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="document" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${sentence}</w:t></w:r></w:p></w:body></w:document>`)
  return zip.generateAsync({ type: 'nodebuffer' })
}
async function epub() {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
  zip.file('book.opf', '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">reading-help-qa</dc:identifier><dc:title>Reading Help EPUB</dc:title><dc:language>en</dc:language></metadata><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>')
  zip.file('one.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>River</title></head><body><h1>River</h1>${Array.from({ length: 80 }, (_, i) => `<p>${sentence} Passage ${i + 1}. ${sentence}</p>`).join('')}</body></html>`)
  zip.file('two.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Home</title></head><body><h1>Home</h1><p>${sentence}</p></body></html>`)
  return zip.generateAsync({ type: 'nodebuffer' })
}
function pdf() {
  const stream = `BT /F1 18 Tf 50 760 Td (${sentence}) Tj ET`
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 900 840] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`]
  let file = '%PDF-1.4\n'; const offsets = [0]
  for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(file)); file += `${i + 1} 0 obj\n${objects[i]}\nendobj\n` }
  const xref = Buffer.byteLength(file); file += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(file)
}
async function importBook(page, name, mimeType, buffer) {
  await page.goto(`${base}/library`)
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Import document', exact: true }).click()
  await (await chooser).setFiles({ name, mimeType, buffer })
  await page.getByRole('button', { name: 'Open now', exact: true }).click()
  await page.locator('.reader-prose, .pdf-text-layer').first().waitFor()
}
async function clickWord(page, word, scope = '.reader-prose') {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const point = await page.locator(scope).first().evaluate((element, word) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const index = node.textContent.indexOf(word); if (index < 0) continue
      const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + word.length)
      const rect = [...range.getClientRects()].find((r) => r.left >= 0 && r.top > 0 && r.right <= innerWidth && r.bottom <= innerHeight)
      if (rect) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }
    throw new Error(`No visible ${word}`)
  }, word)
  if (page.viewportSize()?.width === 390) await page.touchscreen.tap(point.x, point.y)
  else await page.mouse.click(point.x, point.y)
  await page.getByRole('dialog', { name: 'Quick meaning', exact: true }).waitFor()
  await page.getByText('ECDICT · 离线词典 · 通用释义', { exact: true }).waitFor()
}
let browser
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...(process.env.READING_HELP_PREVIEW ? ['preview'] : []), '--host', '127.0.0.1', '--port', '4329', '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true })
try {
  await mkdir(artifacts, { recursive: true })
  await new Promise((resolve) => modelServer.listen(4330, '127.0.0.1', resolve))
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break } catch { /* server starting */ } await delay(250) }
  browser = await chromium.launch({ headless: true, executablePath: process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true, reducedMotion: 'reduce' })
  const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => { window.__qaEvents = []; for (const type of ['pointerdown', 'pointerup', 'click', 'pointercancel']) document.addEventListener(type, (event) => { window.__qaEvents.push({ type, x: event.clientX, y: event.clientY, detail: event.detail, target: event.target?.className, text: event.target?.textContent?.slice(0, 90), selection: getSelection()?.toString() }); if (window.__qaEvents.length > 20) window.__qaEvents.shift() }, true) })
  await importBook(page, 'A quiet story.txt', 'text/plain', Buffer.from(`${sentence}\n\n${sentence}`))
  const txtUrl = page.url()
  await clickWord(page, 'bank'); assert.match(await page.locator('.lookup-definition').first().innerText(), /银行/); assert.equal(requests.length, 0)
  await page.getByRole('button', { name: '这里是什么意思', exact: true }).click()
  await page.getByLabel('服务地址', { exact: true }).fill('http://127.0.0.1:4330/v1')
  await page.getByLabel('模型 ID', { exact: true }).fill('QA-contract-fixture')
  await page.getByLabel('API Key', { exact: true }).fill('TEST-ONLY-NOT-A-SECRET')
  await page.getByRole('button', { name: '保存设置', exact: true }).click()
  await page.getByRole('button', { name: '这里是什么意思', exact: true }).click()
  await page.getByText('这里 bank 指河岸。of the river 说明它不是银行。', { exact: true }).waitFor()
  assert.equal(requests.length, 1); assert.equal(JSON.parse(requests[0].messages[1].content).selectedText, 'bank')
  await page.screenshot({ path: `${artifacts}/desktop-context.png` })
  await page.getByRole('button', { name: 'Simple English', exact: true }).click()
  await page.getByText('She sat beside the river.', { exact: true }).waitFor()
  await page.getByRole('button', { name: '加入学习', exact: true }).click()
  await page.getByRole('button', { name: '已加入学习 · 撤销', exact: true }).waitFor()
  const stored = await page.evaluate(() => JSON.stringify(localStorage)); assert.ok(!stored.includes('TEST-ONLY'))
  await page.keyboard.press('Escape'); assert.equal(page.url(), txtUrl); assert.equal(await page.getByRole('dialog').count(), 0)
  results.push('TXT actual browser DOM hit-testing; offline dictionary; context request; simplify; explicit learning; Escape; session-only credential')
  await clickWord(page, 'reluctantly'); assert.match(await page.locator('.lookup-definition').first().innerText(), /不情愿|勉强/); assert.equal(requests.length, 2)
  await page.keyboard.press('Escape')
  await page.locator('.reader-prose p').first().evaluate((element) => { const range = document.createRange(); range.selectNodeContents(element); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range) })
  await page.keyboard.press('Control+Shift+L'); await page.getByRole('dialog', { name: 'Quick meaning', exact: true }).waitFor(); assert.match(await page.locator('.lookup-heading').innerText(), /river/)
  await page.keyboard.press('Escape')
  results.push('Selected sentence keyboard lookup')
  for (const [width, height] of [[390, 844], [834, 1112], [1440, 900]]) {
    await page.setViewportSize({ width, height }); await clickWord(page, 'bank')
    const box = await page.getByRole('dialog', { name: 'Quick meaning', exact: true }).boundingBox()
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    await page.screenshot({ path: `${artifacts}/lookup-${width}.png` }); await page.keyboard.press('Escape')
  }
  results.push('Dictionary panels at 390 / 834 / 1440 without horizontal overflow')
  await importBook(page, 'Reading Help.epub', 'application/epub+zip', await epub())
  await page.mouse.move(50, 5); await page.getByRole('button', { name: 'Reading settings', exact: true }).click(); await page.getByRole('button', { name: 'Pages', exact: true }).click(); await page.keyboard.press('Escape')
  await page.locator('.reader-article--pages').waitFor(); await clickWord(page, 'bank'); await page.keyboard.press('Escape')
  await page.keyboard.press('ArrowRight'); await delay(150); await clickWord(page, 'bank'); await page.keyboard.press('Escape')
  results.push('EPUB Pages lookup before and after page turn')
  await importBook(page, 'Reading Help.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', await docx())
  await clickWord(page, 'bank'); await page.keyboard.press('Escape')
  results.push('DOCX local import and offline lookup')
  await importBook(page, 'Reading Help.pdf', 'application/pdf', pdf())
  await page.locator('.pdf-text-layer span').first().waitFor(); await clickWord(page, 'bank', '.pdf-text-layer'); await page.keyboard.press('Escape')
  results.push('PDF original TextLayer lookup')
  await page.goto(`${base}/reader/pride-and-prejudice`)
  const demoWord = page.locator('.reader-word').first(); await demoWord.focus(); await page.keyboard.press('Enter')
  await page.getByText('ECDICT · 离线词典 · 通用释义', { exact: true }).waitFor(); await page.keyboard.press('Escape')
  results.push('Built-in sample keyboard uses real dictionary, not fixture explanations')
  await page.goto(`${base}/settings`); await page.getByRole('heading', { name: '阅读帮助设置' }).waitFor(); await page.locator('.learning-history li').first().waitFor(); assert.equal(await page.getByLabel('API Key', { exact: true }).inputValue(), '')
  assert.deepEqual(errors, [])
  results.push('History persists after reload; API key is cleared')
  await page.goto(base)
  await page.getByRole('button', { name: '切换到深色主题', exact: true }).filter({ visible: true }).click()
  await page.goto(txtUrl); await clickWord(page, 'bank')
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  await page.screenshot({ path: `${artifacts}/lookup-dark.png` }); await page.keyboard.press('Escape')
  results.push('Dark theme lookup and reload persistence')
  await writeFile(`${artifacts}/${process.env.READING_HELP_PREVIEW ? 'production-' : ''}results.json`, JSON.stringify({ passed: results, model: 'Local HTTP contract fixture, not a live AI service', errors }, null, 2))
  console.log(JSON.stringify(results, null, 2))
} catch (error) { if (browser) { const pages = browser.contexts().flatMap((context) => context.pages()); if (pages[0]) { await pages[0].screenshot({ path: `${artifacts}/failure.png` }); await writeFile(`${artifacts}/failure-events.json`, JSON.stringify(await pages[0].evaluate(() => window.__qaEvents), null, 2)) } } throw error }
finally { if (browser) await browser.close(); await new Promise((resolve) => modelServer.close(resolve)); server.kill() }
