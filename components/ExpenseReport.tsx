'use client'

import CategoryIcon from './CategoryIcon'
import { CalendarRange, ChevronRight } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { buildExpenseReport, bucharestDay, reportRange, distributionGradient, subcategoryDistribution, type ExpenseCategory, type ReportPeriod, type DateRange } from '@/lib/expense-report'
import type { MyLifeData, Transaction } from '@/lib/mylife-data'
import ExpenseTrendChart from './ExpenseTrendChart'
import TransactionsList from './TransactionsList'
import { expenseContributionTransactions,contributionBucketKey } from '@/lib/expense-transactions'
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
  const periodDetail = period === 'Lună' ? new Date(`${anchor.slice(0,7)}-01T12:00:00Z`).toLocaleDateString('ro-RO', { month: 'long', timeZone: 'UTC' }) : period
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
        <div className="reportHeadingRow">
          <h2>Raport</h2>
          <div className="reportTypeSwitch" role="group" aria-label="Tip raport">
            <button type="button" className="active" aria-pressed="true">Cheltuieli</button>
            <button type="button" disabled title="Raportul de venituri va fi disponibil ulterior">Venituri</button>
          </div>
        </div>
        <div className="periodSwitch">
          {(['Lună','An','Custom'] as ReportPeriod[]).map((item) => <button key={item} className={period === item ? 'active' : ''} onClick={() => { setPeriod(item); setSelected(null) }}>{item === 'Custom' && <CalendarRange size={14}/>} {item}</button>)}
        </div>
      </div>

      <div className="reportHero">
        <div className="pieStage">
          {loading || !data || invalidRange || report.error ? <div className="emptyState" role="status">{loading ? 'Se încarcă raportul…' : invalidRange ? 'Data de început trebuie să fie înaintea datei de sfârșit.' : report.error || 'Conectează datele pentru a vedea raportul.'}</div> : <div className="pieChart" style={{ background: categories.length ? `conic-gradient(${gradient})` : 'var(--line)' }} aria-label="Distribuția cheltuielilor">
            <div className="pieHole"><span>Total cheltuieli</span><button className="expenseTotalButton" type="button" aria-expanded={showAllTransactions} aria-controls="expense-all-transactions" aria-label="Vezi tranzacțiile din totalul cheltuielilor" onClick={()=>{setShowAllTransactions(value=>!value);requestAnimationFrame(()=>allTransactionsRef.current?.scrollIntoView({behavior:'smooth',block:'start'}))}}><strong>{money(total)}</strong></button><small>{periodDetail}</small></div>
          </div>}
        </div>
        <div className="reportSummary">
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
        </div>
      </div>

      {!loading && data && !invalidRange && !report.error && <>
      {showAllTransactions&&<div id="expense-all-transactions" ref={allTransactionsRef} className="expenseContributionList"><header><div><h3>Tranzacții · Total cheltuieli</h3><p>{range.from} – {range.to} · {allContributions.length} tranzacții · Apasă pentru detalii și editare.</p></div><button className="expenseCategoryTrendButton" onClick={()=>setShowAllTransactions(false)}>Închide lista</button></header><TransactionsList accounts={data.accounts} categories={data.categories} splits={data.splits} transactions={allContributions.map(row=>row.transaction)} contributionAmounts={Object.fromEntries(allContributions.map(row=>[row.transaction.id,row.amount]))} onSelect={onSelectTransaction}/></div>}
      <div className="sectionTitle reportListTitle"><h2>Cheltuieli pe categorii</h2></div>
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
      </>}
    </div>
  )
}

