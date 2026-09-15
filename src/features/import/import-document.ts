import { adapterFor } from '../../document-adapters'
import { DocumentError, type DocumentFormat, type DocumentRepository, type ImportedDocument } from '../../domain/documents'
import { formatFromName, validateFileSignature } from '../../platform/files'
import type { DocumentSource } from '../../domain/documents'

async function fingerprint(source: DocumentSource) { const bytes = await source.blob.arrayBuffer(); const hash = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('') }
export async function importDocument(source: DocumentSource, repository: DocumentRepository): Promise<ImportedDocument> {
  const format = formatFromName(source.fileName); if (!format) throw new DocumentError('unsupported-format', 'This file type is not supported.')
  const adapter = adapterFor(format); await validateFileSignature(source, format)
  if (!await adapter.supports(source)) throw new DocumentError('unsupported-format', 'This file type is not supported.')
  const parsed = await adapter.parse(source)
  const contentFingerprint = await fingerprint(source); if (await repository.hasDocument(contentFingerprint)) throw new DocumentError('duplicate-document', 'This document is already in your library.')
  const now = new Date().toISOString(); const document: ImportedDocument = { id: crypto.randomUUID(), format, fileName: source.fileName, fileSize: source.size, importedAt: now, updatedAt: now, metadata: parsed.metadata, fingerprint: contentFingerprint, status: 'ready' }
  await repository.saveDocument({ document, source: source.blob, sections: parsed.sections, capabilities: parsed.capabilities }); return document
}
export function supportMessage(format: DocumentFormat) { return `${format.toUpperCase()} reading support is being prepared.` }
