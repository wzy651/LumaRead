import { readFile, mkdir, writeFile, readdir, unlink } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

// Reproducible data conversion. All inputs/outputs stay inside the project.
const root = resolve(import.meta.dirname, '..')
const source = await readFile(resolve(root, '.local-cache/dictionary/ecdict.csv'))
const revision = 'bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b'
const expectedHash = '1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf'
if (createHash('sha256').update(source).digest('hex') !== expectedHash) throw new Error('Use the pinned upstream CSV; do not silently replace dictionary provenance.')
function* rows(text) {
  let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted }
    else if (!quoted && (c === ',' || c === '\n')) { row.push(cell.replace(/\r$/, '')); cell = ''; if (c === '\n') { yield row; row = [] } }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); yield row }
}
const entries = new Map(), exchanges = []
for (const row of rows(source.toString('utf8'))) {
  const [original, phonetic, definition, translation, , collins, , tag, bnc, frq, exchange] = row
  const word = original?.normalize('NFKC').toLowerCase().trim()
  if (!word || !translation || !/^[a-z][a-z '-]{0,79}$/.test(word)) continue
  const ranked = (Number(bnc) > 0 && Number(bnc) <= 40000) || (Number(frq) > 0 && Number(frq) <= 40000)
  const phrase = /^(put|get|take|come|go|look|give|make|turn|bring|hold|break|set|keep|run|pick|carry|find|call|point|work|in|at|on|by|out|as|for|so|even|rather) /.test(word) && word.split(' ').length <= 4
  if (!(ranked || tag || Number(collins) > 0 || phrase)) continue
  entries.set(word, [word, phonetic ?? '', translation.replaceAll('\\n', '\n'), (definition ?? '').replaceAll('\\n', '\n')])
  if (exchange) exchanges.push([word, exchange])
}
for (const [word, exchange] of exchanges) {
  for (const item of exchange.split('/')) {
    const [kind, variant] = item.split(':')
    if ('pdi3rts'.includes(kind) && variant && /^[a-z][a-z'-]*$/.test(variant) && !entries.has(variant)) entries.set(variant, word)
  }
}
const shards = new Map()
for (const [word, entry] of [...entries].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
  const key = word.slice(0, 2).replace(/[^a-z]/g, '_')
  if (!shards.has(key)) shards.set(key, Object.create(null))
  shards.get(key)[word] = entry
}
const out = resolve(root, 'public/dictionary')
await mkdir(out, { recursive: true })
// Remove obsolete shards from this generated-data directory only.
for (const name of await readdir(out)) if (/^[a-z_]{1,2}\.json$/.test(name) && !shards.has(name.slice(0, -5))) await unlink(resolve(out, name))
for (const [key, value] of shards) await writeFile(resolve(out, `${key}.json`), JSON.stringify(value))
await writeFile(resolve(out, 'meta.json'), JSON.stringify({ source: 'ECDICT', revision, sourceSha256: expectedHash, license: 'MIT', entries: entries.size, shards: [...shards.keys()].sort(), filter: 'BNC/FRQ <= 40000, exam tags, Collins, and selected common-prefix phrases of up to four words; exchange aliases' }, null, 2))
await writeFile(resolve(out, 'LICENSE.txt'), await readFile(resolve(root, '.local-cache/dictionary/LICENSE')))
console.log(`Built ${entries.size} entries/aliases in ${shards.size} lazy shards.`)