function SubcategoryDetails({ category, data, range, period, onSelectTransaction }: { category: ExpenseCategory; data: MyLifeData; range: DateRange; period: ReportPeriod; onSelectTransaction:(transaction:Transaction)=>void }) {
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [showCategoryTransactions, setShowCategoryTransactions] = useState(false)
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(() => new Set())
  const [selectedBucket,setSelectedBucket]=useState<{key:string;unit:string;label:string}|null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const distribution = subcategoryDistribution(category)
  const gradient = distributionGradient(distribution)
  const selectedItem = distribution.find((item) => item.id === selectedSubcategory)
  const contributions = useMemo(()=>expenseContributionTransactions(data.transactions,data.categories,data.splits,range,{categoryId:category.id,subcategoryId:selectedItem?.id}).filter(row=>!selectedBucket||contributionBucketKey(row.transaction,selectedBucket.unit)===selectedBucket.key),[data,range.from,range.to,category.id,selectedItem?.id,selectedBucket])
  const subcategoryContributions = useMemo(() => new Map(distribution.filter(item => expandedSubcategories.has(item.id)).map(item => [item.id, expenseContributionTransactions(data.transactions, data.categories, data.splits, range, { categoryId: category.id, subcategoryId: item.id })])), [data, range.from, range.to, category, expandedSubcategories])
  const contributionTotal=contributions.reduce((sum,row)=>sum+Math.round(row.amount*100),0)/100
  const chartId = `expense-trend-${category.id}`
  const selectTrend = (id: string | null) => {
    setSelectedSubcategory(id)
    setShowCategoryTransactions(id === null)
    setSelectedBucket(null)
    requestAnimationFrame(() => chartRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }))
  }

  const toggleSubcategory = (id: string) => {
    const closing = expandedSubcategories.has(id)
    setExpandedSubcategories(current => {
      const next = new Set(current)
      if (closing) next.delete(id)
      else next.add(id)
      return next
    })
    setShowCategoryTransactions(false)
    setSelectedSubcategory(closing ? null : id)
    setSelectedBucket(null)
  }
  const scrollToContributions = () => requestAnimationFrame(() => {
    const element = selectedItem ? document.getElementById(`expense-transactions-${selectedItem.id}`) : chartRef.current
    element?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  })

  return (
    <section className="expenseDetails" aria-labelledby={`expense-trigger-${category.id}`}>
      <div className="expenseSubchart" role="img" aria-label={`Distribuția subcategoriilor pentru ${category.name}: ${distribution.map((item) => `${item.name} ${item.percent.toLocaleString('ro-RO')}%`).join(', ')}`} style={{ background: `conic-gradient(${gradient})` }}>
        <div className="expenseSubchartHole"><span>Total categorie</span><button type="button" className="expenseTotalButton" aria-label={`Vezi toate tranzacțiile categoriei ${category.name}`} onClick={()=>selectTrend(null)}><strong>{money(category.amount)}</strong></button></div>
      </div>
      <div className="expenseSubcategories">
        <div className="expenseSubcategoryToolbar">
          <p className="expenseDetailsCaption">Subcategorii · % din {category.name}<br/>Apasă pentru tranzacții și evoluția cheltuielilor.</p>
          <button type="button" className="expenseCategoryTrendButton" aria-pressed={!selectedItem} aria-controls={chartId} onClick={() => selectTrend(null)}>Toată categoria</button>
        </div>
        <ul>
          {distribution.map((item) => {
            const expanded = expandedSubcategories.has(item.id)
            const rows = selectedItem?.id === item.id ? contributions : subcategoryContributions.get(item.id) ?? []
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
                  {selectedItem?.id === item.id && selectedBucket && <div className="expenseInlineFilter"><span>{selectedBucket.label} · {money(contributionTotal)}</span><button className="expenseCategoryTrendButton" onClick={()=>setSelectedBucket(null)}>Toată perioada</button></div>}
                  <TransactionsList accounts={data.accounts} categories={data.categories} splits={data.splits} transactions={rows.map(row=>row.transaction)} contributionAmounts={Object.fromEntries(rows.map(row=>[row.transaction.id,row.amount]))} onSelect={onSelectTransaction} emptyMessage="Nu există tranzacții pentru suma și perioada selectate."/>
                  {rows.some(row=>Math.round(row.amount*100)!==Math.round(Number(row.transaction.amount)*100)) && <p className="expenseReportNote">Sumele reprezintă partea repartizată aici; suma integrală este indicată separat.</p>}
                </>}
              </div>
            </li>
            )
          })}
        </ul>
      </div>
      <div className="expenseTrendContainer" id={chartId} ref={chartRef}>
        {showCategoryTransactions && !selectedItem && <section className="expenseContributionList" aria-label={`Tranzacțiile ${category.name}`}>
          <header><div><h3>Tranzacții · {category.name}</h3><p>{range.from} – {range.to} · {contributions.length} tranzacții · Apasă pentru detalii și editare.{selectedBucket&&` · ${selectedBucket.label}`}</p>{selectedBucket&&<button className="expenseCategoryTrendButton" onClick={()=>setSelectedBucket(null)}>Toată perioada</button>}</div><strong>{money(contributionTotal)}</strong></header>
          <TransactionsList accounts={data.accounts} categories={data.categories} splits={data.splits} transactions={contributions.map(row=>row.transaction)} contributionAmounts={Object.fromEntries(contributions.map(row=>[row.transaction.id,row.amount]))} onSelect={onSelectTransaction} emptyMessage="Nu există tranzacții pentru suma și perioada selectate."/>
          {contributions.some(row=>Math.round(row.amount*100)!==Math.round(Number(row.transaction.amount)*100)) && <p className="expenseReportNote">Sumele afișate reprezintă partea repartizată în această subcategorie; suma integrală este indicată separat.</p>}
        </section>}

        <ExpenseTrendChart onSelectPoint={(key,unit,label)=>{setSelectedBucket({key,unit,label});if(!selectedItem)setShowCategoryTransactions(true);scrollToContributions()}} onSelectTotal={()=>{setSelectedBucket(null);if(!selectedItem)setShowCategoryTransactions(true);scrollToContributions()}} key={`${selectedItem?.id??category.id}-${range.from}-${range.to}`} data={data} range={range} period={period} target={{ categoryId: category.id, subcategoryId: selectedItem?.id }} name={selectedItem ? `${category.name} · ${selectedItem.name}` : category.name} color={selectedItem?.color ?? category.color}/>
      </div>
    </section>
  )
}
