import JSZip from 'jszip'
import mammoth from 'mammoth/mammoth.browser.js'
import { DocumentError, type DocumentAdapter, type DocumentBlock, type DocumentCapabilities, type DocumentMetadata, type DocumentSection, type DocumentSource, type ParsedDocument } from '../domain/documents'

const baseCapabilities: Omit<DocumentCapabilities, 'supportsTableOfContents'> = {
  reflowable: true,
  supportsTextSelection: true,
  supportsSearch: false,
  supportsPagination: false,
  supportsReadAloud: false,
}

type HtmlBlock =
  | { type: 'paragraph' | 'blockquote' | 'page-break'; text: string }
  | { type: 'heading'; text: string; level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: 'list-item'; text: string; ordered: boolean }

function titleFromFile(fileName: string) {
  return fileName.replace(/\.docx$/i, '') || 'Untitled document'
}

function hasZipSignature(arrayBuffer: ArrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  return bytes.length === 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

function textOf(element: Element) {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function coreValue(document: Document, names: string[]) {
  for (const name of names) {
    const value = document.getElementsByTagName(name).item(0)?.textContent?.trim()
    if (value) return value
  }
  return undefined
}

async function readCoreMetadata(zip: JSZip): Promise<Partial<DocumentMetadata>> {
  const core = zip.file('docProps/core.xml')
  if (!core || typeof DOMParser === 'undefined') return {}
  try {
    const xml = await core.async('text')
    const document = new DOMParser().parseFromString(xml, 'application/xml')
    return {
      title: coreValue(document, ['dc:title', 'title']),
      author: coreValue(document, ['dc:creator', 'creator']),
      language: coreValue(document, ['dc:language', 'language']),
    }
  } catch {
    return {}
  }
}

async function openDocx(arrayBuffer: ArrayBuffer) {
  if (!hasZipSignature(arrayBuffer.slice(0, 4))) {
    throw new DocumentError('invalid-document', 'This file is not a valid DOCX document.')
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(arrayBuffer, { checkCRC32: false, createFolders: false })
  } catch {
    throw new DocumentError('invalid-document', 'This DOCX file is damaged or cannot be opened.')
  }
  const contentTypes = zip.file('[Content_Types].xml')
  if (!contentTypes || !zip.file('_rels/.rels') || !zip.file('word/document.xml')) {
    throw new DocumentError('invalid-document', 'This ZIP file does not contain the required DOCX document structure.')
  }
  try {
    const contentTypesXml = await contentTypes.async('text')
    if (!contentTypesXml.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')) {
      throw new DocumentError('invalid-document', 'This ZIP file is not a Word DOCX document.')
    }
  } catch (error) {
    if (error instanceof DocumentError) throw error
    throw new DocumentError('invalid-document', 'This DOCX file has unreadable document metadata.')
  }
  return zip
}

function blocksFromHtml(html: string): HtmlBlock[] {
  if (typeof DOMParser === 'undefined') throw new DocumentError('parse-failed', 'DOCX conversion requires a browser document parser.')
  const document = new DOMParser().parseFromString(html, 'text/html')
  const blocks: HtmlBlock[] = []
  const addText = (block: HtmlBlock) => {
    if (block.text) blocks.push(block)
  }
  const addElementText = (type: 'paragraph' | 'blockquote', element: Element) => {
    const text = textOf(element)
    if (text) addText({ type, text })
  }
  const visitList = (list: Element, ordered: boolean) => {
    for (const child of Array.from(list.children)) {
      if (child.tagName.toLowerCase() !== 'li') continue
      const directText = Array.from(child.childNodes)
        .filter((node) => node.nodeType === 3 || (node.nodeType === 1 && !['ol', 'ul'].includes((node as Element).tagName.toLowerCase())))
        .map((node) => node.textContent ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (directText) blocks.push({ type: 'list-item', text: directText, ordered })
      for (const nested of Array.from(child.children)) {
        const tag = nested.tagName.toLowerCase()
        if (tag === 'ol' || tag === 'ul') visitList(nested, tag === 'ol')
      }
    }
  }
  const visit = (element: Element) => {
    const tag = element.tagName.toLowerCase()
    if (/^h[1-6]$/.test(tag)) return addText({ type: 'heading', text: textOf(element), level: Number(tag[1]) as 1 | 2 | 3 | 4 | 5 | 6 })
    if (tag === 'p') return addElementText('paragraph', element)
    if (tag === 'blockquote') return addElementText('blockquote', element)
    if (tag === 'ol' || tag === 'ul') return visitList(element, tag === 'ol')
    if (tag === 'table') {
      for (const row of Array.from(element.getElementsByTagName('tr'))) {
        const cells = Array.from(row.children).filter((cell) => ['td', 'th'].includes(cell.tagName.toLowerCase())).map(textOf).filter(Boolean)
        if (cells.length) blocks.push({ type: 'paragraph', text: cells.join(' | ') })
      }
      return
    }
    if (tag === 'img') {
      const alt = element.getAttribute('alt')?.trim()
      if (alt) blocks.push({ type: 'paragraph', text: alt })
      return
    }
    for (const child of Array.from(element.children)) visit(child)
  }
  for (const child of Array.from(document.body.children)) visit(child)
  return blocks
}

function sectionsFrom(blocks: HtmlBlock[]): DocumentSection[] {
  const sections: DocumentSection[] = []
  let current: DocumentSection | undefined
  const startSection = (title?: string) => {
    current = { id: `section-${sections.length}`, title, order: sections.length, blocks: [] }
    sections.push(current)
  }
  for (const block of blocks) {
    if (block.type === 'heading' && block.level === 1) startSection(block.text)
    if (!current) startSection()
    if (!current) throw new DocumentError('parse-failed', 'DOCX sections could not be created.')
    const section = current
    const order = section.blocks.length
    section.blocks.push({ ...block, id: `${block.type}-${section.order}-${order}`, order } as DocumentBlock)
  }
  if (!current) startSection()
  return sections
}

export const docxAdapter: DocumentAdapter = {
  format: 'docx',
  async supports(source) {
    if (!source.fileName.toLowerCase().endsWith('.docx') || source.size === 0) return false
    try {
      return hasZipSignature(await source.blob.slice(0, 4).arrayBuffer())
    } catch {
      return false
    }
  },
  async parse(source: DocumentSource): Promise<ParsedDocument> {
    if (!source.fileName.toLowerCase().endsWith('.docx')) throw new DocumentError('unsupported-format', 'Please choose a .docx Word document, not a legacy .doc file.')
    if (source.size === 0) throw new DocumentError('empty-file', 'This DOCX file is empty.')
    let arrayBuffer: ArrayBuffer
    try {
      arrayBuffer = await source.blob.arrayBuffer()
    } catch {
      throw new DocumentError('read-failed', 'LumaRead could not read this DOCX file.')
    }
    const zip = await openDocx(arrayBuffer)
    const coreMetadata = await readCoreMetadata(zip)
    let html: string
    try {
      const result = await mammoth.convertToHtml({ arrayBuffer }, {
        styleMap: ["p[style-name='Heading 1'] => h1:fresh", "p[style-name='Heading 2'] => h2:fresh", "p[style-name='Quote'] => blockquote:fresh"],
        convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '' })),
      })
      html = result.value
    } catch {
      throw new DocumentError('parse-failed', 'LumaRead could not convert this DOCX document.')
    }
    const blocks = blocksFromHtml(html)
    if (!blocks.length) throw new DocumentError('empty-file', 'This DOCX file does not contain readable text.')
    const sections = sectionsFrom(blocks)
    const reliableHeadings = sections.filter((section) => section.title).length
    return {
      metadata: { title: coreMetadata.title || titleFromFile(source.fileName), author: coreMetadata.author, language: coreMetadata.language, sectionCount: sections.length },
      capabilities: { ...baseCapabilities, supportsTableOfContents: reliableHeadings > 1 },
      sections,
    }
  },
}
