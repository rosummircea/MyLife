'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, ArrowLeft, Car, ChevronRight, ExternalLink, FileText, Gauge, Home, Pencil, Plus, Save, Settings, Trash2, Wrench, X, Zap } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import { bucharestDay } from '@/lib/expense-report'
import type { DocumentRow } from '@/lib/mylife-data'
import { documentStatus, loadAutoData, photos, text, vehicleDocuments, type AutoData, type Vehicle, type VehiclePhoto, type VehicleRecord } from '@/lib/auto-data'
import './AutoExperience.css'

type AutoTab = 'Overview' | 'Documente' | 'Date' | 'Istoric'
type DeadlineKey = 'rca' | 'casco' | 'vignette' | 'itp' | 'fire_extinguisher' | 'service'
type DeadlineItem = {
  key: DeadlineKey
  label: string
  recordType: string
  record: VehicleRecord | null
  due: string | null
  remainingKm: string | null
  dueMonth: string | null
  status: { label: string; tone: 'ok' | 'attention' | 'danger' | 'muted' }
}

type VehicleDataField = {
  key: 'mileage_km' | 'fuel' | 'power_kw' | 'color' | 'seats' | 'max_authorized_mass_kg'
  label: string
  unit?: string
  numeric?: boolean
}

const tabs: AutoTab[] = ['Overview', 'Documente', 'Date', 'Istoric']
const dataFields: VehicleDataField[] = [
  { key: 'mileage_km', label: 'Kilometraj', unit: 'km', numeric: true },
  { key: 'fuel', label: 'Motorizare' },
  { key: 'power_kw', label: 'Putere', unit: 'kW', numeric: true },
  { key: 'color', label: 'Culoare' },
  { key: 'seats', label: 'Locuri', numeric: true },
  { key: 'max_authorized_mass_kg', label: 'Masă maximă autorizată', unit: 'kg', numeric: true },
]

const deadlineSpecs: { key: DeadlineKey; label: string; types: string[]; recordType: string }[] = [
  { key: 'service', label: 'Revizie', types: ['service'], recordType: 'service' },
  { key: 'vignette', label: 'Rovinietă', types: ['vignette'], recordType: 'vignette' },
  { key: 'casco', label: 'CASCO', types: ['casco'], recordType: 'casco' },
  { key: 'rca', label: 'RCA', types: ['rca'], recordType: 'rca' },
  { key: 'itp', label: 'ITP', types: ['itp', 'inspection'], recordType: 'itp' },
  { key: 'fire_extinguisher', label: 'Stingător', types: ['fire_extinguisher'], recordType: 'fire_extinguisher' },
]

