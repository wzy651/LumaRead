import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'
import { beforeAll, describe, expect, it } from 'vitest'
import type { DocumentSource } from '../domain/documents'
import { epubAdapter } from './epub-adapter'

beforeAll(() => { Object.assign(globalThis, { DOMParser }) })

type Chapter = { name: string; body: string }
async function fixture({ title = 'A Small Book', includeSpine = true, chapters = [{ name: 'one.xhtml', body: '<h1>One</h1><p>First.</p>' }, { name: 'two.xhtml', body: '<h2>Two</h2><p>Second.</p>' }], nav = true }: { title?: string; includeSpine?: boolean; chapters?: Chapter[]; nav?: boolean } = {}) {
  const zip = new JSZip(); zip.file('mimetype', 'application/epub+zip'); zip.file('META-INF/container.xml', '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
  const manifest = chapters.map((chapter, index) => `<item id="c${index}" href="${chapter.name}" media-type="application/xhtml+xml"/>`).join('') + (nav ? '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' : '')
  const spine = includeSpine ? `<spine>${chapters.map((_, index) => `<itemref idref="c${index}"/>`).join('')}</spine>` : ''
  zip.file('OPS/book.opf', `<package><metadata><dc:title xmlns:dc="urn:dc">${title}</dc:title><dc:creator xmlns:dc="urn:dc">Ada</dc:creator><dc:language xmlns:dc="urn:dc">en</dc:language><dc:description xmlns:dc="urn:dc">A description</dc:description></metadata><manifest>${manifest}</manifest>${spine}</package>`)
  chapters.forEach((chapter) => zip.file(`OPS/${chapter.name}`, `<html xmlns="http://www.w3.org/1999/xhtml"><body>${chapter.body}</body></html>`))
  if (nav) zip.file('OPS/nav.xhtml', `<html><body><nav epub:type="toc"><ol>${chapters.map((chapter, index) => `<li><a href="${chapter.name}">Navigation ${index + 1}</a></li>`).join('')}</ol></nav></body></html>`)
  const bytes = await zip.generateAsync({ type: 'uint8array' }); const blob = new Blob([bytes as unknown as ArrayBuffer]); return { blob, fileName: 'sample.epub', size: blob.size } satisfies DocumentSource
}

describe('EPUB adapter', () => {
  it('accepts a minimal EPUB, reads metadata, and follows its spine order', async () => { const parsed = await epubAdapter.parse(await fixture()); expect(parsed.metadata).toMatchObject({ title: 'A Small Book', author: 'Ada', language: 'en', description: 'A description', sectionCount: 2 }); expect(parsed.sections.map(({ id, order, title }) => ({ id, order, title }))).toEqual([{ id: 'section-0', order: 0, title: 'Navigation 1' }, { id: 'section-1', order: 1, title: 'Navigation 2' }]); expect(parsed.capabilities).toMatchObject({ reflowable: true, supportsTextSelection: true, supportsTableOfContents: true, supportsPagination: false, supportsSearch: false, supportsReadAloud: false }) })
  it('converts safe XHTML structure into stable reader blocks', async () => { const parsed = await epubAdapter.parse(await fixture({ chapters: [{ name: 'chapter.xhtml', body: '<h2>Heading</h2><p>Paragraph <img src="https://bad.example/a.png" onerror="boom"/>text.</p><blockquote>Quote</blockquote><ul><li>Bullet</li></ul><ol><li>Number</li></ol><hr epub:type="pagebreak"/><script>bad()</script><iframe src="https://bad.example"></iframe>' }] })); expect(parsed.sections[0].blocks).toEqual([{ id: 'block-0', type: 'heading', text: 'Heading', order: 0, level: 2 }, { id: 'block-1', type: 'paragraph', text: 'Paragraph text.', order: 1 }, { id: 'block-2', type: 'blockquote', text: 'Quote', order: 2 }, { id: 'block-3', type: 'list-item', text: 'Bullet', order: 3, ordered: false }, { id: 'block-4', type: 'list-item', text: 'Number', order: 4, ordered: true }, { id: 'block-5', type: 'page-break', text: '', order: 5 }]) })
  it('rejects invalid ZIP data and missing package/spine data', async () => { const bad = new Blob(['not a zip']); await expect(epubAdapter.supports({ blob: bad, fileName: 'bad.epub', size: bad.size })).resolves.toBe(false); await expect(epubAdapter.parse({ blob: bad, fileName: 'bad.epub', size: bad.size })).rejects.toMatchObject({ code: 'invalid-document' }); await expect(epubAdapter.parse(await fixture({ includeSpine: false }))).rejects.toMatchObject({ code: 'invalid-document' }) })
  it('uses the file name for missing title and rejects empty spine content', async () => { const missingTitle = await fixture({ title: '' }); const parsed = await epubAdapter.parse({ ...missingTitle, fileName: 'fallback.epub' }); expect(parsed.metadata.title).toBe('fallback'); await expect(epubAdapter.parse(await fixture({ chapters: [{ name: 'empty.xhtml', body: '<script>bad()</script><iframe></iframe>' }] }))).rejects.toMatchObject({ code: 'empty-file' }) })
})
