import { DocumentError, type DocumentAdapter, type DocumentCapabilities, type DocumentMetadata, type DocumentSource, type OpenedDocument } from '../domain/documents'

const capabilities: DocumentCapabilities = { reflowable: true, supportsTextSelection: true, supportsSearch: false, supportsTableOfContents: false, supportsPagination: false, supportsReadAloud: false }
function titleFromFile(fileName: string) { return fileName.replace(/\.txt$/i, '') || 'Untitled document' }
async function textFrom(source: DocumentSource) {
  let text: string
  try { text = await source.blob.text() } catch { throw new DocumentError('read-failed', 'LumaRead could not read this file.') }
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?|\n/g, '\n').replaceAll('\0', '')
  if (!text.trim()) throw new DocumentError('empty-file', 'This file does not contain readable text.')
  const badCharacters = (text.match(/\uFFFD/g) ?? []).length
  if (badCharacters > Math.max(5, text.length * 0.02)) throw new DocumentError('invalid-document', 'This text file does not appear to use a supported encoding.')
  return text
}
export const txtAdapter: DocumentAdapter = {
  format: 'txt',
  async supports(source) { return source.fileName.toLowerCase().endsWith('.txt') },
  async inspect(source) { await textFrom(source) },
  async parseMetadata(source): Promise<DocumentMetadata> { await textFrom(source); return { title: titleFromFile(source.fileName), language: 'und', sectionCount: 1 } },
  async open(source, document): Promise<OpenedDocument> {
    const text = await textFrom(source)
    const content = text.split(/\n\s*\n+/).map((paragraph) => paragraph.trim().replace(/\n+/g, ' ')).filter(Boolean)
    if (!content.length) throw new DocumentError('empty-file', 'This file does not contain readable paragraphs.')
    return { document, capabilities, sections: [{ id: `${document.id}:section:0`, order: 0, content }] }
  },
}
