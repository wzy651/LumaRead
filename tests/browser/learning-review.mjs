import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('../../', import.meta.url))
const output = fileURLToPath(new URL('../../.qa-artifacts/learning-review/', import.meta.url))
const temp = fileURLToPath(new URL('../../.local-cache/tmp/', import.meta.url))
await mkdir(output, { recursive: true }); await mkdir(temp, { recursive: true })
process.env.TEMP = temp; process.env.TMP = temp; process.env.TMPDIR = temp
const base = 'http://127.0.0.1:4331'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4331', '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true })
let browser
const errors = [], requests = [], results = []
async function readStores(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const open = indexedDB.open('lumaread-learning'); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error) })
    try { return await new Promise((resolve, reject) => { const tx = db.transaction(['sessions', 'lookups', 'terms', 'reviewCards', 'reviewLogs']); const data = {}; for (const store of ['sessions', 'lookups', 'terms', 'reviewCards', 'reviewLogs']) { const read = tx.objectStore(store).getAll(); read.onsuccess = () => { data[store] = read.result } } tx.oncomplete = () => resolve(data); tx.onabort = () => reject(tx.error) }) } finally { db.close() }
  })
}
async function word(page, term) {
  await page.evaluate(() => document.fonts.ready)
  const point = await page.locator('.reader-prose').evaluate((element, term) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) { const start = node.textContent.indexOf(term); if (start < 0) continue; const range = document.createRange(); range.setStart(node, start); range.setEnd(node, start + term.length); const rect = range.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } }
    throw new Error('Missing word')
  }, term)
  await page.mouse.click(point.x, point.y)
  await page.getByRole('dialog', { name: 'Quick meaning', exact: true }).waitFor()
  await page.getByRole('button', { name: '加入学习', exact: true }).waitFor()
}
try {
  for (let attempt = 0; attempt < 80; attempt++) { try { if ((await fetch(base)).ok) break } catch { /* startup */ } await delay(250) }
  browser = await chromium.launch({ headless: true, executablePath: process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => { if (!request.url().startsWith(base) && !request.url().startsWith('data:')) requests.push(request.url()) })
  await page.goto(`${base}/review`)
  await page.getByRole('heading', { name: '现在可以安心读书。', exact: true }).waitFor()
  results.push('Fresh database has no mock review cards')
  await page.goto(`${base}/library`)
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Import document', exact: true }).click()
  await (await chooser).setFiles({ name: 'Gentle Review.txt', mimeType: 'text/plain', buffer: Buffer.from('She reluctantly sat on the bank of the river.\n\nThe quiet evening was beautiful.') })
  await page.getByRole('button', { name: 'Open now', exact: true }).click()
  await page.locator('.reader-prose').waitFor()
  const bookUrl = page.url()
  await page.bringToFront()
  await word(page, 'bank'); await page.getByRole('button', { name: '懂了，继续读', exact: true }).click()
  await word(page, 'bank'); await page.getByRole('button', { name: '懂了，继续读', exact: true }).click()
  await delay(1400)
  await page.keyboard.press('Escape')
  await page.waitForURL(base + '/')
  await page.getByRole('link', { name: 'Stats', exact: true }).filter({ visible: true }).click()
  await page.getByRole('heading', { name: '阅读足迹', exact: true }).waitFor()
  await page.getByRole('button', { name: '加入学习', exact: true }).waitFor()
  const before = await readStores(page)
  assert.equal(before.lookups.length, 2); assert.equal(before.reviewCards.length, 0)
  assert.ok(before.sessions.length === 1 && before.sessions[0].activeMs >= 1000)
  results.push('Actual foreground reading duration persisted; repeated lookup only suggests, not auto-enrolled')
  await page.getByRole('button', { name: '加入学习', exact: true }).click()
  await page.getByRole('link', { name: '开始轻复习 →', exact: true }).click()
  await page.getByRole('button', { name: '看看答案', exact: true }).click()
  await page.getByRole('heading', { name: 'bank', exact: true }).waitFor()
  await page.locator('.lookup-definition').filter({ hasText: /银行|岸/ }).waitFor()
  assert.match(await page.locator('.real-review').innerText(), /Gentle Review/)
  await page.getByRole('button', { name: '播放英语发音', exact: true }).waitFor()
  for (const [width, height] of [[390, 844], [834, 1112], [1440, 900]]) {
    await page.setViewportSize({ width, height })
    await page.getByRole('button', { name: '想起来了', exact: true }).scrollIntoViewIfNeeded()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    for (const rating of ['还没想起', '有点模糊', '想起来了', '很熟悉']) { const rect = await page.getByRole('button', { name: rating, exact: true }).boundingBox(); assert.ok(rect.width > 80 && rect.height >= 44) }
    await page.screenshot({ path: `${output}/review-${width}.png`, fullPage: true })
  }
  await page.getByRole('button', { name: '想起来了', exact: true }).click()
  await page.getByRole('heading', { name: '这样就很好。', exact: true }).waitFor()
  await page.reload(); await page.getByRole('heading', { name: '现在可以安心读书。', exact: true }).waitFor()
  const after = await readStores(page)
  assert.equal(after.reviewLogs.length, 1); assert.equal(after.reviewCards.length, 1)
  assert.equal(after.reviewLogs[0].scheduler, 'ts-fsrs@5.4.2'); assert.equal(after.terms[0].status, 'learning')
  assert.ok(Date.parse(after.reviewCards[0].schedule.due) > Date.now())
  results.push('Real original sentence, dictionary, phonetic/speech UI, self-rating; FSRS survives reload without duplicate review')
  await page.goto(bookUrl); await word(page, 'reluctantly')
  await page.getByRole('button', { name: '加入学习', exact: true }).click()
  await page.getByRole('button', { name: '已加入学习 · 撤销', exact: true }).waitFor()
  await page.getByRole('button', { name: '懂了，继续读', exact: true }).click()
  await page.keyboard.press('Escape'); await page.waitForURL(base + '/')
  await page.getByRole('link', { name: 'Start quick review', exact: true }).click()
  await page.getByRole('button', { name: '先跳过', exact: true }).click()
  assert.equal((await readStores(page)).reviewLogs.length, 1)
  results.push('Joining from lookup creates real review; skipping records no grade')
  await page.goto(`${base}/statistics`)
  await page.getByRole('heading', { name: '阅读足迹', exact: true }).waitFor()
  await page.getByRole('button', { name: '切换到深色主题', exact: true }).click()
  for (const [width, height] of [[390, 844], [834, 1112], [1440, 900]]) {
    await page.setViewportSize({ width, height }); await delay(80)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    await page.screenshot({ path: `${output}/statistics-dark-${width}.png`, fullPage: true })
  }
  await page.getByLabel('自动记录阅读时长', { exact: true }).uncheck()
  await page.reload(); assert.equal(await page.getByLabel('自动记录阅读时长', { exact: true }).isChecked(), false)
  await page.goto(`${base}/settings`)
  await page.getByText('此平台目前仅支持会话密钥；不会以明文替代安全存储。', { exact: true }).waitFor()
  assert.deepEqual(errors, []); assert.deepEqual(requests, [])
  results.push('Statistics dark responsive 390/834/1440, timer preference persists, no remote requests, honest browser credential limitation')
  await writeFile(`${output}/results.json`, JSON.stringify({ results, errors, requests, environment: 'Edge browser production build; not native Tauri/Android' }, null, 2))
  console.log(JSON.stringify(results, null, 2))
} catch (error) { if (browser) { const page = browser.contexts()[0]?.pages()[0]; if (page) await page.screenshot({ path: `${output}/failure.png`, fullPage: true }) } throw error }
finally { await browser?.close(); server.kill() }
