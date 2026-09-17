'use client'

import { CalendarRange, ChevronRight } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { buildExpenseReport, bucharestDay, reportRange, distributionGradient, subcategoryDistribution, type ExpenseCategory, type ReportPeriod, type DateRange } from '@/lib/expense-report'
import type { MyLifeData } from '@/lib/mylife-data'
import ExpenseTrendChart from './ExpenseTrendChart'
import './ExpenseReport.css'

function money(value: number) {
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', maximumFractionDigits: 2 }).format(value)
}

export default function ExpenseReport({ data, loading }: { data: MyLifeData | null; loading: boolean }) {
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
            <div className="pieHole"><span>Total cheltuieli</span><strong>{money(total)}</strong><small>{period}</small></div>
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
      <div className="sectionTitle reportListTitle"><h2>Cheltuieli pe categorii</h2><span>click pentru detalii</span></div>
      <div className="expenseList">
        {categories.length === 0 && <div className="emptyState">Nu există cheltuieli în RON în perioada selectată.</div>}
        {categories.map((item) => {
          const expanded = selected === item.id
          return (
            <div className="expenseCategory" key={item.id}>
              <button type="button" id={`expense-trigger-${item.id}`} className={`expenseRow ${expanded ? 'selected' : ''}`} aria-expanded={expanded} aria-controls={`expense-details-${item.id}`} onClick={() => setSelected(expanded ? null : item.id)}>
                <span className="expenseDot" style={{ background: item.color }}/>
                <div className="expenseName"><strong>{item.name}</strong><span>{percent(item.percent)} din total</span></div>
                <div className="expenseValue"><strong>{money(item.amount)}</strong><span>{percent(item.percent)}</span></div>
                <ChevronRight size={18} className="expenseChevron" aria-hidden="true"/>
              </button>
              <div id={`expense-details-${item.id}`} hidden={!expanded}>
                {expanded && <SubcategoryDetails category={item} data={data} range={range} period={period}/>}
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

function SubcategoryDetails({ category, data, range, period }: { category: ExpenseCategory; data: MyLifeData; range: DateRange; period: ReportPeriod }) {
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const distribution = subcategoryDistribution(category)
  const gradient = distributionGradient(distribution)
  const selectedItem = distribution.find((item) => item.id === selectedSubcategory)
  const chartId = `expense-trend-${category.id}`
  const selectTrend = (id: string | null) => {
    setSelectedSubcategory(id)
    requestAnimationFrame(() => chartRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }))
  }

  return (
    <section className="expenseDetails" aria-labelledby={`expense-trigger-${category.id}`}>
      <div className="expenseSubchart" role="img" aria-label={`Distribuția subcategoriilor pentru ${category.name}: ${distribution.map((item) => `${item.name} ${item.percent.toLocaleString('ro-RO')}%`).join(', ')}`} style={{ background: `conic-gradient(${gradient})` }}>
        <div className="expenseSubchartHole"><span>Total categorie</span><strong>{money(category.amount)}</strong></div>
      </div>
      <div className="expenseSubcategories">
        <div className="expenseSubcategoryToolbar">
          <p className="expenseDetailsCaption">Subcategorii · % din {category.name}<br/>Apasă pentru evoluția cheltuielilor.</p>
          <button type="button" className="expenseCategoryTrendButton" aria-pressed={!selectedItem} aria-controls={chartId} onClick={() => selectTrend(null)}>Toată categoria</button>
        </div>
        <ul>
          {distribution.map((item) => (
            <li key={item.id} className="expenseSubcategory">
              <button type="button" className="expenseSubcategoryButton" aria-pressed={selectedItem?.id === item.id} aria-controls={chartId} onClick={() => selectTrend(item.id)}>
                <span className="expenseDot" style={{ background: item.color }} aria-hidden="true"/>
                <span className="expenseSubcategoryName">{item.name}</span>
                <strong>{money(item.amount)}</strong>
                <span className="expenseSubcategoryPercent">{item.percent.toLocaleString('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="expenseTrendContainer" id={chartId} ref={chartRef}>
        <ExpenseTrendChart key={selectedItem?.id ?? category.id} data={data} range={range} period={period} target={{ categoryId: category.id, subcategoryId: selectedItem?.id }} name={selectedItem ? `${category.name} · ${selectedItem.name}` : category.name} color={selectedItem?.color ?? category.color}/>
      </div>
    </section>
  )
}
