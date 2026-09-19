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
  const swipeStart = useRef<{x:number;y:number;at:number;axis:'x'|'y'|null;currentX:number;previousX:number;previousAt:number;lastAt:number}|null>(null)
  const swipeSurface = useRef<HTMLElement|null>(null)
  const swipeResetTimer = useRef<number|null>(null)
  const [collapsedMonths,setCollapsedMonths]=useState<Set<string>>(()=>new Set())
  useEffect(()=>setCollapsedMonths(new Set()),[account.id])
  useEffect(()=>()=>{if(swipeResetTimer.current!==null)window.clearTimeout(swipeResetTimer.current)},[])
  const allCollapsed=months.length>0&&months.every(group=>collapsedMonths.has(group.month))
  const toggleMonth=(month:string)=>setCollapsedMonths(current=>{const next=new Set(current);if(next.has(month))next.delete(month);else next.add(month);return next})

  return <section
    ref={swipeSurface}
    className="accountTransactions"
    aria-label={`Tranzacțiile ${account.name}`}
    onTouchStart={event=>{
      if(swipeResetTimer.current!==null){window.clearTimeout(swipeResetTimer.current);swipeResetTimer.current=null}
      const touch=event.touches[0]
      if(!touch||touch.clientX>36){swipeStart.current=null;return}
      const now=Date.now()
      swipeStart.current={x:touch.clientX,y:touch.clientY,at:now,axis:null,currentX:0,previousX:0,previousAt:now,lastAt:now}
    }}
    onTouchMove={event=>{
      const start=swipeStart.current
      const touch=event.touches[0]
      const surface=swipeSurface.current
      if(!start||!touch||!surface)return
      const dx=Math.max(0,touch.clientX-start.x)
      const dy=touch.clientY-start.y
      if(start.axis===null){
        if(Math.max(dx,Math.abs(dy))<8)return
        start.axis=dx>Math.abs(dy)*1.08?'x':'y'
      }
      if(start.axis!=='x')return
      event.preventDefault()
      const now=Date.now()
      start.previousX=start.currentX
      start.previousAt=start.lastAt
      start.currentX=Math.min(dx,surface.clientWidth)
      start.lastAt=now
      surface.classList.remove('isSwipeBackSnapping','isSwipeBackCompleting')
      surface.classList.add('isSwipeBackDragging')
      surface.style.setProperty('--swipe-back-x',`${start.currentX}px`)
    }}
    onTouchEnd={event=>{
      const start=swipeStart.current
      swipeStart.current=null
      const surface=swipeSurface.current
      const touch=event.changedTouches[0]
      if(!start||!surface||start.axis!=='x'||!touch)return
      const width=Math.max(surface.clientWidth,1)
      const dx=Math.max(start.currentX,touch.clientX-start.x)
      const sampleMs=Math.max(start.lastAt-start.previousAt,1)
      const velocity=(start.currentX-start.previousX)/sampleMs
      const complete=dx>=Math.min(width*.34,150)||(dx>=48&&velocity>.5)
      surface.classList.remove('isSwipeBackDragging')
      if(complete){
        surface.classList.add('isSwipeBackCompleting')
        surface.style.setProperty('--swipe-back-x',`${width}px`)
        swipeResetTimer.current=window.setTimeout(()=>{swipeResetTimer.current=null;onBack()},190)
      }else{
        surface.classList.add('isSwipeBackSnapping')
        surface.style.setProperty('--swipe-back-x','0px')
        swipeResetTimer.current=window.setTimeout(()=>{swipeResetTimer.current=null;surface.classList.remove('isSwipeBackSnapping')},240)
      }
    }}
    onTouchCancel={()=>{
      swipeStart.current=null
      const surface=swipeSurface.current
      if(!surface)return
      surface.classList.remove('isSwipeBackDragging','isSwipeBackCompleting')
      surface.classList.add('isSwipeBackSnapping')
      surface.style.setProperty('--swipe-back-x','0px')
      swipeResetTimer.current=window.setTimeout(()=>{swipeResetTimer.current=null;surface.classList.remove('isSwipeBackSnapping')},240)
    }}
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