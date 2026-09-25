'use client'

import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react'
import {Activity,CalendarDays,ChevronRight,FileText,HeartPulse,Home,Image as ImageIcon,Lungs,Moon,Plus,Search,Stethoscope,Trash2,Upload,Watch,X,ExternalLink,Pencil,Save,Sparkles,Footprints,PersonStanding} from 'lucide-react'
import {getSupabaseClient} from '@/lib/supabase'
import type {DocumentRow} from '@/lib/mylife-data'
import {healthDocumentCategory,healthDocuments,healthDocumentTitle,loadHealthData,metricMeta,type HealthData,type HealthMeasurement,type HealthMetricType,type HealthVisit} from '@/lib/health-data'
import './HealthModule.css'

export type HealthTab='overview'|'visits'|'data'|'documents'

const healthDocTypes=[
  ['health_lab','Analize'],
  ['health_imaging','Imagistică'],
  ['health_prescription','Rețetă'],
  ['health_discharge','Bilet externare'],
  ['health_consultation','Raport consultație'],
  ['health_other','Alt document'],
] as const

const metricOrder:HealthMetricType[]=['resting_heart_rate','sleep_duration','respiratory_rate','vo2_max','steps','weight','spo2','blood_pressure']

function roDate(value:string|Date,{time=false}:{time?:boolean}={}){
  const d=value instanceof Date?value:new Date(value)
  if(Number.isNaN(d.getTime()))return '—'
  return d.toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',day:'2-digit',month:'short',year:'numeric',...(time?{hour:'2-digit',minute:'2-digit'}:{})})
}
function todayLabel(){return new Date().toLocaleDateString('ro-RO',{timeZone:'Europe/Bucharest',weekday:'long',day:'numeric',month:'long',year:'numeric'})}
function latestByMetric(rows:HealthMeasurement[]){
  const map=new Map<HealthMetricType,HealthMeasurement>()
  for(const row of rows)if(!map.has(row.metric_type))map.set(row.metric_type,row)
  return map
}
function metricValue(row:HealthMeasurement|null|undefined){
  if(!row)return '—'
  if(row.metric_type==='sleep_duration'){
    const hours=Math.floor(row.value);const min=Math.round((row.value-hours)*60)
    return `${hours} h ${min?min+' min':''}`.trim()
  }
  if(row.metric_type==='steps')return Math.round(row.value).toLocaleString('ro-RO')
  if(row.metric_type==='blood_pressure')return `${Math.round(row.value)}/${Math.round(row.secondary_value??0)}`
  return Number(row.value).toLocaleString('ro-RO',{maximumFractionDigits:1})
}
function metricUnit(type:HealthMetricType){
  if(type==='sleep_duration')return ''
  return metricMeta[type].unit
}
function metricIcon(type:HealthMetricType){
  if(type==='resting_heart_rate')return HeartPulse
  if(type==='sleep_duration')return Moon
  if(type==='respiratory_rate')return Lungs
  if(type==='steps')return Footprints
  if(type==='vo2_max')return PersonStanding
  return Activity
}
function trendFor(rows:HealthMeasurement[],type:HealthMetricType){
  const items=rows.filter(row=>row.metric_type===type).slice(0,2)
  if(items.length<2)return 'Ultima valoare'
  const delta=items[0].value-items[1].value
  if(Math.abs(delta)<0.0001)return 'Fără schimbare'
  return delta>0?'↑ față de precedenta':'↓ față de precedenta'
}

