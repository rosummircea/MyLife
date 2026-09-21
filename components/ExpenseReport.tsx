'use client'

import CategoryIcon from './CategoryIcon'
import { CalendarRange, ChevronRight } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { buildExpenseReport, bucharestDay, reportRange, distributionGradient, subcategoryDistribution, type ExpenseCategory, type ReportPeriod, type DateRange } from '@/lib/expense-report'
import type { MyLifeData, Transaction } from '@/lib/mylife-data'
import ExpenseTrendChart from './ExpenseTrendChart'
import TransactionsList from './TransactionsList'
import { contributionBucketKey, expenseContributionTransactions } from '@/lib/expense-transactions'
import './ExpenseReport.css'

function money(value: number) {
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', maximumFractionDigits: 2 }).format(value)
}

export default function ExpenseReport({ data, loading, onSelectTransaction }: { data: MyLifeData | null; loading: boolean; onSelectTransaction:(transaction:Transaction)=>void }) {
  const [showAllTransactions,setShowAllTransactions]=useState(false)
  const allTransactionsRef=useRef<HTMLDivElement>(null)
  const [period, setPeriod] = useState<ReportPeriod>('Lună')
  const [selected, setSelected] = useState<string | null>(null)
  const [anchor, setAnchor] = useState(() => bucharestDay(new Date()))
  const [customFrom, setCustomFrom] = useState(anchor)
  const [customTo, setCustomTo] = useState(anchor)
  const range = reportRange(period, anchor, { from: customFrom, to: customTo })
  const invalidRange = range.from > range.to
  const report = useMemo(() => {
    try {
      return { ...buildExpenseReport(data?.transactions ?? [], data?.categories ?? [], data?.splits ?? [], range), error: '' }
    } catch (error) {
      return { categories: [], total: 0, transactionCount: 0, excludedCurrencies: 0, error: error instanceof Error ? error.message : 'Raportul nu poate fi calculat.' }
    }
  }, [data, range.from, range.to])
  const allContributions=useMemo(()=>showAllTransactions&&data&&!report.error?expenseContributionTransactions(data.transactions,data.categories,data.splits,range):[],[showAllTransactions,data,range.from,range.to,report.error])
  const { categories, total } = report
  const gradient = distributionGradient(categories)
  const fromDate = new Date(`${range.from}T12:00:00Z`)
  const label = period === 'Lună' ? fromDate.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : period === 'An' ? range.from.slice(0, 4) : `${range.from} – ${range.to}`
  const percent = (value: number) => `${value.toLocaleString('ro-RO', { maximumFractionDigits: 1 })}%`
  const currentYear = Number(bucharestDay(new Date()).slice(0, 4))
  const years = [...new Set([Number(anchor.slice(0, 4)), ...Array.from({ length: 7 }, (_, index) => currentYear - 5 + index), ...(data?.transactions ?? []).map((tx) => Number(bucharestDay(new Date(tx.transaction_date)).slice(0, 4)))])].sort((a, b) => b - a)
  const changeYear = (year: string) => {
    const month = Number(anchor.slice(5, 7))
    const day = Math.min(Number(anchor.slice(8, 10)), new Date(Date.UTC(Number(year), month, 0)).getUTCDate())
    setAnchor(`${year}-${anchor.slice(5, 7)}-${String(day).padStart(2, '0')}`)
    setSelected(null)
  }


  return (
    <div className="reportWrap">
      <div className="reportToolbar">
        <div>
          <p className="eyebrow">RAPORT CHELTUIELI</p>
          <h2>Unde s-au dus banii</h2>
          <p className="subtitle">Cheltuieli în RON din tranzacțiile înregistrate.</p>
        </div>
        <div className="periodSwitch">
          {(['Zi','Săptămână','Lună','An','Custom'] as ReportPeriod[]).map((item) => <button key={item} className={period === item ? 'active' : ''} onClick={() => { setPeriod(item); setSelected(null) }}>{item === 'Custom' && <CalendarRange size={14}/>} {item}</button>)}
        </div>
      </div>

      <div className="reportHero">
        <div className="pieStage">
          {loading || !data || invalidRange || report.error ? <div className="emptyState" role="status">{loading ? 'Se încarcă raportul…' : invalidRange ? 'Data de început trebuie să fie înaintea datei de sfârșit.' : report.error || 'Conectează datele pentru a vedea raportul.'}</div> : <div className="pieChart" style={{ background: categories.length ? `conic-gradient(${gradient})` : 'var(--line)' }} aria-label="Distribuția cheltuielilor">
            <div className="pieHole"><span>Total cheltuieli</span><button className="expenseTotalButton" type="button" aria-expanded={showAllTransactions} aria-controls="expense-all-transactions" aria-label="Vezi tranzacțiile din totalul cheltuielilor" onClick={()=>{setShowAllTransactions(value=>!value);requestAnimationFrame(()=>allTransactionsRef.current?.scrollIntoView({behavior:'smooth',block:'start'}))}}><strong>{money(total)}</strong></button><small>{period}</small></div>
          </div>}
        </div>
        <div className="reportSummary">
          <span className="summaryLabel">Perioadă selectată</span>
          <strong>{label}</strong>
          <div className="expensePeriodControls">
            {(period === 'An' || period === 'Lună') ? <>
              <label>Anul<select aria-label="Anul" value={anchor.slice(0, 4)} onChange={(event) => changeYear(event.target.value)}>
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select></label>
              {period === 'Lună' && <label>Luna<select aria-label="Luna" value={anchor.slice(5, 7)} onChange={(event) => { setAnchor(`${anchor.slice(0, 4)}-${event.target.value}-01`); setSelected(null) }}>
                {Array.from({ length: 12 }, (_, index) => <option key={index} value={String(index + 1).padStart(2, '0')}>{new Date(Date.UTC(2026, index, 1)).toLocaleDateString('ro-RO', { month: 'long', timeZone: 'UTC' })}</option>)}
              </select></label>}
            </> : period === 'Custom' ? <>
              <label>De la<input type="date" value={customFrom} onChange={(event) => { if (event.target.value) { setCustomFrom(event.target.value); setSelected(null) } }}/></label>
              <label>Până la<input type="date" value={customTo} onChange={(event) => { if (event.target.value) { setCustomTo(event.target.value); setSelected(null) } }}/></label>
            </> : <label>{period === 'Zi' ? 'Ziua' : 'Alege o zi din săptămână'}<input type="date" value={anchor} onChange={(event) => { if (event.target.value) { setAnchor(event.target.value); setSelected(null) } }}/></label>}
          </div>
          {!loading && data && !invalidRange && !report.error && <>
          <div className="summaryMini"><span>Categorii</span><strong>{categories.length}</strong></div>
          <div className="summaryMini"><span>Tranzacții în raport</span><strong>{report.transactionCount}</strong></div>
          <div className="summaryMini"><span>Cea mai mare categorie</span><strong>{percent(categories[0]?.percent ?? 0)}</strong></div>
          </>}
        </div>
      </div>

      {!loading && data && !invalidRange && !report.error && <>
      {showAllTransactions&&<div id="expense-all-transactions" ref={allTransactionsRef} className="expenseContributionList"><header><div><h3>Tranzacții · Total cheltuieli</h3><p>{range.from} – {range.to} · {allContributions.length} tranzacții · Apasă pentru detalii și editare.</p></div><button className="expenseCategoryTrendButton" onClick={()=>setShowAllTransactions(false)}>Închide lista</button></header><TransactionsList accounts={data.accounts} categories={data.categories} splits={data.splits} transactions={allContributions.map(row=>row.transaction)} contributionAmounts={Object.fromEntries(allContributions.map(row=>[row.transaction.id,row.amount]))} onSelect={onSelectTransaction}/></div>}
      <div className="sectionTitle reportListTitle"><h2>Cheltuieli pe categorii</h2><span>click pentru detalii</span></div>
      <div className="expenseList">
        {categories.length === 0 && <div className="emptyState">Nu există cheltuieli în RON în perioada selectată.</div>}
        {categories.map((item) => {
          const expanded = selected === item.id
          return (
            <div className="expenseCategory" key={item.id}>
              <button type="button" id={`expense-trigger-${item.id}`} className={`expenseRow ${expanded ? 'selected' : ''}`} aria-expanded={expanded} aria-controls={`expense-details-${item.id}`} onClick={() => setSelected(expanded ? null : item.id)}>
                <CategoryIcon category={item}/>
                <div className="expenseName"><strong>{item.name}</strong><span>{percent(item.percent)} din total</span></div>
                <div className="expenseValue"><strong>{money(item.amount)}</strong><span>{percent(item.percent)}</span></div>
                <ChevronRight size={18} className="expenseChevron" aria-hidden="true"/>
              </button>
              <div id={`expense-details-${item.id}`} hidden={!expanded}>
                {expanded && <SubcategoryDetails onSelectTransaction={onSelectTransaction} category={item} data={data} range={range} period={period}/>}
              </div>
            </div>
          )
        })}
      </div>
      <p className="expenseReportNote">Raportul include tranzacțiile înregistrate, fără totalurile istorice importate separat.{report.excludedCurrencies > 0 && ` ${report.excludedCurrencies} cheltuieli în alte monede nu sunt incluse în totalul RON.`}</p>
      </>}
    </div>
  )
}

