import { ArrowLeft, ArrowRight } from 'lucide-react'

type Props = { page: number; total: number; isMobile: boolean; chromeVisible: boolean; onPrevious: () => void; onNext: () => void }

export function PdfPageNavigation({ page, total, isMobile, chromeVisible, onPrevious, onNext }: Props) {
  return <nav aria-label="PDF page navigation" className={`pdf-page-navigation ${isMobile ? 'pdf-page-navigation--mobile' : 'pdf-page-navigation--desktop'} ${chromeVisible ? 'is-visible' : ''}`}>
    <button aria-label="Previous PDF page" disabled={page <= 1} onClick={onPrevious} type="button"><ArrowLeft aria-hidden="true" size={22} /></button>
    <button aria-label="Next PDF page" disabled={page >= total} onClick={onNext} type="button"><ArrowRight aria-hidden="true" size={22} /></button>
  </nav>
}
