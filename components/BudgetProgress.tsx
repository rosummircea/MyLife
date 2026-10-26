import {budgetStatus} from '@/lib/budgets'

const money=(value:number)=>new Intl.NumberFormat('ro-RO',{style:'currency',currency:'RON',maximumFractionDigits:0}).format(Math.abs(value))

export default function BudgetProgress({spent,budget,compact=false}:{spent:number;budget:number;compact?:boolean}){
  const status=budgetStatus(spent,budget)
  const message=status.remaining<0?`${money(status.remaining)} peste buget`:`${money(status.remaining)} disponibile`
  return <div className={`budgetProgress ${status.tone} ${compact?'compact':''}`} aria-label={`${Math.round(status.ratio*100)}% din buget consumat; ${message}`}>
    <div className="budgetProgressMeta"><span>{message}</span><strong>{Math.round(status.ratio*100)}%</strong></div>
    <div className="budgetProgressTrack" aria-hidden="true"><span style={{width:`${status.progress}%`}}/></div>
  </div>
}
