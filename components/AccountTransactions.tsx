'use client'

import {useEffect,useRef,useState, type ReactNode} from 'react'
import type { Account, MyLifeData, Transaction } from '@/lib/mylife-data'
import { accountTransactionMonths } from '@/lib/account-transactions'
import { accountAmounts } from '@/lib/account-display'
import { ChevronDown } from 'lucide-react'
import TransactionsList from './TransactionsList'
import './AccountTransactions.css'

export default function AccountTransactions({ account, data, loading, onBack, onSelect, actions, management }: {
  actions?:ReactNode
  management?:ReactNode
  account: Account
  data: MyLifeData | null
  loading: boolean
  onBack: () => void
  onSelect: (transaction: Transaction) => void
}) {
  const months = accountTransactionMonths(data?.transactions ?? [], account.id)
  const { balance, color } = accountAmounts(account)
  const swipeStart = useRef<{x:number;y:number;at:number}|null>(null)
  const [collapsedMonths,setCollapsedMonths]=useState<Set<string>>(()=>new Set())
  useEffect(()=>setCollapsedMonths(new Set()),[account.id])
  const allCollapsed=months.length>0&&months.every(group=>collapsedMonths.has(group.month))
  const toggleMonth=(month:string)=>setCollapsedMonths(current=>{const next=new Set(current);if(next.has(month))next.delete(month);else next.add(month);return next})

  return <section
    className="accountTransactions"
    aria-label={`Tranzacțiile ${account.name}`}
    onTouchStart={event=>{
      const touch=event.touches[0]
      swipeStart.current=touch&&touch.clientX<=32?{x:touch.clientX,y:touch.clientY,at:Date.now()}:null
    }}
    onTouchEnd={event=>{
      const start=swipeStart.current
      swipeStart.current=null
      const touch=event.changedTouches[0]
      if(!start||!touch)return
      const dx=touch.clientX-start.x
      const dy=Math.abs(touch.clientY-start.y)
      if(dx>=72&&dy<=Math.max(64,dx*.6)&&Date.now()-start.at<=1000)onBack()
    }}
    onTouchCancel={()=>{swipeStart.current=null}}
  >
    <header className="accountTransactionsHeader"><div><div className="accountTransactionsTitle"><h2>{account.name}</h2>{actions}</div><p>Toate tranzacțiile · transferuri trimise și primite</p></div><div><span>Sold actual</span><strong className={`accountTransactionsBalance-${color}`}>{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: account.currency.trim() }).format(balance)}</strong></div></header>
    {management}
    {!loading&&months.length>0&&<div className="accountTransactionsListTools"><button type="button" onClick={()=>setCollapsedMonths(allCollapsed?new Set():new Set(months.map(group=>group.month)))}>{allCollapsed?'Extinde toate':'Restrânge toate'}</button></div>}
    {loading ? <div className="emptyState" role="status">Se încarcă tranzacțiile…</div> : !months.length ? <div className="emptyState">Nu există tranzacții înregistrate în acest cont.</div> : months.map(group => {
      const collapsed=collapsedMonths.has(group.month)
      const monthLabel=new Date(group.month + '-01T12:00:00Z').toLocaleDateString('ro-RO', { month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest' })
      return <section key={group.month} className="accountTransactionsMonth">
        <header><button type="button" className="accountTransactionsMonthToggle" aria-expanded={!collapsed} onClick={()=>toggleMonth(group.month)}><h3>{monthLabel}</h3><span>{group.transactions.length} tranzacții</span><ChevronDown size={18} aria-hidden="true"/></button></header>
        {!collapsed&&<TransactionsList accounts={data?.accounts ?? []} transactions={group.transactions} categories={data?.categories ?? []} splits={data?.splits ?? []} contextAccountId={account.id} onSelect={onSelect}/>}
      </section>
    })}
  </section>
}