function SubcategoryDetails({ category, data, range, period, onSelectTransaction }: { category: ExpenseCategory; data: MyLifeData; range: DateRange; period: ReportPeriod; onSelectTransaction:(transaction:Transaction)=>void }) {
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(() => new Set())
  const [selectedBucket,setSelectedBucket]=useState<{key:string;unit:string;label:string}|null>(null)
  const [showCategoryTransactions,setShowCategoryTransactions]=useState(false)
  const [reportView, setReportView] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)
  const distribution = subcategoryDistribution(category)
  const gradient = distributionGradient(distribution)
  const subcategoryContributions = useMemo(() => new Map(distribution.filter(item => expandedSubcategories.has(item.id)).map(item => [item.id, expenseContributionTransactions(data.transactions, data.categories, data.splits, range, { categoryId: category.id, subcategoryId: item.id })])), [data, range.from, range.to, category, expandedSubcategories])
  const categoryContributions = useMemo(() => expenseContributionTransactions(data.transactions,data.categories,data.splits,range,{categoryId:category.id}).filter(row=>!selectedBucket||contributionBucketKey(row.transaction,selectedBucket.unit)===selectedBucket.key),[data,range.from,range.to,category.id,selectedBucket])
  const categoryContributionTotal=categoryContributions.reduce((sum,row)=>sum+Math.round(row.amount*100),0)/100
  const [fromYear, fromMonth] = range.from.split('-').map(Number)
  const [toYear, toMonth] = range.to.split('-').map(Number)
  const monthCount = Math.max(1, (toYear - fromYear) * 12 + toMonth - fromMonth + 1)
  const monthlyAverage = Math.round(category.amount * 100 / monthCount) / 100
  const showReport = (index: number) => {
    setReportView(index)
    carouselRef.current?.scrollTo({ left: carouselRef.current.clientWidth * index, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  const toggleSubcategory = (id: string) => {
    const closing = expandedSubcategories.has(id)
    setExpandedSubcategories(current => {
      const next = new Set(current)
      if (closing) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="expenseDetails" aria-labelledby={`expense-trigger-${category.id}`}>
      <div className="expenseReportDeck">
        <header className="expenseReportDeckHeader">
          <div><p className="expenseTrendEyebrow">RAPOARTE CATEGORIE</p><h3>{category.name}</h3><p>Glisează pentru a schimba reprezentarea.</p></div>
          <div className="expenseReportDeckTotals"><span>Total în perioadă</span><strong>{money(category.amount)}</strong><small>Medie pe lună · {money(monthlyAverage)}</small></div>
        </header>
        <div className="expenseReportViewSwitch" role="tablist" aria-label="Tipul graficului">
          <button type="button" role="tab" aria-selected={reportView===0} onClick={()=>showReport(0)}>Distribuție</button>
          <button type="button" role="tab" aria-selected={reportView===1} onClick={()=>showReport(1)}>Evoluție</button>
        </div>
        <div className="expenseReportCarousel" ref={carouselRef} onScroll={event => {
          const element = event.currentTarget
          const next = Math.round(element.scrollLeft / Math.max(1, element.clientWidth))
          if (next !== reportView) setReportView(next)
        }}>
          <section className="expenseReportSlide expenseReportPieSlide" aria-label={`Distribuția subcategoriilor pentru ${category.name}`}>
            <div className="expenseSubchart" role="img" aria-label={`Distribuția subcategoriilor pentru ${category.name}: ${distribution.map((item) => `${item.name} ${item.percent.toLocaleString('ro-RO')}%`).join(', ')}`} style={{ background: `conic-gradient(${gradient})` }}>
              <div className="expenseSubchartHole"><span>Total categorie</span><strong>{money(category.amount)}</strong></div>
            </div>
          </section>
          <section className="expenseReportSlide expenseReportTrendSlide" aria-label={`Evoluția cheltuielilor pentru ${category.name}`}>
            <ExpenseTrendChart
              compact
              key={`${category.id}-${range.from}-${range.to}-${period}`}
              data={data}
              range={range}
              period={period}
              target={{categoryId:category.id}}
              name={category.name}
              color={category.color}
              onSelectPoint={(key,unit,label)=>{
                setSelectedBucket({key,unit,label})
                setShowCategoryTransactions(true)
              }}
              onSelectTotal={()=>{
                setSelectedBucket(null)
                setShowCategoryTransactions(true)
              }}
            />
          </section>
        </div>
      </div>
      {showCategoryTransactions && <section className="expenseContributionList expenseCategoryPeriodTransactions" aria-label={`Tranzacțiile ${category.name}`}>
        <header>
          <div><h3>Tranzacții · {category.name}</h3><p>{selectedBucket?.label ?? `${range.from} – ${range.to}`} · {categoryContributions.length} tranzacții · Apasă pentru detalii și editare.</p></div>
          <div className="expenseContributionActions"><strong>{money(categoryContributionTotal)}</strong><button type="button" className="expenseCategoryTrendButton" onClick={()=>{setShowCategoryTransactions(false);setSelectedBucket(null)}}>Închide</button></div>
        </header>
        <TransactionsList accounts={data.accounts} categories={data.categories} splits={data.splits} transactions={categoryContributions.map(row=>row.transaction)} contributionAmounts={Object.fromEntries(categoryContributions.map(row=>[row.transaction.id,row.amount]))} onSelect={onSelectTransaction} emptyMessage="Nu există tranzacții pentru intervalul selectat."/>
      </section>}
      <div className="expenseSubcategories">
        <div className="expenseSubcategoryToolbar">
          <p className="expenseDetailsCaption">Subcategorii · % din {category.name}<br/>Apasă pentru tranzacțiile care compun suma.</p>
        </div>
        <ul>
          {distribution.map((item) => {
            const expanded = expandedSubcategories.has(item.id)
            const rows = subcategoryContributions.get(item.id) ?? []
            return (
            <li key={item.id} className="expenseSubcategory">
              <button type="button" id={`expense-subcategory-${item.id}`} className="expenseSubcategoryButton" aria-expanded={expanded} aria-controls={`expense-transactions-${item.id}`} onClick={() => toggleSubcategory(item.id)}>
                <span className="expenseSubcategorySwatch" aria-hidden="true" style={{backgroundColor:item.color}}/>
                <span className="expenseSubcategoryName">{item.name}</span>
                <strong>{money(item.amount)}</strong>
                <span className="expenseSubcategoryPercent">{item.percent.toLocaleString('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>
                <ChevronRight size={14} className="expenseChevron" aria-hidden="true"/>
              </button>
              <div id={`expense-transactions-${item.id}`} hidden={!expanded} className="expenseSubcategoryTransactions" role="region" aria-labelledby={`expense-subcategory-${item.id}`} style={{borderLeftColor:item.color}}>
                {expanded && <>
                  <p className="expenseInlineCaption">{rows.length} tranzacții · {range.from} – {range.to} · Apasă pentru detalii și editare.</p>
                  <TransactionsList accounts={data.accounts} categories={data.categories} splits={data.splits} transactions={rows.map(row=>row.transaction)} contributionAmounts={Object.fromEntries(rows.map(row=>[row.transaction.id,row.amount]))} onSelect={onSelectTransaction} emptyMessage="Nu există tranzacții pentru suma și perioada selectate."/>
                  {rows.some(row=>Math.round(row.amount*100)!==Math.round(Number(row.transaction.amount)*100)) && <p className="expenseReportNote">Sumele reprezintă partea repartizată aici; suma integrală este indicată separat.</p>}
                </>}
              </div>
            </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
