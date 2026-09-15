import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, FileText, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { DocumentError, ImportedDocument } from '../../domain/documents'
import { chooseLocalDocument } from '../../platform/files'
import { getDocumentRepository } from '../../storage'
import { importDocument } from '../import'
import { ThemeToggle } from '../../components/ui'
import './library.css'

function bytes(value: number) { return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB` }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'LumaRead could not import this document.' }
export function LibraryPage() {
  const navigate = useNavigate(); const [documents, setDocuments] = useState<ImportedDocument[]>([]); const [message, setMessage] = useState<string>(); const [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => { try { setDocuments(await getDocumentRepository().listDocuments()) } catch (error) { setMessage(errorMessage(error)) } }, [])
  useEffect(() => { const timer = window.setTimeout(() => { void refresh() }, 0); return () => window.clearTimeout(timer) }, [refresh])
  async function handleImport() {
    setMessage(undefined); setBusy(true)
    try { const source = await chooseLocalDocument(); if (!source) return; const document = await importDocument(source, getDocumentRepository()); await refresh(); setMessage(`Added “${document.metadata.title}” to your library.`) }
    catch (error) { setMessage(errorMessage(error as DocumentError)) } finally { setBusy(false) }
  }
  return <div className="library-shell">
    <header className="library-header"><Link aria-label="Back to home" className="library-back" to="/"><ArrowLeft aria-hidden="true" size={19} /></Link><Link className="library-brand" to="/"><span>L</span>LumaRead</Link><ThemeToggle /></header>
    <main className="library-main">
      <div className="library-intro"><div><p>YOUR LIBRARY</p><h1>A place for your own reading.</h1><span>Import a document when you are ready.</span></div><button className="library-import" disabled={busy} onClick={() => void handleImport()} type="button"><Plus aria-hidden="true" size={18} />{busy ? 'Preparing…' : 'Import document'}</button></div>
      <div aria-live="polite" className="library-feedback">{message}</div>
      {documents.length === 0 ? <section className="library-empty"><FileText aria-hidden="true" size={28} /><h2>Your library is quiet for now.</h2><p>TXT files can be read here today. EPUB, PDF, and DOCX support is being prepared.</p><button className="library-import library-import--quiet" disabled={busy} onClick={() => void handleImport()} type="button">Choose a document</button></section> : <section aria-label="Imported documents" className="library-list">{documents.map((document) => <article className="library-card" key={document.id}><div className="library-card__icon"><BookOpen aria-hidden="true" size={20} /></div><div className="library-card__content"><div className="library-card__top"><span>{document.format.toUpperCase()}</span><small>{bytes(document.fileSize)}</small></div><h2>{document.metadata.title}</h2><p>{document.fileName}</p><small>Imported {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(document.importedAt))}</small></div><button className="library-continue" onClick={() => navigate(`/reader/${document.id}`)} type="button">Continue reading</button></article>)}</section>}
    </main>
  </div>
}
