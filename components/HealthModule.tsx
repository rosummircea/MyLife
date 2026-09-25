'use client'

import {useEffect,useMemo,useState,type ReactNode} from 'react'
import {Activity,CalendarDays,ChevronRight,FileText,HeartPulse,Plus,Save,Stethoscope,Trash2,X} from 'lucide-react'
import {getSupabaseClient} from '@/lib/supabase'
import type {DocumentRow} from '@/lib/mylife-data'
import {healthDocuments,healthDocumentTitle,loadHealthData,metricMeta,type HealthData,type HealthMeasurement,type HealthMetricType,type HealthVisit} from '@/lib/health-data'
import './HealthModule.css'

export type HealthTab='overview'|'visits'|'data'|'documents'

export default function HealthModule({connected,refreshVersion,documents,documentsLoading,tab,setTab,registerMobileBack,onChanged}:{connected:boolean;refreshVersion:number;documents:DocumentRow[];documentsLoading:boolean;tab:HealthTab;setTab:(tab:HealthTab)=>void;registerMobileBack:(handler:(()=>boolean)|null)=>void;onChanged:()=>void}){
  const [data,setData]=useState<HealthData>({visits:[],measurements:[]})
  const [loading,setLoading]=useState(connected)
  const [error,setError]=useState('')
  const [visitEditor,setVisitEditor]=useState<HealthVisit|null|'new'>(null)
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
      if(tab!=='overview'){setTab('overview');return true}
      return false
    })
    return()=>registerMobileBack(null)
  },[registerMobileBack,setTab,tab,visitEditor])

  return <section className="healthModule">
    {error&&<div className="healthError">{error}</div>}
    {tab==='overview'&&<Overview data={data} documents={medicalDocuments} loading={loading||documentsLoading} setTab={setTab}/>}
    {tab==='visits'&&<VisitsTab visits={data.visits} loading={loading} onAdd={()=>setVisitEditor('new')} onOpen={visit=>setVisitEditor(visit)}/>}
    {tab==='data'&&<DataReadOnly measurements={data.measurements} loading={loading}/>}
    {tab==='documents'&&<Documents documents={medicalDocuments} loading={documentsLoading}/>}
    {visitEditor&&<VisitSheet visit={visitEditor==='new'?null:visitEditor} onClose={()=>setVisitEditor(null)} onSaved={()=>{setVisitEditor(null);onChanged()}}/>}
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

function DataReadOnly({measurements,loading}:{measurements:HealthMeasurement[];loading:boolean}){
  return <div className="healthPage"><Header title="Date" subtitle="Valori și tendințe, fără interpretări medicale."/><section className="healthDocumentList">{loading?<p className="healthMuted">Se încarcă…</p>:measurements.length?measurements.slice(0,20).map(row=><button key={row.id}><div className="healthSquareIcon"><Activity size={21}/></div><div><strong>{metricMeta[row.metric_type].label}</strong><span>{Number(row.value).toLocaleString('ro-RO',{maximumFractionDigits:1})} {row.unit}</span></div><ChevronRight size={18}/></button>):<div className="healthEmptyPanel"><Activity size={34}/><strong>Nicio valoare încă</strong></div>}</section></div>
}

function Documents({documents,loading}:{documents:DocumentRow[];loading:boolean}){
  return <div className="healthPage"><Header title="Documente" subtitle="Analize, imagistică, rețete și alte acte medicale."/><section className="healthDocumentList">{loading?<p className="healthMuted">Se încarcă…</p>:documents.length?documents.map(document=><button key={document.id}><div className="healthSquareIcon document"><FileText size={21}/></div><div><strong>{healthDocumentTitle(document)}</strong><span>{document.issuer||document.source_filename||'Document medical'}</span></div><ChevronRight size={18}/></button>):<div className="healthEmptyPanel"><FileText size={34}/><strong>Niciun document</strong></div>}</section></div>
}
