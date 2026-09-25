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

function Vehi