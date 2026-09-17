'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, ExternalLink, Expand, X } from 'lucide-react'
import type { DocumentRow } from '@/lib/mylife-data'
import { getSupabaseClient } from '@/lib/supabase'
import './DocumentsWorkspace.css'

function date(value: string) {
  const parsed = new Date(value.slice(0, 10) + 'T12:00:00Z')
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('ro-RO', { timeZone: 'UTC' })
}
function expiry(value: string | null) {
  if (!value) return 'Fără dată expirare'
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
  const days = Math.round((Date.parse(value.slice(0,10)) - Date.parse(today)) / 86400000)
  return days < 0 ? 'Expirat' : days <= 30 ? 'Expiră curând' : 'Valid'
}
function readable(value: string) { return value.replace(/_/g, ' ') }

export default function DocumentsWorkspace({ documents, loading, onUpdated }: { documents: DocumentRow[]; loading: boolean; onUpdated: (document: DocumentRow) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = documents.find(doc => doc.id === selectedId) ?? documents[0]
  return <div className="documentsWorkspace">
    <div className="sectionTitle"><h2>Documentele mele</h2><span>{documents.length} documente</span></div>
    {loading ? <div className="emptyState" role="status">Se încarcă documentele…</div> : !selected ? <div className="documentsEmpty">Nu există documente vizibile pentru acest cont.</div> : <div className="documentsLayout">
      <nav className="documentsList" aria-label="Lista documentelor">{documents.map(doc => <button type="button" key={doc.id} aria-pressed={selected.id === doc.id} onClick={() => setSelectedId(doc.id)}>
        <FileText size={20} aria-hidden="true"/><div><strong>{doc.source_filename || readable(doc.document_type)}</strong><span>{readable(doc.document_type)}</span>{doc.issuer && <span>{doc.issuer}</span>}{doc.expires_at && <span>Expiră {date(doc.expires_at)}</span>}<small>{doc.storage_path ? 'Fișier asociat · acces verificat la deschidere' : 'Doar metadata'}</small></div>
      </button>)}</nav>
      <DocumentDetail key={selected.id + (selected.storage_path ?? '')} document={selected} onUpdated={onUpdated}/>
    </div>}
  </div>
}

function DocumentDetail({ document: initialDoc, onUpdated }: { document: DocumentRow; onUpdated: (document: DocumentRow) => void }) {
  const [doc, setDoc] = useState(initialDoc)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  async function attach(file: File) {
    setUploading(true); setUploadError('')
    try {
      const client = getSupabaseClient()
      if (!client) throw new Error('Conectează contul Supabase.')
      const { data: auth, error: authError } = await client.auth.getUser()
      if (authError || !auth.user) throw new Error('Autentifică-te înainte de upload.')
      if (file.size > 20 * 1024 * 1024) throw new Error('Fișierul trebuie să fie mai mic de 20 MB.')
      if (!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)) throw new Error('Selectează un JPG, PNG, WebP sau PDF.')
      const path = `${auth.user.id}/${doc.id}/${crypto.randomUUID()}.${file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1]}`
      const { error: uploadError } = await client.storage.from('mylife-documents').upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) throw new Error('Fișierul nu a putut fi încărcat. Verifică sesiunea și permisiunile.')
      const { data: saved, error: saveError } = await client.from('documents').update({ storage_path: path, mime_type: file.type, source_filename: file.name }).eq('id', doc.id).eq('user_id', auth.user.id).is('storage_path', null).select('id').maybeSingle()
      if (saveError || !saved) {
        await client.storage.from('mylife-documents').remove([path])
        throw new Error('Asocierea fișierului nu a reușit. Actualizează documentele și reîncearcă.')
      }
      const updated = { ...doc, storage_path: path, mime_type: file.type, source_filename: file.name }
      setDoc(updated); onUpdated(updated)
    } catch (error) { setUploadError(error instanceof Error ? error.message : 'Upload nereușit.') }
    finally { setUploading(false) }
  }
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(Boolean(doc.storage_path))
  const [revision, setRevision] = useState(0)
  const [imageError, setImageError] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!doc.storage_path) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    setBusy(true); setUrl(''); setError(''); setImageError(false)
    async function sign() {
      const client = getSupabaseClient()
      if (!client) throw new Error('Conectează contul Supabase pentru a deschide fișierul.')
      const { data: auth, error: authError } = await client.auth.getUser()
      if (authError || !auth.user) throw new Error('Autentifică-te pentru a accesa fișierul privat.')
      const path = doc.storage_path!.replace(/^mylife-documents\//, '')
      const { data, error: storageError } = await client.storage.from('mylife-documents').createSignedUrl(path, 300)
      if (storageError || !data?.signedUrl) throw new Error('Fișierul nu este disponibil sau nu ai permisiunea de a-l citi.')
      if (!cancelled) { setUrl(data.signedUrl); timer = setTimeout(() => setRevision(value => value + 1), 240000) }
    }
    sign().catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Fișierul nu poate fi încărcat.') }).finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [doc.storage_path, revision])
  const fields = [
    ['Tip document', readable(doc.document_type)], ['Nume fișier', doc.source_filename], ['Emitent', doc.issuer],
    ['Țară emitentă', doc.issuing_country], ['Autoritate emitentă', doc.issuing_authority],
    ['Data emiterii', doc.issued_at && date(doc.issued_at)], ['Data expirării', doc.expires_at && date(doc.expires_at)],
    ['Data documentului', doc.document_date && date(doc.document_date)], ['Format', doc.mime_type], ['Note', doc.notes],
  ].filter(([,value]) => Boolean(value))
  const extra = Object.entries(doc.extra ?? {}).filter(([,value]) => value !== null && value !== '' && value !== undefined)
  const mime = doc.mime_type?.toLowerCase()
  const extension = (doc.source_filename || doc.storage_path || '').split('.').pop()?.toLowerCase()
  const image = mime ? ['image/jpeg','image/png','image/webp','image/gif','image/avif','image/bmp'].includes(mime) : ['jpg','jpeg','png','webp','gif','avif','bmp'].includes(extension ?? '')
  const pdf = mime ? mime === 'application/pdf' : extension === 'pdf'
  const status = expiry(doc.expires_at)
  return <div className="documentsDetail">
    <section className="documentsMetadata" aria-label="Detalii document">
      <div className="documentsDetailHeading"><h2>{doc.source_filename || readable(doc.document_type)}</h2><span className={`documentsBadge ${status === 'Expirat' ? 'expired' : status === 'Expiră curând' ? 'soon' : ''}`}>{status}</span></div>
      <dl>{fields.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {extra.length > 0 && <><h3>Alte date</h3><dl>{extra.map(([key,value]) => <div key={key}><dt>{readable(key)}</dt><dd>{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</dd></div>)}</dl></>}
    </section>
    <section className="documentsViewer" aria-label="Preview document">
      <div className="documentsViewerToolbar"><span><FileText size={18} aria-hidden="true"/> Preview document</span>{url && <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden="true"/> Deschide documentul</a>}</div>
      <div className="documentsPreview">
        {!doc.storage_path ? <div className="documentsViewerMessage"><FileText size={40} aria-hidden="true"/><p>Fișierul nu este încă disponibil. Metadata documentului este salvată.</p><label className="documentsUploadButton">{uploading ? 'Se încarcă…' : 'Atașează fișierul'}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; if (file) void attach(file); event.target.value = '' }}/></label>{uploadError && <p role="alert">{uploadError}</p>}</div> : busy ? <p role="status">Se verifică accesul la fișier…</p> : error ? <div className="documentsViewerMessage"><p role="alert">{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Reîncearcă</button></div> : url && image && !imageError ? <button type="button" className="documentsImageButton" aria-label="Mărește imaginea" onClick={() => dialog.current?.showModal()}><img src={url} alt={doc.source_filename || 'Document'} onError={() => setImageError(true)}/><span><Expand size={16}/> Mărește imaginea</span></button> : url && pdf ? <object data={url + '#page=1'} type="application/pdf" aria-label={doc.source_filename || 'Document PDF'}><p>Browserul nu poate afișa PDF-ul. Folosește „Deschide documentul”.</p></object> : <p>{imageError ? 'Imaginea nu poate fi afișată.' : 'Acest format nu are preview integrat.'} Folosește „Deschide documentul”.</p>}
      </div>
      {url && <p className="documentsViewerFootnote">Acces privat · link temporar valabil 5 minute. Pe mobil, dacă PDF-ul nu se afișează, deschide documentul complet.</p>}
    </section>
    {image && url && <dialog className="documentsImageDialog" ref={dialog} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}><button type="button" aria-label="Închide imaginea" onClick={() => dialog.current?.close()}><X/></button><img src={url} alt={doc.source_filename || 'Document'}/></dialog>}
  </div>
}
