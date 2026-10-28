export type BudgetTone='healthy'|'warning'|'critical'|'over'
export type BudgetCoverageTone='available'|'caution'|'over'

const excludedBudgetCategories=new Set(['animale','necategorizat'])

export function isBudgetCategory(category:{name:string}){
  const normalized=category.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('ro-RO')
  return !excludedBudgetCategories.has(normalized)
}

export function budgetCoverageTone(spent:number,remaining:number,income:number):BudgetCoverageTone{
  if(remaining<0||spent>income)return 'over'
  if(spent+remaining>income)return 'caution'
  return 'available'
}

export function isValidTotalBudget(total:number,categoryTotal:number){
  return Number.isFinite(total)&&total>=0&&total+1e-9>=categoryTotal
}

export function budgetStatus(spent:number,budget:number){
  const safeBudget=Math.max(0,budget)
  const ratio=safeBudget>0?spent/safeBudget:spent>0?1:0
  const remaining=safeBudget-spent
  const remainingRatio=safeBudget>0?remaining/safeBudget:1
  const tone:BudgetTone=safeBudget===0&&spent>0?'over':ratio>1?'over':remainingRatio<=.1?'critical':remainingRatio<=.2?'warning':'healthy'
  return {ratio,remaining,remainingRatio,tone,progress:Math.min(100,Math.max(0,ratio*100))}
}

export function monthRange(month:string){
  const [year,value]=month.split('-').map(Number)
  const end=new Date(Date.UTC(year,value,0,12))
  return {from:`${month}-01`,to:end.toISOString().slice(0,10)}
}

export function shiftBudgetMonth(month:string,direction:-1|1){
  const date=new Date(`${month}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth()+direction)
  return date.toISOString().slice(0,7)
}

export function budgetMonthLabel(month:string){
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString('ro-RO',{month:'long',year:'numeric',timeZone:'UTC'})
}
