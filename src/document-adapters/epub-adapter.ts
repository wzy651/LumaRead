import ePub, { type Book, type NavItem } from 'epubjs'
import type Section from 'epubjs/types/section'
import { DocumentError, type DocumentAdapter, type DocumentBlock, type DocumentCapabilities, type DocumentSource, type ParsedDocument } from '../domain/documents'

const capabilities = (hasTableOfContents: boolean, supportsInternalLinks: boolean): DocumentCapabilities => ({ reflowable: true, supportsOriginalLayout: false, supportsTextSelection: true, supportsSearch: false, supportsTableOfContents: hasTableOfContents, supportsPagination: false, supportsReadAloud: false, supportsInternalLinks })
const zipSignatures = [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08]]
const ignoredElements = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math'])

function fileTitle(fileName: string) { return fileName.replace(/\.epub$/i, '') || 'Untitled document' }
function cleanText(value: string | null | undefined) { return value?.replace(/\s+/g, ' ').trim() ?? '' }
function localName(node: Node) { return (node as Element).localName?.toLowerCase() ?? node.nodeName.split(':').pop()?.toLowerCase() ?? '' }
function childElements(node: ParentNode) { return Array.from(node.childNodes).filter((child): child is Element => child.nodeType === 1) }
function descendants(node: ParentNode, name: string) { const found: Element[] = []; const visit = (parent: ParentNode) => childElements(parent).forEach((child) => { if (name === '*' || localName(child) === name) found.push(child); visit(child) }); visit(node); return found }
function hrefKey(href: string) { return href.replace(/\\/g, '/').replace(/^\.\//, '').split('#')[0].split('?')[0] }
function tocTitles(items: NavItem[], titles = new Map<string, string>()) { for (const item of items) { const label = cleanText(item.label); if (item.href && label) titles.set(hrefKey(item.href), label); if (item.subitems) tocTitles(item.subitems, titles) } return titles }

type PendingLink = { id: string; start: number; end: number; href: string; noteref: boolean; blockId: string }
type BlockDraft = { block: DocumentBlock; exactAnchors: string[]; inheritedAnchors: string[]; anchorRoles: Map<string, string>; links: PendingLink[] }
type SectionDraft = { id: string; href: string; blocks: DocumentBlock[]; anchorTargets: Map<string, { blockId: string; role?: string }>; links: PendingLink[] }

function epubType(element: Element) { return element.getAttribute('epub:type') ?? element.getAttribute('type') ?? '' }
function isNoteRole(value: string) { return /(^|\s)(noteref|footnoteref|endnoteref|footnote|endnote)(\s|$)/i.test(value) }
function hasNoterefSemantics(element: Element) { return isNoteRole(epubType(element)) || isNoteRole(element.getAttribute('role') ?? '') || /(^|\s)noteref(\s|$)/i.test(element.getAttribute('class') ?? '') }
function isWhitespace(value: string) { return /\s/u.test(value) }
function codePointAt(value: string, index: number) { const point = value.codePointAt(index); return point === undefined ? '' : String.fromCodePoint(point) }

class SafeTextCollector {
  text = ''
  private pendingSpace = false
  readonly links: Array<{ start: number; end: number; href: string; noteref: boolean }> = []
  private flushSpace() { if (this.pendingSpace && this.text.length) this.text += ' '; this.pendingSpace = false }
  append(value: string, active?: { start: number; end: number }) { for (let index = 0; index < value.length;) { const character = codePointAt(value, index); index += character.length; if (isWhitespace(character)) { this.pendingSpace = true; continue } this.flushSpace(); this.text += character; if (active) active.end = this.text.length } }
  collect(root: Element) {
    const visit = (node: Node, active?: { start: number; end: number; href: string; noteref: boolean }) => {
      if (node.nodeType === 3) { this.append(node.nodeValue ?? '', active); return }
      if (node.nodeType !== 1 || ignoredElements.has(localName(node))) return
      const element = node as Element
      if (localName(element) === 'a' && element.hasAttribute('href') && !active) {
        this.flushSpace(); const link = { start: this.text.length, end: this.text.length, href: element.getAttribute('href') ?? '', noteref: hasNoterefSemantics(element) }
        Array.from(element.childNodes).forEach((child) => visit(child, link)); if (link.end > link.start) this.links.push(link); return
      }
      Array.from(element.childNodes).forEach((child) => visit(child, active))
    }
    visit(root)
    const leading = this.text.length - this.text.trimStart().length; const trimmed = this.text.trim(); const end = leading + trimmed.length
    for (const link of this.links) { link.start = Math.max(0, link.start - leading); link.end = Math.min(trimmed.length, link.end - leading) }
    this.text = trimmed; this.links.splice(0, this.links.length, ...this.links.filter((link) => link.end > link.start && link.start >= 0 && link.end <= end - leading))
  }
}

function anchorNames(element: Element) { const names: string[] = []; const add = (value: string | null) => { if (value?.trim() && !names.includes(value.trim())) names.push(value.trim()) }; add(element.getAttribute('id')); if (localName(element) === 'a') add(element.getAttribute('name')); return names }

function ancestorAnchors(element: Element) {
  const names: string[] = []
  let current: Node | null = element.parentNode
  while (current?.nodeType === 1) {
    for (const name of anchorNames(current as Element)) if (!names.includes(name)) names.push(name)
    current = current.parentNode
  }
  return names
}

function safeBlocks(document: Document): BlockDraft[] {
  const blocks: BlockDraft[] = []
  const add = (element: Element, type: DocumentBlock['type'], extra: Partial<DocumentBlock> = {}) => {
    const collector = new SafeTextCollector(); collector.collect(element); if (!collector.text && type !== 'page-break') return
    const order = blocks.length; const block = { id: `block-${order}`, type, text: collector.text, order, ...extra } as DocumentBlock; const exactAnchors = new Set(anchorNames(element)); const anchorRoles = new Map<string, string>(); for (const name of exactAnchors) anchorRoles.set(name, epubType(element)); for (const child of descendants(element, '*')) for (const name of anchorNames(child)) { exactAnchors.add(name); anchorRoles.set(name, epubType(child)) }
    const inheritedAnchors = ancestorAnchors(element); let ancestor: Node | null = element.parentNode; while (ancestor?.nodeType === 1) { const ancestorElement = ancestor as Element; for (const name of anchorNames(ancestorElement)) if (!anchorRoles.has(name)) anchorRoles.set(name, epubType(ancestorElement)); ancestor = ancestor.parentNode }
    const links = collector.links.map((link, index) => ({ ...link, id: `${block.id}-link-${index}`, blockId: block.id })); if (exactAnchors.size) block.anchors = [...exactAnchors]; if (links.length) block.links = links.map(({ id, start, end, noteref }) => ({ id, start, end, role: noteref ? 'noteref' : 'link', target: { sectionId: '' } })); blocks.push({ block, exactAnchors: [...exactAnchors], inheritedAnchors, anchorRoles, links })
  }
  const visit = (node: Element) => { const name = localName(node); if (ignoredElements.has(name)) return; if (/^h[1-6]$/.test(name)) { add(node, 'heading', { level: Number(name[1]) as 1 | 2 | 3 | 4 | 5 | 6 }); return }; if (name === 'p') { add(node, 'paragraph'); return }; if (name === 'blockquote') { add(node, 'blockquote'); return }; if (name === 'li') { const parent = node.parentNode; add(node, 'list-item', { ordered: parent?.nodeType === 1 && localName(parent as Element) === 'ol' }); return }; if (name === 'hr' || (node.hasAttribute('epub:type') && /pagebreak/i.test(epubType(node)))) { add(node, 'page-break'); return }; childElements(node).forEach(visit) }
  const body = descendants(document, 'body')[0]; if (body) childElements(body).forEach(visit); return blocks
}

function sourceBytes(source: DocumentSource) { return source.blob.arrayBuffer().catch(() => { throw new DocumentError('read-failed', 'LumaRead could not read this EPUB file.') }) }
async function openBook(source: DocumentSource) { const book = ePub(); try { await book.open(await sourceBytes(source), 'binary'); await book.ready; return book } catch { book.destroy(); throw new DocumentError('invalid-document', 'This EPUB file is damaged, encrypted, or unsupported.') } }
function chapterDocument(document: Document) { return new DOMParser().parseFromString(new XMLSerializer().serializeToString(document), 'application/xhtml+xml') }
function sectionTitle(titles: Map<string, string>, href: string, blocks: DocumentBlock[]) { const key = hrefKey(href); return titles.get(key) ?? titles.get(key.split('/').pop() ?? '') ?? blocks.find((block) => block.type === 'heading')?.text }
function canonicalPath(value: string, base?: string) { const raw = value.replace(/\\/g, '/'); const baseDir = base?.includes('/') ? base.slice(0, base.lastIndexOf('/')) : ''; const combined = raw.startsWith('/') ? raw : `${baseDir}/${raw}`; const parts: string[] = []; for (const encoded of combined.split('/')) { if (!encoded || encoded === '.') continue; if (encoded === '..') { if (!parts.length) return undefined; parts.pop(); continue }; try { parts.push(decodeURIComponent(encoded)) } catch { return undefined } } return parts.join('/') }
function splitHref(raw: string) { const hashIndex = raw.indexOf('#'); const beforeHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw; const queryIndex = beforeHash.indexOf('?'); return { path: queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash, hasFragment: hashIndex >= 0, fragment: hashIndex >= 0 ? raw.slice(hashIndex + 1) : undefined } }
function externalHref(raw: string) { return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(raw.trim()) }

function resolvePendingLinks(sections: SectionDraft[]) {
  const byPath = new Map(sections.map((section) => [canonicalPath(section.href) ?? section.href, section]))
  for (const section of sections) for (const link of section.links) {
    const raw = link.href.trim(); if (!raw || externalHref(raw)) continue; const split = splitHref(raw); let fragment: string | undefined
    if (split.hasFragment) { try { fragment = decodeURIComponent(split.fragment ?? '') } catch { continue } }
    const sameSection = !split.path; const targetSection = sameSection ? section : byPath.get(canonicalPath(split.path, section.href) ?? ''); if (!targetSection) continue
    const anchor = fragment ? targetSection.anchorTargets.get(fragment) : undefined; if (split.hasFragment && !anchor) continue
    const block = section.blocks.find((candidate) => candidate.id === link.blockId); const documentLink = block?.links?.find((candidate) => candidate.id === link.id); if (!documentLink) continue
    documentLink.target = { sectionId: targetSection.id, ...(anchor ? { blockId: anchor.blockId } : {}) }; if (link.noteref || (anchor?.role ? isNoteRole(anchor.role) : false)) documentLink.role = 'noteref'
  }
  for (const section of sections) for (const block of section.blocks) if (block.links) block.links = block.links.filter((link) => link.target.sectionId)
}

export const epubAdapter: DocumentAdapter = {
  format: 'epub',
  async supports(source) { if (!source.fileName.toLowerCase().endsWith('.epub')) return false; try { const bytes = new Uint8Array(await source.blob.slice(0, 4).arrayBuffer()); return zipSignatures.some((signature) => signature.every((byte, index) => bytes[index] === byte)) } catch { return false } },
  async parse(source): Promise<ParsedDocument> {
    if (!source.fileName.toLowerCase().endsWith('.epub')) throw new DocumentError('unsupported-format', 'This file type is not supported.')
    let book: Book | undefined
    try {
      book = await openBook(source); const metadata = book.packaging.metadata; const title = cleanText(metadata.title) || fileTitle(source.fileName); const author = cleanText(metadata.creator); const language = cleanText(metadata.language); const description = cleanText(metadata.description); const titles = tocTitles(book.navigation.toc); const sections: SectionDraft[] = []; const spineSections: Section[] = []
      book.spine.each((section: Section) => spineSections.push(section)); if (!spineSections.length) throw new DocumentError('invalid-document', 'This EPUB does not contain a readable reading order.')
      for (const section of spineSections) { try { const loaded = await Promise.resolve(section.load(book.load.bind(book))); const drafts = safeBlocks(chapterDocument(loaded)); if (drafts.length) { const blocks = drafts.map(({ block }) => block); const draft: SectionDraft = { id: `section-${sections.length}`, href: String(section.href ?? ''), blocks, anchorTargets: new Map(), links: [] }; for (const draftBlock of drafts) for (const name of draftBlock.exactAnchors) if (!draft.anchorTargets.has(name)) draft.anchorTargets.set(name, { blockId: draftBlock.block.id, role: draftBlock.anchorRoles.get(name) }); for (const draftBlock of drafts) for (const name of draftBlock.inheritedAnchors) if (!draft.anchorTargets.has(name)) { draft.anchorTargets.set(name, { blockId: draftBlock.block.id, role: draftBlock.anchorRoles.get(name) }); draftBlock.block.anchors = [...(draftBlock.block.anchors ?? []), name] }; drafts.forEach(({ links }) => draft.links.push(...links)); sections.push(draft) } } finally { section.unload() } }
      if (!sections.length) throw new DocumentError('empty-file', 'This EPUB does not contain readable text.'); resolvePendingLinks(sections)
      const resolvedInternalLinks = sections.some((section) => section.blocks.some((block) => (block.links?.length ?? 0) > 0)); return { metadata: { title, ...(author && { author }), ...(language && { language }), ...(description && { description }), sectionCount: sections.length }, capabilities: capabilities(titles.size > 0, resolvedInternalLinks), sections: sections.map((section, order) => ({ id: section.id, order, title: sectionTitle(titles, section.href, section.blocks), blocks: section.blocks })) }
    } catch (error) { if (error instanceof DocumentError) throw error; throw new DocumentError('parse-failed', 'LumaRead could not parse this EPUB file.') } finally { book?.destroy() }
  },
}
