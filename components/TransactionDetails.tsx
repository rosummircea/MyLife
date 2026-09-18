'use client'

import { useEffect, useRef, useState } from 'react'
import { X, FileText, ChevronRight } from 'lucide-react'
import type { MyLifeData, Transaction } from '@/lib/mylife-data'
import './TransactionDetails.css'
import TransactionEditor from './TransactionEditor'
import {getSupabaseClient} from '@/lib/supabase'
import {balanceChange} from '@/lib/transaction-edit'
import { transferLabel } from '@/lib/transfers'

export default function TransactionDetails({ transaction: tx, data, onClose, onOpenDocument, onSaved }: { transaction: Transaction; data: MyLifeData | null; onSaved: () => void; onClose: () => void; onOpenDocument: (id: string) => void }) {
  const [deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState('')
  async function remove(){const client=getSupabaseClient();if(!client||saving)return;setSaving(true);setDeleteError('');try{const {error}=await client.rpc('finance_delete_transaction',{p_id:tx.id,p_expected_updated_at:tx.updated_at});if(error)throw Error(error.message);onClose();onSaved()}catch(e){setDeleteError(e instanceof Error?e.message:'Ștergerea nu a reușit.')}finally{setSaving(false)}}
  const [editing,setEditing]=useState(false)
  const [saving,setSaving]=useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  const account = data?.accounts.find(item => item.id === tx.account_id) ?? tx.source_account
  const document = data?.documents.find(item => item.id === tx.attachment_document_id)
  const splits = data?.splits.filter(item => item.transaction_id === tx.id) ?? []
  const money = (amount: number | string) => new Intl.NumberFormat('ro-RO', { style: 'currency', currency: tx.currency.trim() }).format(Number(amount))
  const date = new Date(tx.transaction_date).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', ...(tx.date_precision === 'date' ? { day: 'numeric', month: 'long', year: 'numeric' } : {}) })
  const type = ({ expense: 'Cheltuială', income: 'Venit', transfer: 'Transfer' } as Record<string,string>)[tx.transaction_type] ?? tx.transaction_type
  return <dialog ref={dialog} className="transactionDetails" aria-labelledby="transaction-details-title" onClose={onClose} onCancel={event=>{if(saving)event.preventDefault()}} onClick={event => { if (!saving && event.target === event.currentTarget) dialog.current?.close() }}>
    <header><div>{!editing&&<p>DETALII TRANZACȚIE</p>}<h2 id="transaction-details-title">{editing?'Editează tranzacția':tx.title?.trim() || (tx.transaction_type==='transfer' ? transferLabel(tx,data?.accounts??[]) : tx.merchant || tx.description || 'Tranzacție')}</h2></div><button type="button" aria-label="Închide detaliile tranzacției" disabled={saving} onClick={() => dialog.current?.close()}><X size={20}/></button></header>
    {editing && data ? <TransactionEditor onSavingChange={setSaving} transaction={tx} data={data} onCancel={()=>setEditing(false)} onSaved={()=>{setEditing(false);onSaved()}}/> : <>
    <button type="button" className="transactionEditButton" disabled={data?.source!=='live'||!tx.updated_at} onClick={()=>setEditing(true)}>Editează tranzacția</button>
    <button type="button" className="transactionEditButton transactionDeleteButton" disabled={data?.source!=='live'||!tx.updated_at||saving} onClick={()=>setDeleting(true)}>Șterge tranzacția</button>
    {deleting&&<section className="transactionDeleteConfirm"><h3>Ștergi această tranzacție?</h3><p>Atenție: tranzacția va fi eliminată din liste și rapoarte. Această acțiune nu poate fi anulată din aplicație. {Object.keys(balanceChange(tx,{...tx,status:'void'})).length?'Soldurile se vor actualiza:':'Soldurile nu se schimbă.'}</p>{Object.entries(balanceChange(tx,{...tx,status:'void'})).map(([id,delta])=><p key={id}>{data?.accounts.find(a=>a.id===id)?.name}: {money(delta)}</p>)}<button disabled={saving} onClick={()=>void remove()}>{saving?'Se șterge…':'Confirmă ștergerea'}</button><button disabled={saving} onClick={()=>setDeleting(false)}>Renunță</button>{deleteError&&<p role="alert">{deleteError}</p>}</section>}
    {data?.source!=='live'&&<p className="transactionDetailsEmpty">Conectează live pentru editare.</p>}
    <strong className="transactionDetailsAmount">{tx.transaction_type === 'expense' ? '−' : tx.transaction_type === 'income' ? '+' : ''}{money(tx.amount)}</strong>
    <p className="transactionDetailsEmpty">{tx.affects_balance===false||tx.affects_balance==='false'?'Nu afectează soldul actual':'Afectează soldul actual'}</p><dl><div><dt>Tip</dt><dd>{type}</dd></div><div><dt>Data</dt><dd>{date}</dd></div>{account && <div><dt>{tx.transaction_type==='transfer'?'Din contul':'Cont'}</dt><dd>{account.name}</dd></div>}{tx.transaction_type==='transfer' && <div><dt>În contul</dt><dd>{tx.destination_account?.name ?? data?.accounts.find(item=>item.id===tx.transfer_account_id)?.name ?? 'Cont destinație indisponibil'}</dd></div>}{tx.merchant && <div><dt>Comerciant</dt><dd>{tx.merchant}</dd></div>}{tx.description && <div><dt>Descriere</dt><dd>{tx.description}</dd></div>}</dl>
    {splits.length > 0 && <section><h3>Categorii</h3>{splits.map(split => { const category = data?.categories.find(item => item.id === split.category_id); const parent = data?.categories.find(item => item.id === category?.parent_id); return <div className="transactionDetailsCategory" key={split.id}><span>{parent ? `${parent.name} → ` : ''}{category?.name ?? 'Fără categorie'}</span><strong>{money(split.amount)}</strong></div> })}</section>}
    <section><h3>Document asociat</h3>{tx.attachment_document_id ? document ? <button type="button" className="transactionDocumentLink" onClick={() => { onClose(); onOpenDocument(document.id) }}><FileText size={22}/><span><strong>{document.source_filename || document.document_type}</strong><small>{document.storage_path ? 'Vezi documentul și metadata' : 'Metadata salvată · fișier încă neatașat'}</small></span><ChevronRight size={18}/></button> : <p className="transactionDetailsEmpty">Documentul asociat nu este disponibil pentru acest cont.</p> : <p className="transactionDetailsEmpty">Nu există un document asociat acestei tranzacții.</p>}</section>
    </>}
  </dialog>
}
