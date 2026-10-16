'use client'

import {useEffect,useState} from 'react'
import {getSupabaseClient} from '@/lib/supabase'
import {bucharestDay} from '@/lib/expense-report'
import type {Account} from '@/lib/mylife-data'
import {createLoan,loadLoans,loanTotals,remaining,repayLoan,type Loan,type LoanInput,type RepaymentInput} from '@/lib/loans'
import './LoansWorkspace.css'

const money=(amount:number,currency:string)=>new Intl.NumberFormat('ro-RO',{style:'currency',currency:currency.trim()}).format(amount)
const today=()=>bucharestDay(new Date())
const emptyInput=():LoanInput=>({direction:'given',counterparty:'',amount:'',currency:'RON',loan_date:today(),purpose:'',notes:'',account_id:''})
const eligibleAccounts=(accounts:Account[],currency:string)=>accounts.filter(account=>account.is_active!==false&&account.currency.trim()===currency)

export default function LoansWorkspace({householdId,accounts,onSaved,onSelectTransaction}:{householdId:string|null;accounts:Account[];onSaved:()=>void;onSelectTransaction:(transactionId:string)=>void}) {
  const [loans,setLoans]=useState<Loan[]>([])
  const [loading,setLoading]=useState(false)
  const [ready,setReady]=useState(false)
  const [error,setError]=useState('')
  const [revision,setRevision]=useState(0)
  const [showForm,setShowForm]=useState(false)
  const [saving,setSaving]=useState(false)
  const [input,setInput]=useState<LoanInput>(emptyInput)
  const [repayment,setRepayment]=useState<({id:string}&RepaymentInput)|null>(null)

  useEffect(()=>{
    let cancelled=false
    setLoans([]);setReady(false);setError('');setShowForm(false);setRepayment(null)
    if(!householdId){setLoading(false);return}
    const client=getSupabaseClient();if(!client)return
    setLoading(true)
    loadLoans(client,householdId).then(data=>{if(!cancelled){setLoans(data);setReady(true)}}).catch(error=>{if(!cancelled)setError(error.message)}).finally(()=>{if(!cancelled)setLoading(false)})
    return()=>{cancelled=true}
  },[householdId,revision])

  const firstAccount=(currency:string)=>eligibleAccounts(accounts,currency)[0]?.id??''
  const openLoanForm=()=>{const fresh=emptyInput();fresh.account_id=firstAccount(fresh.currency);setInput(fresh);setShowForm(true)}
  const openRepayment=(loan:Loan)=>setRepayment({id:loan.id,amount:'',account_id:firstAccount(loan.currency),repayment_date:today()})

  async function save(){
    const client=getSupabaseClient();if(!client||!householdId)return
    setSaving(true);setError('')
    try{await createLoan(client,householdId,input);setShowForm(false);setInput(emptyInput());setRevision(value=>value+1);onSaved()}
    catch(error){setError(error instanceof Error?error.message:'Împrumutul nu a fost salvat.')}
    finally{setSaving(false)}
  }

  async function repay(loan:Loan){
    const client=getSupabaseClient();if(!client||!repayment)return
    setSaving(true);setError('')
    try{await repayLoan(client,loan,repayment);setRepayment(null);setRevision(value=>value+1);onSaved()}
    catch(error){setError(error instanceof Error?error.message:'Rambursarea nu a fost salvată.')}
    finally{setSaving(false)}
  }

  const field=<K extends keyof LoanInput>(key:K,value:LoanInput[K])=>setInput(old=>({...old,[key]:value}))
  const changeCurrency=(currency:string)=>setInput(old=>({...old,currency,account_id:eligibleAccounts(accounts,currency).some(account=>account.id===old.account_id)?old.account_id:firstAccount(currency)}))

  return <section className="loansWorkspace">
    <div className="loansToolbar loansActions">
      <button type="button" disabled={!householdId||loading||saving} onClick={()=>setRevision(value=>value+1)}>Actualizează</button>
      <button className="financePrimaryAction" type="button" disabled={!ready||saving} onClick={()=>showForm?setShowForm(false):openLoanForm()}><span aria-hidden="true">+</span> Adaugă împrumut</button>
    </div>
    {!householdId&&<div className="emptyState">Conectează live contul Supabase pentru a vedea și salva împrumuturi.</div>}
    {error&&<p className="loansError" role="alert">{error}</p>}
    {loading&&<div className="emptyState" role="status">Se încarcă împrumuturile…</div>}

    {showForm&&<form className="loansForm" onSubmit={event=>{event.preventDefault();void save()}}>
      <h3>Împrumut nou</h3>
      <label>Tip<select value={input.direction} onChange={event=>field('direction',event.target.value as LoanInput['direction'])}><option value="given">Împrumut dat</option><option value="received">Împrumut primit</option></select></label>
      <label>{input.direction==='given'?'Cui ai dat':'De la cine ai primit'}<input required maxLength={200} value={input.counterparty} onChange={event=>field('counterparty',event.target.value)}/></label>
      <label>Suma<input required type="number" inputMode="decimal" min="0.01" step="0.01" value={input.amount} onChange={event=>field('amount',event.target.value)}/></label>
      <label>Moneda<select value={input.currency} onChange={event=>changeCurrency(event.target.value)}>{['RON','EUR','USD','GBP'].map(currency=><option key={currency}>{currency}</option>)}</select></label>
      <label>Contul tranzacției<select required value={input.account_id} onChange={event=>field('account_id',event.target.value)}><option value="">Alege contul</option>{eligibleAccounts(accounts,input.currency).map(account=><option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label>Data tranzacției<input required type="date" value={input.loan_date} onChange={event=>field('loan_date',event.target.value)}/></label>
      <label>Pentru ce<input maxLength={1000} value={input.purpose??''} onChange={event=>field('purpose',event.target.value)}/></label>
      <label className="loansWide">Notițe<textarea maxLength={4000} value={input.notes??''} onChange={event=>field('notes',event.target.value)}/></label>
      <p className="loansHint loansWide">Împrumutul și tranzacția lui se salvează împreună. Împrumutul primit intră ca venit, iar cel dat ca cheltuială.</p>
      <div className="loansActions loansWide"><button type="submit" disabled={saving}>{saving?'Se salvează…':'Salvează împrumutul și tranzacția'}</button><button type="button" disabled={saving} onClick={()=>setShowForm(false)}>Renunță</button></div>
    </form>}

    <div className="loansColumns">{(['given','received'] as const).map(direction=>{
      const entries=loans.filter(loan=>loan.direction===direction),totals=loanTotals(loans,direction)
      return <section className="loansColumn" key={direction}>
        <header><p>{direction==='given'?'DE PRIMIT':'DE PLĂTIT'}</p><h3>{direction==='given'?'Împrumuturi date':'Împrumuturi primite'}</h3><div className={direction==='given'?'loansPositive':'loansNegative'}>{!ready?'—':Object.keys(totals).length?Object.entries(totals).map(([currency,cents])=><strong key={currency}>{money(cents/100,currency)}</strong>):<strong>0 RON</strong>}</div></header>
        {ready&&!entries.length&&<div className="emptyState">Nu există împrumuturi {direction==='given'?'date':'primite'}.</div>}
        {entries.map(loan=><article className="loansEntry" key={loan.id}>
          <div className="loansEntryHeading"><h4>{loan.counterparty}</h4><span>{remaining(loan)===0?'Rambursat integral':'Activ'}</span></div>
          <time dateTime={loan.loan_date}>{new Date(loan.loan_date+'T12:00:00Z').toLocaleDateString('ro-RO',{timeZone:'UTC'})}</time>
          {loan.purpose&&<p>{loan.purpose}</p>}
          <dl><div><dt>Suma inițială</dt><dd>{money(Number(loan.amount),loan.currency)}</dd></div><div><dt>Rambursat</dt><dd>{money(Number(loan.repaid_amount),loan.currency)}</dd></div><div><dt>Rămas {direction==='given'?'de primit':'de plătit'}</dt><dd><strong>{money(remaining(loan),loan.currency)}</strong></dd></div></dl>
          {loan.notes&&<p className="loansHint">{loan.notes}</p>}
          {loan.transaction_id&&<button className="loansTransactionLink" type="button" onClick={()=>onSelectTransaction(loan.transaction_id!)}>Vezi tranzacția împrumutului</button>}
          {loan.repayments.length>0&&<div className="loanRepayments"><strong>Rambursări</strong>{[...loan.repayments].sort((a,b)=>b.repayment_date.localeCompare(a.repayment_date)).map(item=><button type="button" key={item.id} onClick={()=>onSelectTransaction(item.transaction_id)}><span>{new Date(item.repayment_date+'T12:00:00Z').toLocaleDateString('ro-RO',{timeZone:'UTC'})} · {item.account?.name??'Cont'}</span><strong>{direction==='received'?'−':'+'}{money(Number(item.amount),loan.currency)}</strong></button>)}</div>}
          {remaining(loan)>0&&(repayment?.id===loan.id?<form className="loansRepayment" onSubmit={event=>{event.preventDefault();void repay(loan)}}>
            <label>Sumă rambursată · {loan.currency}<input required type="number" inputMode="decimal" min="0.01" max={remaining(loan)} step="0.01" value={repayment.amount} onChange={event=>setRepayment({...repayment,amount:event.target.value})}/></label>
            <label>Contul tranzacției<select required value={repayment.account_id} onChange={event=>setRepayment({...repayment,account_id:event.target.value})}><option value="">Alege contul</option>{eligibleAccounts(accounts,loan.currency).map(account=><option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            <label>Data tranzacției<input required type="date" value={repayment.repayment_date} onChange={event=>setRepayment({...repayment,repayment_date:event.target.value})}/></label>
            <p className="loansHint">Rambursarea va apărea și în Tranzacții ca {direction==='received'?'cheltuială':'venit'}.</p>
            <button disabled={saving} type="submit">{saving?'Se salvează…':'Salvează rambursarea și tranzacția'}</button><button disabled={saving} type="button" onClick={()=>setRepayment(null)}>Renunță</button>
          </form>:<button disabled={saving} type="button" onClick={()=>openRepayment(loan)}>Notează rambursare</button>)}
        </article>)}
      </section>
    })}</div>
  </section>
}