export default function HealthModule({connected,refreshVersion,documents,documentsLoading,tab,setTab,registerMobileBack,onChanged}:{connected:boolean;refreshVersion:number;documents:DocumentRow[];documentsLoading:boolean;tab:HealthTab;setTab:(tab:HealthTab)=>void;registerMobileBack:(handler:(()=>boolean)|null)=>void;onChanged:()=>void}){
  const [data,setData]=useState<HealthData>({visits:[],measurements:[]})
  const [loading,setLoading]=useState(connected)
  const [error,setError]=useState('')
  const [visitEditor,setVisitEditor]=useState<HealthVisit|null|'new'>(null)
  const [metricEditor,setMetricEditor]=useState<HealthMeasurement|null|'new'>(null)
  const [docEditor,setDocEditor]=useState<DocumentRow|null|'new'>(null)
  const [docViewer,setDocViewer]=useState<DocumentRow|null>(null)
  const docs=useMemo(()=>healthDocuments(documents),[documents])

  useEffect(()=>{
    let cancelled=false
    if(!connected){setLoading(false);setData({visits:[],measurements:[]});return}
    const client=getSupabaseClient()
    if(!client){setError('Supabase nu este configurat.');setLoading(false);return}
    setLoading(true);setError('')
    loadHealthData(client).then(result=>{if(!cancelled)setData(result)}).catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:'Datele de sănătate nu pot fi încărcate.')}).finally(()=>{if(!cancelled)setLoading(false)})
    return()=>{cancelled=true}
  },[connected,refreshVersion])

  useEffect(()=>{
    registerMobileBack(()=>{
      if(visitEditor||metricEditor||docEditor||docViewer)return false
      if(tab!=='overview'){setTab('overview');return true}
      return false
    })
    return()=>registerMobileBack(null)
  },[docEditor,docViewer,metricEditor,registerMobileBack,setTab,tab,visitEditor])

  const refresh=()=>{onChanged()}

  return <section className="healthModule">
    {error&&<div className="healthError">{error}</div>}
    {tab==='overview'&&<Overview data={data} docs={docs} loading={loading||documentsLoading} setTab={setTab}/>}
    {tab==='visits'&&<Visits data={data} loading={loading} onAdd={()=>setVisitEditor('new')} onOpen={setVisitEditor}/>}
    {tab==='data'&&<HealthDataTab data={data} loading={loading} onAdd={()=>setMetricEditor('new')} onOpen={setMetricEditor}/>}
    {tab==='documents'&&<HealthDocuments documents={docs} loading={documentsLoading} onAdd={()=>setDocEditor('new')} onOpen={setDocViewer}/>}

    {visitEditor&&<VisitEditor visit={visitEditor==='new'?null:visitEditor} onClose={()=>setVisitEditor(null)} onSaved={()=>{setVisitEditor(null);refresh()}}/>}
    {metricEditor&&<MeasurementEditor measurement={metricEditor==='new'?null:metricEditor} onClose={()=>setMetricEditor(null)} onSaved={()=>{setMetricEditor(null);refresh()}}/>}
    {docEditor&&<MedicalDocumentEditor document={docEditor==='new'?null:docEditor} onClose={()=>setDocEditor(null)} onSaved={()=>{setDocEditor(null);refresh()}}/>}
    {docViewer&&<MedicalDocumentViewer document={docViewer} onClose={()=>setDocViewer(null)} onEdit={()=>{setDocEditor(docViewer);setDocViewer(null)}} onDeleted={()=>{setDocViewer(null);refresh()}}/>}
  </section>
}

function Header({title,subtitle,action}:{title:string;subtitle?:string;action?:ReactNode}){
  return <header className="healthHeader"><div><span>MYLIFE</span><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action}</header>
}

