import type {Transaction} from './mylife-data'

const orderValue=(value:number|null|undefined)=>typeof value==='number'&&Number.isFinite(value)?value:null

export function sortDailyTransactions(rows:Transaction[]){
  return [...rows].sort((a,b)=>{
    const aManual=orderValue(a.day_sort_order),bManual=orderValue(b.day_sort_order)
    if(aManual!==null&&bManual!==null&&aManual!==bManual)return aManual-bManual
    if(aManual!==null&&bManual===null)return -1
    if(aManual===null&&bManual!==null)return 1
    const byTime=Date.parse(a.transaction_date)-Date.parse(b.transaction_date)
    if(byTime)return byTime
    const aCreated=a.created_at?Date.parse(a.created_at):0,bCreated=b.created_at?Date.parse(b.created_at):0
    if(aCreated!==bCreated)return aCreated-bCreated
    return a.id.localeCompare(b.id)
  })
}

export function moveTransactionId(ids:string[],draggedId:string,overId:string){
  const from=ids.indexOf(draggedId),to=ids.indexOf(overId)
  if(from<0||to<0||from===to)return ids
  const next=[...ids]
  next.splice(from,1)
  next.splice(to,0,draggedId)
  return next
}
