'use client'

import { useEffect, useRef, useState } from 'react'
import { X, FileText, ChevronRight, HandCoins, Repeat2 } from 'lucide-react'
import type { MyLifeData, Transaction } from '@/lib/mylife-data'
import './TransactionDetails.css'
import TransactionEditor from './TransactionEditor'
import {getSupabaseClient} from '@/lib/supabase'
import {balanceChange} from '@/lib/transaction-edit'
import { transferLabel } from '@/lib/transfers'
import ConfirmDialog from './ConfirmDialog'

export default function TransactionDetails({ transaction: tx, data, onClose, onOpenDocument, onSaved, onSeen }: { transaction: Transaction; data: MyLifeData | null; onSaved: () => void; onSeen?: () => void; onClose: () => void; onOpenDocument: (id: string) => void }) {
  const [deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState('')
  async function remove(){const client=getSupabaseClient();if(!client||saving)return;setSaving(true);setDeleteError('');try{const {error}=await client.rpc('finance_delete_transaction',{p_id:tx.id,p_expected_updated_at:tx.updated_at});if(error)throw Error(error.message);onClose();onSaved()}catch(e){setDeleteError(e instanceof Error?e.message:'Ștergerea nu a reușit.')}finally{setSaving(false)}}
  const [editing,setEditing]=useState(false)
  const [saving,setSaving]=useState(false)
  const existingRule=(data?.recurringRules??[]).find(rule=>rule.source_transaction_id===tx.id)
  const [recurring,setRecurring]=useState(existingRule?.is_active===true),[recurringBusy,setRecurringBusy]=useState(false),[recurringError,setRecurringError]=useState('')
  const [recurringOpen,setRecurringOpen]=useState(false)
  const [recurringFrequency,setRecurringFrequency]=useState(existingRule?.frequency==='weekly'?'weekly':existingRule?.frequency==='quarterly'?'quarterly':'monthly')
  const recurringFrequencyLabel=recurringFrequency==='weekly'?'Săptămânal':recurringFrequency==='quarterly'?'La 3 luni':'Lunar'
  const recurringBusyRef=useRef(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const seenRequestSent = useRef(false)
  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => {
    const unseen=tx.unseen===true||tx.unseen==='true'
    if(!unseen||!tx.enable_banking_transaction_id||seenRequestSent.current)return
    seenRequestSent.current=true
    let cancelled=false
    async function markSeen(){
      try{
        const client=getSupabaseClient()
        if(!client){seenRequestSent.current=false;return}
        const {data:{session}}=await client.auth.getSession()
        if(!session?.access_token){seenRequestSent.current=false;return}
        const response=await fetch(`/api/finance/transactions/${tx.id}/seen`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}})
        if(response.ok&&!cancelled)onSeen?.()
        else if(!response.ok)seenRequestSent.current=false
      }catch{
        seenRequestSent.current=false
      }
    }
    void markSeen()
    return()=>{cancelled=true}
  },[tx.id,tx.unseen,tx.enable_banking_transaction_id,onSeen])
  const account = data?.accounts.find(item => item.id === tx.account_id) ?? tx.source_account
  const document = data?.documents.find(item => item.id === tx.attachment_document_id)
  const splits = data?.splits.filter(item => item.transaction_id === tx.id) ?? []
  const money = (amount: number | string) => new Intl.NumberFormat('ro-RO', { style: 'currency', currency: tx.currency.trim() }).format(Number(amount))
  const date = new Date(tx.transaction_date).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', ...(tx.date_precision === 'date' ? { day: 'numeric', month: 'long', year: 'numeric' } : {}) })
  const type = ({ expense: 'Cheltuială', income: 'Venit', transfer: 'Transfer' } as Record<string,string>)[tx.transaction_type] ?? tx.transaction_type
  const nextRecurringDue=(frequency:string)=>{
    const source=new Date(tx.transaction_date)
    if(frequency==='weekly')return new Date(source.getTime()+7*86400000).toISOString().slice(0,10)
    const months=frequency==='quarterly'?3:1
    const targetMonth=new Date(Date.UTC(source.getUTCFullYear(),source.getUTCMonth()+months,1))
    const lastDay=new Date(Date.UTC(targetMonth.getUTCFullYear(),targetMonth.getUTCMonth()+1,0)).getUTCDate()
    return new Date(Date.UTC(targetMonth.getUTCFullYear(),targetMonth.getUTCMonth(),Math.min(source.getUTCDate(),lastDay))).toISOString().slice(0,10)
  }
  async function saveRecurring(){
    const client=getSupabaseClient();if(!client||!data||recurringBusyRef.current)return
    recurringBusyRef.current=true;setRecurringBusy(true);setRecurringError('')
    try{
      const primarySplit=[...splits].sort((a,b)=>Number(b.amount)-Number(a.amount))[0]
      const payload={household_id:data.profile.householdId,source_transaction_id:tx.id,account_id:tx.account_id??null,category_id:primarySplit?.category_id??null,kind:'expense',name:tx.title?.trim()||tx.merchant||tx.description||'Cheltuială recurentă',expected_amount:Number(tx.amount),currency:tx.currency.trim(),frequency:recurringFrequency,next_due_date:nextRecurringDue(recurringFrequency),forecast_months:2,is_active:true}
      const {error}=await client.from('finance_recurring_rules').upsert(payload,{onConflict:'source_transaction_id'})
      if(error)throw Error(error.message)
      setRecurring(true)
      onClose();onSaved()
    }catch(error){setRecurringError(error instanceof Error?error.message:'Recurența nu a putut fi salvată.')}finally{recurringBusyRef.current=false;setRecurringBusy(false)}
  }
  async function removeRecurring(){
    const client=getSupabaseClient();if(!client||recurringBusyRef.current)return
    recurringBusyRef.current=true;setRecurringBusy(true);setRecurringError('')
    try{
      const {error}=await client.from('finance_recurring_rules').delete().eq('source_transaction_id',tx.id)
      if(error)throw Error(error.message)
      setRecurring(false);setRecurringOpen(false);onClose();onSaved()
    }catch(error){setRecurringError(error instanceof Error?error.message:'Recurența nu a putut fi oprită.')}finally{recurringBusyRef.current=false;setRecurringBusy(false)}
  }
  return <dialog ref={dialog} className="transactionDetails" aria-labelledby="transaction-details-title" onClose={onClose} onCancel={event=>{if(saving)event.preventDefault()}} onClick={event => { if (!saving && event.target === event.currentTarget) dialog.current?.close() }}>
    <header><div>{!editing&&<p>DETALII TRANZACȚIE</p>}<h2 id="transaction-details-title">{editing?'Editează tranzacția':tx.title?.trim() || (tx.transaction_type==='transfer' ? transferLabel(tx,data?.accounts??[]) : tx.merchant || tx.description || 'Tranzacție')}</h2></div><button type="button" aria-label="Închide detaliile tranzacției" disabled={saving} onClick={() => dialog.current?.close()}><X size={20}/></button></header>
    {editing && data ? <TransactionEditor onSavingChange={setSaving} transaction={tx} data={data} onCancel={()=>setEditing(false)} onSaved={()=>{onClose();onSaved()}}/> : <>
    {data?.source!=='live'&&<p className="transactionDetailsEmpty">Conectează live pentru editare.</p>}
    <strong className="transactionDetailsAmount">{tx.transaction_type === 'expense' ? '−' : tx.transaction_type === 'income' ? '+' : ''}{money(tx.amount)}</strong>
    {(tx.imported_from||tx.enable_banking_transaction_id)&&<p className="transactionImportedDetail">Importată din {tx.imported_from||'Revolut'}</p>}
    {tx.loan_id&&<p className="transactionLoanDetail"><HandCoins size={17}/>{tx.loan_kind==='repayment'?'Rambursare legată de împrumut':'Tranzacția inițială a împrumutului'}</p>}
    <p className="transactionDetailsEmpty">{tx.affects_balance===false||tx.affects_balance==='false'?'Nu afectează soldul actual':'Afectează soldul actual'}</p><dl><div><dt>Tip</dt><dd>{type}</dd></div><div><dt>Data</dt><dd>{date}</dd></div>{account && <div><dt>{tx.transaction_type==='transfer'?'Din contul':'Cont'}</dt><dd>{account.name}</dd></div>}{tx.transaction_type==='transfer' && <div><dt>În contul</dt><dd>{tx.destination_account?.name ?? data?.accounts.find(item=>item.id===tx.transfer_account_id)?.name ?? 'Cont destinație indisponibil'}</dd></div>}{tx.merchant && <div><dt>{tx.enable_banking_transaction_id||tx.imported_from?'Comerciant · date bancă':'Comerciant'}</dt><dd>{tx.merchant}</dd></div>}{tx.description && <div><dt>{tx.enable_banking_transaction_id||tx.imported_from?'Descriere originală · date bancă':'Descriere'}</dt><dd>{tx.description}</dd></div>}</dl>
    {splits.length > 0 && <section><h3>Categorii</h3>{splits.map(split => { const category = data?.categories.find(item => item.id === split.category_id); const parent = data?.categories.find(item => item.id === category?.parent_id); return <div className="transactionDetailsCategory" key={split.id}><span>{parent ? `${parent.name} → ` : ''}{category?.name ?? 'Fără categorie'}</span><strong>{money(split.amount)}</strong></div> })}</section>}
    {tx.transaction_type==='expense'&&data?.source==='live'&&<section className={`transactionRecurring ${recurring?'is-active':'is-inactive'}`}><div className="transactionRecurringIntro"><Repeat2 size={19}/><span><span className="transactionRecurringHeading"><strong>Cheltuială recurentă</strong><span className={`transactionRecurringStatus ${recurring?'active':'inactive'}`}>{recurring?'Activă':'Inactivă'}</span>{recurring&&<span className="transactionRecurringFrequency">{recurringFrequencyLabel}</span>}</span><small>{recurring?'Previziunea este pornită. Plata reală înlocuiește automat previziunea.':'Această tranzacție nu generează previziuni.'}</small></span></div><button type="button" className="transactionRecurringConfigure" aria-expanded={recurringOpen} disabled={recurringBusy} onClick={()=>{setRecurringOpen(open=>!open);setRecurringError('')}}>{recurring?'Editează':'Configurează'}</button>{recurringOpen&&<div className="transactionRecurringPanel"><span className="transactionRecurringLabel">Cât de des se repetă?</span><div className="transactionRecurringOptions" role="radiogroup" aria-label="Frecvența cheltuielii recurente">{([['weekly','Săptămânal'],['monthly','Lunar'],['quarterly','La 3 luni']] as const).map(([value,label])=><button key={value} type="button" role="radio" aria-checked={recurringFrequency===value} className={recurringFrequency===value?'selected':''} onClick={()=>setRecurringFrequency(value)}>{label}</button>)}</div><div className="transactionRecurringActions"><button type="button" className="transactionRecurringSave" disabled={recurringBusy} onClick={()=>void saveRecurring()}>{recurringBusy?'Se salvează…':'Salvează recurența'}</button>{recurring&&<button type="button" className="transactionRecurringRemove" disabled={recurringBusy} onClick={()=>void removeRecurring()}>Oprește recurența</button>}<button type="button" disabled={recurringBusy} onClick={()=>setRecurringOpen(false)}>Renunță</button></div></div>}{recurringError&&<p role="alert">{recurringError}</p>}</section>}
    <section><h3>Document asociat</h3>{tx.attachment_document_id ? document ? <button type="button" className="transactionDocumentLink" onClick={() => { onClose(); onOpenDocument(document.id) }}><FileText size={22}/><span><strong>{document.source_filename || document.document_type}</strong><small>{document.storage_path ? 'Vezi documentul și metadata' : 'Metadata salvată · fișier încă neatașat'}</small></span><ChevronRight size={18}/></button> : <p className="transactionDetailsEmpty">Documentul asociat nu este disponibil pentru acest cont.</p> : <p className="transactionDetailsEmpty">Nu există un document asociat acestei tranzacții.</p>}</section>
    <div className="transactionDetailsActions">
      <button type="button" className="transactionEditButton" disabled={data?.source!=='live'||!tx.updated_at} onClick={()=>setEditing(true)}>Editează tranzacția</button>
      <button type="button" className="transactionEditButton transactionDeleteButton" disabled={data?.source!=='live'||!tx.updated_at||saving} onClick={()=>setDeleting(true)}>Șterge tranzacția</button>
    </div>
    <ConfirmDialog open={deleting} danger busy={saving} title="Ștergi această tranzacție?" description={<>Tranzacția va fi eliminată din liste și rapoarte. Acțiunea nu poate fi anulată din aplicație. {Object.keys(balanceChange(tx,{...tx,status:'void'})).length?'Soldurile se vor actualiza:':'Soldurile nu se schimbă.'}</>} confirmLabel={saving?'Se șterge…':'Confirmă ștergerea'} onConfirm={()=>void remove()} onCancel={()=>{setDeleting(false);setDeleteError('')}}>{Object.entries(balanceChange(tx,{...tx,status:'void'})).map(([id,delta])=><p key={id}><strong>{data?.accounts.find(a=>a.id===id)?.name}:</strong> {money(delta)}</p>)}{deleteError&&<p role="alert">{deleteError}</p>}</ConfirmDialog>
    </>}
  </dialog>
}
