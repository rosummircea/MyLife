'use client'

import {useEffect,useMemo,useState,type ReactNode} from 'react'
import {Activity,CalendarDays,ChevronRight,ExternalLink,FileText,HeartPulse,Pencil,Plus,Save,Search,Stethoscope,Trash2,Upload,X} from 'lucide-react'
import {getSupabaseClient} from '@/lib/supabase'
import type {DocumentRow} from '@/lib/mylife-data'
import {healthDocumentCategory,healthDocuments,healthDocumentTitle,loadHealthData,metricMeta,type HealthData,type HealthMeasurement,type HealthMetricType,type HealthVisit} from '@/lib/health-data'
import './HealthModule.css'

export type HealthTab='overview'|'visits'|'data'|'documents'

export default function HealthModule({connected,refreshVersion,documents,documentsLoading,tab,setTab,registerMobileBack,onChanged}:{connected:boolean;refreshVersion:number;documents:DocumentRow[];documentsLoading:boolean;tab:HealthTab;setTab:(tab:HealthTab)=>void;registerMobileBack:(handler:(()=>boolean)|null)=>void;onChanged:()=>void}){
  const [data,setData]=useState<HealthData>({visits:[],measurements:[]})
  const [loading,setLoading]=useState(connected)
  const [error,setError]=useState('')
  const [visitEditor,setVisitEditor]=useState<HealthVisit|null|'new'>(null)
  const [metricEditor,setMetricEditor]=useState<HealthMeasurement|null|'new'>(null)
  const [documentEditor,setDocumentEditor]=useState<DocumentRow|null|'new'>(null)
  const [selectedDocument,setSelectedDocument]=useState<DocumentRow|null>(null)
  const medicalDocuments=useMemo(()=>healthDocuments(documents),[documents])

  useEffect(()=>{
    let cancelled=false
    if(!connected){setData({visits:[],measurements:[]});setLoading(false);return}
    const client=getSupabaseClient()
    if(!client){setError('Supabase nu este disponibil.');setLoading(false);return}
    setLoading(true);setError('')
    loadHealthData(client).then(result=>{if(!cancelled)setData(result)}).catch(reason=>{if(!cancelled)setError(reason instanceof Error?reason.message:'Datele nu pot fi încărcate.')}).finally(()=>{if(!cancelled)setLoading(false)})
    return()=>{cancelled=true}
  },[connected,refreshVersion])

  useEffect(()=>{
    registerMobileBack(()=>{
      if(visitEditor){setVisitEditor(null);return true}
      if(metricEditor){setMetricEditor(null);return true}
      if(documentEditor){setDocumentEditor(null);return true}
      if(selectedDocument){setSelectedDocument(null);return true}
      if(tab!=='overview'){setTab('overview');return true}
      return false
    })
    return()=>registerMobileBack(null)
  },[documentEditor,metricEditor,registerMobileBack,selectedDocument,setTab,tab,visitEditor])

  return <section className="healthModule">
    {error&&<div className="healthError">{error}</div>}
    {tab==='overview'&&<Overview data={data} documents={medicalDocuments} loading={loading||documentsLoading} setTab={setTab}/>}
    {tab==='visits'&&<VisitsTab visits={data.visits} loading={loading} onAdd={()=>setVisitEditor('new')} onOpen={visit=>setVisitEditor(visit)}/>}
    {tab==='data'&&<MetricsTab measurements={data.measurements} loading={loading} onAdd={()=>setMetricEditor('new')} onOpen={measurement=>setMetricEditor(measurement)}/>}
    {tab==='documents'&&<DocumentsTab documents={medicalDocuments} loading={documentsLoading} onAdd={()=>setDocumentEditor('new')} onOpen={document=>setSelectedDocument(document)}/>}
    {visitEditor&&<VisitSheet visit={visitEditor==='new'?null:visitEditor} onClose={()=>setVisitEditor(null)} onSaved={()=>{setVisitEditor(null);onChanged()}}/>}
    {metricEditor&&<MetricSheet measurement={metricEditor==='new'?null:metricEditor} onClose={()=>setMetricEditor(null)} onSaved={()=>{setMetricEditor(null);onChanged()}}/>}
    {documentEditor&&<MedicalDocumentSheet document={documentEditor==='new'?null:documentEditor} onClose={()=>setDocumentEditor(null)} onSaved={()=>{setDocumentEditor(null);onChanged()}}/>}
    {selectedDocument&&<MedicalDocumentDetail document={selectedDocument} onClose={()=>setSelectedDocument(null)} onEdit={()=>{setDocumentEditor(selectedDocument);setSelectedDocument(null)}} onDeleted={()=>{setSelectedDocument(null);onChanged()}}/>}
  </section>
}

