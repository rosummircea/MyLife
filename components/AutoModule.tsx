'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Bike, Car, ChevronRight, FileText, Home, ImageIcon, X } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import { bucharestDay } from '@/lib/expense-report'
import type { DocumentRow } from '@/lib/mylife-data'
import { autoDemo, documentStatus, loadAutoData, photos, recordCost, text, vehicleDocuments, vehicleType, type AutoData, type Vehicle, type VehiclePhoto, type VehicleRecord } from '@/lib/auto-data'
import './AutoModule.css'

const tabs = ['Overview','Documente','Mentenanță','Costuri','Istoric'] as const
const recordLabels: Record<string,string> = { service:'Revizie',maintenance:'Mentenanță',oil_change:'Schimb ulei',filters:'Filtre',brakes:'Frâne',tires:'Anvelope',repair:'Reparație',inspection:'Inspecție',itp:'ITP',rca:'RCA',casco:'CASCO',fuel:'Combustibil',tax:'Taxe',vignette:'Rovinietă',parking:'Parcare',mileage:'Kilometraj',purchase:'Achiziție' }
function label(type: string) { return recordLabels[type] || type.replace(/_/g,' ') }
function date(value: string) { const parsed = new Date(value.slice(0,10)+'T12:00:00Z'); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('ro-RO',{timeZone:'UTC'}) }
function title(vehicle: Vehicle) { return [vehicle.make,vehicle.model].filter(Boolean).join(' ') || 'Vehicul fără denumire' }
function money(amount: number, currency: string) { return new Intl.NumberFormat('ro-RO',{style:'currency',currency}).format(amount) }
function deadlineStatus(value: string | null, today: string) {
  if (!value) return {label:'Nesetat',tone:'muted'}
  const days=(Date.parse(value.slice(0,10))-Date.parse(today))/86400000
  if (!Number.isFinite(days)) return {label:'Dată nevalidă',tone:'attention'}
  if (days < 0) return {label:'Expirat',tone:'danger'}
  if (days <= 30) return {label:`${Math.ceil(days)} zile`,tone:'attention'}
  return {label:`${Math.ceil(days)} zile`,tone:'ok'}
}

