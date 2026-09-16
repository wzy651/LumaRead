import JSZip from 'jszip'
import { DocumentError, type DocumentAdapter, type DocumentBlock, type DocumentCapabilities, type DocumentSection, type DocumentSource, type ParsedDocument } from '../domain/documents'

const capabilities = (hasTableOfContents: boolean): DocumentCapabilities => ({ reflowable: true, supportsTextSelection: true, supportsSearch: false, supportsTableOfContents: hasTableOfContents, supportsPagination: false, supportsReadAloud: false })
const zipHeader = [0x50, 0x4b]

type OpfItem = { id: string; href: string; mediaType: string; properties: string }

function fileTitle(fileName: string) { return fileName.replace(/\.epub$/i, '') || 'Untitled document' }
function cleanText(value: string | null | undefined) { return value?.replace(/\s+/g, ' ').trim() ?? '' }
function localName(node: Node) { return (node as Element).localName?.toLowerCase() ?? node.nodeName.split(':').pop()?.toLowerCase() ?? '' }
function childElements(node: ParentNode) { return Array.from(node.childNodes).filter((child): child is Element => child.nodeType === 1) }
function descendants(node: ParentNode, name: string) { const found: Element[] = []; const visit = (parent: ParentNode) => childElements(parent).forEach((child) => { if (localName(child) === name) found.push(child); visit(child) }); visit(node); return found }
function firstDescendant(node: ParentNode, name: string) { return descendants(node, name)[0] }
function parseXml(source: string, message: string) {
  const document = new DOMParser().parseFromString(source, 'application/xml')
  if (firstDescendant(document, 'parsererror')) throw new DocumentError('invalid-document', message)
  return document
}
function pathFor(base: string, href: string) {
  const target = href.replace(/\\/g, '/').split('#')[0].split('?')[0]
  const parts = `${base}/${target}`.split('/'); const output: string[] = []
  for (const part of parts) { if (!part || part === '.') continue; if (part === '..') output.pop(); else output.push(part) }
  return output.join('/')
}
function basePath(path: string) { const index = path.lastIndexOf('/'); return index < 0 ? '' : path.slice(0, index) }
function sourceBytes(source: DocumentSource) { return source.blob.arrayBuffer().catch(() => { throw new DocumentError('read-failed', 'LumaRead could not read this EPUB file.') }) }
async function openArchive(source: DocumentSource) {
  const bytes = new Uint8Array(await sourceBytes(source))
  if (!zipHeader.every((byte, index) => bytes[index] === byte)) throw new DocumentError('invalid-document', 'This does not appear to be a valid EPUB file.')
  try { return await JSZip.loadAsync(bytes, { createFolders: false }) } catch { throw new DocumentError('invalid-document', 'This EPUB file is damaged or uses unsupported encryption.') }
}
async function textFile(zip: JSZip, path: string, message: string) {
  const file = zip.file(path)
  if (!file) throw new DocumentError('invalid-document', message)
  try { return await file.async('string') } catch { throw new DocumentError('read-failed', 'LumaRead could not read this EPUB file.') }
}
async function packageData(zip: JSZip) {
  const container = parseXml(await textFile(zip, 'META-INF/container.xml', 'This EPUB is missing its container information.'), 'This EPUB has an invalid container file.')
  const rootfile = firstDescendant(container, 'rootfile')?.getAttribute('full-path')
  if (!rootfile) throw new DocumentError('invalid-document', 'This EPUB is missing its package document.')
  const opfPath = pathFor('', rootfile)
  const opf = parseXml(await textFile(zip, opfPath, 'This EPUB is missing its package document.'), 'This EPUB has an invalid package document.')
  const manifestEntries = descendants(opf, 'item').map((item): [string, OpfItem] => { const entry: OpfItem = { id: item.getAttribute('id') ?? '', href: item.getAttribute('href') ?? '', mediaType: item.getAttribute('media-type') ?? '', properties: item.getAttribute('properties') ?? '' }; return [entry.id, entry] }).filter(([id, item]) => Boolean(id && item.href))
  const manifest = new Map<string, OpfItem>(manifestEntries)
  const spine = descendants(firstDescendant(opf, 'spine') ?? opf, 'itemref').map((item) => ({ idref: item.getAttribute('idref') ?? '' })).filter((item) => Boolean(item.idref))
  if (!spine.length) throw new DocumentError('invalid-document', 'This EPUB does not contain a readable reading order.')
  return { opf, opfPath, manifest, spine }
}
function navigationTitles(document: Document, navPath: string) {
  const titles = new Map<string, string>(); const toc = descendants(document, 'nav').find((nav) => /(^|\s)(toc|doc-toc)(\s|$)/.test(`${nav.getAttribute('epub:type') ?? ''} ${nav.getAttribute('role') ?? ''}`))
  if (!toc) return titles
  for (const link of descendants(toc, 'a')) { const href = link.getAttribute('href'); const label = cleanText(link.textContent); if (href && label) titles.set(pathFor(basePath(navPath), href), label) }
  return titles
}
async function tableOfContents(zip: JSZip, opfPath: string, manifest: Map<string, OpfItem>) {
  const nav = [...manifest.values()].find((item) => item.properties.split(/\s+/).includes('nav'))
  if (!nav) return new Map<string, string>()
  const navPath = pathFor(basePath(opfPath), nav.href)
  try { return navigationTitles(parseXml(await textFile(zip, navPath, 'This EPUB has an invalid table of contents.'), 'This EPUB has an invalid table of contents.'), navPath) } catch (error) { if (error instanceof DocumentError && error.code === 'invalid-document') return new Map<string, string>(); throw error }
}
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

