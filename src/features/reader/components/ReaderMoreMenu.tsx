import { Link } from 'react-router-dom'

export function ReaderMoreMenu() {
  return <section aria-labelledby="reader-more-title" className="reader-more-menu"><h2 id="reader-more-title">More</h2><button disabled type="button">Table of contents <span>Coming soon</span></button><button disabled type="button">Search in book <span>Coming soon</span></button><button disabled type="button">Read aloud <span>Coming soon</span></button><Link to="/session-summary">End session &amp; view summary</Link></section>
}
