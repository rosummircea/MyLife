'use client'

import CategoryIcon from './CategoryIcon'
import { CalendarRange, ChevronDown, ChevronRight, ChevronsUp } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { buildExpenseReport, bucharestDay, reportRange, distributionGradient, subcategoryDistribution, type ExpenseCategory, type ReportPeriod, type DateRange, type ReportKind } from '@/lib/expense-report'
import type { MyLifeData, Transaction } from '@/lib/mylife-data'
import ExpenseTrendChart from './ExpenseTrendChart'
import TransactionsList from './TransactionsList'
import { contributionBucketKey, expenseContributionTransactions } from '@/lib/expense-transactions'
import './ExpenseReport.css'

function money(value: number) {
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', maximumFractionDigits: 2 }).format(value)
}
function reportAmountClass(value:number, kind:ReportKind) {
  return value === 0 ? 'reportMoneyNeutral' : kind === 'income' ? 'reportMoneyIncome' : 'reportMoneyExpense'
}
function transactionCountLabel(count:number){
  return `${count} ${count===1?'tranzacție':'tranzacții'}`
}

export default function ExpenseReport({ data, loading, onSelectTransaction }: { data: MyLifeData | null; loading: boolean; onSelectTransaction:(transaction:Transaction)=>void }) {
  const [showAllTransactions,setShowAllTransactions]=useState(false)
  const [kind,setKind]=useState<ReportKind>('expense')
  const allTransactionsRef=useRef<HTMLDivElement>(null)
  const heroCarouselRef=useRef<HTMLDivElement>(null)
  const [heroView,setHeroView]=useState(0)
  const [overviewBucket,setOverviewBucket]=useState<{key:string;unit:string;label:string}|null>(null)
  const [period, setPeriod] = useState<ReportPeriod>('Lună')
  const [selected, setSelected] = useState<string | null>(null)
  const [anchor, setAnchor] = useState(() => bucharestDay(new Date()))
  const [customFrom, setCustomFrom] = useState(anchor)
  const [customTo, setCustomTo] = useState(anchor)
  const range = reportRange(period, anchor, { from: customFrom, to: customTo })
  const invalidRange = range.from > range.to
  const report = useMemo(() => {
    try {
      return { ...buildExpenseReport(data?.transactions ?? [], data?.categories ?? [], data?.splits ?? [], range, kind), error: '' }
    } catch (error) {
      return { categories: [], total: 0, transactionCount: 0, excludedCurrencies: 0, error: error instanceof Error ? error.message : 'Raportul nu poate fi calculat.' }
    }
  }, [data, range.from, range.to, kind])
  const allContributions=useMemo(()=>showAllTransactions&&data&&!report.error?expenseContributionTransactions(data.transactions,data.categories,data.splits,range,undefined,kind).filter(row=>!overviewBucket||contributionBucketKey(row.transaction,overviewBucket.unit)===overviewBucket.key):[],[showAllTransactions,data,range.from,range.to,report.error,kind,overviewBucket])
  const { categories, total } = report
  const categoryTransactionCounts=useMemo(()=>new Map(categories.map(item=>[
    item.id,
    data ? expenseContributionTransactions(data.transactions,data.categories,data.splits,range,{categoryId:item.id},kind).length : 0,
  ])),[categories,data,range.from,range.to,kind])
  const gradient = distributionGradient(categories)
  const fromDate = new Date(`${range.from}T12:00:00Z`)
  const label = period === 'Lună' ? fromDate.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : period === 'An' ? range.from.slice(0, 4) : `${range.from} – ${range.to}`
  const percent = (value: number) => `${value.toLocaleString('ro-RO', { maximumFractionDigits: 1 })}%`
  const currentYear = Number(bucharestDay(new Date()).slice(0, 4))
  const years = [...new Set([Number(anchor.slice(0, 4)), ...Array.from({ length: 7 }, (_, index) => currentYear - 5 + index), ...(data?.transactions ?? []).map((tx) => Number(bucharestDay(new Date(tx.transaction_date)).slice(0, 4)))])].sort((a, b) => b - a)
  const resetReportSelection=()=>{
    setSelected(null)
    setOverviewBucket(null)
    setShowAllTransactions(false)
  }
  const changeYear = (year: string) => {
    const month = Number(anchor.slice(5, 7))
    const day = Math.min(Number(anchor.slice(8, 10)), new Date(Date.UTC(Number(year), month, 0)).getUTCDate())
    setAnchor(`${year}-${anchor.slice(5, 7)}-${String(day).padStart(2, '0')}`)
    resetReportSelection()
  }
  const changeKind = (next:ReportKind) => {
    setKind(next)
    setSelected(null)
    setShowAllTransactions(false)
    setOverviewBucket(null)
  }
  const showHeroView=(index:number)=>{
    setHeroView(index)
    heroCarouselRef.current?.scrollTo({left:heroCarouselRef.current.clientWidth*index,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})
  }
  const showContributionList=(bucket:{key:string;unit:string;label:string}|null)=>{
    setOverviewBucket(bucket)
    setShowAllTransactions(true)
    requestAnimationFrame(()=>allTransactionsRef.current?.scrollIntoView({behavior:'smooth',block:'start'}))
  }


  return (
    <div className="reportWrap">
      <div className="reportKindToolbar">
        <div className="reportTypeSwitch" role="group" aria-label="Tipul raportului">
          <button type="button" className={kind==='expense'?'active':''} aria-pressed={kind==='expense'} onClick={()=>changeKind('expense')}>Cheltuieli</button>
          <button type="button" className={kind==='income'?'active':''} aria-pressed={kind==='income'} onClick={()=>changeKind('income')}>Venituri</button>
        </div>
      </div>
      <div className="reportHero">
        <div className="pieStage reportMainDeck">
          <div className="reportMainViewSwitch" role="tablist" aria-label="Tipul graficului principal">
            <button type="button" role="tab" aria-selected={heroView===0} onClick={()=>showHeroView(0)}>Distribuție</button>
            <button type="button" role="tab" aria-selected={heroView===1} onClick={()=>showHeroView(1)}>Evoluție</button>
          </div>
          <div className="reportMainCarousel" ref={heroCarouselRef} onScroll={event=>{
            const element=event.currentTarget
            const next=Math.round(element.scrollLeft/Math.max(1,element.clientWidth))
            if(next!==heroView)setHeroView(next)
          }}>
            <section className="reportMainSlide reportMainPieSlide" aria-label={`Distribuția ${kind==='income'?'veniturilor':'cheltuielilor'}`}>
              {loading || !data || invalidRange || report.error ? <div className="emptyState" role="status">{loading ? 'Se încarcă raportul…' : invalidRange ? 'Data de început trebuie să fie înaintea datei de sfârșit.' : report.error || 'Conectează datele pentru a vedea raportul.'}</div> : <div className="pieChart" style={{ background: categories.length ? `conic-gradient(${gradient})` : 'var(--line)' }}>
                <div className="pieHole"><span>Total {kind==='income'?'venituri':'cheltuieli'}</span><button className="expenseTotalButton" type="button" aria-expanded={showAllTransactions&&!overviewBucket} aria-controls="expense-all-transactions" aria-label={`Vezi tranzacțiile din totalul ${kind==='income'?'veniturilor':'cheltuielilor'}`} onClick={()=>showContributionList(null)}><strong className={reportAmountClass(total,kind)}>{money(total)}</strong></button><small>{period}</small></div>
              </div>}
            </section>
            <section className="reportMainSlide reportMainTrendSlide" aria-label={`Evoluția totală a ${kind==='income'?'veniturilor':'cheltuielilor'}`}>
              {!loading&&data&&!invalidRange&&!report.error&&<ExpenseTrendChart compact key={`overview-${kind}-${range.from}-${range.to}-${period}`} data={data} range={range} period={period} name={kind==='income'?'Venituri':'Cheltuieli'} color={kind==='income'?'#66d8a4':'#ff8797'} kind={kind} onSelectPoint={(key,unit,bucketLabel)=>showContributionList({key,unit,label:bucketLabel})} onSelectTotal={()=>showContributionList(null)}/>}
            </section>
          </div>
          <div className="reportMainPager" aria-label="Poziția în galeria de grafice">
            <button type="button" aria-label="Arată distribuția" aria-current={heroView===0?'true':undefined} onClick={()=>showHeroView(0)}/>
            <button type="button" aria-label="Arată evoluția" aria-current={heroView===1?'true':undefined} onClick={()=>showHeroView(1)}/>
          </div>
        </div>
        <div className="reportSummary">
          <span className="summaryLabel">Perioadă selectată</span>
          <strong>{label}</strong>
          <div className="periodSwitch reportSummaryPeriods" aria-label="Tipul perioadei">
            {(['Zi','Săptămână','Lună','An','Custom'] as ReportPeriod[]).map((item) => <button type="button" key={item} className={period === item ? 'active' : ''} onClick={() => { setPeriod(item); resetReportSelection() }}>{item === 'Custom' && <CalendarRange size={14}/>} {item}</button>)}
          </div>
          <div className="expensePeriodControls">
            {(period === 'An' || period === 'Lună') ? <>
              <label>Anul<span className="expenseSelectShell"><select aria-label="Anul" value={anchor.slice(0, 4)} onChange={(event) => changeYear(event.target.value)}>
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select><ChevronDown size={16} aria-hidden="true"/></span></label>
              {period === 'Lună' && <label>Luna<span className="expenseSelectShell"><select aria-label="Luna" value={anchor.slice(5, 7)} onChange={(event) => { setAnchor(`${anchor.slice(0, 4)}-${event.target.value}-01`); resetReportSelection() }}>
                {Array.from({ length: 12 }, (_, index) => <option key={index} value={String(index + 1).padStart(2, '0')}>{new Date(Date.UTC(2026, index, 1)).toLocaleDateString('ro-RO', { month: 'long', timeZone: 'UTC' })}</option>)}
              </select><ChevronDown size={16} aria-hidden="true"/></span></label>}
            </> : period === 'Custom' ? <>
              <label>De la<input type="date" value={customFrom} onChange={(event) => { if (event.target.value) { setCustomFrom(event.target.value); resetReportSelection() } }}/></label>
              <label>Până la<input type="date" value={customTo} onChange={(event) => { if (event.target.value) { setCustomTo(event.target.value); resetReportSelection() } }}/></label>
            </> : <label>{period === 'Zi' ? 'Ziua' : 'Alege o zi din săptămână'}<input type="date" value={anchor} onChange={(event) => { if (event.target.value) { setAnchor(event.target.value); resetReportSelection() } }}/></label>}
          </div>
        </div>
      </div>

      {!loading && data && !invalidRange && !report.error && <>
      {showAllTransactions&&<div id="expense-all-transactions" ref={allTransactionsRef} className="expenseContributionList"><header><div><h3>Tranzacții · Total {kind==='income'?'venituri':'cheltuieli'}</h3><p>{overviewBucket?.label??`${range.from} – ${range.to}`} · {allContributions.length} tranzacții · Apasă pentru detalii și editare.</p></div><button className="expenseCategoryTrendButton" onClick={()=>{setShowAllTransactions(false);setOverviewBucket(null)}}>Închide lista</button></header><TransactionsList accounts={data.accounts} categories={data.categories} splits={data.splits} transactions={allContributions.map(row=>row.transaction)} contributionAmounts={Object.fromEntries(allContributions.map(row=>[row.transaction.id,row.amount]))} onSelect={onSelectTransaction}/></div>}
      <div className="sectionTitle reportListTitle"><h2>{kind==='income'?'Venituri':'Cheltuieli'} pe categorii</h2><button type="button" className="expenseCollapseAllButton" disabled={!selected&&!showAllTransactions} onClick={()=>{setSelected(null);setShowAllTransactions(false)}}><ChevronsUp size={15}/> Restrânge tot</button></div>
      <div className="expenseList">
        {categories.length === 0 && <div className="emptyState">Nu există {kind==='income'?'venituri':'cheltuieli'} în RON în perioada selectată.</div>}
        {categories.map((item) => {
          const expanded = selected === item.id
          return (
            <div className="expenseCategory" key={item.id}>
              <button type="button" id={`expense-trigger-${item.id}`} className={`expenseRow ${expanded ? 'selected' : ''}`} aria-expanded={expanded} aria-controls={`expense-details-${item.id}`} onClick={() => setSelected(expanded ? null : item.id)}>
                <CategoryIcon category={item}/>
                <div className="expenseName"><strong>{item.name}</strong><span>{transactionCountLabel(categoryTransactionCounts.get(item.id)??0)}</span></div>
                <div className="expenseValue"><strong className={reportAmountClass(item.amount,kind)}>{money(item.amount)}</strong><span>{percent(item.percent)}</span></div>
                <ChevronRight size={18} className="expenseChevron" aria-hidden="true"/>
              </button>
              <div id={`expense-details-${item.id}`} hidden={!expanded}>
                {expanded && <SubcategoryDetails key={`${kind}:${item.id}`} onSelectTransaction={onSelectTransaction} category={item} data={data} range={range} period={period} kind={kind}/>}
              </div>
            </div>
          )
        })}
      </div>
      </>}
    </div>
  )
}

