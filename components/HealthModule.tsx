'use client'

import {useEffect,useMemo,useState,type ReactNode} from 'react'
import {Activity,CalendarDays,ChevronRight,FileText,HeartPulse,Plus} from 'lucide-react'
import {getSupabaseClient} from '@/lib/supabase'
import type {DocumentRow} from '@/lib/mylife-data'
import {healthDocuments,healthDocumentTitle,loadHealthData,metricMeta,type HealthData,type HealthMeasurement,type HealthMetricType,type HealthVisit} from '@/lib/health-data'
import './HealthModule.css'

export type HealthTab='overview'|'visits'|'data'|'documents'

export default function HealthModule({connected,refreshVersion,documents,documentsLoading,tab,setTab,registerMobileBack}:{connected:boolean;refreshVersion:number;documents:DocumentRow[];documentsLoading:boolean;tab:HealthTab;setTab:(tab:HealthTab)=>void;registerMobileBack:(handler:(()=>boolean)|null)=>void;onChanged:()=>void}){
  const [data,setData]=useState<HealthData>({visits:[],measurements:[]})
  const [loading,setLoading]=useState(connected)
  const [error,setError]=useState('')
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
    registerMobileBack(()=>{if(tab!=='overview'){setTab('overview');return true}return false})
    return()=>registerMobileBack(null)
  },[registerMobileBack,setTab,tab])

  return <section className="healthModule">
    {error&&<div className="healthError">{error}</div>}
    {tab==='overview'&&<Overview data={data} documents={medicalDocuments} loading={loading||documentsLoading} setTab={setTab}/>}
    {tab==='visits'&&<VisitsReadOnly visits={data.visits} loading={loading}/>}
    {tab==='data'&&<DataReadOnly measurements={data.measurements} loading={loading}/>}
    {tab==='documents'&&<Documents documents={medicalDocuments} loading={documentsLoading}/>}
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

function VisitsReadOnly({visits,loading}:{visits:HealthVisit[];loading:boolean}){
  return <div className="healthPage"><Header title="Vizite" subtitle="Programări și istoricul consultațiilor."/><section className="healthDocumentList">{loading?<p className="healthMuted">Se încarcă…</p>:visits.length?visits.map(visit=><button key={visit.id}><div className="healthSquareIcon"><CalendarDays size={21}/></div><div><strong>{visit.specialty}</strong><span>{visit.doctor_name||visit.clinic||new Date(visit.scheduled_at).toLocaleDateString('ro-RO')}</span></div><ChevronRight size={18}/></button>):<div className="healthEmptyPanel"><CalendarDays size={34}/><strong>Nicio vizită încă</strong></div>}</section></div>
}

function DataReadOnly({measurements,loading}:{measurements:HealthMeasurement[];loading:boolean}){
  return <div className="healthPage"><Header title="Date" subtitle="Valori și tendințe, fără interpretări medicale."/><section className="healthDocumentList">{loading?<p className="healthMuted">Se încarcă…</p>:measurements.length?measurements.slice(0,20).map(row=><button key={row.id}><div className="healthSquareIcon"><Activity size={21}/></div><div><strong>{metricMeta[row.metric_type].label}</strong><span>{Number(row.value).toLocaleString('ro-RO',{maximumFractionDigits:1})} {row.unit}</span></div><ChevronRight size={18}/></button>):<div className="healthEmptyPanel"><Activity size={34}/><strong>Nicio valoare încă</strong></div>}</section></div>
}

function Documents({documents,loading}:{documents:DocumentRow[];loading:boolean}){
  return <div className="healthPage"><Header title="Documente" subtitle="Analize, imagistică, rețete și alte acte medicale."/><section className="healthDocumentList">{loading?<p className="healthMuted">Se încarcă…</p>:documents.length?documents.map(document=><button key={document.id}><div className="healthSquareIcon document"><FileText size={21}/></div><div><strong>{healthDocumentTitle(document)}</strong><span>{document.issuer||document.source_filename||'Document medical'}</span></div><ChevronRight size={18}/></button>):<div className="healthEmptyPanel"><FileText size={34}/><strong>Niciun document</strong></div>}</section></div>
}