export default function AutoModule({ connected, refreshVersion, documents, documentsLoading, registerMobileBack, onHome, onOpenDocument }: { connected: boolean; refreshVersion: number; documents: DocumentRow[]; documentsLoading: boolean; registerMobileBack: (handler: (() => boolean) | null) => void; onHome: () => void; onOpenDocument: (id: string) => void }) {
  const [data,setData] = useState<AutoData>({vehicles:[],records:[]})
  const [loading,setLoading] = useState(connected)
  const [error,setError] = useState('')
  const [revision,setRevision] = useState(0)
  const [demo,setDemo] = useState(false)
  const [selectedId,setSelectedId] = useState<string | null>(null)
  useEffect(() => {
    registerMobileBack(() => {
      if (selectedId) { setSelectedId(null); return true }
      return false
    })
    return () => registerMobileBack(null)
  }, [registerMobileBack, selectedId])
  useEffect(() => {
    let cancelled = false
    setDemo(false);setSelectedId(null);setData({vehicles:[],records:[]});setError('')
    if (!connected) { setLoading(false);return }
    const client = getSupabaseClient()
    if (!client) { setError('Supabase nu este configurat.');setLoading(false);return }
    setLoading(true)
    loadAutoData(client).then(result => { if (!cancelled) setData(result) }).catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : 'Vehiculele nu pot fi încărcate.') }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  },[connected,revision,refreshVersion])
  const current = demo ? autoDemo : data
  const vehicle = current.vehicles.find(item => item.id === selectedId)
  const today = bucharestDay(new Date())
  return <section className="modulePage autoModule">
    <div className="topbar"><div><p className="eyebrow">MYLIFE</p><h1>Auto</h1><p className="subtitle">Mașini, motociclete și istoricul lor.</p></div><button type="button" className="iconBtn moduleHomeButton" onClick={onHome} aria-label="Înapoi acasă"><Home size={19}/></button></div>
    {demo && <div className="autoDemoNotice"><span>DEMO · Exemple de structură, fără date personale. Nu sunt salvate în Supabase.</span><button type="button" onClick={() => {setDemo(false);setSelectedId(null)}}>Închide demo</button></div>}
    {!demo && error && <div className="autoNotice" role="alert">{error}<button type="button" onClick={() => setRevision(value => value+1)}>Reîncearcă</button></div>}
    {loading ? <div className="autoEmpty" role="status">Se încarcă vehiculele…</div> : vehicle ? <VehicleDetail key={vehicle.id} vehicle={vehicle} records={current.records.filter(item => item.vehicle_id === vehicle.id)} documents={demo ? [] : vehicleDocuments(vehicle.id,documents)} documentsLoading={documentsLoading && !demo} demo={demo} today={today} onBack={() => setSelectedId(null)} onOpenDocument={onOpenDocument}/> : <>
      <div className="sectionTitle"><h2>Vehiculele mele</h2><span>{current.vehicles.length} vehicule</span></div>
      {!current.vehicles.length ? <div className="autoEmpty"><Car size={42}/><h2>{connected && !error ? 'Nu ai vehicule înregistrate încă' : 'Vehiculele tale, într-un singur loc'}</h2><p>{connected && !error ? 'Vehiculele adăugate în Supabase vor apărea aici.' : 'Conectează contul Supabase folosind „Conectează live” pentru a vedea datele tale.'}</p><button type="button" onClick={() => setDemo(true)}>Vezi structura demo</button></div> : <div className="autoVehicleGrid">{current.vehicles.map(item => {
        const docs = demo ? [] : vehicleDocuments(item.id,documents)
        const expiring = docs.filter(doc => ['Expirat','Expiră curând'].includes(documentStatus(doc.expires_at,today))).length
        return <button type="button" className="autoVehicleCard" key={item.id} onClick={() => setSelectedId(item.id)}><VehicleGallery vehicle={item} compact/><div className="autoVehicleCardInfo"><span>{vehicleType(item) || 'Tip neprecizat'}{item.year ? ` · ${item.year}` : ''}</span><h2>{title(item)}</h2>{item.registration_number && <strong className="autoPlate">{item.registration_number}</strong>}<div className="autoVehicleCardFooter"><small>{documentsLoading && !demo ? 'Se încarcă documentele…' : docs.length ? `${docs.length} documente${expiring ? ` · ${expiring} necesită atenție` : ''}` : 'Fără documente asociate'}</small><ChevronRight size={18}/></div></div></button>
      })}</div>}
    </>}
  </section>
}

