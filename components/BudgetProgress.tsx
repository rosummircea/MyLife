import {budgetStatus} from '@/lib/budgets'

const money=(value:number)=>new Intl.NumberFormat('ro-RO',{style:'currency',currency:'RON',maximumFractionDigits:0}).format(Math.abs(value))

export default function BudgetProgress({spent,budget,compact=false}:{spent:number;budget:number;compact?:boolean}){
  const status=budgetStatus(spent,budget)
  const consumed=status.ratio<1?Math.floor(status.ratio*100):Math.round(status.ratio*100)
  const message=status.remaining<0?`${money(status.remaining)} peste buget`:`${money(status.remaining)} disponibile`
  return <div className={`budgetProgress ${status.tone} ${status.remaining<=0?'exhausted':''} ${compact?'compact':''}`} aria-label={`${consumed}% din buget consumat; ${message}`}>
    <div className="budgetProgressMeta"><span>{compact?<><b>{consumed}%</b> · {message}</>:message}</span>{!compact&&<strong>{consumed}%</strong>}</div>
    <div className="budgetProgressTrack" aria-hidden="true">
      <span className="budgetProgressSpent" style={{width:`${status.progress}%`}}/>
      <span className="budgetProgressRemaining" style={{width:`${100-status.progress}%`}}/>
    </div>
  </div>
}
