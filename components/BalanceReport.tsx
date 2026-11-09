'use client'

import { ArrowDown, ArrowUp, ChartNoAxesCombined, Percent } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { buildExpenseTrend, type DateRange, type ReportPeriod } from '@/lib/expense-report'
import type { MyLifeData } from '@/lib/mylife-data'
import './BalanceReport.css'

const money=(value:number)=>new Intl.NumberFormat('ro-RO',{style:'currency',currency:'RON',maximumFractionDigits:0}).format(value)
const signedMoney=(value:number)=>`${value>0?'+':value<0?'−':''}${money(Math.abs(value))}`
const percent=(value:number)=>`${value>0?'+':value<0?'−':''}${Math.abs(value).toLocaleString('ro-RO',{maximumFractionDigits:1})}%`
const plainPercent=(value:number)=>`${Math.abs(value).toLocaleString('ro-RO',{maximumFractionDigits:1})}%`

function shiftDay(day:string,amount:number){
  const date=new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate()+amount)
  return date.toISOString().slice(0,10)
}

function previousRange(range:DateRange,period:ReportPeriod):DateRange{
  if(period==='An'){
    const year=Number(range.from.slice(0,4))-1
    return {from:`${year}-01-01`,to:`${year}-12-31`}
  }
  if(period==='Lună'){
    const start=new Date(`${range.from}T12:00:00Z`)
    const year=start.getUTCFullYear(),month=start.getUTCMonth()
    const from=new Date(Date.UTC(year,month-1,1,12)).toISOString().slice(0,10)
    const to=new Date(Date.UTC(year,month,0,12)).toISOString().slice(0,10)
    return {from,to}
  }
  const from=new Date(`${range.from}T12:00:00Z`)
  const to=new Date(`${range.to}T12:00:00Z`)
  const days=Math.round((to.getTime()-from.getTime())/86400000)+1
  return {from:shiftDay(range.from,-days),to:shiftDay(range.from,-1)}
}

