export const documentFormats = ['epub', 'pdf', 'docx', 'txt'] as const
export type DocumentFormat = (typeof documentFormats)[number]
export type DocumentStatus = 'ready' | 'unsupported'

export interface DocumentMetadata { title: string; author?: string; language?: string; description?: string; cover?: string; sectionCount?: number }
export interface ImportedDocument { id: string; format: DocumentFormat; fileName: string; fileSize: number; importedAt: string; updatedAt: string; metadata: DocumentMetadata; fingerprint: string; status: DocumentStatus }
export interface DocumentSource { blob: Blob; fileName: string; size: number }
export interface DocumentSection { id: string; title?: string; order: number; content: string[] }
export interface ReaderLocation { documentId: string; sectionId: string; sectionIndex: number; progressPercent: number; updatedAt: string }
export interface DocumentCapabilities { reflowable: boolean; supportsTextSelection: boolean; supportsSearch: boolean; supportsTableOfContents: boolean; supportsPagination: boolean; supportsReadAloud: boolean }
export interface OpenedDocument { document: ImportedDocument; sections: DocumentSection[]; capabilities: DocumentCapabilities }
export type DocumentErrorCode = 'unsupported-format' | 'empty-file' | 'file-too-large' | 'duplicate-document' | 'invalid-document' | 'read-failed' | 'parse-failed' | 'storage-failed'
export class DocumentError extends Error { constructor(public readonly code: DocumentErrorCode, message: string) { super(message); this.name = 'DocumentError' } }
export interface DocumentAdapter { format: DocumentFormat; supports(source: DocumentSource): Promise<boolean>; inspect(source: DocumentSource): Promise<void>; parseMetadata(source: DocumentSource): Promise<DocumentMetadata>; open(source: DocumentSource, document: ImportedDocument): Promise<OpenedDocument> }
export interface StoredDocument { document: ImportedDocument; source: Blob; sections: DocumentSection[] }
export interface DocumentRepository { saveDocument(record: StoredDocument): Promise<void>; getDocument(id: string): Promise<StoredDocument | undefined>; listDocuments(): Promise<ImportedDocument[]>; hasDocument(fingerprint: string): Promise<boolean>; saveLocation(location: ReaderLocation): Promise<void>; getLocation(documentId: string): Promise<ReaderLocation | undefined> }