function Overview({data,docs,loading,setTab}:{data:HealthData;docs:DocumentRow[];loading:boolean;setTab:(tab:HealthTab)=>void}){
  const latest=latestByMetric(data.measurements)
  const focus:HealthMetricType[]=['resting_heart_rate','sleep_duration','respiratory_rate','vo2_max']
  const next=data.visits.filter(v=>v.status==='planned'&&new Date(v.scheduled_at)>=new Date()).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at))[0]
  const count=latest.size
  return <div className="healthPage">
    <Header title="Sănătate"/>
    <section className="healthHero"><div><time>{todayLabel()}</time><h2>{count?'Datele tale de sănătate':'Începe jurnalul de sănătate'}</h2><p>{count?`${count} indicatori au valori înregistrate. MyLife nu face diagnostic; îți organizează datele și evoluția.`:'Adaugă valori, vizite și documente medicale într-un singur loc.'}</p><span className="healthHeroPill"><HeartPulse size={17}/>{count?'Date organizate':'Pregătit pentru date'}</span></div><div className="healthHeroArt"><HeartPulse size={64}/></div></section>

    <div className="healthMetricGrid">{focus.map(type=><MetricCard key={type} type={type} row={latest.get(type)} trend={trendFor(data.measurements,type)} onClick={()=>setTab('data')}/>)}</div>

    <section className="healthCard healthNextCard"><header><h3>Următoarea vizită</h3><button onClick={()=>setTab('visits')}>Vezi toate <ChevronRight size={16}/></button></header>{next?<button className="healthVisitPreview" onClick={()=>setTab('visits')}><div className="healthSquareIcon blue"><CalendarDays size={23}/></div><div><strong>{next.doctor_name||next.specialty}</strong><span>{next.specialty}{next.doctor_name?' · '+roDate(next.scheduled_at,{time:true}):' · '+roDate(next.scheduled_at,{time:true})}</span></div><ChevronRight size={19}/></button>:<button className="healthEmptyRow" onClick={()=>setTab('visits')}><span>Nicio vizită programată</span><ChevronRight size={18}/></button>}</section>

    <section className="healthCard healthDocsPreview"><header><h3>Documente medicale</h3><button onClick={()=>setTab('documents')}>Vezi toate <ChevronRight size={16}/></button></header>{loading?<p className="healthMuted">Se încarcă…</p>:docs.length?docs.slice(0,3).map(doc=><button key={doc.id} onClick={()=>setTab('documents')}><div className="healthSquareIcon document"><FileText size={20}/></div><div><strong>{healthDocumentTitle(doc)}</strong><span>{doc.document_date||doc.issued_at?roDate(doc.document_date||doc.issued_at!):doc.issuer||'Document medical'}</span></div><ChevronRight size={18}/></button>):<button className="healthEmptyRow" onClick={()=>setTab('documents')}><span>Niciun document medical</span><ChevronRight size={18}/></button>}</section>
  </div>
}

function MetricCard({type,row,trend,onClick}:{type:HealthMetricType;row?:HealthMeasurement;trend:string;onClick:()=>void}){
  const Icon=metricIcon(type)
  return <button className={`healthMetricCard metric-${type}`} onClick={onClick}><div className="healthMetricIcon"><Icon size={23}/></div><div className="healthMetricCopy"><span>{metricMeta[type].label}</span><strong>{row?metricValue(row):'—'} {row&&metricUnit(type)&&<small>{metricUnit(type)}</small>}</strong><em>{row?trend:'Fără date'}</em></div><ChevronRight size={18}/></button>
}

function Visits({data,loading,onAdd,onOpen}:{data:HealthData;loading:boolean;onAdd:()=>void;onOpen:(visit:HealthVisit)=>void}){
  const [mode,setMode]=useState<'upcoming'|'history'>('upcoming')
  const now=Date.now()
  const upcoming=data.visits.filter(v=>v.status==='planned'&&new Date(v.scheduled_at).getTime()>=now).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at))
  const history=data.visits.filter(v=>v.status!=='planned'||new Date(v.scheduled_at).getTime()<now).sort((a,b)=>b.scheduled_at.localeCompare(a.scheduled_at))
  const rows=mode==='upcoming'?upcoming:history
  return <div className="healthPage">
    <Header title="Vizite" subtitle="Programări și istoricul consultațiilor." action={<button className="healthCircleAction" onClick={onAdd}><Plus size={21}/></button>}/>
    <div className="healthSegmented"><button className={mode==='upcoming'?'active':''} onClick={()=>setMode('upcoming')}>Următoare</button><button className={mode==='history'?'active':''} onClick={()=>setMode('history')}>Istoric</button></div>
    <section className="healthInfoCard"><div className="healthSquareIcon blue"><CalendarDays size={22}/></div><div><strong>Ține aici toate vizitele și recomandările.</strong><p>Programările viitoare și istoricul consultațiilor, într-un singur loc.</p></div></section>
    <h2 className="healthSectionTitle">{mode==='upcoming'?'Următoarele vizite':'Istoric vizite'}</h2>
    <div className="healthVisitList">{loading?<p className="healthMuted">Se încarcă…</p>:rows.length?rows.map(visit=><button key={visit.id} onClick={()=>onOpen(visit)}><div className="healthSquareIcon visit"><Stethoscope size={22}/></div><div><strong>{visit.specialty}</strong><span>{visit.doctor_name||visit.clinic||'Fără medic setat'}</span><small><CalendarDays size={14}/>{roDate(visit.scheduled_at,{time:true})}</small>{visit.summary&&<p>{visit.summary}</p>}</div><ChevronRight size={18}/></button>):<div className="healthEmptyPanel"><CalendarDays size={34}/><strong>{mode==='upcoming'?'Nicio vizită programată':'Niciun istoric încă'}</strong><button onClick={onAdd}><Plus size={17}/> Adaugă vizită</button></div>}</div>
  </div>
}

