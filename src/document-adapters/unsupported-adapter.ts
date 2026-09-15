import { DocumentError, type DocumentAdapter, type DocumentFormat, type DocumentSource } from '../domain/documents'
export function unsupportedAdapter(format: Exclude<DocumentFormat, 'txt'>): DocumentAdapter {
  const name = format.toUpperCase()
  return { format, async supports(source: DocumentSource) { return source.fileName.toLowerCase().endsWith(`.${format}`) }, async inspect() { throw new DocumentError('unsupported-format', `${name} reading support is being prepared.`) }, async parseMetadata() { throw new DocumentError('unsupported-format', `${name} reading support is being prepared.`) }, async open() { throw new DocumentError('unsupported-format', `${name} reading support is being prepared.`) } }
}