const documentTypeOptions = [
  ['asigurare_auto_rca', 'RCA'],
  ['asigurare_auto_casco', 'CASCO'],
  ['certificat_inmatriculare', 'Talon'],
  ['carte_identitate_vehicul', 'Carte identitate vehicul (CIV)'],
  ['rovinieta', 'Rovinietă'],
  ['document_auto', 'Alt document auto'],
] as const

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const parsed = new Date(value.slice(0, 10) + 'T12:00:00Z')
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
function monthLabel(value: string | null) {
  if (!value) return ''
  const parsed = new Date(`${value}-01T12:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
function vehicleTitle(vehicle: Vehicle) { return [vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicul' }
function documentLabel(type: string) { return documentTypeOptions.find(([code]) => code === type)?.[1] ?? type.replace(/_/g, ' ') }
function documentHelper(type: string) {
  const helpers: Record<string, string> = {
    asigurare_auto_rca: 'Poliță de răspundere civilă',
    asigurare_auto_casco: 'Poliță facultativă',
    certificat_inmatriculare: 'Certificat de înmatriculare',
    carte_identitate_vehicul: 'Față + verso într-un singur fișier',
    rovinieta: 'Document de drum',
  }
  return helpers[type] ?? 'Document auto'
}
function deadlineStatus(value: string | null, today: string) {
  if (!value) return { label: 'Nesetat', tone: 'muted' as const }
  const days = (Date.parse(value.slice(0, 10)) - Date.parse(today)) / 86400000
  if (!Number.isFinite(days)) return { label: 'Dată nevalidă', tone: 'danger' as const }
  if (days < 0) return { label: 'Expirat', tone: 'danger' as const }
  if (days <= 30) return { label: 'În curând', tone: 'attention' as const }
  return { label: 'Valid', tone: 'ok' as const }
}
function recordDue(record: VehicleRecord, key: DeadlineKey) {
  if (key === 'service') return text(record.extra?.next_due_date) || record.expires_at
  return record.expires_at
}
function deadlineItems(records: VehicleRecord[], today: string): DeadlineItem[] {
  return deadlineSpecs.map(spec => {
    const candidates = records.filter(record => spec.types.includes(record.record_type))
    const record = [...candidates].sort((a, b) => (recordDue(b, spec.key) || b.issued_at || '').localeCompare(recordDue(a, spec.key) || a.issued_at || ''))[0] ?? null
    const due = record ? recordDue(record, spec.key) : null
    const remainingKm = spec.key === 'service' && record ? text(record.extra?.remaining_km) : null
    const dueMonth = spec.key === 'service' && record ? text(record.extra?.next_due_month) : null
    const status = remainingKm || dueMonth ? { label: 'Planificat', tone: 'ok' as const } : deadlineStatus(due, today)
    return { ...spec, record, due, remainingKm, dueMonth, status }
  })
}
function displayDeadline(item: DeadlineItem) {
  if (item.remainingKm && item.dueMonth) return `${Number(item.remainingKm).toLocaleString('ro-RO')} km / ${monthLabel(item.dueMonth)}`
  if (item.remainingKm) return `${Number(item.remainingKm).toLocaleString('ro-RO')} km`
  if (item.dueMonth) return monthLabel(item.dueMonth)
  return formatDate(item.due)
}
function statusClass(tone: DeadlineItem['status']['tone']) { return `autoStatusDot ${tone}` }

export default function AutoModule({ connected, refreshVersion, documents, documentsLoading, registerMobileBack, onHome, onOpenDocument, onChanged }: { connected: boolean; refreshVersion: number; documents: DocumentRow[]; documentsLoading: boolean; registerMobileBack: (handler: (() => boolean) | null) => void; onHome: () => void; onOpenDocument: (id: string) => void; onChanged: () => void }) {
  const [data, setData] = useState<AutoData>({ vehicles: [], records: [] })
  const [loading, setLoading] = useState(connected)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!connected) { setLoading(false); setData({ vehicles: [], records: [] }); return }
    const client = getSupabaseClient()
    if (!client) { setError('Supabase nu este configurat.'); setLoading(false); return }
    setLoading(true); setError('')
    loadAutoData(client).then(result => {
      if (cancelled) return
      setData(result)
      setSelectedId(current => current && result.vehicles.some(vehicle => vehicle.id === current) ? current : result.vehicles.length === 1 ? result.vehicles[0].id : current)
    }).catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Datele Auto nu pot fi încărcate.') }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [connected, revision, refreshVersion])

  useEffect(() => {
    registerMobileBack(() => {
      if (selectedId && data.vehicles.length > 1) { setSelectedId(null); return true }
      return false
    })
    return () => registerMobileBack(null)
  }, [data.vehicles.length, registerMobileBack, selectedId])

  const refreshAll = () => { setRevision(value => value + 1); onChanged() }
  const vehicle = data.vehicles.find(item => item.id === selectedId) ?? null

  return <section className="modulePage autoModule">
    {loading ? <div className="autoLoading">Se încarcă mașina…</div> : error ? <div className="autoError" role="alert"><AlertCircle size={20}/><span>{error}</span><button type="button" onClick={() => setRevision(value => value + 1)}>Reîncearcă</button></div> : !vehicle ? <VehiclePicker vehicles={data.vehicles} documents={documents} documentsLoading={documentsLoading} onSelect={setSelectedId} onHome={onHome}/> : <VehicleWorkspace vehicle={vehicle} allVehicles={data.vehicles.length} records={data.records.filter(item => item.vehicle_id === vehicle.id)} documents={vehicleDocuments(vehicle.id, documents)} documentsLoading={documentsLoading} today={bucharestDay(new Date())} onBack={() => setSelectedId(null)} onOpenDocument={onOpenDocument} onChanged={refreshAll}/>} 
  </section>
}

function VehiclePicker({ vehicles, documents, documentsLoading, onSelect, onHome }: { vehicles: Vehicle[]; documents: DocumentRow[]; documentsLoading: boolean; onSelect: (id: string) => void; onHome: () => void }) {
  return <div className="autoPicker">
    <header className="autoPageHeader"><div><span>MYLIFE AUTO</span><h1>Mașinile mele</h1><p>Alege vehiculul pe care vrei să-l vezi.</p></div><button type="button" className="autoIconButton" onClick={onHome} aria-label="Acasă"><Home size={20}/></button></header>
    {!vehicles.length ? <div className="autoEmptyLight"><Car size={42}/><h2>Nu există vehicule</h2><p>Vehiculele adăugate în MyLife vor apărea aici.</p></div> : <div className="autoPickerGrid">{vehicles.map(vehicle => <button type="button" className="autoPickerCard" key={vehicle.id} onClick={() => onSelect(vehicle.id)}><VehiclePhoto vehicle={vehicle}/><div><h2>{vehicleTitle(vehicle)}</h2><p>{vehicle.registration_number || 'Fără număr'}</p><span>{documentsLoading ? 'Se încarcă…' : `${vehicleDocuments(vehicle.id, documents).length} documente`}</span></div><ChevronRight size={20}/></button>)}</div>}
  </div>
}

function VehicleWorkspace({ vehicle, allVehicles, records, documents, documentsLoading, today, onBack, onOpenDocument, onChanged }: { vehicle: Vehicle; allVehicles: number; records: VehicleRecord[]; documents: DocumentRow[]; documentsLoading: boolean; today: string; onBack: () => void; onOpenDocument: (id: string) => void; onChanged: () => void }) {
  const [tab, setTab] = useState<AutoTab>('Overview')
  const [selectedDoc, setSelectedDoc] = useState<DocumentRow | null>(null)
  const [docEditor, setDocEditor] = useState<{ mode: 'create' | 'edit'; document?: DocumentRow } | null>(null)
  const [fieldEditor, setFieldEditor] = useState<VehicleDataField | null>(null)
  const [recordEditor, setRecordEditor] = useState<DeadlineItem | null>(null)
  const deadlines = useMemo(() => deadlineItems(records, today), [records, today])

  const titles: Record<AutoTab, [string, string]> = {
    Overview: ['Mașina mea', 'Totul despre mașină, simplu și clar.'],
    Documente: ['Documente', 'Toate fișierele mașinii, într-un singur loc.'],
    Date: ['Date', 'Metadate și scadențe, separate de documente.'],
    Istoric: ['Istoric', 'Ce s-a întâmplat și ce urmează.'],
  }

  return <div className="autoWorkspace">
    <header className="autoPageHeader"><div>{allVehicles > 1 && <button type="button" className="autoBackLink" onClick={onBack}><ArrowLeft size={16}/> Vehicule</button>}<span>MYLIFE AUTO</span><h1>{titles[tab][0]}</h1><p>{titles[tab][1]}</p></div><button type="button" className="autoIconButton" onClick={() => setTab('Date')} aria-label="Datele mașinii"><Settings size={20}/></button></header>
    <nav className="autoSegmented" aria-label="Secțiuni Auto">{tabs.map(item => <button type="button" key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</nav>
    <VehicleHero vehicle={vehicle}/>

    {tab === 'Overview' && <OverviewTab vehicle={vehicle} documents={documents} documentsLoading={documentsLoading} deadlines={deadlines} onTab={setTab} onDeadline={setRecordEditor}/>} 
    {tab === 'Documente' && <DocumentsTab documents={documents} loading={documentsLoading} today={today} onSelect={setSelectedDoc} onCreate={() => setDocEditor({ mode: 'create' })}/>} 
    {tab === 'Date' && <DataTab vehicle={vehicle} deadlines={deadlines} onField={setFieldEditor} onDeadline={setRecordEditor}/>} 
    {tab === 'Istoric' && <HistoryTab records={records} documents={documents} today={today} onDocument={setSelectedDoc} onRecord={item => setRecordEditor(deadlines.find(deadline => deadline.record?.id === item.id) ?? { key: item.record_type === 'service' ? 'service' : (item.record_type as DeadlineKey), label: item.record_type.replace(/_/g, ' '), recordType: item.record_type, record: item, due: item.expires_at, remainingKm: text(item.extra?.remaining_km), dueMonth: text(item.extra?.next_due_month), status: deadlineStatus(item.expires_at, today) })}/>} 

    {selectedDoc && <DocumentSheet document={selectedDoc} today={today} onClose={() => setSelectedDoc(null)} onOpen={() => onOpenDocument(selectedDoc.id)} onEdit={() => { setDocEditor({ mode: 'edit', document: selectedDoc }); setSelectedDoc(null) }} onDeleted={() => { setSelectedDoc(null); onChanged() }}/>} 
    {docEditor && <DocumentEditor vehicle={vehicle} document={docEditor.document} onClose={() => setDocEditor(null)} onSaved={() => { setDocEditor(null); onChanged() }}/>} 
    {fieldEditor && <VehicleFieldEditor vehicle={vehicle} field={fieldEditor} onClose={() => setFieldEditor(null)} onSaved={() => { setFieldEditor(null); onChanged() }}/>} 
    {recordEditor && <RecordEditor vehicle={vehicle} item={recordEditor} onClose={() => setRecordEditor(null)} onSaved={() => { setRecordEditor(null); onChanged() }}/>} 
  </div>
}

function VehicleHero({ vehicle }: { vehicle: Vehicle }) {
  return <section className="autoVehicleHero"><div className="autoVehicleHeroCopy"><h2>{vehicleTitle(vehicle)}</h2><strong>{vehicle.registration_number || 'Fără număr'}</strong><div className="autoHeroPills">{text(vehicle.extra?.fuel) && <span><Zap size={15}/>{text(vehicle.extra?.fuel)}</span>}{text(vehicle.extra?.power_kw) && <span><Gauge size={15}/>{Number(text(vehicle.extra?.power_kw)).toLocaleString('ro-RO')} kW</span>}</div></div><VehiclePhoto vehicle={vehicle}/></section>
}

function VehiclePhoto({ vehicle }: { vehicle: Vehicle }) {
  const photo = photos(vehicle)[0]
  const [url, setUrl] = useState<string | null>(photo?.data_url ?? null)
  const [failed, setFailed] = useState(false)
  const identity = photo ? JSON.stringify(photo) : ''
  useEffect(() => {
    const current: VehiclePhoto | undefined = identity ? JSON.parse(identity) : undefined
    if (!current || current.data_url) { setUrl(current?.data_url ?? null); return }
    let cancelled = false
    const client = getSupabaseClient()
    if (!client || !current.bucket || !current.path) return
    client.storage.from(current.bucket).createSignedUrl(current.path, 300).then(({ data, error }) => { if (!cancelled && !error) setUrl(data?.signedUrl ?? null) })
    return () => { cancelled = true }
  }, [identity])
  if (!photo || !url || failed) return <div className="autoVehiclePhotoFallback"><Car size={72}/></div>
  return <div className="autoVehiclePhoto"><img src={url} alt={photo.caption || vehicleTitle(vehicle)} onError={() => setFailed(true)}/></div>
}

function OverviewTab({ vehicle, documents, documentsLoading, deadlines, onTab, onDeadline }: { vehicle: Vehicle; documents: DocumentRow[]; documentsLoading: boolean; deadlines: DeadlineItem[]; onTab: (tab: AutoTab) => void; onDeadline: (item: DeadlineItem) => void }) {
  const urgent = deadlines.filter(item => item.record && (item.status.tone === 'danger' || item.status.tone === 'attention'))
  const service = deadlines.find(item => item.key === 'service' && item.record)
  const next = urgent[0] ?? service ?? deadlines.find(item => item.record) ?? null
  return <div className="autoAppleContent">
    <section className="autoActionCard"><span>Următoarea acțiune</span>{next ? <button type="button" onClick={() => onDeadline(next)}><div className="autoRoundIcon"><Wrench size={23}/></div><div><strong>{next.label}{next.status.tone === 'attention' ? ' · în curând' : ''}</strong><p>{displayDeadline(next)}</p></div><ChevronRight size={20}/></button> : <p>Nu există încă o acțiune planificată.</p>}</section>
    <div className="autoSummaryGrid"><button type="button" onClick={() => onTab('Documente')}><div className="autoRoundIcon"><FileText size={22}/></div><div><span>Documente</span><strong>{documentsLoading ? '…' : `${documents.length} documente`}</strong><small>Toate fișierele sunt aici</small></div><ChevronRight size={18}/></button><button type="button" onClick={() => onTab('Date')}><div className="autoRoundIcon"><Gauge size={22}/></div><div><span>Date mașină</span><strong>{text(vehicle.extra?.mileage_km) ? `${Number(text(vehicle.extra?.mileage_km)).toLocaleString('ro-RO')} km` : 'Nesetat'}</strong><small>Kilometraj actual</small></div><ChevronRight size={18}/></button></div>
    <section className="autoListCard"><header><h3>Scadențe</h3><button type="button" onClick={() => onTab('Date')}>Vezi toate <ChevronRight size={16}/></button></header>{deadlines.filter(item => item.record).slice(0, 3).map(item => <button type="button" className="autoSimpleRow" key={item.key} onClick={() => onDeadline(item)}><span className={statusClass(item.status.tone)}/><strong>{item.label}</strong><span>{displayDeadline(item)}</span><ChevronRight size={17}/></button>)}</section>
  </div>
}

function DocumentsTab({ documents, loading, today, onSelect, onCreate }: { documents: DocumentRow[]; loading: boolean; today: string; onSelect: (document: DocumentRow) => void; onCreate: () => void }) {
  return <div className="autoAppleContent"><section className="autoListCard autoDocumentsCard"><header><h3>Toate documentele</h3><button type="button" className="autoPrimaryMini" onClick={onCreate}><Plus size={16}/> Adaugă</button></header>{loading ? <p className="autoMutedLight">Se încarcă documentele…</p> : !documents.length ? <div className="autoEmptyLight"><FileText size={34}/><h3>Niciun document</h3><p>Adaugă primul fișier al mașinii.</p><button type="button" className="autoPrimaryButton" onClick={onCreate}><Plus size={18}/> Adaugă document</button></div> : documents.map(document => { const status = document.storage_path ? documentStatus(document.expires_at, today) : 'Fără fișier'; const tone = status === 'Expirat' ? 'danger' : status === 'Expiră curând' || status === 'Fără fișier' ? 'attention' : 'ok'; return <button type="button" className="autoDocumentRow" key={document.id} onClick={() => onSelect(document)}><div className="autoDocIcon"><FileText size={21}/></div><div><strong>{documentLabel(document.document_type)}</strong><span>{documentHelper(document.document_type)}</span></div><em className={`autoPill ${tone}`}>{status === 'Fără dată expirare' ? 'Salvat' : status}</em><ChevronRight size={18}/></button>})}</section>{documents.length > 0 && <button type="button" className="autoPrimaryButton autoAddDocument" onClick={onCreate}><Plus size={19}/> Adaugă document</button>}</div>
}

function DataTab({ vehicle, deadlines, onField, onDeadline }: { vehicle: Vehicle; deadlines: DeadlineItem[]; onField: (field: VehicleDataField) => void; onDeadline: (item: DeadlineItem) => void }) {
  return <div className="autoAppleContent"><section className="autoListCard"><header><h3>Date principale</h3><span>Apasă pentru editare</span></header>{dataFields.map(field => <button type="button" className="autoDataRow" key={field.key} onClick={() => onField(field)}><span>{field.label}</span><strong>{text(vehicle.extra?.[field.key]) ? `${field.numeric ? Number(text(vehicle.extra?.[field.key])).toLocaleString('ro-RO') : text(vehicle.extra?.[field.key])}${field.unit ? ` ${field.unit}` : ''}` : 'Nesetat'}</strong><ChevronRight size={17}/></button>)}</section><section className="autoListCard"><header><h3>Scadențe</h3><span>Apasă pentru CRUD</span></header>{deadlines.map(item => <button type="button" className="autoSimpleRow" key={item.key} onClick={() => onDeadline(item)}><span className={statusClass(item.status.tone)}/><strong>{item.label}</strong><span>{displayDeadline(item)}</span><ChevronRight size={17}/></button>)}</section><div className="autoInfoNote"><span>i</span><p>Fișierele se găsesc doar în tabul <strong>Documente</strong>. Aici sunt doar date și scadențe.</p></div></div>
}

type HistoryEvent = { id: string; date: string; title: string; subtitle?: string | null; future: boolean; document?: DocumentRow; record?: VehicleRecord }
function HistoryTab({ records, documents, today, onDocument, onRecord }: { records: VehicleRecord[]; documents: DocumentRow[]; today: string; onDocument: (document: DocumentRow) => void; onRecord: (record: VehicleRecord) => void }) {
  const events = useMemo(() => {
    const result: HistoryEvent[] = []
    for (const record of records) {
      if (record.record_type === 'mileage' && record.issued_at) result.push({ id: `mileage-${record.id}`, date: record.issued_at, title: 'Kilometraj actualizat', subtitle: text(record.extra?.mileage_km) ? `${Number(text(record.extra?.mileage_km)).toLocaleString('ro-RO')} km` : null, future: false, record })
      if (record.expires_at) result.push({ id: `due-${record.id}`, date: record.expires_at, title: `${deadlineSpecs.find(spec => spec.types.includes(record.record_type))?.label ?? record.record_type} expiră`, future: record.expires_at > today, record })
      if (record.record_type === 'service' && text(record.extra?.next_due_month)) result.push({ id: `service-${record.id}`, date: `${text(record.extra?.next_due_month)}-01`, title: 'Revizie recomandată', subtitle: text(record.extra?.remaining_km) ? `sau peste ${Number(text(record.extra?.remaining_km)).toLocaleString('ro-RO')} km` : null, future: `${text(record.extra?.next_due_month)}-01` > today, record })
    }
    for (const document of documents) if (document.issued_at) result.push({ id: `doc-${document.id}`, date: document.issued_at, title: `${documentLabel(document.document_type)} emis`, future: document.issued_at > today, document })
    const unique = new Map<string, HistoryEvent>()
    result.forEach(event => unique.set(`${event.date}-${event.title}`, event))
    return [...unique.values()]
  }, [documents, records, today])
  const past = events.filter(event => !event.future).sort((a, b) => b.date.localeCompare(a.date))
  const future = events.filter(event => event.future).sort((a, b) => a.date.localeCompare(b.date))
  const row = (event: HistoryEvent) => <button type="button" className="autoTimelineRow" key={event.id} onClick={() => event.document ? onDocument(event.document) : event.record && onRecord(event.record)}><span className={`autoTimelineDot ${event.future ? 'future' : 'past'}`}/><time>{event.date.endsWith('-01') && event.title.startsWith('Revizie') ? monthLabel(event.date.slice(0, 7)) : formatDate(event.date)}</time><div><strong>{event.title}</strong>{event.subtitle && <span>{event.subtitle}</span>}</div><ChevronRight size={17}/></button>
  return <div className="autoAppleContent"><section className="autoListCard autoTimelineCard"><header><h3>Timeline</h3><span>{events.length} evenimente</span></header><h4>Trecut</h4>{past.length ? past.map(row) : <p className="autoMutedLight">Nu există evenimente trecute.</p>}<div className="autoTimelineDivider"/><h4>Urmează</h4>{future.length ? future.map(row) : <p className="autoMutedLight">Nu există evenimente planificate.</p>}</section></div>
}

function DocumentSheet({ document, today, onClose, onOpen, onEdit, onDeleted }: { document: DocumentRow; today: string; onClose: () => void; onOpen: () => void; onEdit: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const status = document.storage_path ? documentStatus(document.expires_at, today) : 'Fără fișier'
  async function remove() {
    if (!window.confirm(`Ștergi definitiv documentul „${documentLabel(document.document_type)}”?`)) return
    setBusy(true); setError('')
    try {
      const client = getSupabaseClient(); if (!client) throw new Error('Supabase nu este disponibil.')
      const { data: auth } = await client.auth.getUser(); if (!auth.user) throw new Error('Sesiunea nu este validă.')
      const storagePath = document.storage_path?.replace(/^mylife-documents\//, '') ?? null
      const { data: deleted, error: dbError } = await client.from('documents').delete().eq('id', document.id).eq('user_id', auth.user.id).select('id').maybeSingle()
      if (dbError || !deleted) throw new Error('Documentul nu a putut fi șters.')
      if (storagePath) await client.storage.from('mylife-documents').remove([storagePath])
      onDeleted()
    } catch (err) { setError(err instanceof Error ? err.message : 'Ștergerea nu a reușit.') } finally { setBusy(false) }
  }
  return <Sheet title={documentLabel(document.document_type)} onClose={onClose}><div className="autoSheetMeta"><div><span>Status</span><strong>{status}</strong></div><div><span>Fișier</span><strong>{document.source_filename || 'Nesetat'}</strong></div>{document.expires_at && <div><span>Expiră</span><strong>{formatDate(document.expires_at)}</strong></div>}{document.issuer && <div><span>Emitent</span><strong>{document.issuer}</strong></div>}</div>{error && <p className="autoFormError">{error}</p>}<div className="autoSheetActions"><button type="button" className="autoPrimaryButton" onClick={onOpen}><ExternalLink size={18}/> Deschide</button><button type="button" className="autoSecondaryButton" onClick={onEdit}><Pencil size={18}/> Editează</button><button type="button" className="autoDangerButton" disabled={busy} onClick={() => void remove()}><Trash2 size={18}/>{busy ? 'Se șterge…' : 'Șterge'}</button></div></Sheet>
}

function DocumentEditor({ vehicle, document, onClose, onSaved }: { vehicle: Vehicle; document?: DocumentRow; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState(document?.document_type ?? 'document_auto')
  const [issuedAt, setIssuedAt] = useState(document?.issued_at?.slice(0, 10) ?? '')
  const [expiresAt, setExpiresAt] = useState(document?.expires_at?.slice(0, 10) ?? '')
  const [issuer, setIssuer] = useState(document?.issuer ?? '')
  const [notes, setNotes] = useState(document?.notes ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    setBusy(true); setError('')
    try {
      const client = getSupabaseClient(); if (!client) throw new Error('Supabase nu este disponibil.')
      const { data: auth, error: authError } = await client.auth.getUser(); if (authError || !auth.user) throw new Error('Sesiunea nu este validă.')
      if (!document && !file) throw new Error('Alege un fișier pentru document.')
      if (file && file.size > 20 * 1024 * 1024) throw new Error('Fișierul trebuie să fie mai mic de 20 MB.')
      if (file && !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) throw new Error('Folosește JPG, PNG, WebP sau PDF.')
      const payload = { document_type: type, issued_at: issuedAt || null, expires_at: expiresAt || null, issuer: issuer.trim() || null, notes: notes.trim() || null }
      if (!document) {
        const id = crypto.randomUUID()
        const { error: insertError } = await client.from('documents').insert({ id, user_id: auth.user.id, ...payload, source_filename: file!.name, mime_type: file!.type, extra: { domain: 'auto', vehicle_id: vehicle.id } })
        if (insertError) throw new Error('Documentul nu a putut fi creat.')
        const ext = file!.type === 'application/pdf' ? 'pdf' : file!.type.split('/')[1]
        const path = `${auth.user.id}/${id}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await client.storage.from('mylife-documents').upload(path, file!, { contentType: file!.type, upsert: false })
        if (uploadError) { await client.from('documents').delete().eq('id', id).eq('user_id', auth.user.id); throw new Error('Fișierul nu a putut fi încărcat.') }
        const { error: linkError } = await client.from('documents').update({ storage_path: path }).eq('id', id).eq('user_id', auth.user.id)
        if (linkError) { await client.storage.from('mylife-documents').remove([path]); await client.from('documents').delete().eq('id', id).eq('user_id', auth.user.id); throw new Error('Fișierul nu a putut fi asociat.') }
      } else {
        let newPath: string | null = null
        if (file) {
          const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1]
          newPath = `${auth.user.id}/${document.id}/${crypto.randomUUID()}.${ext}`
          const { error: uploadError } = await client.storage.from('mylife-documents').upload(newPath, file, { contentType: file.type, upsert: false })
          if (uploadError) throw new Error('Fișierul nou nu a putut fi încărcat.')
        }
        const update = { ...payload, ...(file && newPath ? { source_filename: file.name, mime_type: file.type, storage_path: newPath } : {}) }
        const { error: updateError } = await client.from('documents').update(update).eq('id', document.id).eq('user_id', auth.user.id)
        if (updateError) { if (newPath) await client.storage.from('mylife-documents').remove([newPath]); throw new Error('Documentul nu a putut fi actualizat.') }
        if (newPath && document.storage_path) await client.storage.from('mylife-documents').remove([document.storage_path.replace(/^mylife-documents\//, '')])
      }
      onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : 'Salvarea nu a reușit.') } finally { setBusy(false) }
  }
  return <Sheet title={document ? 'Editează document' : 'Adaugă document'} onClose={onClose}><div className="autoForm"><label>Tip document<select value={type} onChange={event => setType(event.target.value)}>{documentTypeOptions.map(([code, label]) => <option value={code} key={code}>{label}</option>)}</select></label><label>Data emiterii<input type="date" value={issuedAt} onChange={event => setIssuedAt(event.target.value)}/></label><label>Data expirării<input type="date" value={expiresAt} onChange={event => setExpiresAt(event.target.value)}/></label><label>Emitent<input value={issuer} onChange={event => setIssuer(event.target.value)} placeholder="Opțional"/></label><label>Note<textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Opțional"/></label><label>{document ? 'Înlocuiește / atașează fișier' : 'Fișier'}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => setFile(event.target.files?.[0] ?? null)}/></label>{error && <p className="autoFormError">{error}</p>}<div className="autoFormActions"><button type="button" className="autoSecondaryButton" onClick={onClose}>Anulează</button><button type="button" className="autoPrimaryButton" disabled={busy} onClick={() => void save()}><Save size={18}/>{busy ? 'Se salvează…' : 'Salvează'}</button></div></div></Sheet>
}

