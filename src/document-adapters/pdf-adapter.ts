import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { DocumentError, type DocumentAdapter, type DocumentBlock, type DocumentCapabilities, type DocumentMetadata, type DocumentSection, type DocumentSource, type ParsedDocument } from '../domain/documents'

// Vite copies this worker into the application bundle; PDF.js never receives a remote URL.
GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const capabilities: DocumentCapabilities = {
  reflowable: true,
  supportsTextSelection: true,
  supportsSearch: false,
  supportsTableOfContents: false,
  supportsPagination: true,
  supportsReadAloud: false,
}

type PdfTextItem = { str: string; transform: number[]; width: number; height: number; hasEOL: boolean }
type TextLine = { text: string; y: number; height: number }

function titleFromFile(fileName: string) { return fileName.replace(/\.pdf$/i, '') || 'Untitled document' }

function friendlyPdfError(error: unknown): DocumentError {
  const message = error instanceof Error ? error.message : ''
  if (/password|encrypted|encrypt/i.test(message)) return new DocumentError('read-failed', 'This PDF is password-protected. Remove its password before importing it.')
  if (/invalid|xref|format|corrupt|malformed/i.test(message)) return new DocumentError('invalid-document', 'This PDF is damaged or is not a valid PDF file.')
  return new DocumentError('parse-failed', 'LumaRead could not extract text from this PDF.')
}

function isTextItem(item: unknown): item is PdfTextItem {
  return typeof item === 'object' && item !== null && 'str' in item && typeof item.str === 'string' && 'transform' in item && Array.isArray(item.transform)
}

function needsSpace(previous: PdfTextItem, current: PdfTextItem) {
  if (!previous.str || !current.str || /\s$/.test(previous.str) || /^\s/.test(current.str)) return false
  const previousEnd = previous.transform[4] + Math.abs(previous.width)
  const gap = current.transform[4] - previousEnd
  const fontSize = Math.max(Math.abs(previous.height), Math.abs(current.height), 1)
  return gap > fontSize * 0.16 && /[\p{L}\p{N}]$/u.test(previous.str) && /^[\p{L}\p{N}]/u.test(current.str)
}

export function paragraphsFromTextItems(items: unknown[]): string[] {
  const lines: TextLine[] = []
  let current: PdfTextItem[] = []
  const flushLine = () => {
    if (!current.length) return
    const ordered = [...current].sort((left, right) => left.transform[4] - right.transform[4])
    let text = ''
    for (let index = 0; index < ordered.length; index += 1) {
      const item = ordered[index]
      text += `${index > 0 && needsSpace(ordered[index - 1], item) ? ' ' : ''}${item.str}`
    }
    const first = ordered[0]
    lines.push({ text: text.replace(/\s+/g, ' ').trim(), y: first.transform[5], height: Math.abs(first.height) || 1 })
    current = []
  }
  for (const item of items) {
    if (!isTextItem(item) || !item.str) continue
    current.push(item)
    if (item.hasEOL) flushLine()
  }
  flushLine()
  if (!lines.length) return []

  const paragraphs: string[] = []
  let paragraph = lines[0].text
  for (let index = 1; index < lines.length; index += 1) {
    const previous = lines[index - 1]
    const line = lines[index]
    const gap = Math.abs(previous.y - line.y)
    const isParagraphBreak = gap > Math.max(previous.height, line.height) * 1.65
    if (isParagraphBreak) {
      if (paragraph) paragraphs.push(paragraph)
      paragraph = line.text
    } else {
      paragraph = `${paragraph}${paragraph && line.text ? ' ' : ''}${line.text}`
    }
  }
  if (paragraph) paragraphs.push(paragraph)
  return paragraphs
}

function assertPdfHeader(bytes: Uint8Array) {
  if (bytes.length < 5) throw new DocumentError('invalid-document', 'This file is not a valid PDF.')
  const header = new TextDecoder('ascii').decode(bytes.slice(0, 5))
  if (header !== '%PDF-') throw new DocumentError('invalid-document', 'This file is not a valid PDF.')
}

async function headerFrom(source: DocumentSource) {
  try {
    const header = new Uint8Array(await source.blob.slice(0, 5).arrayBuffer())
    assertPdfHeader(header)
  } catch (error) {
    if (error instanceof DocumentError) throw error
    throw new DocumentError('read-failed', 'LumaRead could not read this PDF file.')
  }
}

async function bytesFrom(source: DocumentSource) {
  try {
    const bytes = new Uint8Array(await source.blob.arrayBuffer())
    assertPdfHeader(bytes)
    return bytes
  } catch (error) {
    if (error instanceof DocumentError) throw error
    throw new DocumentError('read-failed', 'LumaRead could not read this PDF file.')
  }
}

function metadataFrom(raw: { info: object; metadata: { get(name: string): unknown } | null }, fileName: string): DocumentMetadata {
  const info = raw.info as Record<string, unknown>
  const get = (name: string) => raw.metadata?.get(name)
  const value = (...values: unknown[]) => values.find((candidate) => typeof candidate === 'string' && candidate.trim()) as string | undefined
  return {
    title: value(get('dc:title'), info.Title) ?? titleFromFile(fileName),
    author: value(get('dc:creator'), info.Author),
    language: value(get('dc:language'), info.Language) ?? 'und',
  }
}

export const pdfAdapter: DocumentAdapter = {
  format: 'pdf',
  async supports(source) {
    if (!source.fileName.toLowerCase().endsWith('.pdf')) return false
    try { await headerFrom(source); return true } catch { return false }
  },
  async parse(source): Promise<ParsedDocument> {
    const data = await bytesFrom(source)
    let loadingTask: ReturnType<typeof getDocument> | undefined
    let document: Awaited<ReturnType<typeof getDocument>['promise']> | undefined
    try {
      loadingTask = getDocument({ data, disableAutoFetch: true, disableRange: true })
      document = await loadingTask.promise
      const rawMetadata = await document.getMetadata()
      const sections: DocumentSection[] = []
      let readableText = false
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber)
        const textContent = await page.getTextContent()
        const paragraphs = paragraphsFromTextItems(textContent.items)
        readableText ||= paragraphs.some((paragraph) => Boolean(paragraph.trim()))
        const blocks: DocumentBlock[] = paragraphs.map((text, order) => ({ id: `page-${pageNumber}-paragraph-${order + 1}`, type: 'paragraph', text, order }))
        sections.push({ id: `page-${pageNumber}`, title: `Page ${pageNumber}`, order: pageNumber - 1, blocks })
        page.cleanup()
      }
      if (!readableText) throw new DocumentError('parse-failed', 'This PDF has no readable text. It may be a scanned document.')
      const metadata = metadataFrom(rawMetadata, source.fileName)
      return { metadata: { ...metadata, sectionCount: sections.length }, sections, capabilities }
    } catch (error) {
      if (error instanceof DocumentError) throw error
      throw friendlyPdfError(error)
    } finally {
      // PDFDocumentProxy.destroy delegates to its loading task. Calling both would
      // tear down the same PDF.js transport twice.
      if (document) await document.destroy()
      else await loadingTask?.destroy()
    }
  },
}
