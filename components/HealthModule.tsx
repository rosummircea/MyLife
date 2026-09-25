'use client'

import {Activity,CalendarDays,ChevronRight,FileText,HeartPulse,Plus} from 'lucide-react'
import type {DocumentRow} from '@/lib/mylife-data'
import {healthDocuments,healthDocumentTitle,type HealthMeasurement,type HealthMetricType,type HealthVisit} from '@/lib/health-data'
import './HealthModule.css'

export type HealthTab='overview'|'visits'|'data'|'documents'

export default function HealthModule({documents,documentsLoading,tab,setTab}:{connected:boolean;refreshVersion:number;documents:DocumentRow[];documentsLoading:boolean;tab:HealthTab;setTab:(tab:HealthTab)=>void;registerMobileBack:(handler:(()=>boolean)|null)=>void;onChanged:()=>void}){
  const medicalDocuments=healthDocuments(documents)
  return <section className="healthModule">
    {tab==='overview'&&<Overview documents={medicalDocuments} loading={documentsLoading} setTab={setTab}/>}
    {tab==='visits'&&<Simple title="Vizite" subtitle="Programări și istoricul consultațiilor." icon={<CalendarDays size={34}/>}/>}
    {tab==='data'&&<Simple title="Date" subtitle="Valori și tendințe, fără interpretări medicale." icon={<Activity size={34}/>}/>}
    {tab==='documents'&&<Documents documents={medicalDocuments} loading={documentsLoading}/>}
  </section>
}

function Header({title,subtitle}:{title:string;subtitle?:string}){
  return <header className="healthHeader"><div><span>MYLIFE</span><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div></header>
}

function Overview({documents,loading,setTab}:{documents:DocumentRow[];loading:boolean;setTab:(tab:HealthTab)=>void}){
  return <div className="healthPage">
    <Header title="Sănătate"/>
    <section className="healthHero"><div><time>{new Date().toLocaleDateString('ro-RO',{timeZone:'Europe/Bucharest',weekday:'long',day:'numeric',month:'long',year:'numeric'})}</time><h2>Tot ce ține de sănătate</h2><p>Vizite, date vitale și documente medicale, într-un singur loc.</p><span className="healthHeroPill"><HeartPulse size={17}/>Simplu și privat</span></div><div className="healthHeroArt"><HeartPulse size={64}/></div></section>
    <div className="healthMetricGrid">
      <button className="healthMetricCard" onClick={()=>setTab('data')}><div className="healthMetricIcon"><HeartPulse size={23}/></div><div className="healthMetricCopy"><span>Puls în repaus</span><strong>—</strong><em>Fără date</em></div><ChevronRight size={18}/></button>
      <button className="healthMetricCard" onClick={()=>setTab('data')}><div className="healthMetricIcon"><Activity size={23}/></div><div className="healthMetricCopy"><span>Somn</span><strong>—</strong><em>Fără date</em></div><ChevronRight size={18}/></button>
    </div>
    <section className="healthCard"><header><h3>Următoarea vizită</h3><button onClick={()=>setTab('visits')}>Vezi toate <ChevronRight size={16}/></button></header><button className="healthEmptyRow" onClick={()=>setTab('visits')}><span>Nicio vizită programată</span><ChevronRight size={18}/></button></section>
    <section className="healthCard healthDocsPreview"><header><h3>Documente medicale</h3><button onClick={()=>setTab('documents')}>Vezi toate <ChevronRight size={16}/></button></header>{loading?<p className="healthMuted">Se încarcă…</p>:documents.length?documents.slice(0,3).map(document=><button key={document.id} onClick={()=>setTab('documents')}><div className="healthSquareIcon document"><FileText size={20}/></div><div><strong>{healthDocumentTitle(document)}</strong><span>{document.issuer||document.source_filename||'Document medical'}</span></div><ChevronRight size={18}/></button>):<button className="healthEmptyRow" onClick={()=>setTab('documents')}><span>Niciun document medical</span><ChevronRight size={18}/></button>}</section>
  </div>
}

function Simple({title,subtitle,icon}:{title:string;subtitle:string;icon:React.ReactNode}){
  return <div className="healthPage"><Header title={title} subtitle={subtitle}/><div className="healthEmptyPanel">{icon}<strong>Modul pregătit</strong><button><Plus size={17}/>Adaugă</button></div></div>
}

function Documents({documents,loading}:{documents:DocumentRow[];loading:boolean}){
  return <div className="healthPage"><Header title="Documente" subtitle="Analize, imagistică, rețete și alte acte medicale."/><section className="healthDocumentList">{loading?<p className="healthMuted">Se încarcă…</p>:documents.length?documents.map(document=><button key={document.id}><div className="healthSquareIcon document"><FileText size={21}/></div><div><strong>{healthDocumentTitle(document)}</strong><span>{document.issuer||document.source_filename||'Document medical'}</span></div><ChevronRight size={18}/></button>):<div className="healthEmptyPanel"><FileText size={34}/><strong>Niciun document</strong></div>}</section></div>
}
