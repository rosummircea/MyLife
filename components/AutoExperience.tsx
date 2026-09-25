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
      if (record.record_type === 'mileage' && record.issued_at) result.push({ id: `mileage-${record.id}`, date: record.issued_at, title: 'Kilometraj actualizat', subtitle: text(record.extra?.mileage_km) ? `${Number(text(record.extra?.mileage_km)).toLocaleString('ro-RO')} km` : null, future: false, recor