function Header({title,subtitle}:{title:string;subtitle?:string}){
  return <header className="healthHeader"><div><span>MYLIFE</span><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div></header>
}

function Overview({data,documents,loading,setTab}:{data:HealthData;documents:DocumentRow[];loading:boolean;setTab:(tab:HealthTab)=>void}){
  const latest=(type:HealthMetricType)=>data.measurements.find(item=>item.metric_type===type)
  const value=(row:HealthMeasurement|undefined)=>row?Number(row.value).toLocaleString('ro-RO',{maximumFractionDigits:1}):'—'
  const next=data.visits.filter(item=>item.status==='planned'&&new Date(item.scheduled_at).getTime()>=Date.now()).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at))[0]
  return <div className="healthPage">
    <Header title="Sănătate"/>
    <section className="healthHero"><div><time>{new Date().toLocaleDateString('ro-RO',{timeZone:'Europe/Bucharest',weekday:'long',day:'numeric',month:'long',year:'numeric'})}</time><h2>{data.measurements.length?'Datele tale de sănătate':'Începe jurnalul de sănătate'}</h2><p>MyLife îți organizează valorile, vizitele și documentele medicale, fără să pună diagnostice.</p><span className="healthHeroPill"><HeartPulse size={17}/>{data.measurements.length?data.measurements.length+' valori':'Pregătit pentru date'}</span></div><div className="healthHeroArt"><HeartPulse size={64}/></div></section>
    <div className="healthMetricGrid">
      <button className="healthMetricCard" onClick={()=>setTab('data')}><div className="healthMetricIcon"><HeartPulse size={23}/></div><div className="healthMetricCopy"><span>Puls în repaus</span><strong>{value(latest('resting_heart_rate'))} <small>bătăi/min</small></strong><em>{latest('resting_heart_rate')?'Ultima valoare':'Fără date'}</em></div><ChevronRight size={18}/></button>
      <button className="healthMetricCard" onClick={()=>setTab('data')}><div className="healthMetricIcon"><Activity size={23}/></div><div className="healthMetricCopy"><span>Somn</span><strong>{value(latest('sleep_duration'))} <small>ore</small></strong><em>{latest('sleep_duration')?'Ultima valoare':'Fără date'}</em></div><ChevronRight size={18}/></button>
    </div>
    <section className="healthCard"><header><h3>Următoarea vizită</h3><button onClick={()=>setTab('visits')}>Vezi toate <ChevronRight size={16}/></button></header>{next?<button className="healthEmptyRow" onClick={()=>setTab('visits')}><span>{next.doctor_name||next.specialty} · {new Date(next.scheduled_at).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span><ChevronRight size={18}/></button>:<button className="healthEmptyRow" onClick={()=>setTab('visits')}><span>Nicio vizită programată</span><ChevronRight size={18}/></button>}</section>
    <section className="healthCard healthDocsPreview"><header><h3>Documente medicale</h3><button onClick={()=>setTab('documents')}>Vezi toate <ChevronRight size={16}/></button></header>{loading?<p className="healthMuted">Se încarcă…</p>:documents.length?documents.slice(0,3).map(document=><button key={document.id} onClick={()=>setTab('documents')}><div className="healthSquareIcon document"><FileText size={20}/></div><div><strong>{healthDocumentTitle(document)}</strong><span>{document.issuer||document.source_filename||'Document medical'}</span></div><ChevronRight size={18}/></button>):<button className="healthEmptyRow" onClick={()=>setTab('documents')}><span>Niciun document medical</span><ChevronRight size={18}/></button>}</section>
  </div>
}

