'use client'

import {ChevronLeft,ChevronRight,Copy,Save} from 'lucide-react'
import {useEffect,useMemo,useState} from 'react'
import {buildExpenseReport,bucharestDay} from '@/lib/expense-report'
import {budgetMonthLabel,monthRange,shiftBudgetMonth} from '@/lib/budgets'
import {sortedCategories} from '@/lib/category-display'
import {getSupabaseClient} from '@/lib/supabase'
import type {MyLifeData} from '@/lib/mylife-data'
import CategoryIcon from './CategoryIcon'
import BudgetProgress from './BudgetProgress'
import './BudgetsWorkspace.css'

const money=(value:number)=>new Intl.NumberFormat('ro-RO',{style:'currency',currency:'RON',maximumFractionDigits:0}).format(value)
const normalizeAmount=(value:string)=>value.replace(/\s/g,'').replace(',','.')

export default function BudgetsWorkspace({data,onSaved}:{data:MyLifeData;onSaved:()=>void}){
  const [month,setMonth]=useState(()=>bucharestDay(new Date()).slice(0,7))
  const [draft,setDraft]=useState<Record<string,string>>({})
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [saved,setSaved]=useState(false)
  const categories=useMemo(()=>sortedCategories(data.categories.filter(category=>category.kind==='expense'&&!category.parent_id&&category.is_active&&category.household_id===data.profile.householdId)),[data.categories,data.profile.householdId])
  const budgets=useMemo(()=>new Map(data.budgets.filter(row=>row.month.slice(0,7)===month&&row.currency.trim()==='RON').map(row=>[row.category_id,row])),[data.budgets,month])
  const range=monthRange(month)
  const report=useMemo(()=>buildExpenseReport(data.transactions,data.categories,data.splits,range,'expense'),[data.transactions,data.categories,data.splits,range.from,range.to])
  const spentByCategory=useMemo(()=>new Map(report.categories.map(category=>[category.id,category.amount])),[report.categories])
  useEffect(()=>{
    setDraft(Object.fromEntries(categories.map(category=>[category.id,budgets.get(category.id)?String(Number(budgets.get(category.id)!.amount)):'' ])))
    setError('');setSaved(false)
  },[categories,budgets])
  const totalBudget=categories.reduce((sum,category)=>sum+(Number(normalizeAmount(draft[category.id]??''))||0),0)
  const remaining=totalBudget-report.total
  const copyPrevious=()=>{
    const previous=shiftBudgetMonth(month,-1)
    const rows=data.budgets.filter(row=>row.month.slice(0,7)===previous&&row.currency.trim()==='RON')
    if(!rows.length){setError(`Nu există bugete salvate pentru ${budgetMonthLabel(previous)}.`);return}
    const values=new Map(rows.map(row=>[row.category_id,String(Number(row.amount))]))
    setDraft(Object.fromEntries(categories.map(category=>[category.id,values.get(category.id)??''])))
    setError('');setSaved(false)
  }
  const save=async()=>{
    const client=getSupabaseClient();if(!client||busy||data.source!=='live')return
    const parsed=categories.map(category=>({category,amount:Number(normalizeAmount(draft[category.id]??''))}));
    if(parsed.some(row=>draft[row.category.id]?.trim()&&(!Number.isFinite(row.amount)||row.amount<=0))){setError('Bugetele completate trebuie să fie sume mai mari decât zero.');return}
    setBusy(true);setError('');setSaved(false)
    try{
      const upserts=parsed.filter(row=>row.amount>0).map(row=>({household_id:data.profile.householdId,category_id:row.category.id,month:`${month}-01`,amount:Math.round(row.amount*100)/100,currency:'RON'}))
      if(upserts.length){const result=await client.from('finance_category_budgets').upsert(upserts,{onConflict:'household_id,category_id,month,currency'});if(result.error)throw Error(result.error.message)}
      const removed=parsed.filter(row=>!row.amount&&budgets.has(row.category.id)).map(row=>row.category.id)
      if(removed.length){const result=await client.from('finance_category_budgets').delete().eq('household_id',data.profile.householdId).eq('month',`${month}-01`).in('category_id',removed);if(result.error)throw Error(result.error.message)}
      setSaved(true);onSaved()
    }catch(value){setError(value instanceof Error?value.message:'Bugetele nu au putut fi salvate.')}
    finally{setBusy(false)}
  }
  return <section className="budgetsWorkspace">
    <header className="budgetsHeader">
      <div><span className="budgetsEyebrow">BUGETE LUNARE</span><h2>{budgetMonthLabel(month)}</h2><p>Stabilește limita pentru fiecare categorie principală și urmărește progresul în Rapoarte.</p></div>
      <button type="button" className="financePrimaryAction" disabled={busy||data.source!=='live'} onClick={()=>void save()}><Save size={16}/>{busy?'Se salvează…':'Salvează bugetele'}</button>
    </header>
    <div className="budgetsMonthNavigator">
      <button type="button" aria-label="Luna precedentă" onClick={()=>setMonth(value=>shiftBudgetMonth(value,-1))}><ChevronLeft size={20}/></button>
      <strong>{budgetMonthLabel(month)}</strong>
      <button type="button" aria-label="Luna următoare" onClick={()=>setMonth(value=>shiftBudgetMonth(value,1))}><ChevronRight size={20}/></button>
    </div>
    <div className="budgetsSummary">
      <div><span>Buget total</span><strong>{money(totalBudget)}</strong></div>
      <div><span>Cheltuit</span><strong>{money(report.total)}</strong></div>
      <div className={remaining<0?'negative':'positive'}><span>{remaining<0?'Depășire':'Disponibil'}</span><strong>{money(Math.abs(remaining))}</strong></div>
      <button type="button" onClick={copyPrevious}><Copy size={15}/> Copiază luna precedentă</button>
    </div>
    {error&&<p className="budgetMessage error" role="alert">{error}</p>}
    {saved&&<p className="budgetMessage success" role="status">Bugetele au fost salvate.</p>}
    <div className="budgetCategoryList">
      {categories.map(category=>{
        const amount=Number(normalizeAmount(draft[category.id]??''))||0
        const spent=spentByCategory.get(category.id)??0
        return <article className="budgetCategoryCard" key={category.id}>
          <div className="budgetCategoryIdentity"><CategoryIcon category={category}/><div><strong>{category.name}</strong><span>{money(spent)} cheltuiți</span></div></div>
          <label><span>Buget</span><div><input inputMode="decimal" placeholder="Fără buget" value={draft[category.id]??''} onChange={event=>{if(/^\d*[.,]?\d{0,2}$/.test(event.target.value)){setDraft(current=>({...current,[category.id]:event.target.value}));setSaved(false)}}}/><b>RON</b></div></label>
          {amount>0?<BudgetProgress spent={spent} budget={amount}/>:<p className="budgetUnset">Completează o limită pentru această lună.</p>}
        </article>
      })}
    </div>
  </section>
}
