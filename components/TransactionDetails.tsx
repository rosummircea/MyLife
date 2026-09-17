'use client'

import { useEffect, useRef } from 'react'
import { X, FileText, ChevronRight } from 'lucide-react'
import type { MyLifeData, Transaction } from '@/lib/mylife-data'
import './TransactionDetails.css'

export default function TransactionDetails({ transaction: tx, data, onClose, onOpenDocument }: { transaction: Transaction; data: MyLifeData | null; onClose: () => void; onOpenDocument: (id: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  const account = data?.accounts.find(item => item.id === tx.account_id)
  const document = data?.documents.find(item => item.id === tx.attachment_document_id)
  const splits = data?.splits.filter(item => item.transaction_id === tx.id) ?? []
  const money = (amount: number | string) => new Intl.NumberFormat('ro-RO', { style: 'currency', currency: tx.currency.trim() }).format(Number(amount))
  const date = new Date(tx.transaction_date).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', ...(tx.date_precision === 'date' ? { day: 'numeric', month: 'long', year: 'numeric' } : {}) })
  const type = ({ expense: 'Cheltuială', income: 'Venit', transfer: 'Transfer' } as Record<string,string>)[tx.transaction_type] ?? tx.transaction_type
  return <dialog ref={dialog} className="transactionDetails" aria-labelledby="transaction-details-title" onClose={onClose} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
    <header><div><p>DETALII TRANZACȚIE</p><h2 id="transaction-details-title">{tx.merchant || tx.description || 'Tranzacție'}</h2></div><button type="button" aria-label="Închide detaliile tranzacției" onClick={() => dialog.current?.close()}><X size={20}/></button></header>
    <strong className="transactionDetailsAmount">{tx.transaction_type === 'expense' ? '−' : tx.transaction_type === 'income' ? '+' : ''}{money(tx.amount)}</strong>
    <dl><div><dt>Tip</dt><dd>{type}</dd></div><div><dt>Data</dt><dd>{date}</dd></div>{account && <div><dt>Cont</dt><dd>{account.name}</dd></div>}{tx.merchant && <div><dt>Comerciant</dt><dd>{tx.merchant}</dd></div>}{tx.description && <div><dt>Descriere</dt><dd>{tx.description}</dd></div>}</dl>
    {splits.length > 0 && <section><h3>Categorii</h3>{splits.map(split => { const category = data?.categories.find(item => item.id === split.category_id); const parent = data?.categories.find(item => item.id === category?.parent_id); return <div className="transactionDetailsCategory" key={split.id}><span>{parent ? `${parent.name} → ` : ''}{category?.name ?? 'Fără categorie'}</span><strong>{money(split.amount)}</strong></div> })}</section>}
    <section><h3>Document asociat</h3>{tx.attachment_document_id ? document ? <button type="button" className="transactionDocumentLink" onClick={() => { onClose(); onOpenDocument(document.id) }}><FileText size={22}/><span><strong>{document.source_filename || document.document_type}</strong><small>{document.storage_path ? 'Vezi documentul și metadata' : 'Metadata salvată · fișier încă neatașat'}</small></span><ChevronRight size={18}/></button> : <p className="transactionDetailsEmpty">Documentul asociat nu este disponibil pentru acest cont.</p> : <p className="transactionDetailsEmpty">Nu există un document asociat acestei tranzacții.</p>}</section>
  </dialog>
}