function HealthDataTab({data,loading,onAdd,onOpen}:{data:HealthData;loading:boolean;onAdd:()=>void;onOpen:(row:HealthMeasurement)=>void}){
  const [period,setPeriod]=useState<'week'|'month'|'all'>('week')
  const cutoff=period==='week'?7:period==='month'?30:36500
  const min=Date.now()-cutoff*86400000
  const scoped=data.measurements.filter(row=>new Date(row.measured_at).getTime()>=min)
  const latest=latestByMetric(scoped.length?scoped:data.measurements)
  const chartType:HealthMetricType=latest.has('resting_heart_rate')?'resting_heart_rate':(latest.keys().next().value??'resting_heart_rate')
  const chartRows=data.measurements.filter(r=>r.metric_type===chartType&&new Date(r.measured_at).getTime()>=Date.now()-30*86400000).slice().reverse()
  return <div className="healthPage">
    <Header title="Date" subtitle="Valori și tendințe, fără interpretări medicale." action={<button className="healthCircleAction" onClick={onAdd}><Plus size={21}/></button>}/>
    <div className="healthSegmented three"><button className={period==='week'?'active':''} onClick={()=>setPeriod('week')}>Săptămână</button><button className={period==='month'?'active':''} onClick={()=>setPeriod('month')}>Lună</button><button className={period==='all'?'active':''} onClick={()=>setPeriod('all')}>Tot</button></div>
    <section className="healthPeriodSummary"><CalendarDays size={22}/><div><strong>{period==='week'?'Ultimele 7 zile':period==='month'?'Ultimele 30 zile':'Toate datele'}</strong><span>{scoped.length} înregistrări</span></div><em>Date personale</em></section>
    <div className="healthMetricGrid">{['resting_heart_rate','sleep_duration','vo2_max','steps'].map(t=><MetricCard key={t} type={t as HealthMetricType} row={latest.get(t as HealthMetricType)} trend={trendFor(data.measurements,t as HealthMetricType)} onClick={()=>{const row=latest.get(t as HealthMetricType);if(row)onOpen(row);else onAdd()}}/>)}</div>
    <section className="healthCard healthChartCard"><header><div><h3>Tendință 30 zile</h3><span>{metricMeta[chartType].label}</span></div><em>{chartRows.length>1?'Evoluție disponibilă':'Mai sunt necesare date'}</em></header><TrendChart rows={chartRows}/></section>
    <section className="healthCard healthSources"><header><h3>Surse de date</h3></header><div><span className="healthSquareIcon source"><Watch size={21}/></span><div><strong>Apple Health / Watch</strong><small>Neconectat · necesită integrare iOS</small></div></div><div><span className="healthSquareIcon source manual"><Activity size={21}/></span><div><strong>Manual</strong><small>{data.measurements.filter(r=>r.source==='manual').length} valori introduse</small></div></div></section>
  </div>
}

function TrendChart({rows}:{rows:HealthMeasurement[]}){
  if(rows.length<2)return <div className="healthChartEmpty">Adaugă cel puțin două valori pentru a vedea tendința.</div>
  const vals=rows.map(r=>r.value);const min=Math.min(...vals),max=Math.max(...vals);const range=Math.max(1,max-min)
  const points=rows.map((r,i)=>`${(i/(rows.length-1))*100},${88-((r.value-min)/range)*68}`).join(' ')
  return <svg className="healthChart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Grafic tendință"><line x1="0" y1="88" x2="100" y2="88"/><line x1="0" y1="54" x2="100" y2="54"/><line x1="0" y1="20" x2="100" y2="20"/><polyline points={points}/>{rows.map((r,i)=><circle key={r.id} cx={(i/(rows.length-1))*100} cy={88-((r.value-min)/range)*68} r="1.6"/>)}</svg>
}

