import type { DocumentAdapter } from '../../../domain/documents'
import type { DocumentContentUpdate, DocumentRepository, StoredDocument } from '../../../domain/documents'
import { currentContentSchemaVersion } from '../../../storage/database'

export type EpubContentUpgradeStatus = 'current' | 'upgraded' | 'parse-failed' | 'storage-failed'
export type EpubContentUpgradeResult = { record: StoredDocument; status: EpubContentUpgradeStatus }

const attempts = new Map<string, Promise<EpubContentUpgradeResult>>()

function oldContentRecord(record: StoredDocument): StoredDocument {
  return { ...record, capabilities: { ...record.capabilities, supportsInternalLinks: false } }
}

async function performUpgrade(record: StoredDocument, repository: DocumentRepository, adapter: DocumentAdapter): Promise<EpubContentUpgradeResult> {
  const fallback = oldContentRecord(record)
  let parsed
  try {
    parsed = await adapter.parse({ blob: record.source, fileName: record.document.fileName, size: record.source.size })
  } catch {
    return { record: fallback, status: 'parse-failed' }
  }

  const update: DocumentContentUpdate = {
    sections: parsed.sections,
    capabilities: parsed.capabilities,
    contentSchemaVersion: currentContentSchemaVersion,
  }
  const sessionRecord: StoredDocument = { ...record, ...update, contentSchemaVersion: record.contentSchemaVersion }
  try {
    const updated = await repository.updateDocumentContent(record.document.id, update)
    if (!updated) return { record: sessionRecord, status: 'storage-failed' }
    return { record: updated, status: 'upgraded' }
  } catch {
    return { record: sessionRecord, status: 'storage-failed' }
  }
}

/**
 * Attempts one EPUB content-model upgrade per document and schema version per
 * application session. Failed attempts remain retryable in a later session,
 * while concurrent readers share the same parse and persistence operation.
 */
export function ensureCurrentEpubContent(record: StoredDocument, repository: DocumentRepository, adapter: DocumentAdapter): Promise<EpubContentUpgradeResult> {
  if (record.document.format !== 'epub' || record.contentSchemaVersion === currentContentSchemaVersion) return Promise.resolve({ record, status: 'current' })
  const key = `${record.document.id}:${currentContentSchemaVersion}`
  const existing = attempts.get(key)
  if (existing) return existing
  const attempt = performUpgrade(record, repository, adapter)
  attempts.set(key, attempt)
  return attempt
}

export function clearEpubContentUpgradeAttempts() {
  attempts.clear()
}
