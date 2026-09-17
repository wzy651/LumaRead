import ePub, { type Book, type NavItem } from 'epubjs'
import type Section from 'epubjs/types/section'
import { DocumentError, type DocumentAdapter, type DocumentBlock, type DocumentCapabilities, type DocumentSection, type DocumentSource, type ParsedDocument } from '../domain/documents'

const capabilities = (hasTableOfContents: boolean): DocumentCapabilities => ({ reflowable: true, supportsOriginalLayout: false, supportsTextSelection: true, supportsSearch: false, supportsTableOfContents: hasTableOfContents, supportsPagination: false, supportsReadAloud: false })
const zipSignatures = [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08]]

function fileTitle(fileName: string) { return fileName.replace(/\.epub$/i, '') || 'Untitled document' }
function cleanText(value: string | null | undefined) { return value?.replace(/\s+/g, ' ').trim() ?? '' }
function localName(node: Node) { return (node as Element).localName?.toLowerCase() ?? node.nodeName.split(':').pop()?.toLowerCase() ?? '' }
function childElements(node: ParentNode) { return Array.from(node.childNodes).filter((child): child is Element => child.nodeType === 1) }
function descendants(node: ParentNode, name: string) { const found: Element[] = []; const visit = (parent: ParentNode) => childElements(parent).forEach((child) => { if (localName(child) === name) found.push(child); visit(child) }); visit(node); return found }
function hrefKey(href: string) { return href.replace(/\\/g, '/').replace(/^\.\//, '').split('#')[0].split('?')[0] }
function tocTitles(items: NavItem[], titles = new Map<string, string>()) { for (const item of items) { const label = cleanText(item.label); if (item.href && label) titles.set(hrefKey(item.href), label); if (item.subitems) tocTitles(item.subitems, titles) } return titles }
function safeBlocks(document: Document): DocumentBlock[] {
  const blocks: DocumentBlock[] = []; const add = (type: DocumentBlock['type'], text: string, extra: Partial<DocumentBlock> = {}) => { const value = cleanText(text); if (!value && type !== 'page-break') return; const order = blocks.length; blocks.push({ id: `block-${order}`, type, text: value, order, ...extra } as DocumentBlock) }
  const visit = (node: Element) => {
    const name = localName(node); if (['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math'].includes(name)) return
    if (/^h[1-6]$/.test(name)) { add('heading', node.textContent ?? '', { level: Number(name[1]) as 1 | 2 | 3 | 4 | 5 | 6 }); return }
    if (name === 'p') { add('paragraph', node.textContent ?? ''); return }
    if (name === 'blockquote') { add('blockquote', node.textContent ?? ''); return }
    if (name === 'li') { const parent = node.parentNode; add('list-item', node.textContent ?? '', { ordered: parent?.nodeType === 1 && localName(parent) === 'ol' }); return }
    if (name === 'hr' || node.hasAttribute('epub:type') && /pagebreak/i.test(node.getAttribute('epub:type') ?? '')) { add('page-break', ''); return }
    childElements(node).forEach(visit)
  }
  const body = descendants(document, 'body')[0]; if (body) childElements(body).forEach(visit)
  return blocks
}
function sourceBytes(source: DocumentSource) { return source.blob.arrayBuffer().catch(() => { throw new DocumentError('read-failed', 'LumaRead could not read this EPUB file.') }) }
async function openBook(source: DocumentSource) {
  const book = ePub()
  try { await book.open(await sourceBytes(source), 'binary'); await book.ready; return book } catch { book.destroy(); throw new DocumentError('invalid-document', 'This EPUB file is damaged, encrypted, or unsupported.') }
}
function chapterDocument(document: Document) { return new DOMParser().parseFromString(new XMLSerializer().serializeToString(document), 'application/xhtml+xml') }
function sectionTitle(titles: Map<string, string>, href: string, blocks: DocumentBlock[]) { const key = hrefKey(href); return titles.get(key) ?? titles.get(key.split('/').pop() ?? '') ?? blocks.find((block) => block.type === 'heading')?.text }

export const epubAdapter: DocumentAdapter = {
  format: 'epub',
  async supports(source) {
    if (!source.fileName.toLowerCase().endsWith('.epub')) return false
    try { const bytes = new Uint8Array(await source.blob.slice(0, 4).arrayBuffer()); return zipSignatures.some((signature) => signature.every((byte, index) => bytes[index] === byte)) } catch { return false }
  },
  async parse(source): Promise<ParsedDocument> {
    if (!source.fileName.toLowerCase().endsWith('.epub')) throw new DocumentError('unsupported-format', 'This file type is not supported.')
    let book: Book | undefined
    try {
      book = await openBook(source)
      const metadata = book.packaging.metadata; const title = cleanText(metadata.title) || fileTitle(source.fileName); const author = cleanText(metadata.creator); const language = cleanText(metadata.language); const description = cleanText(metadata.description); const titles = tocTitles(book.navigation.toc)
      const sections: DocumentSection[] = []
      const spineSections: Section[] = []; book.spine.each((section: Section) => { spineSections.push(section) })
      if (!spineSections.length) throw new DocumentError('invalid-document', 'This EPUB does not contain a readable reading order.')
      for (const section of spineSections) { try { const loaded = await Promise.resolve(section.load(book.load.bind(book))); const blocks = safeBlocks(chapterDocument(loaded)); if (blocks.length) sections.push({ id: `section-${sections.length}`, title: sectionTitle(titles, section.href, blocks), order: sections.length, blocks }) } finally { section.unload() } }
      if (!sections.length) throw new DocumentError('empty-file', 'This EPUB does not contain readable text.')
      return { metadata: { title, ...(author && { author }), ...(language && { language }), ...(description && { description }), sectionCount: sections.length }, capabilities: capabilities(titles.size > 0), sections }
    } catch (error) { if (error instanceof DocumentError) throw error; throw new DocumentError('parse-failed', 'LumaRead could not parse this EPUB file.') } finally { book?.destroy() }
  },
}