function HealthDocuments({documents,loading,onAdd,onOpen}:{documents:DocumentRow[];loading:boolean;onAdd:()=>void;onOpen:(doc:DocumentRow)=>void}){
  const [query,setQuery]=useState('')
  const [filter,setFilter]=useState('all')
  const filtered=documents.filter(doc=>{
    const title=healthDocumentTitle(doc).toLowerCase()
    const q=query.toLowerCase().trim()
    const matches=!q||title.includes(q)||(doc.issuer||'').toLowerCase().includes(q)||(doc.source_filename||'').toLowerCase().includes(q)
    return matches&&(filter==='all'||healthDocumentCategory(doc)===filter)
  })
  return <div className="healthPage">
    <Header title="Documente" subtitle="Analize, imagistică, rețete și alte acte medicale." action={<button className="healthCircleAction" onClick={onAdd}><Plus size={21}/></button>}/>
    <label className="healthSearch"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Caută documente, emitent sau fișier…"/></label>
    <div className="healthFilters"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Toate</button><button className={filter==='lab'?'active':''} onClick={()=>setFilter('lab')}>Analize</button><button className={filter==='imaging'?'active':''} onClick={()=>setFilter('imaging')}>Imagistică</button><button className={filter==='prescription'?'active':''} onClick={()=>setFilter('prescription')}>Rețete</button></div>
    <section className="healthDocumentList">{loading?<p className="healthMuted">Se încarcă…</p>:filtered.length?filtered.map(doc=><button key={doc.id} onClick={()=>onOpen(doc)}><div className="healthSquareIcon document"><FileText size={21}/></div><div><strong>{healthDocumentTitle(doc)}</strong><span>{doc.issuer||doc.source_filename||'Document medical'}</span><small>{doc.document_date||doc.issued_at?roDate(doc.document_date||doc.issued_at!):'Fără dată'}</small></div><ChevronRight size={18}/></button>):<div className="healthEmptyPanel"><FileText size={34}/><strong>Niciun document</strong><button onClick={onAdd}><Upload size={17}/> Adaugă document</button></div>}</section>
    <div className="healthAiNote"><Sparkles size={19}/><div><strong>AI completează metadatele importante</strong><p>La upload, MyLife încearcă să identifice tipul, emitentul, data și un rezumat factual scurt. Nu produce diagnostic.</p></div></div>
  </div>
}

function HealthSheet({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
  return <div className="healthSheetBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="healthSheet" role="dialog" aria-modal="true"><header><h2>{title}</h2><button onClick={onClose} aria-label="Închide"><X size={20}/></button></header>{children}</div></div>
}

function VisitEditor({visit,onClose,onSaved}:{visit:HealthVisit|null;onClose:()=>void;onSaved:()=>void}){
  const [specialty,setSpecialty]=useState(visit?.specialty??'')
  const [doctor,setDoctor]=useState(visit?.doctor_name??'')
  const [clinic,setClinic]=useState(visit?.clinic??'')
  const [scheduled,setScheduled]=useState(visit?.scheduled_at?new Date(visit.scheduled_at).toISOString().slice(0,16):'')
  const [status,setStatus]=useState<HealthVisit['status']>(visit?.status??'planned')
  const [summary,setSummary]=useState(visit?.summary??'')
  const [notes,setNotes]=useState(visit?.notes??'')
  const [busy,setBusy]=useState(false);const[error,setError]=useState('')
  async function save(){
    setBusy(true);setError('')
    try{const client=getSupabaseClient();if(!client)throw new Error('Supabase nu este disponibil.');const{data:auth}=await client.auth.getUser();if(!auth.user)throw new Error('Sesiune invalidă.');if(!specialty.trim()||!scheduled)throw new Error('Completează specialitatea și data.')
      const payload={specialty:specialty.trim(),doctor_name:doctor.trim()||null,clinic:clinic.trim()||null,scheduled_at:new Date(scheduled).toISOString(),status,summary:summary.trim()||null,notes:notes.trim()||null,updated_at:new Date().toISOString()}
      const result=visit?await client.from('health_visits').update(payload).eq('id',visit.id).eq('user_id',auth.user.id):await client.from('health_visits').insert({user_id:auth.user.id,...payload})
      if(result.error)throw new Error(result.error.message);onSaved()
    }catch(e){setError(e instanceof Error?e.message:'Salvarea nu a reușit.')}finally{setBusy(false)}
  }
  async function remove(){if(!visit||!confirm('Ștergi această vizită?'))return;setBusy(true);const client=getSupabaseClient();const{data:auth}=await client!.auth.getUser();const{error}=await client!.from('health_visits').delete().eq('id',visit.id).eq('user_id',auth.user!.id);setBusy(false);if(error)setError(error.message);else onSaved()}
  return <HealthSheet title={visit?'Editează vizită':'Adaugă vizită'} onClose={onClose}><div className="healthForm"><label>Specialitate<input value={specialty} onChange={e=>setSpecialty(e.target.value)} placeholder="ex. Cardiologie"/></label><label>Medic<input value={doctor} onChange={e=>setDoctor(e.target.value)} placeholder="Opțional"/></label><label>Clinică<input value={clinic} onChange={e=>setClinic(e.target.value)} placeholder="Opțional"/></label><label>Data și ora<input type="datetime-local" value={scheduled} onChange={e=>setScheduled(e.target.value)}/></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value as HealthVisit['status'])}><option value="planned">Programată</option><option value="completed">Finalizată</option><option value="cancelled">Anulată</option></select></label><label>Rezumat<textarea value={summary} onChange={e=>setSummary(e.target.value)} placeholder="Ce s-a discutat / recomandat"/></label><label>Note<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Opțional"/></label>{error&&<p className="healthFormError">{error}</p>}<div className="healthFormActions">{visit&&<button className="danger" disabled={busy} onClick={()=>void remove()}><Trash2 size={17}/> Șterge</button>}<button className="secondary" onClick={onClose}>Anulează</button><button className="primary" disabled={busy} onClick={()=>void save()}><Save size={17}/> {busy?'Se salvează…':'Salvează'}</button></div></div></HealthSheet>
}

