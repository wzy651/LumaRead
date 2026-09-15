import { DocumentError, type DocumentFormat, type DocumentSource } from '../../domain/documents'

const extensions: Record<string, DocumentFormat> = { txt: 'txt', epub: 'epub', pdf: 'pdf', docx: 'docx' }
export const fileSizeLimits: Record<DocumentFormat, number> = { txt: 10 * 1024 * 1024, epub: 200 * 1024 * 1024, pdf: 200 * 1024 * 1024, docx: 100 * 1024 * 1024 }

export function formatFromName(name: string): DocumentFormat | undefined { return extensions[name.split('.').pop()?.toLowerCase() ?? ''] }
export function sourceFromFile(file: File): DocumentSource {
  const format = formatFromName(file.name)
  if (!format) throw new DocumentError('unsupported-format', 'This file type is not supported.')
  if (file.size === 0) throw new DocumentError('empty-file', 'This file is empty.')
  if (file.size > fileSizeLimits[format]) throw new DocumentError('file-too-large', 'This file is larger than LumaRead can import right now.')
  return { blob: file, fileName: file.name, size: file.size }
}
export async function validateFileSignature(source: DocumentSource, format: DocumentFormat) {
  const head = new Uint8Array(await source.blob.slice(0, 8).arrayBuffer())
  const startsWith = (...values: number[]) => values.every((value, index) => head[index] === value)
  if (format === 'pdf' && !startsWith(0x25, 0x50, 0x44, 0x46, 0x2d)) throw new DocumentError('invalid-document', 'This does not appear to be a valid PDF file.')
  if ((format === 'epub' || format === 'docx') && !startsWith(0x50, 0x4b)) throw new DocumentError('invalid-document', `This does not appear to be a valid ${format.toUpperCase()} file.`)
}
export function chooseLocalDocument(): Promise<DocumentSource | undefined> {
  return new Promise((resolve, reject) => {
    const input = window.document.createElement('input')
    input.type = 'file'; input.accept = '.txt,.epub,.pdf,.docx'; input.style.display = 'none'
    let settled = false
    const finish = (value?: DocumentSource) => { if (settled) return; settled = true; input.remove(); resolve(value) }
    input.addEventListener('cancel', () => finish(), { once: true })
    input.addEventListener('change', () => { try { const file = input.files?.[0]; finish(file ? sourceFromFile(file) : undefined) } catch (error) { input.remove(); settled = true; reject(error) } }, { once: true })
    window.document.body.append(input); input.click()
  })
}
