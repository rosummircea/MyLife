import 'server-only'

import type {SupabaseClient} from '@supabase/supabase-js'
import {saltedgeList,saltedgeRequest} from './api'

type Connection={id:string;customer_id:string;provider_code?:string;provider_name?:string;country_code?:string;status?:string;last_attempt?:{last_stage?:{name?:string};custom_fields?:Record<string,unknown>}}
type Account={id:string;connection_id:string;name:string;nature?:string;balance?:number;currency_code:string;extra?:Record<string,unknown>}
type Transaction={id:string;account_id:string;duplicated?:boolean;mode?:string;status?:string;made_on:string;amount:number;currency_code:string;description?:string;category?:string;extra?:Record<string,unknown>}

function text(value:unknown){return typeof value==='string'?value:null}
function number(value:unknown){return typeof value==='number'&&Number.isFinite(value)?value:null}

export async function syncSaltEdgeConnection(admin:SupabaseClient,saltedgeConnectionId:string){
  const connection=(await saltedgeRequest<Connection>(`/connections/${encodeURIComponent(saltedgeConnectionId)}?include_holder_info=true`)).data
  const {data:customer,error:customerError}=await admin.from('open_banking_customers').select('id,user_id,household_id').eq('saltedge_customer_id',connection.customer_id).maybeSingle()
  if(customerError)throw new Error(customerError.message)
  if(!customer)throw new Error('Clientul Salt Edge nu este asociat unui profil MyLife.')

  const now=new Date().toISOString()
  const {data:storedConnection,error:connectionError}=await admin.from('open_banking_connections').upsert({
    customer_id:customer.id,user_id:customer.user_id,household_id:customer.household_id,
    saltedge_connection_id:connection.id,provider_code:connection.provider_code??null,provider_name:connection.provider_name??null,
    country_code:connection.country_code??null,status:connection.status??'pending',stage:connection.last_attempt?.last_stage?.name??null,
    last_error_class:null,last_error_message:null,last_synced_at:now,raw:connection,updated_at:now,
  },{onConflict:'saltedge_connection_id'}).select('id').single()
  if(connectionError)throw new Error(connectionError.message)

  const accounts=await saltedgeList<Account>('/accounts',{connection_id:connection.id})
  const accountIds=new Map<string,string>()
  for(const account of accounts){
    const extra=account.extra??{}
    const iban=text(extra.iban)
    const {data:stored,error}=await admin.from('open_banking_accounts').upsert({
      connection_id:storedConnection.id,user_id:customer.user_id,household_id:customer.household_id,
      saltedge_account_id:account.id,name:account.name||'Cont bancar',nature:account.nature??null,currency:account.currency_code,
      balance:number(account.balance),available_amount:number(extra.available_amount),iban_last4:iban?iban.slice(-4):null,status:text(extra.status),raw:account,updated_at:now,
    },{onConflict:'saltedge_account_id'}).select('id').single()
    if(error)throw new Error(error.message)
    accountIds.set(account.id,stored.id)
  }

  const transactions=[
    ...await saltedgeList<Transaction>('/transactions',{connection_id:connection.id}),
    ...await saltedgeList<Transaction>('/transactions',{connection_id:connection.id,pending:'true'}),
  ]
  for(let offset=0;offset<transactions.length;offset+=250){
    const batch=transactions.slice(offset,offset+250).flatMap(transaction=>{
      const accountId=accountIds.get(transaction.account_id)
      if(!accountId)return []
      return [{connection_id:storedConnection.id,account_id:accountId,user_id:customer.user_id,household_id:customer.household_id,
        saltedge_transaction_id:transaction.id,status:transaction.status??'posted',duplicated:Boolean(transaction.duplicated),mode:transaction.mode??null,
        made_on:transaction.made_on,amount:transaction.amount,currency:transaction.currency_code,description:transaction.description??null,
        category:transaction.category??null,raw:transaction,updated_at:now}]
    })
    if(!batch.length)continue
    const {error}=await admin.from('open_banking_transactions').upsert(batch,{onConflict:'saltedge_transaction_id'})
    if(error)throw new Error(error.message)
  }
  return {connectionId:storedConnection.id,accounts:accounts.length,transactions:transactions.length}
}
