'use client'
import {useEffect,useRef,useState} from 'react'
import type {MyLifeData,Transaction} from '@/lib/mylife-data'
import {bucharestDay} from '@/lib/expense-report'
import TransactionEditor,{type TransactionCreateMode} from './TransactionEditor'
import ReceiptCapture from './ReceiptCapture'
import './TransactionDetails.css'

export default function NewTransaction({data,onClose,onSaved,mode='standard',accountId}:{data:MyLifeData;onClose:()=>void;onSaved:()=>void;mode?:TransactionCreateMode;accountId?:string}){
 const dialog=useRef<HTMLDialogElement>(null),[saving,setSaving]=useState(false)
 const [transaction]=useState<Transaction>(()=>{
  const account=data.accounts.find(a=>a.id===accountId)??data.accounts[0]
  const transaction_type=mode==='transfer'?'transfer':mode==='adjustment'?'adjustment':'expense'
  return {id:crypto.randomUUID(),transaction_type,amount:0,currency:account?.currency.trim()??'RON',transaction_date:`${bucharestDay(new Date())}T12:00:00+03:00`,account_id:account?.id??'',transfer_account_id:null,merchant:null,description:null}
 })
 useEffect(()=>{dialog.current?.showModal()},[])
 const title=mode==='transfer'?'Transfer nou':mode==='adjustment'?'Ajustare sold':'Tranzacție nouă'
 return <dialog ref={dialog} className="transactionDetails" onClose={onClose} onCancel={e=>{if(saving)e.preventDefault()}} aria-label={title}><header><h2>{title}</h2><button disabled={saving} onClick={()=>dialog.current?.close()} aria-label="Închide">×</button></header>{mode==='standard'?<ReceiptCapture/>:null}<TransactionEditor creating createMode={mode} transaction={transaction} data={data} onCancel={onClose} onSaved={onSaved} onSavingChange={setSaving}/></dialog>
}