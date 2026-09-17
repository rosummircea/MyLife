import type { SupabaseClient } from '@supabase/supabase-js'
export type Loan = {id:string;household_id:string;direction:'given'|'received';counterparty:string;amount:number|string;currency:string;loan_date:string;purpose:string|null;notes:string|null;repaid_amount:number|string;created_at:string}
export type LoanInput = Pick<Loan,'direction'|'counterparty'|'amount'|'currency'|'loan_date'|'purpose'|'notes'>
export function remaining(loan:Loan) {return Math.max(0,Math.round(Number(loan.amount)*100)-Math.round(Number(loan.repaid_amount)*100))/100}
export function loanTotals(loans:Loan[],direction:Loan['direction']) {return loans.filter(loan=>loan.direction===direction).reduce<Record<string,number>>((totals,loan)=>{const currency=loan.currency.trim();totals[currency]=(totals[currency]??0)+Math.round(remaining(loan)*100);return totals},{})}
export function validateLoan(input:LoanInput) {
  if(!input.counterparty.trim())throw Error('Completează numele persoanei.')
  const cents=Math.round(Number(input.amount)*100)
  if(!Number.isFinite(cents)||cents<=0||Math.abs(Number(input.amount)*100-cents)>0.00001)throw Error('Suma trebuie să fie pozitivă, cu cel mult două zecimale.')
  if(!/^[A-Z]{3}$/.test(input.currency))throw Error('Selectează moneda.')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.loan_date)||Number.isNaN(Date.parse(input.loan_date))||new Date(input.loan_date).toISOString().slice(0,10)!==input.loan_date)throw Error('Completează o dată validă.')
  return {...input,counterparty:input.counterparty.trim(),amount:cents/100,purpose:input.purpose?.trim()||null,notes:input.notes?.trim()||null}
}
const fields='id,household_id,direction,counterparty,amount,currency,loan_date,purpose,notes,repaid_amount,created_at'
export async function loadLoans(client:SupabaseClient,householdId:string):Promise<Loan[]> {
  const {data,error}=await client.auth.getUser();if(error||!data.user)throw Error('Conectează contul pentru împrumuturi.')
  const rows:Loan[]=[]
  for(let from=0;;from+=500){const {data,error}=await client.from('finance_loans').select(fields).eq('household_id',householdId).order('loan_date',{ascending:false}).order('id').range(from,from+499);if(error)throw Error(error.code==='42P01'||error.code==='PGRST205'?'Salvarea împrumuturilor necesită tabelul finance_loans în Supabase.':error.message);rows.push(...(data??[]) as Loan[]);if(!data||data.length<500)return rows}
}
export async function createLoan(client:SupabaseClient,householdId:string,input:LoanInput):Promise<Loan> {
  const clean=validateLoan(input);const {data:auth,error:authError}=await client.auth.getUser();if(authError||!auth.user)throw Error('Sesiunea a expirat. Reconectează contul.')
  const {data,error}=await client.from('finance_loans').insert({...clean,household_id:householdId,created_by_user_id:auth.user.id,repaid_amount:0}).select(fields).single();if(error)throw Error(error.message);return data as Loan
}
export async function repayLoan(client:SupabaseClient,loan:Loan,amount:number):Promise<Loan> {
  const cents=Math.round(amount*100);if(!Number.isFinite(cents)||cents<=0||cents>Math.round(remaining(loan)*100)||Math.abs(amount*100-cents)>0.00001)throw Error('Rambursarea trebuie să fie pozitivă și cel mult egală cu suma rămasă.')
  const {data:auth,error:authError}=await client.auth.getUser();if(authError||!auth.user)throw Error('Sesiunea a expirat.')
  const total=(Math.round(Number(loan.repaid_amount)*100)+cents)/100
  const {data,error}=await client.from('finance_loans').update({repaid_amount:total}).eq('id',loan.id).eq('household_id',loan.household_id).eq('repaid_amount',loan.repaid_amount).select(fields).maybeSingle();if(error)throw Error(error.message);if(!data)throw Error('Împrumutul s-a modificat între timp. Actualizează lista.');return data as Loan
}
