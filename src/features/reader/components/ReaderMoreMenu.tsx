import { Link } from 'react-router-dom'
import type { DocumentCapabilities } from '../../../domain/documents'

interface ReaderMoreMenuProps { capabilities?: DocumentCapabilities; canOpenTableOfContents?: boolean; onOpenTableOfContents?: () => void }
export function ReaderMoreMenu({ capabilities, canOpenTableOfContents = false, onOpenTableOfContents }: ReaderMoreMenuProps) {
  const tableOfContentsAvailable = Boolean(capabilities?.supportsTableOfContents && canOpenTableOfContents)
  return <section aria-labelledby="reader-more-title" className="reader-more-menu"><h2 id="reader-more-title">More</h2><button disabled={!tableOfContentsAvailable} onClick={onOpenTableOfContents} type="button">Table of contents {!tableOfContentsAvailable && <span>Coming soon</span>}</button><button disabled type="button">Search in book <span>Coming soon</span></button><button disabled type="button">Read aloud <span>Coming soon</span></button><Link to="/session-summary">End session &amp; view summary</Link></section>
}