function MeasurementEditor({measurement,onClose,onSaved}:{measurement:HealthMeasurement|null;onClose:()=>void;onSaved:()=>void}){
  const [type,setType]=useState<HealthMetricType>(measurement?.metric_type??'resting_heart_rate')
  const [value,setValue]=useState(measurement?String(measurement.value):'')
  const [secondary,setSecondary]=useState(measurement?.secondary_value===null||measurement?.secondary_value===undefined?'':String(measurement.secondary_value))
  const [measuredAt,setMeasuredAt]=useState(measurement?.measured_at?new Date(measurement.measured_at).toISOString().slice(0,16):new Date().toISOString().slice(0,16))
  const [notes,setNotes]=useState(measurement?.notes??'')
  const [busy,setBusy]=useState(false);const[error,setError]=useState('')
  const unit=type==='resting_heart_rate'?'bpm':type==='sleep_duration'?'h':type==='respiratory_rate'?'rpm':type==='vo2_max'?'ml/kg/min':type==='steps'?'pași':type==='weight'?'kg':type==='spo2'?'%':'mmHg'
  async function save(){setBusy(true);setError('');try{const client=getSupabaseClient();if(!client)throw new Error('Supabase nu este disponibil.');const{data:auth}=await client.auth.getUser();if(!auth.user)throw new Error('Sesiune invalidă.');const n=Number(value.replace(',','.'));if(!Number.isFinite(n))throw new Error('Introdu o valoare numerică.');const s=secondary?Number(secondary.replace(',','.')):null;if(type==='blood_pressure'&&(!s||!Number.isFinite(s)))throw new Error('Introdu și valoarea diastolică.')
    const payload={metric_type:type,value:n,secondary_value:s,unit,measured_at:new Date(measuredAt).toISOString(),source:'manual',notes:notes.trim()||null,updated_at:new Date().toISOString()}
    const result=measurement?await client.from('health_measurements').update(payload).eq('id',measurement.id).eq('user_id',auth.user.id):await client.from('health_measurements').insert({user_id:auth.user.id,...payload})
    if(result.error)throw new Error(result.error.message);onSaved()}catch(e){setError(e instanceof Error?e.message:'Salvarea nu a reușit.')}finally{setBusy(false)}}
  async function remove(){if(!measurement||!confirm('Ștergi această valoare?'))return;setBusy(true);const client=getSupabaseClient();const{data:auth}=await client!.auth.getUser();const{error}=await client!.from('health_measurements').delete().eq('id',measurement.id).eq('user_id',auth.user!.id);setBusy(false);if(error)setError(error.message);else onSaved()}
  return <HealthSheet title={measurement?'Editează valoare':'Adaugă valoare'} onClose={onClose}><div className="healthForm"><label>Indicator<select value={type} onChange={e=>setType(e.target.value as HealthMetricType)}>{metricOrder.map(key=><option key={key} value={key}>{metricMeta[key].label}</option>)}</select></label><label>{type==='blood_pressure'?'Sistolică':'Valoare'}<input inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)} placeholder={unit}/></label>{type==='blood_pressure'&&<label>Diastolică<input inputMode="decimal" value={secondary} onChange={e=>setSecondary(e.target.value)} placeholder="mmHg"/></label>}<label>Data și ora<input type="datetime-local" value={measuredAt} onChange={e=>setMeasuredAt(e.target.value)}/></label><label>Note<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Opțional"/></label>{error&&<p className="healthFormError">{error}</p>}<div className="healthFormActions">{measurement&&<button className="danger" disabled={busy} onClick={()=>void remove()}><Trash2 size={17}/> Șterge</button>}<button className="secondary" onClick={onClose}>Anulează</button><button className="primary" disabled={busy} onClick={()=>void save()}><Save size={17}/> {busy?'Se salvează…':'Salvează'}</button></div></div></HealthSheet>
}