function SubcategoryDetails({ category, data, range, period, kind, onSelectTransaction }: { category: ExpenseCategory; data: MyLifeData; range: DateRange; period: ReportPeriod; kind:ReportKind; onSelectTransaction:(transaction:Transaction)=>void }) {
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(() => new Set())
  const [selectedBucket,setSelectedBucket]=useState<{key:string;unit:string;label:string}|null>(null)
  const [showCategoryTransactions,setShowCategoryTransactions]=useState(false)
  const [reportView, setReportView] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)
  const distribution = subcategoryDistribution(category)
  const gradient = distributionGradient(distribution)
  const subcategoryContributions = useMemo(() => new Map(distribution.map(item => [item.id, expenseContributionTransactions(data.transactions, data.categories, data.splits, range, { categoryId: category.id, subcategoryId: item.id }, kind)])), [data, range.from, range.to, category, kind])
  const categoryContributions = useMemo(() => expenseContributionTransactions(data.transactions,data.categories,data.splits,range,{categoryId:category.id},kind).filter(row=>!selectedBucket||contributionBucketKey(row.transaction,selectedBucket.unit)===selectedBucket.key),[data,range.from,range.to,category.id,selectedBucket,kind])
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
      <div className="expenseSubcategories">
        <ul>
          {distribution.map((item) => {
            const expanded = expandedSubcategories.has(item.id)
            const rows = subcategoryContributions.get(item.id) ?? []
            return (
            <li key={item.id} className="expenseSubcategory">
              <button type="button" id={`expense-subcategory-${item.id}`} className="expenseSubcategoryButton" aria-expanded={expanded} aria-controls={`expense-transactions-${item.id}`} onClick={() => toggleSubcategory(item.id)}>
                <span className="expenseSubcategorySwatch" aria-hidden="true" style={{backgroundColor:item.color}}/>
                <span className="expenseSubcategoryMeta"><span className="expenseSubcategoryName">{item.name}</span><small>{transactionCountLabel(rows.length)}</small></span>
                <strong className={reportAmountClass(item.amount,kind)}>{money(item.amount)}</strong>
                <span className="expenseSubcategoryPercent">{item.percent.toLocaleString('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>
                <ChevronRight size={14} className="expenseChevron" aria-hidden="true"/>
              </button>
              <div id={`expense-transactions-${item.id}`} hidden={!expanded} className="expenseSubcategoryTransactions" role="region" aria-labelledby={`expense-subcategory-${item.id}`} style={{borderLeftColor:item.color}}>
                {expanded && <>
                  <p className="expenseInlineCaption">{rows.length} tranzacții · {range.from} – {range.to} · Apasă pentru detalii și editare.</p>
                  <TransactionsList accounts={data.accounts} categories={data.categories} splits={data.splits} transactions={rows.map(row=>row.transaction)} contributionAmounts={Object.fromEntries(rows.map(row=>[row.transaction.id,row.amount]))} onSelect={onSelectTransaction} emptyMessage="Nu există tranzacții pentru suma și perioada selectate."/>
                  {rows.length>0&&<div className="expenseSubcategoryTrend"><ExpenseTrendChart
                    compact
                    key={`subcategory-${item.id}-${range.from}-${range.to}-${period}`}
                    data={data}
                    range={range}
                    period={period}
                    target={{categoryId:category.id,subcategoryId:item.id}}
                    name={`${category.name} · ${item.name}`}
                    color={item.color}
                    kind={kind}
                  /></div>}
                  {rows.some(row=>Math.round(row.amount*100)!==Math.round(Number(row.transaction.amount)*100)) && <p className="expenseReportNote">Sumele reprezintă partea repartizată aici; suma integrală este indicată separat.</p>}
                </>}
              </div>
            </li>
            )
          })}
        </ul>
      </div>
      <div className="expenseReportDeck">
        <header className="expenseReportDeckHeader">
          <div><p className="expenseTrendEyebrow">RAPOARTE CATEGORIE</p><h3>{category.name}</h3><p>Glisează pentru a schimba reprezentarea.</p></div>
          <div className="expenseReportDeckTotals"><span>Total în perioadă</span><strong className={reportAmountClass(category.amount,kind)}>{money(category.amount)}</strong><small>Medie pe lună · <b className={reportAmountClass(monthlyAverage,kind)}>{money(monthlyAverage)}</b></small></div>
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
              <div className="expenseSubchartHole"><span>Total categorie</span><strong className={reportAmountClass(category.amount,kind)}>{money(category.amount)}</strong></div>
            </div>
          </section>
          <section className="expenseReportSlide expenseReportTrendSlide" aria-label={`Evoluția ${kind==='income'?'veniturilor':'cheltuielilor'} pentru ${category.name}`}>
            <ExpenseTrendChart
              compact
              key={`${category.id}-${range.from}-${range.to}-${period}`}
              data={data}
              range={range}
              period={period}
              target={{categoryId:category.id}}
              name={category.name}
              color={category.color}
              kind={kind}
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
          <div className="expenseContributionActions"><strong className={reportAmountClass(categoryContributionTotal,kind)}>{money(categoryContributionTotal)}</strong><button type="button" className="expenseCategoryTrendButton" onClick={()=>{setShowCategoryTransactions(false);setSelectedBucket(null)}}>Închide</button></div>
        </header>
        <TransactionsList accounts={data.accounts} categories={data.categories} splits={data.splits} transactions={categoryContributions.map(row=>row.transaction)} contributionAmounts={Object.fromEntries(categoryContributions.map(row=>[row.transaction.id,row.amount]))} onSelect={onSelectTransaction} emptyMessage="Nu există tranzacții pentru intervalul selectat."/>
      </section>}
    </section>
  )
}