export const epubAdapter: DocumentAdapter = {
  format: 'epub',
  async supports(source) {
    if (!source.fileName.toLowerCase().endsWith('.epub')) return false
    try { const archive = await openArchive(source); await packageData(archive); return true } catch { return false }
  },
  async parse(source): Promise<ParsedDocument> {
    if (!source.fileName.toLowerCase().endsWith('.epub')) throw new DocumentError('unsupported-format', 'This file type is not supported.')
    const archive = await openArchive(source); const { opf, opfPath, manifest, spine } = await packageData(archive); const toc = await tableOfContents(archive, opfPath, manifest)
    const metadata = firstDescendant(opf, 'metadata') ?? opf; const title = cleanText(firstDescendant(metadata, 'title')?.textContent) || fileTitle(source.fileName); const author = cleanText(firstDescendant(metadata, 'creator')?.textContent); const language = cleanText(firstDescendant(metadata, 'language')?.textContent); const description = cleanText(firstDescendant(metadata, 'description')?.textContent)
    const sections: DocumentSection[] = []
    for (const item of spine) { const entry = manifest.get(item.idref); if (!entry || !/xhtml|html/i.test(entry.mediaType)) continue; const path = pathFor(basePath(opfPath), entry.href); let blocks: DocumentBlock[]; try { blocks = safeBlocks(new DOMParser().parseFromString(await textFile(archive, path, 'This EPUB is missing a spine chapter.'), 'application/xhtml+xml')) } catch (error) { if (error instanceof DocumentError) throw error; throw new DocumentError('parse-failed', 'LumaRead could not parse an EPUB chapter.') }; if (!blocks.length) continue; const heading = blocks.find((block) => block.type === 'heading'); sections.push({ id: `section-${sections.length}`, title: toc.get(path) || heading?.text, order: sections.length, blocks }) }
    if (!sections.length) throw new DocumentError('empty-file', 'This EPUB does not contain readable text.')
    return { metadata: { title, ...(author && { author }), ...(language && { language }), ...(description && { description }), sectionCount: sections.length }, capabilities: capabilities(toc.size > 0), sections }
  },
}
