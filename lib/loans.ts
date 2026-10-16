import type { SupabaseClient } from '@supabase/supabase-js'
export type LoanRepayment={id:string;loan_id:string;transaction_id:string;account_id:string;amount:number|string;repayment_date:string;created_at:string;account:{name:string}|null}
export type Loan = {id:string;household_id:string;direction:'given'|'received';counterparty:string;amount:number|string;currency:string;loan_date:string;purpose:string|null;notes:string|null;repaid_amount:number|string;transaction_id:string|null;created_at:string;repayments:LoanRepayment[]}
export type LoanInput = Pick<Loan,'direction'|'counterparty'|'amount'|'currency'|'loan_date'|'purpose'|'notes'> & {account_id:string}
export type RepaymentInput={amount:string;account_id:string;repayment_date:string}
export function remaining(loan:Loan) {return Math.max(0,Math.round(Number(loan.amount)*100)-Math.round(Number(loan.repaid_amount)*100))/100}
export function loanTotals(loans:Loan[],direction:Loan['direction']) {return loans.filter(loan=>loan.direction===direction).reduce<Record<string,number>>((totals,loan)=>{const currency=loan.currency.trim();totals[currency]=(totals[currency]??0)+Math.round(remaining(loan)*100);return totals},{})}
export function validateLoan(input:LoanInput) {
  if(!input.counterparty.trim())throw Error('Completează numele persoanei.')
  const cents=Math.round(Number(input.amount)*100)
  if(!Number.isFinite(cents)||cents<=0||Math.abs(Number(input.amount)*100-cents)>0.00001)throw Error('Suma trebuie să fie pozitivă, cu cel mult două zecimale.')
  if(!/^[A-Z]{3}$/.test(input.currency))throw Error('Selectează moneda.')
  if(!input.account_id)throw Error('Alege contul tranzacției.')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.loan_date)||Number.isNaN(Date.parse(input.loan_date))||new Date(input.loan_date).toISOString().slice(0,10)!==input.loan_date)throw Error('Completează o dată validă.')
  return {...input,counterparty:input.counterparty.trim(),amount:cents/100,purpose:input.purpose?.trim()||null,notes:input.notes?.trim()||null}
}
const fields='id,household_id,direction,counterparty,amount,currency,loan_date,purpose,notes,repaid_amount,transaction_id,created_at,repayments:finance_loan_repayments(id,loan_id,transaction_id,account_id,amount,repayment_date,created_at,account:finance_accounts!account_id(name))'
type RawLoan=Omit<Loan,'repayments'>&{repayments:Array<Omit<LoanRepayment,'account'>&{account:{name:string}|Array<{name:string}>|null}>}
function normalizeLoan(row:RawLoan):Loan{return {...row,repayments:(row.repayments??[]).map(item=>({...item,account:Array.isArray(item.account)?item.account[0]??null:item.account}))}}
export async function loadLoans(client:SupabaseClient,householdId:string):Promise<Loan[]> {
  const {data,error}=await client.auth.getUser();if(error||!data.user)throw Error('Conectează contul pentru împrumuturi.')
  const rows:Loan[]=[]
  for(let from=0;;from+=500){const {data,error}=await client.from('finance_loans').select(fields).eq('household_id',householdId).order('loan_date',{ascending:false}).order('id').range(from,from+499);if(error)throw Error(error.code==='42P01'||error.code==='PGRST205'?'Salvarea împrumuturilor necesită tabelul finance_loans în Supabase.':error.message);rows.push(...((data??[]) as unknown as RawLoan[]).map(normalizeLoan));if(!data||data.length<500)return rows}
}
export async function createLoan(client:SupabaseClient,householdId:string,input:LoanInput):Promise<Loan> {
  const clean=validateLoan(input);const {data:auth,error:authError}=await client.auth.getUser();if(authError||!auth.user)throw Error('Sesiunea a expirat. Reconectează contul.')
  const {data,error}=await client.rpc('finance_create_loan_with_transaction',{p_household_id:householdId,p_direction:clean.direction,p_counterparty:clean.counterparty,p_amount:clean.amount,p_currency:clean.currency,p_day:clean.loan_date,p_account_id:clean.account_id,p_purpose:clean.purpose,p_notes:clean.notes});if(error)throw Error(error.message);return {...data,repayments:[]} as Loan
}
export async function repayLoan(client:SupabaseClient,loan:Loan,input:RepaymentInput):Promise<Loan> {
  const amount=Number(input.amount.replace(',','.'))
  const cents=Math.round(amount*100);if(!Number.isFinite(cents)||cents<=0||cents>Math.round(remaining(loan)*100)||Math.abs(amount*100-cents)>0.00001)throw Error('Rambursarea trebuie să fie pozitivă și cel mult egală cu suma rămasă.')
  if(!input.account_id)throw Error('Alege contul tranzacției.')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.repayment_date)||Number.isNaN(Date.parse(input.repayment_date))||new Date(input.repayment_date).toISOString().slice(0,10)!==input.repayment_date)throw Error('Completează data rambursării.')
  const {data:auth,error:authError}=await client.auth.getUser();if(authError||!auth.user)throw Error('Sesiunea a expirat.')
  const {data,error}=await client.rpc('finance_repay_loan_with_transaction',{p_loan_id:loan.id,p_amount:cents/100,p_day:input.repayment_date,p_account_id:input.account_id});if(error)throw Error(error.message);return {...data,repayments:loan.repayments} as Loan
}