function VehicleGallery({ vehicle, compact = false }: { vehicle: Vehicle; compact?: boolean }) {
  const allPhotos = photos(vehicle)
  const items = compact ? allPhotos.slice(0,1) : allPhotos
  const [urls,setUrls] = useState<Record<string,string>>({})
  const [selected,setSelected] = useState(0)
  const [error,setError] = useState('')
  const [failed,setFailed] = useState<Record<string,boolean>>({})
  const [revision,setRevision] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const identity = JSON.stringify(items)
  const photoKey=(photo:VehiclePhoto,index:number)=>photo.data_url?`inline-${index}-${photo.data_url.length}`:`${photo.bucket}/${photo.path}`
  useEffect(() => {
    const current: VehiclePhoto[] = JSON.parse(identity)
    if (!current.length) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    setUrls({});setError('');setFailed({})
    async function load() {
      const inlineEntries=current.flatMap((photo,index)=>photo.data_url?[[photoKey(photo,index),photo.data_url] as const]:[])
      const remote=current.map((photo,index)=>({photo,index})).filter(item=>!item.photo.data_url)
      if (!remote.length) { if (!cancelled) setUrls(Object.fromEntries(inlineEntries)); return }
      const client = getSupabaseClient()
      if (!client) throw new Error('Conectează contul pentru fotografii.')
      const {data,error} = await client.auth.getUser()
      if (error || !data.user) throw new Error('Fotografiile necesită autentificare.')
      const results = await Promise.all(remote.map(async ({photo,index}) => {
        const key=photoKey(photo,index)
        if (!photo.bucket || !photo.path) return {key,url:undefined}
        const {data,error} = await client.storage.from(photo.bucket).createSignedUrl(photo.path,300)
        return {key,url:!error ? data?.signedUrl : undefined}
      }))
      if (!cancelled) {
        setUrls({...Object.fromEntries(inlineEntries),...Object.fromEntries(results.filter(item => item.url).map(item => [item.key,item.url!]))})
        if (results.some(item => !item.url)) setError('Unele fotografii nu sunt disponibile pentru acest cont.')
        timer=setTimeout(() => setRevision(value => value+1),240000)
      }
    }
    load().catch(error => {if (!cancelled) setError(error instanceof Error ? error.message : 'Fotografiile nu pot fi încărcate.')})
    return () => {cancelled=true;if (timer) clearTimeout(timer)}
  },[identity,revision])
  const photo = items[selected] ?? items[0]
  const key = photo ? photoKey(photo,selected) : ''
  const url = photo && !failed[key] ? urls[key] : null
  const Icon = vehicleType(vehicle) === 'Motocicletă' ? Bike : Car
  const image = url ? <img src={url} alt={photo.caption || title(vehicle)} onError={() => setFailed(value => ({...value,[key]:true}))}/> : <div className="autoPhotoEmpty"><Icon size={compact ? 54 : 80}/><span>{items.length ? error || 'Fotografie în curs de încărcare / indisponibilă' : 'Fotografie neadăugată'}</span></div>
  if (compact) return <div className="autoCardPhoto">{image}</div>
  return <div className="autoGallery"><div className="autoHeroPhoto">{url ? <button type="button" onClick={() => dialog.current?.showModal()} aria-label="Mărește fotografia vehiculului">{image}<span><ImageIcon size={16}/> Mărește fotografia</span></button> : image}</div>{error && <p className="autoMuted" role="status">{error}</p>}{items.length > 1 && <div className="autoThumbnails" aria-label="Galerie fotografii">{items.map((item,index) => {const itemKey=photoKey(item,index);return <button type="button" key={itemKey} aria-pressed={selected === index} aria-label={item.caption || `Fotografia ${index+1}`} onClick={() => setSelected(index)}>{urls[itemKey] && !failed[itemKey] ? <img src={urls[itemKey]} alt="" onError={() => setFailed(value => ({...value,[itemKey]:true}))}/> : <ImageIcon size={22}/>}</button>})}</div>}{url && <dialog className="autoImageDialog" ref={dialog} aria-label="Fotografia vehiculului" onClick={event => {if (event.target === event.currentTarget) dialog.current?.close()}}><button type="button" aria-label="Închide fotografia" onClick={() => dialog.current?.close()}><X/></button><img src={url} alt={photo.caption || title(vehicle)}/></dialog>}</div>
}
function VehicleDetail({vehicle,records,documents,documentsLoading,demo,today,onBack,onOpenDocument}: {vehicle: Vehicle;records: VehicleRecord[];documents: DocumentRow[];documentsLoading:boolean;demo:boolean;today:string;onBack:()=>void;onOpenDocument:(id:string)=>void}) {
  const [tab,setTab] = useState<typeof tabs[number]>('Overview')
  const technical = [
    ['Tip',vehicleType(vehicle)],['An fabricație',vehicle.year],['Înmatriculare',vehicle.registration_number],['VIN',vehicle.vin],
    ['Kilometraj',text(vehicle.extra?.mileage_km) !== null ? `${text(vehicle.extra?.mileage_km)} km` : null],['Combustibil / motorizare',text(vehicle.extra?.fuel)],
    ['Putere',text(vehicle.extra?.power_kw) !== null ? `${text(vehicle.extra?.power_kw)} kW` : null],['Transmisie',text(vehicle.extra?.transmission)],['Culoare',text(vehicle.extra?.color)],
    ['Data achiziției',text(vehicle.extra?.purchase_date) ? date(String(vehicle.extra.purchase_date)) : null],['Note',vehicle.notes],
  ].filter(([,value]) => value !== null && value !== undefined && value !== '')
  const maintenance = records.filter(record => ['service','maintenance','oil_change','filters','brakes','tires','repair','inspection','itp'].includes(record.record_type) || record.extra?.category === 'maintenance')
  const costs = records.map(record => ({record,cost:recordCost(record)})).filter(item => item.cost !== null)
  const totals = costs.reduce<Record<string,number>>((result,item) => {const cost=item.cost!;result[cost.currency]=(result[cost.currency]??0)+Math.round(cost.amount*100);return result},{})
  const events = [
    ...(text(vehicle.extra?.purchase_date) ? [{id:'purchase',date:String(vehicle.extra.purchase_date),title:'Achiziție vehicul',description:null,documentId:null}] : []),
    ...records.filter(record => record.issued_at || text(record.extra?.date)).map(record => ({id:`record-${record.id}`,date:record.issued_at || String(record.extra.date),title:label(record.record_type),description:record.provider,documentId:null})),
    ...documents.flatMap(doc => [doc.issued_at ? {id:`issued-${doc.id}`,date:doc.issued_at,title:`Document emis · ${doc.document_type.replace(/_/g,' ')}`,description:doc.issuer,documentId:doc.id} : null,doc.expires_at ? {id:`expires-${doc.id}`,date:doc.expires_at,title:`Expirare document · ${doc.document_type.replace(/_/g,' ')}`,description:doc.issuer,documentId:doc.id} : null].filter((event): event is NonNullable<typeof event> => Boolean(event))),
  ].sort((a,b) => b.date.localeCompare(a.date))
  const known = new Set(['vehicle_type','mileage_km','fuel','power_kw','transmission','color','purchase_date','photos'])
  const extra = Object.entries(vehicle.extra ?? {}).filter(([key,value]) => !known.has(key) && value !== null && value !== '')
  return <div className="autoVehicleDetail"><button type="button" className="autoBack" onClick={onBack}><ArrowLeft size={17}/> Toate vehiculele</button><div className="autoDetailHero"><VehicleGallery vehicle={vehicle}/><section className="autoTechnical"><span className="autoMuted">{vehicleType(vehicle) || 'Vehicul'}{demo ? ' · DEMO' : ''}</span><h2>{title(vehicle)}</h2>{vehicle.registration_number && <strong className="autoPlate">{vehicle.registration_number}</strong>}<dl>{technical.map(([key,value]) => <div key={String(key)}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>{extra.length>0 && <><h3>Alte date</h3><dl>{extra.map(([key,value]) => <div key={key}><dt>{key.replace(/_/g,' ')}</dt><dd>{typeof value==='object' ? JSON.stringify(value,null,2) : String(value)}</dd></div>)}</dl></>}</section></div>
    <nav className="autoTabs" aria-label="Secțiuni vehicul">{tabs.map(item => <button type="button" key={item} aria-pressed={tab===item} className={tab===item?'active':''} onClick={() => setTab(item)}>{item}</button>)}</nav>
    <div className="autoTabContent">
      {tab==='Overview' ? <><div className="autoOverviewGrid"><div><span>Documente asociate</span><strong>{documentsLoading?'…':documents.length}</strong></div><div><span>Înregistrări</span><strong>{records.length}</strong></div><div><span>Costuri înregistrate</span><strong>{Object.keys(totals).length ? Object.entries(totals).map(([currency,amount]) => money(amount/100,currency)).join(' · ') : 'Neadăugate'}</strong></div></div><h3>Documente importante</h3><DocumentCards documents={documents} loading={documentsLoading} today={today} onOpenDocument={onOpenDocument}/></> : tab==='Documente' ? <DocumentCards documents={documents} loading={documentsLoading} today={today} onOpenDocument={onOpenDocument}/> : tab==='Mentenanță' ? <><p className="autoMuted">Revizii, ulei, filtre, frâne, anvelope, reparații și inspecții.</p>{maintenance.length ? <div className="autoRecordList">{maintenance.map(record => <RecordCard key={record.id} record={record}/>)}</div> : <div className="autoEmpty">Nu există intervenții înregistrate. Înregistrările din vehicle_records vor apărea aici.</div>}</> : tab==='Costuri' ? <><p className="autoMuted">Costuri salvate în înregistrările vehiculului. Tranzacțiile din Finanțe nu sunt conectate.</p>{Object.entries(totals).map(([currency,amount]) => <p className="autoCostTotal" key={currency}>Total {money(amount/100,currency)}</p>)}{costs.length ? <div className="autoRecordList">{costs.map(item => <RecordCard key={item.record.id} record={item.record}/>)}</div> : <div className="autoEmpty">Nu există costuri înregistrate pentru combustibil, service, asigurări, taxe, rovinietă sau parcare.</div>}</> : events.length ? <ol className="autoTimeline">{events.map(event => <li key={event.id}><time dateTime={event.date}>{date(event.date)}{event.date>today?' · Planificat':''}</time><strong>{event.title}</strong>{event.description && <span>{event.description}</span>}{event.documentId && <button type="button" onClick={() => onOpenDocument(event.documentId!)}>Vezi documentul</button>}</li>)}</ol> : <div className="autoEmpty">Istoricul va include achiziția, documentele și intervențiile datate.</div>}
    </div>
  </div>
}
function RecordCard({record}:{record:VehicleRecord}) {
  const cost = recordCost(record)
  const recordDate=record.issued_at || text(record.extra?.date)
  return <article className="autoRecordCard"><header><h3>{label(record.record_type)}</h3>{recordDate && <time dateTime={recordDate}>{date(recordDate)}</time>}</header><dl>{text(record.extra?.mileage_km)!==null && <div><dt>Kilometraj</dt><dd>{text(record.extra.mileage_km)} km</dd></div>}{record.provider && <div><dt>Service / furnizor</dt><dd>{record.provider}</dd></div>}{cost && <div><dt>Cost</dt><dd>{money(cost.amount,cost.currency)}</dd></div>}{record.expires_at && <div><dt>Expiră</dt><dd>{date(record.expires_at)}</dd></div>}{record.policy_number && <div><dt>Referință / poliță</dt><dd>{record.policy_number}</dd></div>}{record.notes && <div><dt>Note</dt><dd>{record.notes}</dd></div>}</dl></article>
}
function DocumentCards({documents,loading,today,onOpenDocument}:{documents:DocumentRow[];loading:boolean;today:string;onOpenDocument:(id:string)=>void}) {
  if(loading) return <div className="autoEmpty" role="status">Se încarcă documentele…</div>
  if(!documents.length) return <div className="autoEmpty"><FileText size={30}/><p>Nu există documente asociate explicit acestui vehicul.</p></div>
  return <div className="autoDocumentGrid">{documents.map(doc => <button type="button" className="autoDocumentCard" key={doc.id} onClick={() => onOpenDocument(doc.id)}><div className="autoDocumentHeading"><FileText size={22}/><strong>{doc.source_filename || doc.document_type.replace(/_/g,' ')}</strong><ChevronRight size={18}/></div><span>{doc.document_type.replace(/_/g,' ')}</span>{doc.issuer && <span>{doc.issuer}</span>}{doc.issued_at && <span>Emis {date(doc.issued_at)}</span>}{doc.expires_at && <span>Expiră {date(doc.expires_at)}</span>}<small className={['Expirat','Expiră curând'].includes(documentStatus(doc.expires_at,today))?'attention':''}>{documentStatus(doc.expires_at,today)}</small><small>{doc.storage_path?'Fișier asociat · deschide viewerul':'Doar metadata · fișier neatașat'}</small></button>)}</div>
}
