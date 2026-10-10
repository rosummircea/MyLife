import 'server-only'

import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {enableBankingRequest} from './api'

type Money={currency:string;amount:string}
type Account={uid:string;name?:string;details?:string;cash_account_type?:string;currency?:string;psu_status?:string;account_id?:{iban?:string};all_account_ids?:Array<{identification?:string;scheme_name?:string}>}
type Balance={name:string;balance_amount:Money;balance_type:string}
type BankTransaction={transaction_id?:string;entry_reference?:string;status?:string;booking_date?:string;value_date?:string;transaction_date?:string;credit_debit_indicator?:string;transaction_amount:Money;creditor?:{name?:string};debtor?:{name?:string};merchant_category_code?:string;remittance_information?:string[];note?:string;bank_transaction_code?:{description?:string}}
type Session={status:string;aspsp:{name:string;country:string};access:{valid_until?:string};accounts:string[];accounts_data?:Array<{uid:string}>}
type TransactionsPage={transactions:BankTransaction[];continuation_key?:string|null}

function finite(value:unknown){const parsed=Number(value);return Number.isFinite(parsed)?parsed:null}
function balanceOf(rows:Balance[],types:string[]){for(const type of types){const row=rows.find(item=>item.balance_type===type);const amount=finite(row?.balance_amount.amount);if(amount!==null)return amount}return null}
function dateOf(transaction:BankTransaction){return transaction.booking_date||transaction.value_date||transaction.transaction_date||new Date().toISOString().slice(0,10)}
function descriptionOf(transaction:BankTransaction){return transaction.remittance_information?.filter(Boolean).join(' · ')||transaction.note||transaction.bank_transaction_code?.description||transaction.creditor?.name||transaction.debtor?.name||'Tranzacție bancară'}
function transactionId(accountId:string,transaction:BankTransaction){
  if(transaction.transaction_id)return transaction.transaction_id
  return createHash('sha256').update(JSON.stringify([accountId,transaction.entry_reference,dateOf(transaction),transaction.transaction_amount,transaction.credit_debit_indicator,transaction.remittance_information])).digest('hex')
}

async function transactionsForAccount(accountId:string){
  const rows:BankTransaction[]=[]
  let continuation:string|undefined
  const end=new Date(),start=new Date(Date.UTC(end.getUTCFullYear()-1,end.getUTCMonth(),end.getUTCDate()))
  for(let page=0;page<100;page++){
    const query=new URLSearchParams({date_from:start.toISOString().slice(0,10),date_to:end.toISOString().slice(0,10)})
    if(continuation)query.set('continuation_key',continuation)
    const payload=await enableBankingRequest<TransactionsPage>(`/accounts/${encodeURIComponent(accountId)}/transactions?${query}`)
    rows.push(...(payload.transactions??[]))
    const next=payload.continuation_key||undefined
    if(!next||next===continuation)break
    continuation=next
  }
  return rows
}

export async function syncEnableBankingSession(admin:SupabaseClient,externalSessionId:string){
  const {data:storedSession,error:lookupError}=await admin.from('enable_banking_sessions').select('id,user_id,household_id').eq('external_session_id',externalSessionId).maybeSingle()
  if(lookupError)throw new Error(lookupError.message)
  if(!storedSession)throw new Error('Sesiunea Enable Banking nu este asociată unui profil MyLife.')

  const session=await enableBankingRequest<Session>(`/sessions/${encodeURIComponent(externalSessionId)}`)
  const now=new Date().toISOString()
  const {error:sessionError}=await admin.from('enable_banking_sessions').update({provider_name:session.aspsp.name,country_code:session.aspsp.country,status:session.status,consent_valid_until:session.access?.valid_until??null,last_error_message:null,last_synced_at:now,raw:session,updated_at:now}).eq('id',storedSession.id)
  if(sessionError)throw new Error(sessionError.message)

  let transactionCount=0
  const accountIds=session.accounts?.length?session.accounts:(session.accounts_data??[]).map(account=>account.uid)
  for(const externalAccountId of accountIds){
    const [details,balances,transactions]=await Promise.all([
      enableBankingRequest<Account>(`/accounts/${encodeURIComponent(externalAccountId)}/details`),
      enableBankingRequest<{balances:Balance[]}>(`/accounts/${encodeURIComponent(externalAccountId)}/balances`),
      transactionsForAccount(externalAccountId),
    ])
    const iban=details.account_id?.iban||details.all_account_ids?.find(item=>item.scheme_name==='IBAN')?.identification
    const booked=balanceOf(balances.balances??[],['CLBD','ITBD','VALU','OTHR'])
    const available=balanceOf(balances.balances??[],['CLAV','ITAV','FWAV','OPAV'])
    const currency=details.currency||balances.balances?.[0]?.balance_amount.currency||'RON'
    const {data:storedAccount,error:accountError}=await admin.from('enable_banking_accounts').upsert({session_id:storedSession.id,user_id:storedSession.user_id,household_id:storedSession.household_id,external_account_id:externalAccountId,name:details.name||details.details||'Cont bancar',nature:details.cash_account_type??null,currency,balance:booked??available,available_amount:available??booked,iban_last4:iban?.slice(-4)??null,status:details.psu_status??null,raw:{details,balances:balances.balances??[]},updated_at:now},{onConflict:'external_account_id'}).select('id').single()
    if(accountError)throw new Error(accountError.message)

    for(let offset=0;offset<transactions.length;offset+=250){
      const batch=transactions.slice(offset,offset+250).flatMap(transaction=>{
        const rawAmount=finite(transaction.transaction_amount?.amount)
        if(rawAmount===null)return []
        const signedAmount=transaction.credit_debit_indicator==='DBIT'?-Math.abs(rawAmount):Math.abs(rawAmount)
        return [{session_id:storedSession.id,account_id:storedAccount.id,user_id:storedSession.user_id,household_id:storedSession.household_id,external_transaction_id:transactionId(externalAccountId,transaction),status:transaction.status||'BOOK',made_on:dateOf(transaction),amount:signedAmount,currency:transaction.transaction_amount.currency||currency,description:descriptionOf(transaction),merchant_name:transaction.credit_debit_indicator==='DBIT'?transaction.creditor?.name??null:transaction.debtor?.name??null,merchant_category_code:transaction.merchant_category_code??null,raw:transaction,updated_at:now}]
      })
      if(batch.length){const {error}=await admin.from('enable_banking_transactions').upsert(batch,{onConflict:'account_id,external_transaction_id'});if(error)throw new Error(error.message)}
    }
    transactionCount+=transactions.length
  }
  return {accounts:accountIds.length,transactions:transactionCount,status:session.status}
}
