import type { DocumentAdapter, DocumentFormat } from '../domain/documents'
import { txtAdapter } from './txt-adapter'
import { unsupportedAdapter } from './unsupported-adapter'
const adapters: Record<DocumentFormat, DocumentAdapter> = { txt: txtAdapter, epub: unsupportedAdapter('epub'), pdf: unsupportedAdapter('pdf'), docx: unsupportedAdapter('docx') }
export function adapterFor(format: DocumentFormat) { return adapters[format] }
export { txtAdapter }
