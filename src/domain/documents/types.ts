export const documentFormats = ['epub', 'pdf', 'docx', 'txt'] as const
export type DocumentFormat = (typeof documentFormats)[number]
export type DocumentStatus = 'ready' | 'unsupported'

export interface DocumentMetadata { title: string; author?: string; language?: string; description?: string; cover?: string; sectionCount?: number }
export interface ImportedDocument { id: string; format: DocumentFormat; fileName: string; fileSize: number; importedAt: string; updatedAt: string; metadata: DocumentMetadata; fingerprint: string; status: DocumentStatus }
export interface DocumentSource { blob: Blob; fileName: string; size: number }
export type DocumentInternalLinkRole = 'link' | 'noteref'
export interface DocumentInternalLink { id: string; start: number; end: number; role: DocumentInternalLinkRole; target: { sectionId: string; blockId?: string } }
interface DocumentBlockBase { id: string; text: string; order: number; anchors?: string[]; links?: DocumentInternalLink[] }
export type DocumentBlock =
  | (DocumentBlockBase & { type: 'paragraph' | 'blockquote' | 'page-break' })
  | (DocumentBlockBase & { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6 })
  | (DocumentBlockBase & { type: 'list-item'; ordered: boolean })
export interface DocumentSection { id: string; title?: string; order: number; blocks: DocumentBlock[] }
export interface ReaderLocation { documentId: string; sectionId: string; sectionIndex: number; progressPercent: number; updatedAt: string; locator?: import('../reader-locator').ReaderLocator; pdf?: { mode: 'original' | 'reading'; zoomMode: 'comfortable' | 'fit-width' | 'fit-page' | 'actual' | 'custom'; zoom?: number; rotation: number; pageNumber: number } }
export interface DocumentCapabilities { reflowable: boolean; supportsOriginalLayout: boolean; supportsTextSelection: boolean; supportsSearch: boolean; supportsTableOfContents: boolean; supportsPagination: boolean; supportsReadAloud: boolean; supportsInternalLinks?: boolean }
export interface ParsedDocument { metadata: DocumentMetadata; sections: DocumentSection[]; capabilities: DocumentCapabilities }
export type DocumentErrorCode = 'unsupported-format' | 'empty-file' | 'file-too-large' | 'duplicate-document' | 'invalid-document' | 'read-failed' | 'parse-failed' | 'storage-failed'
export class DocumentError extends Error { constructor(public readonly code: DocumentErrorCode, message: string) { super(message); this.name = 'DocumentError' } }
export interface DocumentAdapter { format: DocumentFormat; supports(source: DocumentSource): Promise<boolean>; parse(source: DocumentSource): Promise<ParsedDocument> }
export interface StoredDocument { document: ImportedDocument; source: Blob; sections: DocumentSection[]; capabilities: DocumentCapabilities; contentSchemaVersion?: number }
export interface DocumentContentUpdate { sections: DocumentSection[]; capabilities: DocumentCapabilities; contentSchemaVersion: number }
export interface DocumentRepository { saveDocument(record: StoredDocument): Promise<void>; getDocument(id: string): Promise<StoredDocument | undefined>; listDocuments(): Promise<ImportedDocument[]>; hasDocument(fingerprint: string): Promise<boolean>; updateDocumentContent(documentId: string, update: DocumentContentUpdate): Promise<StoredDocument | undefined>; saveLocation(location: ReaderLocation): Promise<void>; getLocation(documentId: string): Promise<ReaderLocation | undefined>; listLocations(): Promise<ReaderLocation[]> }
export type { PdfReaderLocator, ReaderLocator, ReflowableReaderLocator } from '../reader-locator'