function MedicalDocumentEditor({document,onClose,onSaved}:{document:DocumentRow|null;onClose:()=>void;onSaved:()=>void}){
  const [type,setType]=useState(document?.document_type??'health_other')
  const [title,setTitle]=useState(typeof document?.extra?.health_title==='string'?document.extra.health_title:'')
  const [issuer,setIssuer]=useState(document?.issuer??'')
  const [date,setDate]=useState((document?.document_date||document?.issued_at||'').slice(0,10))
  const [notes,setNotes]=useState(document?.notes??'')
  const [file,setFile]=useState<File|null>(null)
  const [busy,setBusy]=useState(false);const[error,setError]=useState('')
  async function analyze(id:string,client:NonNullable<ReturnType<typeof getSupabaseClient>>){const{data:session}=await client.auth.getSession();const token=session.session?.access_token;if(!token)return;const response=await fetch('/api/health/document-analyze',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({documentId:id})});if(!response.ok){const p=await response.json().catch(()=>({}));throw new Error(p.error||'Analiza AI nu a reușit.')}}
  async function save(){setBusy(true);setError('');try{const client=getSupabaseClient();if(!client)throw new Error('Supabase nu este disponibil.');const{data:auth}=await client.auth.getUser();if(!auth.user)throw new Error('Sesiune invalidă.');if(!document&&!file)throw new Error('Alege un fișier.');if(file&&file.size>20*1024*1024)throw new Error('Fișierul trebuie să fie sub 20 MB.')
    const baseExtra={...(document?.extra??{}),domain:'health',health_title:title.trim()||undefined,health_category:type.replace(/^health_/,'')}
    if(!document){const id=crypto.randomUUID();const{error:insertError}=await client.from('documents').insert({id,user_id:auth.user.id,document_type:type,source_filename:file!.name,mime_type:file!.type,issuer:issuer.trim()||null,document_date:date||null,notes:notes.trim()||null,extra:baseExtra});if(insertError)throw new Error(insertError.message);const ext=file!.type==='application/pdf'?'pdf':(file!.name.split('.').pop()||'bin');const path=`${auth.user.id}/health/${id}/${crypto.randomUUID()}.${ext}`;const{error:uploadError}=await client.storage.from('mylife-documents').upload(path,file!,{contentType:file!.type,upsert:false});if(uploadError){await client.from('documents').delete().eq('id',id);throw new Error(uploadError.message)}const{error:linkError}=await client.from('documents').update({storage_path:path}).eq('id',id).eq('user_id',auth.user.id);if(linkError)throw new Error(linkError.message);try{await analyze(id,client)}catch(e){console.warn(e)}onSaved()}else{let newPath:string|null=null;if(file){const ext=file.type==='application/pdf'?'pdf':(file.name.split('.').pop()||'bin');newPath=`${auth.user.id}/health/${document.id}/${crypto.randomUUID()}.${ext}`;const{error:u}=await client.storage.from('mylife-documents').upload(newPath,file,{contentType:file.type,upsert:false});if(u)throw new Error(u.message)}const payload={document_type:type,issuer:issuer.trim()||null,document_date:date||null,notes:notes.trim()||null,extra:baseExtra,...(file&&newPath?{source_filename:file.name,mime_type:file.type,storage_path:newPath}:{})};const{error:u}=await client.from('documents').update(payload).eq('id',document.id).eq('user_id',auth.user.id);if(u)throw new Error(u.message);if(file)try{await analyze(document.id,client)}catch(e){console.warn(e)}onSaved()}
  }catch(e){setError(e instanceof Error?e.message:'Salvarea nu a reușit.')}finally{setBusy(false)}}
  return <HealthSheet title={document?'Editează document':'Adaugă document'} onClose={onClose}><div className="healthForm">{!document&&<div className="healthAiUpload"><Sparkles size={20}/><div><strong>AI completează automat</strong><p>Poți încărca direct fișierul. Câmpurile de mai jos sunt opționale.</p></div></div>}<label>Fișier<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/></label><label>Tip<select value={type} onChange={e=>setType(e.target.value)}>{healthDocTypes.map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label><label>Titlu<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Opțional"/></label><label>Emitent<input value={issuer} onChange={e=>setIssuer(e.target.value)} placeholder="Opțional"/></label><label>Data documentului<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Rezumat / note<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Opțional"/></label>{error&&<p className="healthFormError">{error}</p>}<div className="healthFormActions"><button className="secondary" onClick={onClose}>Anulează</button><button className="primary" disabled={busy} onClick={()=>void save()}><Save size={17}/> {busy?'Se salvează…':'Salvează'}</button></div></div></HealthSheet>
}

