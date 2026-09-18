'use client'
import {useEffect,useRef,useState} from 'react'
import type {MyLifeData,Transaction} from '@/lib/mylife-data'
import {bucharestDay} from '@/lib/expense-report'
import TransactionEditor from './TransactionEditor'
import './TransactionDetails.css'
export default function NewTransaction({data,onClose,onSaved}:{data:MyLifeData;onClose:()=>void;onSaved:()=>void}){const dialog=useRef<HTMLDialogElement>(null),[saving,setSaving]=useState(false);const [transaction]=useState<Transaction>(()=>({id:crypto.randomUUID(),transaction_type:'expense',amount:0,currency:data.accounts[0]?.currency.trim()??'RON',transaction_date:`${bucharestDay(new Date())}T12:00:00+03:00`,account_id:data.accounts[0]?.id??'',merchant:null,description:null}));useEffect(()=>{dialog.current?.showModal()},[]);return <dialog ref={dialog} className="transactionDetails" onClose={onClose} onCancel={e=>{if(saving)e.preventDefault()}} aria-label="Adaugă tranzacție"><header><h2>Tranzacție nouă</h2><button disabled={saving} onClick={()=>dialog.current?.close()} aria-label="Închide">×</button></header><TransactionEditor creating transaction={transaction} data={data} onCancel={onClose} onSaved={onSaved} onSavingChange={setSaving}/></dialog>}