function VisitsTab({visits,loading,onAdd,onOpen}:{visits:HealthVisit[];loading:boolean;onAdd:()=>void;onOpen:(visit:HealthVisit)=>void}){
  const [mode,setMode]=useState<'upcoming'|'history'>('upcoming')
  const now=Date.now()
  const upcoming=visits.filter(visit=>visit.status==='planned'&&new Date(visit.scheduled_at).getTime()>=now).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at))
  const history=visits.filter(visit=>visit.status!=='planned'||new Date(visit.scheduled_at).getTime()<now).sort((a,b)=>b.scheduled_at.localeCompare(a.scheduled_at))
  const rows=mode==='upcoming'?upcoming:history

  return <div className="healthPage">
    <Header title="Vizite" subtitle="Programări și istoricul consultațiilor."/>
    <div className="healthSegmented"><button className={mode==='upcoming'?'active':''} onClick={()=>setMode('upcoming')}>Următoare</button><button className={mode==='history'?'active':''} onClick={()=>setMode('history')}>Istoric</button></div>
    <section className="healthInfoCard"><div className="healthSquareIcon blue"><CalendarDays size={22}/></div><div><strong>Ține aici toate vizitele și recomandările.</strong><p>Programările viitoare și istoricul consultațiilor, într-un singur loc.</p></div></section>
    <div className="healthSectionHeading"><h2>{mode==='upcoming'?'Următoarele vizite':'Istoric vizite'}</h2><button className="healthAddButton" onClick={onAdd}><Plus size={17}/> Adaugă</button></div>
    <div className="healthVisitList">
      {loading?<p className="healthMuted">Se încarcă…</p>:rows.length?rows.map(visit=><button key={visit.id} onClick={()=>onOpen(visit)}><div className="healthSquareIcon visit"><Stethoscope size={22}/></div><div><strong>{visit.specialty}</strong><span>{visit.doctor_name||visit.clinic||'Fără medic setat'}</span><small><CalendarDays size={14}/>{new Date(visit.scheduled_at).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</small>{visit.summary&&<p>{visit.summary}</p>}</div><ChevronRight size={18}/></button>):<div className="healthEmptyPanel"><CalendarDays size={34}/><strong>{mode==='upcoming'?'Nicio vizită programată':'Niciun istoric încă'}</strong><button onClick={onAdd}><Plus size={17}/> Adaugă vizită</button></div>}
    </div>
  </div>
}

