'use client'

import { useMemo, useState } from 'react'
import { buildExpenseTrend, type DateRange, type ExpenseTrendTarget, type ReportPeriod } from '@/lib/expense-report'
import type { MyLifeData } from '@/lib/mylife-data'
import './ExpenseTrendChart.css'

const money = (amount: number) => new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', maximumFractionDigits: 2 }).format(amount)

export default function ExpenseTrendChart({ data, range, period, target, name, color, onSelectPoint, onSelectTotal }: {
  onSelectPoint?:(key:string,unit:string,label:string)=>void;onSelectTotal?:()=>void
  data: MyLifeData; range: DateRange; period: ReportPeriod; target: ExpenseTrendTarget; name: string; color: string
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const result = useMemo(() => {
    try { return { ...buildExpenseTrend(data.transactions, data.categories, data.splits, range, period, target), error: '' } }
    catch (error) { return { points: [], total: 0, unit: 'day', error: error instanceof Error ? error.message : 'Graficul nu poate fi calculat.' } }
  }, [data, range.from, range.to, period, target.categoryId, target.subcategoryId])
  const { points, total } = result
  const active = points.find((point) => point.key === activeKey)
  const maximum = Math.max(0, ...points.map((point) => point.amount))
  const unitLabel = result.unit === 'month' ? 'luni' : result.unit === 'hour' ? 'ore' : 'zile'
  const [fromYear, fromMonth] = range.from.split('-').map(Number)
  const [toYear, toMonth] = range.to.split('-').map(Number)
  const monthCount = Math.max(1, (toYear - fromYear) * 12 + toMonth - fromMonth + 1)
  const monthlyAverage = Math.round(total * 100 / monthCount) / 100

  return (
    <section className="expenseTrend" aria-label={`Evoluția cheltuielilor pentru ${name}`}>
      <div className="expenseTrendHeader">
        <div><p className="expenseTrendEyebrow">EVOLUȚIA CHELTUIELILOR</p><h3>{name}</h3><p>{range.from} – {range.to} · pe {unitLabel}</p></div>
        <div className="expenseTrendTotal"><span>Total în perioadă</span><button type="button" className="expenseTotalButton" aria-label={`Vezi tranzacțiile pentru ${name}`} onClick={onSelectTotal}><strong>{money(total)}</strong></button><div className="expenseTrendAverage"><span>Medie pe lună</span><strong>{money(monthlyAverage)}</strong></div></div>
      </div>
      {result.error ? <p role="alert" className="expenseTrendHint">{result.error}</p> : <>
        <div className="expenseTrendReadout" aria-live="polite">
          {active ? <><span>{active.fullLabel}</span><button type="button" className="expenseTotalButton" aria-label={`Vezi tranzacțiile pentru ${active.fullLabel}`} onClick={()=>onSelectPoint?.(active.key,result.unit,active.fullLabel)}><strong>{money(active.amount)}</strong></button></> : <span>Apasă pe o bară pentru sumă și tranzacțiile care o compun.</span>}
        </div>
        {maximum === 0 && <p className="expenseTrendHint">Nu există cheltuieli în această perioadă.</p>}
        <div className="expenseTrendPlot">
          <div className="expenseTrendAxis" aria-hidden="true"><span>{money(maximum)}</span><span>{money(maximum / 2)}</span><span>0 RON</span></div>
          <div className="expenseTrendScroll" tabIndex={0} role="group" aria-label="Grafic de cheltuieli; derulează orizontal pentru toate valorile">
            <div className="expenseTrendBars" style={{ minWidth: `${points.length * 30}px` }}>
              {points.map((point) => (
                <button type="button" key={point.key} className={`expenseTrendBar ${active?.key === point.key ? 'active' : ''}`} aria-label={`${point.fullLabel}: ${money(point.amount)}`} aria-pressed={active?.key === point.key} onClick={() => {setActiveKey(point.key);onSelectPoint?.(point.key,result.unit,point.fullLabel)}} onFocus={() => setActiveKey(point.key)} onPointerEnter={(event) => { if (event.pointerType === 'mouse') setActiveKey(point.key) }}>
                  <span className="expenseTrendBarTrack"><span className={`expenseTrendBarFill ${point.amount === 0 ? 'zero' : ''}`} style={{ height: `${maximum > 0 ? point.amount / maximum * 100 : 0}%`, background: color }}/></span>
                  <span className="expenseTrendBarLabel">{point.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="expenseTrendHint">{points.length} {unitLabel} · perioadele fără cheltuieli apar cu 0 RON. Derulează graficul pentru toate valorile.</p>
      </>}
    </section>
  )
}
