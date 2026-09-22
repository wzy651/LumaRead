import JSZip from 'jszip'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { DocumentSource } from '../domain/documents'

const epubCalls = vi.hoisted(() => ({ opens: 0 }))
vi.mock('epubjs', async (importOriginal) => { const actual = await importOriginal<typeof import('epubjs')>(); return { ...actual, default: (...args: Parameters<typeof actual.default>) => { epubCalls.opens += 1; return actual.default(...args) } } })
import { epubAdapter } from './epub-adapter'

beforeAll(() => { Object.assign(globalThis, { DOMParser, XMLSerializer, window: globalThis }); const elementPrototype = Object.getPrototypeOf(new DOMParser().parseFromString('<root/>', 'application/xml').documentElement); if (!Object.hasOwn(elementPrototype, 'children')) Object.defineProperty(elementPrototype, 'children', { get() { return Array.from(this.childNodes).filter((node) => (node as Node).nodeType === 1) } }) })

type Chapter = { name: string; body: string }
async function fixture({ title = 'A Small Book', includeSpine = true, chapters = [{ name: 'one.xhtml', body: '<h1>One</h1><p>First.</p>' }, { name: 'two.xhtml', body: '<h2>Two</h2><p>Second.</p>' }], nav = true }: { title?: string; includeSpine?: boolean; chapters?: Chapter[]; nav?: boolean } = {}) {
  const zip = new JSZip(); zip.file('mimetype', 'application/epub+zip'); zip.file('META-INF/container.xml', '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
  const manifest = chapters.map((chapter, index) => `<item id="c${index}" href="${chapter.name}" media-type="application/xhtml+xml"/>`).join('') + (nav ? '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' : '')
  const spine = includeSpine ? `<spine>${chapters.map((_, index) => `<itemref idref="c${index}"/>`).join('')}</spine>` : ''
  zip.file('OPS/book.opf', `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">sample</dc:identifier><dc:title>${title}</dc:title><dc:creator>Ada</dc:creator><dc:language>en</dc:language><dc:description>A description</dc:description></metadata><manifest>${manifest}</manifest>${spine}</package>`)
  chapters.forEach((chapter) => zip.file(`OPS/${chapter.name}`, `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter</title></head><body>${chapter.body}</body></html>`))
  if (nav) zip.file('OPS/nav.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol>${chapters.map((chapter, index) => `<li><a href="${chapter.name}">Navigation ${index + 1}</a></li>`).join('')}</ol></nav></body></html>`)
  const bytes = await zip.generateAsync({ type: 'uint8array' }); const blob = new Blob([bytes as unknown as ArrayBuffer]); return { blob, fileName: 'sample.epub', size: blob.size } satisfies DocumentSource
}

describe('EPUB adapter', () => {
  it('uses epub.js for a minimal EPUB, metadata, navigation, and spine order', async () => { epubCalls.opens = 0; const parsed = await epubAdapter.parse(await fixture()); expect(epubCalls.opens).toBe(1); expect(parsed.metadata).toMatchObject({ title: 'A Small Book', author: 'Ada', language: 'en', description: 'A description', sectionCount: 2 }); expect(parsed.sections.map(({ id, order, title }) => ({ id, order, title }))).toEqual([{ id: 'section-0', order: 0, title: 'Navigation 1' }, { id: 'section-1', order: 1, title: 'Navigation 2' }]); expect(parsed.capabilities).toMatchObject({ reflowable: true, supportsTextSelection: true, supportsTableOfContents: true, supportsPagination: false, supportsSearch: false, supportsReadAloud: false }) })
  it('converts safe XHTML structure into stable reader blocks', async () => { const parsed = await epubAdapter.parse(await fixture({ chapters: [{ name: 'chapter.xhtml', body: '<h2>Heading</h2><p>Paragraph <img src="https://bad.example/a.png" onerror="boom"/>text.</p><blockquote>Quote</blockquote><ul><li>Bullet</li></ul><ol><li>Number</li></ol><hr epub:type="pagebreak"/><script>bad()</script><iframe src="https://bad.example"></iframe>' }] })); expect(parsed.sections[0].blocks).toEqual([{ id: 'block-0', type: 'heading', text: 'Heading', order: 0, level: 2 }, { id: 'block-1', type: 'paragraph', text: 'Paragraph text.', order: 1 }, { id: 'block-2', type: 'blockquote', text: 'Quote', order: 2 }, { id: 'block-3', type: 'list-item', text: 'Bullet', order: 3, ordered: false }, { id: 'block-4', type: 'list-item', text: 'Number', order: 4, ordered: true }, { id: 'block-5', type: 'page-break', text: '', order: 5 }]) })
  it('rejects invalid ZIP data and missing package/spine data', async () => { const bad = new Blob(['not a zip']); await expect(epubAdapter.supports({ blob: bad, fileName: 'bad.epub', size: bad.size })).resolves.toBe(false); await expect(epubAdapter.parse({ blob: bad, fileName: 'bad.epub', size: bad.size })).rejects.toMatchObject({ code: 'invalid-document' }); await expect(epubAdapter.parse(await fixture({ includeSpine: false }))).rejects.toMatchObject({ code: 'invalid-document' }) })
  it('uses the file name for missing title and rejects empty spine content', async () => { const missingTitle = await fixture({ title: '' }); const parsed = await epubAdapter.parse({ ...missingTitle, fileName: 'fallback.epub' }); expect(parsed.metadata.title).toBe('fallback'); await expect(epubAdapter.parse(await fixture({ chapters: [{ name: 'empty.xhtml', body: '<script>bad()</script><iframe></iframe>' }] }))).rejects.toMatchObject({ code: 'empty-file' }) })
  it('only reads a signature slice in supports and the complete blob once in parse', async () => { const original = await fixture(); let fullReads = 0; let slices = 0; const blob = { size: original.blob.size, arrayBuffer: async () => { fullReads += 1; return original.blob.arrayBuffer() }, slice: (...args: Parameters<Blob['slice']>) => { slices += 1; return original.blob.slice(...args) } } as unknown as Blob; const source = { ...original, blob }; await expect(epubAdapter.supports(source)).resolves.toBe(true); expect({ fullReads, slices }).toEqual({ fullReads: 0, slices: 1 }); await epubAdapter.parse(source); expect(fullReads).toBe(1) })
  it('keeps safe UTF-16 ranges and resolves same- and cross-section links after both phases', async () => {
    const parsed = await epubAdapter.parse(await fixture({ chapters: [
      { name: 'Text/one.xhtml', body: '<h1 id="start">One</h1><p>😀 Before <a href="#note" epub:type="noteref">note</a> and <a href="#note">note</a>.</p><aside id="note" epub:type="footnote"><p id="note-text">A <strong>safe</strong> note.</p></aside><p><a href="two.xhtml#target">Next</a> <a href="https://bad.example">remote</a> <a href="javascript:bad()">bad</a></p>' },
      { name: 'Text/two.xhtml', body: '<h2 id="target">Two</h2><p>Destination.</p>' },
    ] }))
    const first = parsed.sections[0].blocks.find((block) => block.type === 'paragraph' && block.text.startsWith('😀'))!
    expect(first.text).toBe('😀 Before note and note.')
    expect(first.links).toHaveLength(2)
    expect(first.links?.map((link) => [link.start, link.end, link.role, link.target])).toEqual([
      [10, 14, 'noteref', { sectionId: 'section-0', blockId: 'block-2' }],
      [19, 23, 'noteref', { sectionId: 'section-0', blockId: 'block-2' }],
    ])
    const cross = parsed.sections[0].blocks.find((block) => block.text.startsWith('Next'))!
    expect(cross.links).toEqual([{ id: 'block-3-link-0', start: 0, end: 4, role: 'link', target: { sectionId: 'section-1', blockId: 'block-0' } }])
    expect(cross.text).toContain('remote')
    expect(cross.links).toHaveLength(1)
  })

  it('keeps missing same- and cross-section fragments as plain text while allowing chapter-only hrefs', async () => {
    const parsed = await epubAdapter.parse(await fixture({ chapters: [
      { name: 'one.xhtml', body: '<p><a href="#missing">same missing</a> <a href="two.xhtml#missing">cross missing</a> <a href="two.xhtml">chapter only</a></p>' },
      { name: 'two.xhtml', body: '<h1 id="present">Two</h1><p>Destination</p>' },
    ] }))
    const links = parsed.sections[0].blocks[0].links
    expect(links).toEqual([{ id: 'block-0-link-2', start: 27, end: 39, role: 'link', target: { sectionId: 'section-1' } }])
    expect(parsed.capabilities.supportsInternalLinks).toBe(true)
    const missingOnly = await epubAdapter.parse(await fixture({ chapters: [{ name: 'one.xhtml', body: '<p><a href="#missing">missing</a></p>' }] }))
    expect(missingOnly.sections[0].blocks[0].links).toEqual([])
    expect(missingOnly.capabilities.supportsInternalLinks).toBe(false)
  })

  it('rejects malformed fragments, unsafe protocols, and paths outside the EPUB root', async () => {
    const parsed = await epubAdapter.parse(await fixture({ chapters: [{ name: 'Text/one.xhtml', body: '<p><a href="#bad%">bad</a> <a href="../../outside.xhtml">outside</a> <a href="https://example.com">http</a> <a href="mailto:a@example.com">mail</a> <a href="javascript:alert(1)">js</a> <a href="data:text/plain,x">data</a> <a href="//example.com/x">protocol</a></p>' }] }))
    expect(parsed.sections[0].blocks[0].links).toEqual([])
    expect(parsed.capabilities.supportsInternalLinks).toBe(false)
  })

  it('resolves a same-chapter fragment to the exact block and preserves nested inline text', async () => {
    const parsed = await epubAdapter.parse(await fixture({ chapters: [{ name: 'chapter.xhtml', body: '<h1 id="start">Start</h1><p>  Read <strong><em><span>note</span></em></strong>  <a href="#start">again</a></p>' }] }))
    const block = parsed.sections[0].blocks[1]
    expect(block.text).toBe('Read note again'); expect(block.links?.[0].start).toBe(10); expect(block.links?.[0].end).toBe(15); expect(block.links?.[0].target).toEqual({ sectionId: 'section-0', blockId: 'block-0' })
  })

  it('resolves parent-directory hrefs without crossing the EPUB root', async () => {
    const parsed = await epubAdapter.parse(await fixture({ chapters: [{ name: 'Text/one.xhtml', body: '<p><a href="../two.xhtml#target">parent</a></p>' }, { name: 'two.xhtml', body: '<h1 id="target">Target</h1>' }] }))
    expect(parsed.sections[0].blocks[0].links?.[0].target).toEqual({ sectionId: 'section-1', blockId: 'block-0' })
  })

  it('uses deterministic first-block container anchors and exact anchors per chapter', async () => {
    const parsed = await epubAdapter.parse(await fixture({ chapters: [
      { name: 'a/one.xhtml', body: '<div id="body-anchor"><aside id="note" epub:type="footnote"><p>first</p><p id="second">second</p></aside><p><a href="#note">note</a> <a href="#body-anchor">body</a></p></div>' },
      { name: 'b/two.xhtml', body: '<h1 id="same">Other</h1><p><a href="../a/one.xhtml#same">missing same chapter</a></p>' },
    ] }))
    const note = parsed.sections[0].blocks.find((block) => block.text === 'first')!
    const source = parsed.sections[0].blocks.find((block) => block.text.startsWith('note'))!
    expect(source.links?.[0].target).toEqual({ sectionId: 'section-0', blockId: note.id })
    expect(source.links?.[1].target).toEqual({ sectionId: 'section-0', blockId: 'block-0' })
    expect(parsed.sections[0].blocks.find((block) => block.text === 'second')?.anchors).not.toContain('note')
    expect(parsed.sections[1].blocks.find((block) => block.text.startsWith('missing'))?.links).toEqual([])
  })

  it('isolates repeated fragment ids between chapters and supports encoded relative paths', async () => {
    const parsed = await epubAdapter.parse(await fixture({ chapters: [
      { name: 'Text/one.xhtml', body: '<p><a href="two%20dir/two%20file.xhtml#target%20id">go</a></p>' },
      { name: 'Text/two dir/two file.xhtml', body: '<h1 id="target id">Target</h1>' },
      { name: 'Other/two dir/two file.xhtml', body: '<h1 id="target id">Other target</h1>' },
    ] }))
    expect(parsed.sections[0].blocks[0].links?.[0].target).toEqual({ sectionId: 'section-1', blockId: 'block-0' })
    expect(parsed.sections[1].blocks[0].id).toBe('block-0')
    expect(parsed.sections[2].blocks[0].id).toBe('block-0')
  })

  it('produces stable block and link ids across repeated parses', async () => {
    const source = await fixture({ chapters: [{ name: 'one.xhtml', body: '<p><a href="#target">same</a> <a href="#target">same</a></p><p id="target">Target</p>' }] })
    const first = await epubAdapter.parse(source); const second = await epubAdapter.parse(source)
    expect(second.sections).toEqual(first.sections); expect(first.capabilities.supportsInternalLinks).toBe(true)
  })
})