function Sheet({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
  return <div className="healthSheetBackdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><div className="healthSheet" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Închide"><X size={20}/></button></header>{children}</div></div>
}

function VisitSheet({visit,onClose,onSaved}:{visit:HealthVisit|null;onClose:()=>void;onSaved:()=>void}){
  const localDateTime=(value:string)=>{
    const date=new Date(value)
    const shifted=new Date(date.getTime()-date.getTimezoneOffset()*60000)
    return shifted.toISOString().slice(0,16)
  }
  const [specialty,setSpecialty]=useState(visit?.specialty??'')
  const [doctor,setDoctor]=useState(visit?.doctor_name??'')
  const [clinic,setClinic]=useState(visit?.clinic??'')
  const [scheduled,setScheduled]=useState(visit?.scheduled_at?localDateTime(visit.scheduled_at):'')
  const [status,setStatus]=useState<HealthVisit['status']>(visit?.status??'planned')
  const [summary,setSummary]=useState(visit?.summary??'')
  const [notes,setNotes]=useState(visit?.notes??'')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')

  async function save(){
    setBusy(true);setError('')
    try{
      const client=getSupabaseClient()
      if(!client)throw new Error('Supabase nu este disponibil.')
      const {data:auth,error:authError}=await client.auth.getUser()
      if(authError||!auth.user)throw new Error('Sesiunea nu este validă.')
      if(!specialty.trim()||!scheduled)throw new Error('Completează specialitatea și data.')
      const payload={
        specialty:specialty.trim(),
        doctor_name:doctor.trim()||null,
        clinic:clinic.trim()||null,
        scheduled_at:new Date(scheduled).toISOString(),
        status,
        summary:summary.trim()||null,
        notes:notes.trim()||null,
        updated_at:new Date().toISOString(),
      }
      const result=visit
        ?await client.from('health_visits').update(payload).eq('id',visit.id).eq('user_id',auth.user.id)
        :await client.from('health_visits').insert({user_id:auth.user.id,...payload})
      if(result.error)throw new Error(result.error.message)
      onSaved()
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Salvarea nu a reușit.')
    }finally{
      setBusy(false)
    }
  }

  async function remove(){
    if(!visit||!window.confirm('Ștergi această vizită?'))return
    setBusy(true);setError('')
    try{
      const client=getSupabaseClient()
      if(!client)throw new Error('Supabase nu este disponibil.')
      const {data:auth,error:authError}=await client.auth.getUser()
      if(authError||!auth.user)throw new Error('Sesiunea nu este validă.')
      const {error:deleteError}=await client.from('health_visits').delete().eq('id',visit.id).eq('user_id',auth.user.id)
      if(deleteError)throw new Error(deleteError.message)
      onSaved()
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Ștergerea nu a reușit.')
    }finally{
      setBusy(false)
    }
  }

  return <Sheet title={visit?'Editează vizită':'Adaugă vizită'} onClose={onClose}><div className="healthForm">
    <label>Specialitate<input value={specialty} onChange={event=>setSpecialty(event.target.value)} placeholder="ex. Cardiologie"/></label>
    <label>Medic<input value={doctor} onChange={event=>setDoctor(event.target.value)} placeholder="Opțional"/></label>
    <label>Clinică<input value={clinic} onChange={event=>setClinic(event.target.value)} placeholder="Opțional"/></label>
    <label>Data și ora<input type="datetime-local" value={scheduled} onChange={event=>setScheduled(event.target.value)}/></label>
    <label>Status<select value={status} onChange={event=>setStatus(event.target.value as HealthVisit['status'])}><option value="planned">Programată</option><option value="completed">Finalizată</option><option value="cancelled">Anulată</option></select></label>
    <label>Rezumat<textarea value={summary} onChange={event=>setSummary(event.target.value)} placeholder="Ce s-a discutat sau recomandat"/></label>
    <label>Note<textarea value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Opțional"/></label>
    {error&&<p className="healthFormError">{error}</p>}
    <div className="healthFormActions">{visit&&<button type="button" className="danger" disabled={busy} onClick={()=>void remove()}><Trash2 size={17}/> Șterge</button>}<button type="button" className="secondary" disabled={busy} onClick={onClose}>Anulează</button><button type="button" className="primary" disabled={busy} onClick={()=>void save()}><Save size={17}/>{busy?'Se salvează…':'Salvează'}</button></div>
  </div></Sheet>
}

function metricUnit(type:HealthMetricType){
  if(type==='resting_heart_rate')return 'bpm'
  if(type==='sleep_duration')return 'h'
  if(type==='respiratory_rate')return 'rpm'
  if(type==='vo2_max')return 'ml/kg/min'
  if(type==='steps')return 'pași'
  if(type==='weight')return 'kg'
  if(type==='spo2')return '%'
  return 'mmHg'
}

function metricValue(row:HealthMeasurement){
  if(row.metric_type==='sleep_duration'){
    const hours=Math.floor(row.value)
    const minutes=Math.round((row.value-hours)*60)
    return hours+' h'+(minutes?' '+minutes+' min':'')
  }
  if(row.metric_type==='blood_pressure')return Math.round(row.value)+'/'+Math.round(row.secondary_value??0)
  return Number(row.value).toLocaleString('ro-RO',{maximumFractionDigits:1})
}

function MetricsTab({measurements,loading,onAdd,onOpen}:{measurements:HealthMeasurement[];loading:boolean;onAdd:()=>void;onOpen:(measurement:HealthMeasurement)=>void}){
  const [period,setPeriod]=useState<'week'|'month'|'all'>('week')
  const days=period==='week'?7:period==='month'?30:36500
  const cutoff=Date.now()-days*86400000
  const scoped=measurements.filter(item=>new Date(item.measured_at).getTime()>=cutoff)
  const latest=new Map<HealthMetricType,HealthMeasurement>()
  for(const item of measurements)if(!latest.has(item.metric_type))latest.set(item.metric_type,item)
  const cards:HealthMetricType[]=['resting_heart_rate','sleep_duration','vo2_max','steps']
  const chartRows=measurements.filter(item=>item.metric_type==='resting_heart_rate'&&new Date(item.measured_at).getTime()>=Date.now()-30*86400000).slice().reverse()

  return <div className="healthPage">
    <Header title="Date" subtitle="Valori și tendințe, fără interpretări medicale."/>
    <div className="healthSegmented three"><button className={period==='week'?'active':''} onClick={()=>setPeriod('week')}>Săptămână</button><button className={period==='month'?'active':''} onClick={()=>setPeriod('month')}>Lună</button><button className={period==='all'?'active':''} onClick={()=>setPeriod('all')}>Tot</button></div>
    <section className="healthPeriodSummary"><Activity size={22}/><div><strong>{period==='week'?'Ultimele 7 zile':period==='month'?'Ultimele 30 zile':'Toate datele'}</strong><span>{loading?'Se încarcă…':scoped.length+' înregistrări'}</span></div><button className="healthAddButton" onClick={onAdd}><Plus size={17}/> Adaugă</button></section>
    <div className="healthMetricGrid">{cards.map(type=>{const row=latest.get(type);return <button className={'healthMetricCard metric-'+type} key={type} onClick={()=>row?onOpen(row):onAdd()}><div className="healthMetricIcon"><Activity size={23}/></div><div className="healthMetricCopy"><span>{metricMeta[type].label}</span><strong>{row?metricValue(row):'—'} {row&&type!=='sleep_duration'&&<small>{row.unit}</small>}</strong><em>{row?'Ultima valoare':'Fără date'}</em></div><ChevronRight size={18}/></button>})}</div>
    <section className="healthCard healthChartCard"><header><div><h3>Tendință 30 zile</h3><span>Puls în repaus</span></div><em>{chartRows.length>1?'Evoluție disponibilă':'Mai sunt necesare date'}</em></header><TrendChart rows={chartRows}/></section>
    <section className="healthCard healthSources"><header><h3>Surse de date</h3></header><div><div className="healthSquareIcon"><Activity size={21}/></div><div><strong>Manual</strong><small>{measurements.filter(item=>item.source==='manual').length} valori introduse</small></div></div><div><div className="healthSquareIcon"><Activity size={21}/></div><div><strong>Apple Health / Watch</strong><small>Neconectat · necesită integrare iOS</small></div></div></section>
    <section className="healthDocumentList">{measurements.slice(0,20).map(row=><button key={row.id} onClick={()=>onOpen(row)}><div className="healthSquareIcon"><Activity size={21}/></div><div><strong>{metricMeta[row.metric_type].label}</strong><span>{metricValue(row)} {row.metric_type==='sleep_duration'?'':row.unit} · {new Date(row.measured_at).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',day:'2-digit',month:'short',year:'numeric'})}</span></div><ChevronRight size={18}/></button>)}</section>
  </div>
}

function TrendChart({rows}:{rows:HealthMeasurement[]}){
  if(rows.length<2)return <div className="healthChartEmpty">Adaugă cel puțin două valori pentru a vedea tendința.</div>
  const values=rows.map(row=>row.value)
  const min=Math.min(...values)
  const max=Math.max(...values)
  const range=Math.max(1,max-min)
  const points=rows.map((row,index)=>String((index/(rows.length-1))*100)+','+String(88-((row.value-min)/range)*68)).join(' ')
  return <svg className="healthChart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Grafic tendință"><line x1="0" y1="88" x2="100" y2="88"/><line x1="0" y1="54" x2="100" y2="54"/><line x1="0" y1="20" x2="100" y2="20"/><polyline points={points}/></svg>
}

function MetricSheet({measurement,onClose,onSaved}:{measurement:HealthMeasurement|null;onClose:()=>void;onSaved:()=>void}){
  const types:HealthMetricType[]=['resting_heart_rate','sleep_duration','respiratory_rate','vo2_max','steps','weight','spo2','blood_pressure']
  const [type,setType]=useState<HealthMetricType>(measurement?.metric_type??'resting_heart_rate')
  const [value,setValue]=useState(measurement?String(measurement.value):'')
  const [secondary,setSecondary]=useState(measurement?.secondary_value===null||measurement?.secondary_value===undefined?'':String(measurement.secondary_value))
  const toLocal=(dateValue:string)=>{const date=new Date(dateValue);const shifted=new Date(date.getTime()-date.getTimezoneOffset()*60000);return shifted.toISOString().slice(0,16)}
  const [measuredAt,setMeasuredAt]=useState(measurement?.measured_at?toLocal(measurement.measured_at):toLocal(new Date().toISOString()))
  const [notes,setNotes]=useState(measurement?.notes??'')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')

  async function save(){
    setBusy(true);setError('')
    try{
      const client=getSupabaseClient()
      if(!client)throw new Error('Supabase nu este disponibil.')
      const {data:auth,error:authError}=await client.auth.getUser()
      if(authError||!auth.user)throw new Error('Sesiunea nu este validă.')
      const numeric=Number(value.replace(',','.'))
      if(!Number.isFinite(numeric))throw new Error('Introdu o valoare numerică.')
      const second=secondary?Number(secondary.replace(',','.')):null
      if(type==='blood_pressure'&&(second===null||!Number.isFinite(second)))throw new Error('Introdu și valoarea diastolică.')
      const payload={metric_type:type,value:numeric,secondary_value:second,unit:metricUnit(type),measured_at:new Date(measuredAt).toISOString(),source:'manual',notes:notes.trim()||null,updated_at:new Date().toISOString()}
      const result=measurement
        ?await client.from('health_measurements').update(payload).eq('id',measurement.id).eq('user_id',auth.user.id)
        :await client.from('health_measurements').insert({user_id:auth.user.id,...payload})
      if(result.error)throw new Error(result.error.message)
      onSaved()
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Salvarea nu a reușit.')
    }finally{
      setBusy(false)
    }
  }

  async function remove(){
    if(!measurement||!window.confirm('Ștergi această valoare?'))return
    setBusy(true);setError('')
    try{
      const client=getSupabaseClient()
      if(!client)throw new Error('Supabase nu este disponibil.')
      const {data:auth,error:authError}=await client.auth.getUser()
      if(authError||!auth.user)throw new Error('Sesiunea nu este validă.')
      const {error:deleteError}=await client.from('health_measurements').delete().eq('id',measurement.id).eq('user_id',auth.user.id)
      if(deleteError)throw new Error(deleteError.message)
      onSaved()
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Ștergerea nu a reușit.')
    }finally{
      setBusy(false)
    }
  }

  return <Sheet title={measurement?'Editează valoare':'Adaugă valoare'} onClose={onClose}><div className="healthForm">
    <label>Indicator<select value={type} onChange={event=>setType(event.target.value as HealthMetricType)}>{types.map(key=><option key={key} value={key}>{metricMeta[key].label}</option>)}</select></label>
    <label>{type==='blood_pressure'?'Sistolică':'Valoare'}<input inputMode="decimal" value={value} onChange={event=>setValue(event.target.value)} placeholder={metricUnit(type)}/></label>
    {type==='blood_pressure'&&<label>Diastolică<input inputMode="decimal" value={secondary} onChange={event=>setSecondary(event.target.value)} placeholder="mmHg"/></label>}
    <label>Data și ora<input type="datetime-local" value={measuredAt} onChange={event=>setMeasuredAt(event.target.value)}/></label>
    <label>Note<textarea value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Opțional"/></label>
    {error&&<p className="healthFormError">{error}</p>}
    <div className="healthFormActions">{measurement&&<button type="button" className="danger" disabled={busy} onClick={()=>void remove()}><Trash2 size={17}/> Șterge</button>}<button type="button" className="secondary" disabled={busy} onClick={onClose}>Anulează</button><button type="button" className="primary" disabled={busy} onClick={()=>void save()}><Save size={17}/>{busy?'Se salvează…':'Salvează'}</button></div>
  </div></Sheet>
}

function DocumentsTab({documents,loading,onAdd,onOpen}:{documents:DocumentRow[];loading:boolean;onAdd:()=>void;onOpen:(document:DocumentRow)=>void}){
  const [query,setQuery]=useState('')
  const [filter,setFilter]=useState('all')
  const filtered=documents.filter(document=>{
    const haystack=(healthDocumentTitle(document)+' '+(document.issuer||'')+' '+(document.source_filename||'')).toLowerCase()
    const matches=haystack.includes(query.trim().toLowerCase())
    return matches&&(filter==='all'||healthDocumentCategory(document)===filter)
  })
  return <div className="healthPage">
    <Header title="Documente" subtitle="Analize, imagistică, rețete și alte acte medicale."/>
    <label className="healthSearch"><Search size={19}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Caută documente, emitent sau fișier…"/></label>
    <div className="healthFilters"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Toate</button><button className={filter==='lab'?'active':''} onClick={()=>setFilter('lab')}>Analize</button><button className={filter==='imaging'?'active':''} onClick={()=>setFilter('imaging')}>Imagistică</button><button className={filter==='prescription'?'active':''} onClick={()=>setFilter('prescription')}>Rețete</button></div>
    <div className="healthSectionHeading"><h2>Documentele tale</h2><button className="healthAddButton" onClick={onAdd}><Plus size={17}/> Adaugă</button></div>
    <section className="healthDocumentList">{loading?<p className="healthMuted">Se încarcă…</p>:filtered.length?filtered.map(document=><button key={document.id} onClick={()=>onOpen(document)}><div className="healthSquareIcon document"><FileText size={21}/></div><div><strong>{healthDocumentTitle(document)}</strong><span>{document.issuer||document.source_filename||'Document medical'}</span><small>{document.document_date?new Date(document.document_date+'T12:00:00Z').toLocaleDateString('ro-RO',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric'}):'Fără dată'}</small></div><ChevronRight size={18}/></button>):<div className="healthEmptyPanel"><FileText size={34}/><strong>Niciun document</strong><button onClick={onAdd}><Upload size={17}/> Adaugă document</button></div>}</section>
  </div>
}

function MedicalDocumentSheet({document,onClose,onSaved}:{document:DocumentRow|null;onClose:()=>void;onSaved:()=>void}){
  const initialTitle=typeof document?.extra?.health_title==='string'?document.extra.health_title:''
  const [type,setType]=useState(document?.document_type??'health_other')
  const [title,setTitle]=useState(initialTitle)
  const [issuer,setIssuer]=useState(document?.issuer??'')
  const [date,setDate]=useState(document?.document_date?.slice(0,10)??'')
  const [file,setFile]=useState<File|null>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')

  async function save(){
    setBusy(true);setError('')
    try{
      const client=getSupabaseClient()
      if(!client)throw new Error('Supabase nu este disponibil.')
      const {data:auth,error:authError}=await client.auth.getUser()
      if(authError||!auth.user)throw new Error('Sesiunea nu este validă.')
      if(!document&&!file)throw new Error('Alege un fișier.')
      if(file&&file.size>20*1024*1024)throw new Error('Fișierul trebuie să fie sub 20 MB.')
      if(file&&!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Folosește PDF, JPG, PNG sau WebP.')
      const extra:Record<string,unknown>={...(document?.extra??{}),domain:'health',health_category:type.replace(/^health_/,'')}
      if(title.trim())extra.health_title=title.trim()
      else delete extra.health_title

      if(!document){
        const id=crypto.randomUUID()
        const {error:insertError}=await client.from('documents').insert({
          id,
          user_id:auth.user.id,
          document_type:type,
          source_filename:file?.name??null,
          mime_type:file?.type??null,
          issuer:issuer.trim()||null,
          document_date:date||null,
          extra,
        })
        if(insertError)throw new Error(insertError.message)
        const extension=file?.type==='application/pdf'?'pdf':file?.name.split('.').pop()||'bin'
        const path=auth.user.id+'/health/'+id+'/'+crypto.randomUUID()+'.'+extension
        const {error:uploadError}=await client.storage.from('mylife-documents').upload(path,file as File,{contentType:(file as File).type,upsert:false})
        if(uploadError){await client.from('documents').delete().eq('id',id).eq('user_id',auth.user.id);throw new Error(uploadError.message)}
        const {error:linkError}=await client.from('documents').update({storage_path:path}).eq('id',id).eq('user_id',auth.user.id)
        if(linkError){await client.storage.from('mylife-documents').remove([path]);await client.from('documents').delete().eq('id',id).eq('user_id',auth.user.id);throw new Error(linkError.message)}
      }else{
        let newPath:string|null=null
        if(file){
          const extension=file.type==='application/pdf'?'pdf':file.name.split('.').pop()||'bin'
          newPath=auth.user.id+'/health/'+document.id+'/'+crypto.randomUUID()+'.'+extension
          const {error:uploadError}=await client.storage.from('mylife-documents').upload(newPath,file,{contentType:file.type,upsert:false})
          if(uploadError)throw new Error(uploadError.message)
        }
        const update={
          document_type:type,
          issuer:issuer.trim()||null,
          document_date:date||null,
          extra,
          ...(file&&newPath?{source_filename:file.name,mime_type:file.type,storage_path:newPath}:{}),
        }
        const {error:updateError}=await client.from('documents').update(update).eq('id',document.id).eq('user_id',auth.user.id)
        if(updateError){if(newPath)await client.storage.from('mylife-documents').remove([newPath]);throw new Error(updateError.message)}
        if(newPath&&document.storage_path)await client.storage.from('mylife-documents').remove([document.storage_path.replace(/^mylife-documents\//,'')])
      }
      onSaved()
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Salvarea nu a reușit.')
    }finally{
      setBusy(false)
    }
  }

  return <Sheet title={document?'Editează document':'Adaugă document'} onClose={onClose}><div className="healthForm">
    <label>Fișier<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event=>setFile(event.target.files?.[0]??null)}/></label>
    <label>Tip<select value={type} onChange={event=>setType(event.target.value)}><option value="health_lab">Analize</option><option value="health_imaging">Imagistică</option><option value="health_prescription">Rețetă</option><option value="health_discharge">Bilet externare</option><option value="health_consultation">Raport consultație</option><option value="health_other">Alt document</option></select></label>
    <label>Titlu<input value={title} onChange={event=>setTitle(event.target.value)} placeholder="Opțional"/></label>
    <label>Emitent<input value={issuer} onChange={event=>setIssuer(event.target.value)} placeholder="Opțional"/></label>
    <label>Data documentului<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label>
    {error&&<p className="healthFormError">{error}</p>}
    <div className="healthFormActions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>Anulează</button><button type="button" className="primary" disabled={busy} onClick={()=>void save()}><Save size={17}/>{busy?'Se salvează…':'Salvează'}</button></div>
  </div></Sheet>
}

function MedicalDocumentDetail({document,onClose,onEdit,onDeleted}:{document:DocumentRow;onClose:()=>void;onEdit:()=>void;onDeleted:()=>void}){
  const [url,setUrl]=useState<string|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)

  useEffect(()=>{
    let cancelled=false
    if(!document.storage_path)return
    const client=getSupabaseClient()
    if(!client)return
    const path=document.storage_path.replace(/^mylife-documents\//,'')
    client.storage.from('mylife-documents').createSignedUrl(path,300).then(({data,error:signError})=>{
      if(cancelled)return
      if(signError)setError(signError.message)
      else setUrl(data.signedUrl)
    })
    return()=>{cancelled=true}
  },[document.storage_path])

  async function remove(){
    if(!window.confirm('Ștergi definitiv acest document medical?'))return
    setBusy(true);setError('')
    try{
      const client=getSupabaseClient()
      if(!client)throw new Error('Supabase nu este disponibil.')
      const {data:auth,error:authError}=await client.auth.getUser()
      if(authError||!auth.user)throw new Error('Sesiunea nu este validă.')
      const path=document.storage_path?.replace(/^mylife-documents\//,'')||null
      const {error:deleteError}=await client.from('documents').delete().eq('id',document.id).eq('user_id',auth.user.id)
      if(deleteError)throw new Error(deleteError.message)
      if(path)await client.storage.from('mylife-documents').remove([path])
      onDeleted()
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Ștergerea nu a reușit.')
    }finally{
      setBusy(false)
    }
  }

  return <Sheet title={healthDocumentTitle(document)} onClose={onClose}><div className="healthDocDetail">
    <div className="healthDocMeta"><div><span>Tip</span><strong>{healthDocumentCategory(document)}</strong></div><div><span>Emitent</span><strong>{document.issuer||'—'}</strong></div><div><span>Data</span><strong>{document.document_date||'—'}</strong></div><div><span>Fișier</span><strong>{document.source_filename||'—'}</strong></div></div>
    {error&&<p className="healthFormError">{error}</p>}
    <div className="healthFormActions">{url&&<a className="healthLinkButton" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/> Deschide fișierul</a>}<button type="button" className="secondary" onClick={onEdit}><Pencil size={17}/> Editează</button><button type="button" className="danger" disabled={busy} onClick={()=>void remove()}><Trash2 size={17}/> Șterge</button></div>
  </div></Sheet>
}

