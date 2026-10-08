'use client'

import {CalendarDays,Car,Check,Clock3,FileText,HeartPulse,House,ReceiptText,ShieldCheck} from 'lucide-react'
import {useMemo,type ComponentType} from 'react'
import type {MyLifeData,Transaction} from '@/lib/mylife-data'
import {insurancePolicies,type InsuranceKind,type InsurancePolicy} from '@/lib/insurance-data'
import './InsuranceModule.css'

const kindIcons:Record<InsuranceKind,ComponentType<{size?:number;strokeWidth?:number}>>={
  health:HeartPulse,casco:Car,rca:ShieldCheck,home:House,other:ShieldCheck,
}

function todayBucharest(){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const get=(type:string)=>parts.find(part=>part.type===type)?.value??''
  return get('year')+'-'+get('month')+'-'+get('day')
}
function date(value:string){
  return new Date(value.slice(0,10)+'T12:00:00Z').toLocaleDateString('ro-RO',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'})
}
function shortDate(value:string){
  return new Date(value.slice(0,10)+'T12:00:00Z').toLocaleDateString('ro-RO',{day:'2-digit',month:'short',timeZone:'UTC'})
}
function timelineDate(value:string,today:string){
  const differentYear=value.slice(0,4)!==today.slice(0,4)
  return new Date(value.slice(0,10)+'T12:00:00Z').toLocaleDateString('ro-RO',{
    day:'2-digit',
    month:'short',
    ...(differentYear?{year:'2-digit' as const}:{}),
    timeZone:'UTC',
  })
}
function money(amount:number,currency:string){
  try{return new Intl.NumberFormat('ro-RO',{style:'currency',currency,maximumFractionDigits:2}).format(amount)}
  catch{return amount.toLocaleString('ro-RO',{maximumFractionDigits:2})+' '+currency}
}
function frequencyLabel(policy:InsurancePolicy){
  if(policy.totalInstallments!==null){
    const paid=Math.min(policy.totalInstallments,policy.totalInstallments-(policy.remainingInstallments??0))
    return paid+'/'+policy.totalInstallments+' rate plătite'
  }
  if(policy.frequency==='monthly')return policy.payments.length+' plăți · lunar'
  if(policy.frequency==='quarterly')return policy.payments.length+' plăți · trimestrial'
  if(policy.frequency==='yearly')return policy.payments.length+' plăți · anual'
  return policy.payments.length+' '+(policy.payments.length===1?'plată găsită':'plăți găsite')
}
function statusLabel(policy:InsurancePolicy){
  if(policy.status==='expired')return 'Expirată'
  if(policy.status==='expiring')return 'Expiră curând'
  if(policy.status==='active')return 'Activă'
  if(policy.frequency)return 'Activă'
  return 'Urmărită'
}

export default function InsuranceModule({data,loading,onOpenDocument,onOpenTransaction}:{data:MyLifeData|null;loading:boolean;onOpenDocument:(id:string)=>void;onOpenTransaction:(transaction:Transaction)=>void}){
  const today=todayBucharest()
  const policies=useMemo(()=>data?insurancePolicies(data,today):[],[data,today])
  const next=policies.flatMap(policy=>policy.nextPayment?[{...policy.nextPayment,title:policy.title}]:[]).sort((a,b)=>a.date.localeCompare(b.date))[0]
  const expiring=policies.filter(policy=>policy.status==='expiring').length

  if(loading&&!data)return <div className="insuranceEmpty" role="status">Se încarcă asigurările…</div>
  if(!data)return <div className="insuranceEmpty">Datele financiare nu sunt disponibile.</div>
  if(!policies.length)return <div className="insuranceEmpty"><ShieldCheck size={34}/><strong>Nu am găsit încă asigurări</strong><span>Tranzacțiile încadrate în categoria „Asigurări” vor apărea automat aici.</span></div>

  return <div className="insuranceWorkspace">
    <section className="insuranceIntro" aria-label="Rezumat asigurări">
      <div><span>DIN FINANȚE</span><h2>{policies.length} {policies.length===1?'asigurare urmărită':'asigurări urmărite'}</h2></div>
      <div className="insuranceIntroFacts">
        {next&&<div><Clock3 size={17}/><span>Următoarea plată</span><strong>{shortDate(next.date)} · {money(next.amount,next.currency)}</strong></div>}
        {expiring>0&&<div><CalendarDays size={17}/><span>Expiră în 45 zile</span><strong>{expiring} {expiring===1?'poliță':'polițe'}</strong></div>}
      </div>
    </section>

    <div className="insuranceList">
      {policies.map(policy=><InsuranceCard key={policy.id} policy={policy} today={today} onOpenDocument={onOpenDocument} onOpenTransaction={onOpenTransaction}/>)}
    </div>
  </div>
}

function InsuranceCard({policy,today,onOpenDocument,onOpenTransaction}:{policy:InsurancePolicy;today:string;onOpenDocument:(id:string)=>void;onOpenTransaction:(transaction:Transaction)=>void}){
  const Icon=kindIcons[policy.kind]
  const latest=policy.payments.at(-1)
  const paidEvents=policy.installments?.length?[]:policy.payments.slice(-4)
  const future=[
    ...(policy.nextPayment&&policy.nextPayment.date>today?[{kind:'next' as const,date:policy.nextPayment.date,label:'Rată',estimated:policy.nextPayment.estimated}]:[]),
    ...(policy.expiry&&policy.expiry>today?[{kind:'expiry' as const,date:policy.expiry,label:'Expiră',estimated:false}]:[]),
  ].sort((a,b)=>a.date.localeCompare(b.date))
  const paidSummary=policy.installments?.length?`${policy.installments.filter(item=>item.paid===true).length}/${policy.installments.length} rate plătite`:frequencyLabel(policy)
  const nextText=policy.remainingInstallments===0&&policy.totalInstallments!==null
    ? 'Achitată'
    : policy.nextPayment?date(policy.nextPayment.date):'—'
  const nextAmount=policy.nextPayment
    ? (policy.nextPayment.estimated?'estimativ · ':'')+money(policy.nextPayment.amount,policy.nextPayment.currency)
    : policy.remainingInstallments===0?'Nu mai sunt rate':'Nicio scadență înregistrată'

  return <article className={'insuranceCard insurance-'+policy.kind}>
    <header className="insuranceCardHeader">
      <div className="insuranceIdentity"><div className="insuranceIcon"><Icon size={22}/></div><div><span>{policy.categoryName.toUpperCase()}</span><h3>{policy.title}</h3><p>{policy.subtitle}</p></div></div>
      <div className="insuranceHeaderActions">
        <span className={'insuranceStatus '+policy.status}>{statusLabel(policy)}</span>
        {policy.document&&<button type="button" onClick={()=>onOpenDocument(policy.document!.id)}><FileText size={16}/> Poliță</button>}
      </div>
    </header>

    <div className="insuranceFacts">
      <div><span>Următoarea rată</span><strong>{nextText}</strong><small>{nextAmount}</small></div>
      <div><span>Ultima plată</span><strong>{latest?money(latest.amount,latest.currency):'—'}</strong><small>{latest?date(latest.date):'Fără plată găsită'}</small></div>
      <div><span>Expiră</span><strong>{policy.expiry?date(policy.expiry):'—'}</strong><small>{policy.expiry?statusLabel(policy):'Data nu este înregistrată'}</small></div>
    </div>

    <div className="insuranceProgress"><span>{paidSummary}</span>{policy.remainingInstallments!==null&&policy.remainingInstallments>0&&<strong>{policy.remainingInstallments} {policy.remainingInstallments===1?'rată rămasă':'rate rămase'}</strong>}</div>

    <div className="insuranceTimeline" aria-label={'Timeline '+policy.title}>
      {policy.installments?.filter(item=>item.date<=today).map(item=><div className={'insuranceMilestone '+(item.paid===true?'paid':item.date<today?'overdue':'next')} key={'installment-'+item.number} title={`Rata ${item.number} · ${money(item.amount,item.currency)}`}><span className="insuranceDot">{item.paid===true?<Check size={12}/>:item.date<today?'!':<ReceiptText size={12}/>}</span><strong>{timelineDate(item.date,today)}</strong><small>{`Rata ${item.number} · ${item.paid===true?'Plătită':item.date<today?'Neconfirmată':'Scadentă'}`}</small></div>)}
      {paidEvents.map(payment=>{
        const installment=policy.payments.findIndex(item=>item.id===payment.id)+1
        const showInstallment=policy.kind==='casco'||policy.kind==='home'
        return <button type="button" className="insuranceMilestone paid" key={payment.id} onClick={()=>onOpenTransaction(payment.transaction)} title="Deschide plata în Finanțe"><span className="insuranceDot"><Check size={12}/></span><strong>{timelineDate(payment.date,today)}</strong><small>{showInstallment?`Rata ${installment} · Plătit`:'Plătit'}</small></button>
      })}
      <div className="insuranceLine" aria-hidden="true"/>
      <div className="insuranceMilestone now" aria-current="date"><span className="insuranceDot"/><strong>Acum</strong><small>{shortDate(today)}</small></div>
      {policy.installments?.filter(item=>item.date>today).map(item=><div className={'insuranceMilestone '+(item.paid===true?'paid':item.date<today?'overdue':'next')} key={'installment-'+item.number} title={`Rata ${item.number} · ${money(item.amount,item.currency)}`}><span className="insuranceDot">{item.paid===true?<Check size={12}/>:item.date<today?'!':<ReceiptText size={12}/>}</span><strong>{timelineDate(item.date,today)}</strong><small>{`Rata ${item.number} · ${item.paid===true?'Plătită':item.date<today?'Neconfirmată':'Scadentă'}`}</small></div>)}
      {(policy.installments?.length?future.filter(event=>event.kind!=='next'):future).map(event=><div className={'insuranceMilestone '+event.kind} key={event.kind+event.date}><span className="insuranceDot">{event.kind==='next'?<ReceiptText size={12}/>:null}</span><strong>{timelineDate(event.date,today)}</strong><small>{event.label}{event.estimated?' ~':''}</small></div>)}
    </div>
  </article>
}