function MedicalDocumentViewer({document,onClose,onEdit,onDeleted}:{document:DocumentRow;onClose:()=>void;onEdit:()=>void;onDeleted:()=>void}){
  const [url,setUrl]=useState<string|null>(null);const[error,setError]=useState('');const[busy,setBusy]=useState(false)
  useEffect(()=>{let cancelled=false;async function run(){if(!document.storage_path)return;const client=getSupabaseClient();if(!client)return;const path=document.storage_path.replace(/^mylife-documents\//,'');const{data,error}=await client.storage.from('mylife-documents').createSignedUrl(path,300);if(!cancelled){if(error)setError(error.message);else setUrl(data.signedUrl)}}run();return()=>{cancelled=true}},[document.storage_path])
  async function remove(){if(!confirm('Ștergi definitiv documentul?'))return;setBusy(true);setError('');try{const client=getSupabaseClient();if(!client)throw new Error('Supabase nu este disponibil.');const{data:auth}=await client.auth.getUser();if(!auth.user)throw new Error('Sesiune invalidă.');const path=document.storage_path?.replace(/^mylife-documents\//,'');const{error}=await client.from('documents').delete().eq('id',document.id).eq('user_id',auth.user.id);if(error)throw new Error(error.message);if(path)await client.storage.from('mylife-documents').remove([path]);onDeleted()}catch(e){setError(e instanceof Error?e.message:'Ștergerea nu a reușit.')}finally{setBusy(false)}}
  const isImage=document.mime_type?.startsWith('image/')
  return <HealthSheet title={healthDocumentTitle(document)} onClose={onClose}><div className="healthDocDetail"><div className="healthDocMeta"><div><span>Emitent</span><strong>{document.issuer||'—'}</strong></div><div><span>Data</span><strong>{document.document_date||document.issued_at?roDate(document.document_date||document.issued_at!):'—'}</strong></div><div><span>Tip</span><strong>{healthDocumentCategory(document)}</strong></div>{document.notes&&<div><span>Rezumat</span><strong>{document.notes}</strong></div>}</div>{url&&(isImage?<img src={url} alt={healthDocumentTitle(document)}/>:<iframe src={url+'#view=FitH'} title={healthDocumentTitle(document)}/>)}{error&&<p className="healthFormError">{error}</p>}<div className="healthFormActions">{url&&<a className="healthLinkButton" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/> Deschide</a>}<button className="secondary" onClick={onEdit}><Pencil size={17}/> Editează</button><button className="danger" disabled={busy} onClick={()=>void remove()}><Trash2 size={17}/> Șterge</button></div></div></HealthSheet>
}
