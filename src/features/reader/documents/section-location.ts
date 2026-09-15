import type { DocumentSection, ReaderLocation } from '../../../domain/documents'
export function resolveSectionIndex(sections: DocumentSection[], location?: ReaderLocation) { const matching = location ? sections.findIndex((section) => section.id === location.sectionId) : -1; return matching >= 0 ? matching : Math.min(Math.max(location?.sectionIndex ?? 0, 0), Math.max(sections.length - 1, 0)) }