function linePoints(values:number[],minimum:number,maximum:number){
  const span=Math.max(1,maximum-minimum)
  return values.map((value,index)=>{
    const x=values.length===1?50:index/(values.length-1)*100
    const y=100-(value-minimum)/span*100
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
}

function cumulative(values:number[]){
  let total=0
  return values.map(value=>total+=value)
}

export default function BalanceReport({data,range,period,sidebar,comparePrevious}:{
  data:MyLifeData
  range:DateRange
  period:ReportPeriod
  sidebar:ReactNode
  comparePrevious:boolean
}){
  const result=useMemo(()=>{
    try{
      const income=buildExpenseTrend(data.transactions,data.categories,data.splits,range,period,undefined,'income')
      const expense=buildExpenseTrend(data.transactions,data.categories,data.splits,range,period,undefined,'expense')
      const priorRange=previousRange(range,period)
      const priorIncome=buildExpenseTrend(data.transactions,data.categories,data.splits,priorRange,period,undefined,'income')
      const priorExpense=buildExpenseTrend(data.transactions,data.categories,data.splits,priorRange,period,undefined,'expense')
      return {income,expense,priorNet:priorIncome.total-priorExpense.total,error:''}
    }catch(error){
      return {income:{points:[],total:0,unit:'day'},expense:{points:[],total:0,unit:'day'},priorNet:0,error:error instanceof Error?error.message:'Balanța nu poate fi calculată.'}
    }
  },[data,range.from,range.to,period])
  if(result.error)return <div className="balanceEmpty" role="alert">{result.error}</div>

  const incomeValues=result.income.points.map(point=>point.amount)
  const expenseValues=result.expense.points.map(point=>point.amount)
  const incomeCumulative=cumulative(incomeValues)
  const expenseCumulative=cumulative(expenseValues)
  const balanceCumulative=incomeCumulative.map((value,index)=>value-(expenseCumulative[index]??0))
  const incomeTotal=result.income.total
  const expenseTotal=result.expense.total
  const net=incomeTotal-expenseTotal
  const savingsRate=incomeTotal>0?net/incomeTotal*100:0
  const cumulativeMaximum=Math.max(1,...incomeCumulative,...expenseCumulative)
  const balanceMinimum=Math.min(0,...balanceCumulative)
  const balanceMaximum=Math.max(0,...balanceCumulative)
  const zeroY=100-(0-balanceMinimum)/Math.max(1,balanceMaximum-balanceMinimum)*100
  const positivePeriods=incomeValues.filter((value,index)=>value>(expenseValues[index]??0)).length
  const negativePeriods=incomeValues.filter((value,index)=>value<(expenseValues[index]??0)).length
  const neutralPeriods=incomeValues.length-positivePeriods-negativePeriods
  const unitLabel=result.income.unit==='month'?'luni':result.income.unit==='hour'?'ore':'zile'
  const comparisonDelta=net-result.priorNet
  const labelStep=incomeValues.length>24?5:incomeValues.length>14?3:1

  return <div className="balanceReport">
    <div className="balanceTitle"><div><span>RAPORT COMPARATIV</span><h2>Balanță financiară</h2></div></div>
    <section className="balanceKpis" aria-label="Rezumatul balanței">
      <article className="income"><i><ArrowUp size={20}/></i><div><span>Venituri</span><strong>{money(incomeTotal)}</strong></div></article>
      <article className="expense"><i><ArrowDown size={20}/></i><div><span>Cheltuieli</span><strong>{money(expenseTotal)}</strong></div></article>
      <article className={net>=0?'positive':'negative'}><i><ChartNoAxesCombined size={20}/></i><div><span>Diferență</span><strong>{signedMoney(net)}</strong></div></article>
      <article className={savingsRate>=0?'positive':'negative'}><i><Percent size={20}/></i><div><span>Rată de economisire</span><strong>{percent(savingsRate)}</strong></div></article>
    </section>

    <div className="balanceHero">
      <section className="balanceComparison" aria-label="Venituri comparate cu cheltuieli">
        <header><h3>Venituri vs. cheltuieli</h3><div><span className="income">Venituri</span><span className="expense">Cheltuieli</span><span className="incomeLine">Venituri cumulative</span><span className="expenseLine">Cheltuieli cumulative</span></div></header>
        <div className="balanceMainPlot">
          <div className="balanceAxis" aria-hidden="true"><span>{money(cumulativeMaximum)}</span><span>{money(cumulativeMaximum/2)}</span><span>0 RON</span></div>
          <div className="balancePlotArea">
            <svg className="balanceLines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline className="income" points={linePoints(incomeCumulative,0,cumulativeMaximum)}/>
              <polyline className="expense" points={linePoints(expenseCumulative,0,cumulativeMaximum)}/>
            </svg>
            <div className="balanceBars" style={{gridTemplateColumns:`repeat(${Math.max(1,incomeValues.length)},minmax(0,1fr))`}}>
              {result.income.points.map((point,index)=><div className="balanceBarGroup" key={point.key} title={`${point.fullLabel}: venituri ${money(point.amount)}, cheltuieli ${money(expenseValues[index]??0)}`}>
                <div className="balanceBarTrack"><i className="income" style={{height:`${point.amount/cumulativeMaximum*100}%`}}/><i className="expense" style={{height:`${(expenseValues[index]??0)/cumulativeMaximum*100}%`}}/></div>
                <span className={index%labelStep!==0&&index!==incomeValues.length-1?'hiddenLabel':''}>{point.label}</span>
              </div>)}
            </div>
          </div>
        </div>
      </section>
      {sidebar}
    </div>

    <div className="balanceSecondary">
      <section className="balanceCumulative">
        <header><h3>Balanță cumulată</h3><strong className={net>=0?'positive':'negative'}>{signedMoney(net)}</strong></header>
        <div className="balanceCumulativePlot">
          <span className="zero" style={{top:`${zeroY}%`}} aria-hidden="true"/>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`Balanța cumulată finală este ${money(net)}`}>
            <polyline className={net>=0?'positive':'negative'} points={linePoints(balanceCumulative,balanceMinimum,balanceMaximum)}/>
          </svg>
          <div className="balanceCumulativeLabels">{result.income.points.map((point,index)=><span key={point.key} className={index%labelStep!==0&&index!==incomeValues.length-1?'hiddenLabel':''}>{point.label}</span>)}</div>
        </div>
      </section>
      <section className="balancePeriods">
        <header><h3>{result.income.unit==='month'?'Luni':result.income.unit==='hour'?'Ore':'Zile'} pe plus și pe minus</h3><p><b>{positivePeriods} {unitLabel} pe plus</b><i>·</i><strong>{negativePeriods} {unitLabel} pe minus</strong>{neutralPeriods>0&&<><i>·</i><span>{neutralPeriods} fără mișcări</span></>}</p></header>
        <div>{result.income.points.map((point,index)=>{const difference=point.amount-(expenseValues[index]??0);return <span key={point.key} className={difference>0?'positive':difference<0?'negative':'neutral'} title={`${point.fullLabel}: ${signedMoney(difference)}`}>{point.label}</span>})}</div>
      </section>
    </div>

    <section className="balanceInsights" aria-label="Concluziile perioadei">
      <h3>Ce spune perioada</h3>
      <p className={net>=0?'positive':'negative'}><ChartNoAxesCombined size={20}/><span>{net>=0?'Veniturile au depășit cheltuielile cu':'Cheltuielile au depășit veniturile cu'} <strong>{money(Math.abs(net))}</strong></span></p>
      <p className={savingsRate>=0?'positive':'negative'}><Percent size={20}/><span>{savingsRate>=0?'Ai economisit':'Ai consumat peste venituri'} <strong>{plainPercent(savingsRate)}</strong> {savingsRate>=0?'din veniturile perioadei':'raportat la veniturile perioadei'}</span></p>
      {comparePrevious&&<p className={comparisonDelta>=0?'positive':'negative'}><ArrowUp size={20}/><span>Față de perioada anterioară, balanța {comparisonDelta>=0?'s-a îmbunătățit':'a scăzut'} cu <strong>{money(Math.abs(comparisonDelta))}</strong></span></p>}
    </section>
  </div>
}
