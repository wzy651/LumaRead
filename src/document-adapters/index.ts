import type { DocumentAdapter, DocumentFormat } from '../domain/documents'
import { txtAdapter } from './txt-adapter'

// Format parsers load only after the user chooses that file format.
export async function adapterFor(format: DocumentFormat): Promise<DocumentAdapter> {
  switch (format) {
    case 'txt': return txtAdapter
    case 'epub': return (await import('./epub-adapter')).epubAdapter
    case 'pdf': return (await import('./pdf-adapter')).pdfAdapter
    case 'docx': return (await import('./docx-adapter')).docxAdapter
  }
}

export { txtAdapter }
