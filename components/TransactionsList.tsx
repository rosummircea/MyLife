'use client'

import Image from 'next/image'
import CategoryIcon from './CategoryIcon'
import { ArrowRight, Banknote, GripVertical, Landmark, UserRound } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Account, CategoryRow, SplitRow, Transaction } from '@/lib/mylife-data'
import { accountBank, accountOwner } from '@/lib/account-display'
import {categoryRoot,categoryAppearance} from '@/lib/category-display'
import { transferLabel } from '@/lib/transfers'
import './TransactionsList.css'

export default function TransactionsList({ accounts, transactions, categories, splits, emptyMessage = 'Nu există tranzacții disponibile.', onSelect, focusedId, contextAccountId, contributionAmounts, showDate = true, reorderMode = false, onMove }: {
  accounts: Account[]
  transactions: Transaction[]
  categories: CategoryRow[]
  splits: SplitRow[]
  emptyMessage?: string
  onSelect: (transaction: Transaction) => void
  focusedId?: string
  showDate?: boolean
  contextAccountId?: string
  contributionAmounts?: Record<string,number>
  reorderMode?: boolean
  onMove?: (draggedId:string,overId:string)=>void
}) {
  const [draggingId,setDraggingId] = useState<string|null>(null)
  const draggingIdRef = useRef<string|null>(null)
  const beginDrag = (event:React.PointerEvent<HTMLButtonElement>,id:string) => {
    if(!reorderMode||!onMove)return
    event.preventDefault()
    draggingIdRef.current=id
    setDraggingId(id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event:React.PointerEvent<HTMLButtonElement>,id:string) => {
    if(draggingIdRef.current!==id||!onMove)return
    event.preventDefault()
    const element=document.elementFromPoint(event.clientX,event.clientY)
    const target=element?.closest<HTMLElement>('[data-transaction-id]')
    const overId=target?.dataset.transactionId
    if(overId&&overId!==id)onMove(id,overId)
  }
  const endDrag = (event:React.PointerEvent<HTMLButtonElement>) => {
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)
    draggingIdRef.current=null
    setDraggingId(null)
  }
  const keyboardMove = (event:React.KeyboardEvent<HTMLButtonElement>,id:string) => {
    if(!onMove)return
    const index=transactions.findIndex(item=>item.id===id)
    if(event.key==='ArrowUp'&&index>0){event.preventDefault();onMove(id,transactions[index-1].id)}
    if(event.key==='ArrowDown'&&index>=0&&index<transactions.length-1){event.preventDefault();onMove(id,transactions[index+1].id)}
  }

  const categoriesById = new Map(categories.map(category => [category.id, category]))
  const allocations = new Map<string, SplitRow[]>()
  for (const split of splits) {
    const rows = allocations.get(split.transaction_id) ?? []
    rows.push(split)
    allocations.set(split.transaction_id, rows)
  }
  const categoryBadge = (id:string|null) => {
    const category=id?categoriesById.get(id):undefined
    const root=categoryRoot(id,categories)
    return {id:id??'uncategorized',root,label:!id?'Fără categorie':!category?'Categorie indisponibilă':category.parent_id?category.name:null}
  }
  return <div className="listPanel transactionList">
    {!transactions.length && <div className="emptyState">{emptyMessage}</div>}
    {transactions.map(tx => {
      const resolveAccount = (id: string | null | undefined, record: Transaction['source_account']): Account | null =>
        accounts.find(item => item.id === id) ?? (record ? {
          id: id ?? 'unavailable', account_type: 'unknown', opening_balance: 0,
          currency: tx.currency, credit_limit: null, ...record,
        } : null)
      const account = resolveAccount(tx.account_id, tx.source_account)
      const destination = resolveAccount(tx.transfer_account_id, tx.destination_account)
      const rows = allocations.get(tx.id) ?? []
      const badges = [...new Map(rows.map(split=>{const badge=categoryBadge(split.category_id);return [badge.id,badge] as const})).values()]
      if (tx.transaction_type === 'expense' || tx.transaction_type === 'income') {
        if (!rows.length || rows.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) < Math.round(Number(tx.amount) * 100)) {
          if (!badges.some(badge=>badge.id==='uncategorized')) badges.push(categoryBadge(null))
        }
      }
      const incoming = tx.transaction_type === 'income' || tx.transaction_type === 'adjustment' || (tx.transaction_type === 'transfer' && !!contextAccountId && tx.transfer_account_id === contextAccountId)
      const outgoing = tx.transaction_type === 'expense' || (tx.transaction_type === 'transfer' && !!contextAccountId && tx.account_id === contextAccountId)
      const displayedAmount = contributionAmounts?.[tx.id] ?? Number(tx.amount)
      const hasAmount = Math.abs(displayedAmount) > 0.000001
      const route = tx.transaction_type === 'transfer' ? transferLabel(tx, accounts) : null
      const title = tx.title?.trim() || route || tx.merchant || tx.description || 'Tranzacție'
      const unseen = tx.unseen === true || tx.unseen === 'true'
      const row = <button type="button" className={`listRow transactionRow ${route ? 'transactionRow-transfer' : ''} ${unseen ? 'transactionRow-unseen' : ''} ${focusedId === tx.id ? 'transactionFocused' : ''}`} id={`transaction-${tx.id}`} key={tx.id} tabIndex={reorderMode?-1:0} aria-disabled={reorderMode||undefined} onClick={() => { if(!reorderMode)onSelect(tx) }}>
        {route ? <span className="transactionTransferAccounts">
          <AccountIdentity account={account} direction="Din contul"/>
          <ArrowRight className="transactionTransferArrow" size={18} aria-hidden="true"/>
          <AccountIdentity account={destination} direction="În contul"/>
        </span> : <AccountIdentity account={account}/>}
        <div className="transactionRowInfo">
          <strong className="transactionRowTitle">{title}</strong>
          <span className="transactionRowAccount">{route || account?.name || 'Cont indisponibil'}</span>
          {(tx.imported_from||tx.enable_banking_transaction_id)&&<span className="transactionImportedBadge">Importată din {tx.imported_from||'Revolut'}</span>}
          {unseen&&<span className="transactionNewBadge">Nouă · deschide pentru detalii</span>}
          <span className="transactionRowCategories">{badges.length?badges.map(badge=><span className="transactionCategoryBadge" key={badge.id} style={{backgroundColor:badge.root?categoryAppearance(badge.root).color:'#8d98a8'}} title={badge.root?`${badge.root.name}${badge.label?' → '+badge.label:''}`:badge.label??undefined}>{badge.root&&<span className="transactionCategorySymbol" aria-hidden="true"><CategoryIcon category={badge.root}/></span>}<span className="transactionCategoryLabel">{badge.root?.name}{badge.root&&badge.label?' → ':''}{badge.label}</span></span>):tx.transaction_type==='transfer'?'Transfer între conturi':'Ajustare de sold'}</span>
          {showDate&&<span className="transactionRowDate">{new Date(tx.transaction_date).toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' })}</span>}
        </div>
        <strong className={`transactionRowAmount ${hasAmount&&outgoing ? 'transactionRowAmount-outgoing' : hasAmount&&incoming ? 'transactionRowAmount-incoming' : ''}`}>
          {hasAmount&&outgoing ? '−' : hasAmount&&incoming ? '+' : ''}{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: tx.currency.trim() }).format(displayedAmount)}
          {contributionAmounts?.[tx.id] !== undefined && Math.round(contributionAmounts[tx.id]*100)!==Math.round(Number(tx.amount)*100) && <small className="transactionContributionTotal">din {new Intl.NumberFormat('ro-RO',{style:'currency',currency:tx.currency.trim()}).format(Number(tx.amount))}</small>}
        </strong>
      </button>
      return reorderMode ? <div className={`transactionReorderItem ${draggingId===tx.id?'dragging':''}`} data-transaction-id={tx.id} key={tx.id}>
        <button type="button" className="transactionDragHandle" aria-label={`Mută ${title}. Folosește drag sau săgețile sus și jos.`} onPointerDown={event=>beginDrag(event,tx.id)} onPointerMove={event=>moveDrag(event,tx.id)} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={event=>keyboardMove(event,tx.id)}>
          <GripVertical size={20} aria-hidden="true"/>
        </button>
        {row}
      </div> : row
    })}
  </div>
}

function AccountIdentity({ account, direction }: { account: Account | null; direction?: string }) {
  const owner = account ? accountOwner(account) : null
  const bank = account ? accountBank(account) : null
  const label = `${direction ? direction + ': ' : ''}${account ? owner?.name + ' · ' + account.name : 'Cont indisponibil'}`
  return <span className="transactionAccountIdentity" role="img" aria-label={label} title={label}>
    <span className="transactionAccountBank">
      {bank?.icon ? <Image src={bank.icon} alt="" width={36} height={36}/> : account?.account_type === 'cash' ? <Banknote size={26}/> : <Landmark size={26}/>}
    </span>
    <span className="transactionAccountOwnerBadge">
      {owner?.photo ? <Image className="transactionAccountPortrait" src={owner.photo} alt="" width={24} height={24}/> : <UserRound size={14}/>}
    </span>
  </span>
}