function VehicleFieldEditor({ vehicle, field, onClose, onSaved }: { vehicle: Vehicle; field: VehicleDataField; onClose: () => void; onSaved: () => void }) {
  const current = text(vehicle.extra?.[field.key]) ?? ''
  const [value, setValue] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(clear = false) {
    setBusy(true); setError('')
    try {
      const client = getSupabaseClient(); if (!client) throw new Error('Supabase nu este disponibil.')
      const { data: auth } = await client.auth.getUser(); if (!auth.user) throw new Error('Sesiunea nu este validă.')
      const nextExtra = { ...(vehicle.extra ?? {}) }
      if (clear || !value.trim()) delete nextExtra[field.key]
      else nextExtra[field.key] = field.numeric ? Number(value.replace(/\s/g, '').replace(',', '.')) : value.trim()
      if (!clear && field.numeric && !Number.isFinite(Number(nextExtra[field.key]))) throw new Error('Introdu o valoare numerică validă.')
      const { error: updateError } = await client.from('vehicles').update({ extra: nextExtra, updated_at: new Date().toISOString() }).eq('id', vehicle.id).eq('user_id', auth.user.id)
      if (updateError) throw new Error('Valoarea nu a putut fi actualizată.')
      if (field.key === 'mileage_km' && !clear && value.trim() && value !== current) await client.from('vehicle_records').insert({ user_id: auth.user.id, vehicle_id: vehicle.id, record_type: 'mileage', issued_at: bucharestDay(new Date()), notes: 'Kilometraj actualizat din MyLife', extra: { mileage_km: Number(value.replace(/\s/g, '').replace(',', '.')) } })
      onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : 'Salvarea nu a reușit.') } finally { setBusy(false) }
  }
  return <Sheet title={field.label} onClose={onClose}><div className="autoForm"><label>Valoare<input type={field.numeric ? 'number' : 'text'} value={value} onChange={event => setValue(event.target.value)} placeholder="Nesetat"/></label>{field.unit && <p className="autoMutedLight">Unitate: {field.unit}</p>}{error && <p className="autoFormError">{error}</p>}<div className="autoFormActions"><button type="button" className="autoDangerButton" disabled={busy || !current} onClick={() => void save(true)}><Trash2 size={17}/> Șterge valoarea</button><button type="button" className="autoPrimaryButton" disabled={busy} onClick={() => void save()}><Save size={17}/>{busy ? 'Se salvează…' : 'Salvează'}</button></div></div></Sheet>
}

