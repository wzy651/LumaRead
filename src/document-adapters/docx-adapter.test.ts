// @vitest-environment jsdom
import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import type { DocumentSource } from '../domain/documents'
import { docxAdapter } from './docx-adapter'

type Paragraph = { text: string; style?: 'Heading1' | 'Heading2' | 'Quote'; list?: 'ordered' | 'unordered'; externalLink?: boolean }
type DocxOptions = { paragraphs?: Paragraph[]; table?: string[][]; core?: { title?: string; author?: string; language?: string } }

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const paragraphXml = ({ text, style, list, externalLink }: Paragraph) => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${list ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${list === 'ordered' ? 1 : 2}"/></w:numPr>` : ''}</w:pPr>${externalLink ? `<w:hyperlink r:id="external"><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:hyperlink>` : `<w:r><w:t>${escapeXml(text)}</w:t></w:r>`}</w:p>`

async function syntheticDocx(options: DocxOptions = {}) {
  const zip = new JSZip()
  const paragraphs = options.paragraphs ?? [{ text: 'A plain paragraph.' }]
  const table = options.table ? `<w:tbl>${options.table.map((row) => `<w:tr>${row.map((cell) => `<w:tc>${paragraphXml({ text: cell })}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>` : ''
  zip.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`)
  zip.file('_rels/.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="officeDocument" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`)
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${paragraphs.map(paragraphXml).join('')}${table}<w:sectPr/></w:body></w:document>`)
  zip.file('word/styles.xml', `<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/></w:style><w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/></w:style></w:styles>`)
  zip.file('word/numbering.xml', `<?xml version="1.0"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`)
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="numbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="external" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid/never-load" TargetMode="External"/></Relationships>`)
  if (options.core) zip.file('docProps/core.xml', `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(options.core.title ?? '')}</dc:title><dc:creator>${escapeXml(options.core.author ?? '')}</dc:creator><dc:language>${escapeXml(options.core.language ?? '')}</dc:language></cp:coreProperties>`)
  return zip.generateAsync({ type: 'arraybuffer' })
}

async function source(options: DocxOptions = {}, fileName = 'example.docx'): Promise<DocumentSource> {
  const bytes = await syntheticDocx(options)
  const blob = { size: bytes.byteLength, arrayBuffer: async () => bytes } as Blob
  return { blob, fileName, size: blob.size }
}

describe('DOCX adapter', () => {
  it('checks only the first four Blob bytes when testing support', async () => {
    const headerRead = vi.fn(async () => new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer)
    const fullRead = vi.fn(async () => { throw new Error('supports must not read the complete file') })
    const slice = vi.fn(() => ({ arrayBuffer: headerRead }))
    const blob = { size: 1024, slice, arrayBuffer: fullRead } as unknown as Blob
    await expect(docxAdapter.supports({ blob, fileName: 'large.docx', size: 1024 })).resolves.toBe(true)
    expect(slice).toHaveBeenCalledExactlyOnceWith(0, 4)
    expect(headerRead).toHaveBeenCalledOnce()
    expect(fullRead).not.toHaveBeenCalled()
  })

  it('reads the complete DOCX Blob exactly once while parsing', async () => {
    const input = await source()
    const fullRead = vi.fn(input.blob.arrayBuffer.bind(input.blob))
    const blob = { ...input.blob, arrayBuffer: fullRead } as Blob
    await expect(docxAdapter.parse({ ...input, blob })).resolves.toMatchObject({ metadata: { title: 'example' } })
    expect(fullRead).toHaveBeenCalledOnce()
  })

  it('maps paragraphs, headings, lists, quotes, and table rows into readable blocks', async () => {
    const parsed = await docxAdapter.parse(await source({ paragraphs: [{ text: 'Chapter One', style: 'Heading1' }, { text: 'Section', style: 'Heading2' }, { text: 'Plain' }, { text: 'First', list: 'ordered' }, { text: 'Bullet', list: 'unordered' }, { text: 'Quoted', style: 'Quote' }], table: [['Name', 'Value'], ['One', '1']] }))
    expect(parsed.sections[0].blocks.map(({ type, text }) => ({ type, text }))).toEqual([{ type: 'heading', text: 'Chapter One' }, { type: 'heading', text: 'Section' }, { type: 'paragraph', text: 'Plain' }, { type: 'list-item', text: 'First' }, { type: 'list-item', text: 'Bullet' }, { type: 'blockquote', text: 'Quoted' }, { type: 'paragraph', text: 'Name | Value' }, { type: 'paragraph', text: 'One | 1' }])
    expect(parsed.sections[0].blocks.filter((block) => block.type === 'list-item').map((block) => block.ordered)).toEqual([true, false])
  })

  it('splits on Heading 1 and exposes a table of contents only for multiple reliable sections', async () => {
    const parsed = await docxAdapter.parse(await source({ paragraphs: [{ text: 'One', style: 'Heading1' }, { text: 'Body one' }, { text: 'Two', style: 'Heading1' }, { text: 'Body two' }] }))
    expect(parsed.sections.map((section) => section.title)).toEqual(['One', 'Two'])
    expect(parsed.capabilities).toMatchObject({ reflowable: true, supportsTextSelection: true, supportsTableOfContents: true, supportsPagination: false, supportsSearch: false, supportsReadAloud: false })
  })

  it('uses file-name title when metadata is absent, while retaining available core metadata', async () => {
    const fallback = await docxAdapter.parse(await source({}, 'no-title.docx'))
    const metadata = await docxAdapter.parse(await source({ core: { title: 'Core title', author: 'Ada', language: 'en-US' } }))
    expect(fallback.metadata.title).toBe('no-title')
    expect(metadata.metadata).toMatchObject({ title: 'Core title', author: 'Ada', language: 'en-US' })
  })

  it('does not load external relationships and keeps their link text as text', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const parsed = await docxAdapter.parse(await source({ paragraphs: [{ text: 'External link', externalLink: true }] }))
    expect(fetch).not.toHaveBeenCalled()
    expect(parsed.sections[0].blocks[0]).toMatchObject({ type: 'paragraph', text: 'External link' })
    vi.unstubAllGlobals()
  })

  it('returns friendly errors for corrupt or non-DOCX ZIP data', async () => {
    const corruptBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff]).buffer
    const nonDocxBytes = await new JSZip().generateAsync({ type: 'arraybuffer' })
    const corrupt = { size: corruptBytes.byteLength, arrayBuffer: async () => corruptBytes } as Blob
    const nonDocxZip = { size: nonDocxBytes.byteLength, arrayBuffer: async () => nonDocxBytes } as Blob
    await expect(docxAdapter.parse({ blob: corrupt, fileName: 'broken.docx', size: corrupt.size })).rejects.toMatchObject({ code: 'invalid-document' })
    await expect(docxAdapter.parse({ blob: nonDocxZip, fileName: 'archive.docx', size: nonDocxZip.size })).rejects.toMatchObject({ code: 'invalid-document' })
  })

  it('rejects a valid DOCX with no readable blocks', async () => {
    const input = await source({ paragraphs: [] })
    await expect(docxAdapter.parse(input)).rejects.toMatchObject({ code: 'empty-file' })
  })
})