function RecordEditor({ vehicle, item, onClose, onSaved }: { vehicle: Vehicle; item: DeadlineItem; onClose: () => void; onSaved: () => void }) {
  const [expiresAt, setExpiresAt] = useState(item.due?.slice(0, 10) ?? '')
  const [remainingKm, setRemainingKm] = useState(item.remainingKm ?? '')
  const [dueMonth, setDueMonth] = useState(item.dueMonth ?? '')
  const [notes, setNotes] = useState(item.record?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    setBusy(true); setError('')
    try {
      const client = getSupabaseClient(); if (!client) throw new Error('Supabase nu este disponibil.')
      const { data: auth } = await client.auth.getUser(); if (!auth.user) throw new Error('Sesiunea nu este validă.')
      const extra = { ...(item.record?.extra ?? {}) }
      if (item.key === 'service') {
        if (remainingKm.trim()) extra.remaining_km = Number(remainingKm); else delete extra.remaining_km
        if (dueMonth) extra.next_due_month = dueMonth; else delete extra.next_due_month
      }
      const payload = { expires_at: item.key === 'service' ? null : (expiresAt || null), notes: notes.trim() || null, extra }
      if (item.record) {
        const { error: updateError } = await client.from('vehicle_records').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', item.record.id).eq('user_id', auth.user.id)
        if (updateError) throw new Error('Scadența nu a putut fi actualizată.')
      } else {
        const { error: insertError } = await client.from('vehicle_records').insert({ user_id: auth.user.id, vehicle_id: vehicle.id, record_type: item.recordType, ...payload })
        if (insertError) throw new Error('Scadența nu a putut fi creată.')
      }
      onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : 'Salvarea nu a reușit.') } finally { setBusy(false) }
  }
  async function remove() {
    if (!item.record || !window.confirm(`Ștergi înregistrarea „${item.label}”?`)) return
    setBusy(true); setError('')
    try {
      const client = getSupabaseClient(); if (!client) throw new Error('Supabase nu este disponibil.')
      const { data: auth } = await client.auth.getUser(); if (!auth.user) throw new Error('Sesiunea nu este validă.')
      const { error: deleteError } = await client.from('vehicle_records').delete().eq('id', item.record.id).eq('user_id', auth.user.id)
      if (deleteError) throw new Error('Înregistrarea nu a putut fi ștearsă.')
      onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : 'Ștergerea nu a reușit.') } finally { setBusy(false) }
  }
  return <Sheet title={item.label} onClose={onClose}><div className="autoForm">{item.key === 'service' ? <><label>Km rămași<input type="number" value={remainingKm} onChange={event => setRemainingKm(event.target.value)} placeholder="ex. 2400"/></label><label>Luna recomandată<input type="month" value={dueMonth} onChange={event => setDueMonth(event.target.value)}/></label></> : <label>Data expirării<input type="date" value={expiresAt} onChange={event => setExpiresAt(event.target.value)}/></label>}<label>Note<textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Opțional"/></label>{error && <p className="autoFormError">{error}</p>}<div className="autoFormActions">{item.record && <button type="button" className="autoDangerButton" disabled={busy} onClick={() => void remove()}><Trash2 size={17}/> Șterge</button>}<button type="button" className="autoPrimaryButton" disabled={busy} onClick={() => void save()}><Save size={17}/>{busy ? 'Se salvează…' : item.record ? 'Salvează' : 'Creează'}</button></div></div></Sheet>
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [onClose])
  return <div className="autoSheetBackdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className="autoSheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Închide"><X size={20}/></button></header>{children}</div></div>
}
