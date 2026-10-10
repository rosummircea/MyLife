import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,routeError} from '@/lib/open-banking/server'

export const runtime='nodejs'

type ImportBody={transactionIds?:string[];affectsBalance?:boolean}

export async function POST(request:Request,{params}:{params:Promise<{accountId:string}>}){
  try{
    const user=await authenticatedUser(request)
    const {accountId}=await params
    const body=await request.json() as ImportBody
    const transactionIds=Array.from(new Set((body.transactionIds??[]).filter(Boolean))).slice(0,200)
    if(!transactionIds.length)throw Object.assign(new Error('Selectează cel puțin o tranzacție.'),{status:400})
    const admin=adminClient()
    const {data:bankAccount,error:accountError}=await admin.from('enable_banking_accounts').select('id,household_id,finance_account_id,currency').eq('id',accountId).eq('user_id',user.id).maybeSingle()
    if(accountError)throw new Error(accountError.message)
    if(!bankAccount)throw Object.assign(new Error('Contul sincronizat nu există.'),{status:404})
    if(!bankAccount.finance_account_id)throw Object.assign(new Error('Leagă mai întâi contul sincronizat de un cont MyLife.'),{status:400})
    const {data:financeAccount,error:financeError}=await admin.from('finance_accounts').select('id,household_id,currency,is_active').eq('id',bankAccount.finance_account_id).eq('household_id',bankAccount.household_id).maybeSingle()
    if(financeError)throw new Error(financeError.message)
    if(!financeAccount||financeAccount.is_active===false)throw Object.assign(new Error('Contul MyLife asociat nu mai este disponibil.'),{status:400})
    const {data:person,error:personError}=await admin.from('people').select('id').eq('auth_user_id',user.id).maybeSingle()
    if(personError)throw new Error(personError.message)
    if(!person)throw Object.assign(new Error('Profilul MyLife nu este asociat utilizatorului.'),{status:400})
    const {data:bankTransactions,error:transactionsError}=await admin.from('enable_banking_transactions').select('id,external_transaction_id,status,made_on,amount,currency,description,merchant_name').eq('user_id',user.id).eq('account_id',bankAccount.id).in('id',transactionIds)
    if(transactionsError)throw new Error(transactionsError.message)
    const {data:existing,error:existingError}=await admin.from('finance_transactions').select('id,import_metadata').eq('household_id',bankAccount.household_id).eq('account_id',financeAccount.id).eq('status','posted')
    if(existingError)throw new Error(existingError.message)
    const importedIds=new Set((existing??[]).map(row=>(row.import_metadata as Record<string,unknown>|null)?.enable_banking_transaction_id).filter((value):value is string=>typeof value==='string'))
    const now=new Date().toISOString()
    const rows=(bankTransactions??[]).filter(transaction=>!importedIds.has(transaction.id)).map(transaction=>{
      const signedAmount=Number(transaction.amount)
      const title=transaction.merchant_name||transaction.description||'Tranzacție Revolut'
      return {id:transaction.id,household_id:bankAccount.household_id,account_id:financeAccount.id,transfer_account_id:null,created_by_person_id:person.id,transaction_type:signedAmount<0?'expense':'income',amount:Math.abs(signedAmount),currency:String(transaction.currency||financeAccount.currency).trim().toUpperCase(),transaction_date:`${transaction.made_on}T12:00:00+03:00`,merchant:transaction.merchant_name,description:transaction.description,status:'posted',source:'manual',date_precision:'date',import_metadata:{title,affects_balance:body.affectsBalance===true,imported_from:'Revolut',enable_banking_transaction_id:transaction.id,enable_banking_external_transaction_id:transaction.external_transaction_id,enable_banking_account_id:bankAccount.id,imported_at:now}}
    })
    if(rows.length){const {error:insertError}=await admin.from('finance_transactions').upsert(rows,{onConflict:'id'});if(insertError)throw new Error(insertError.message)}
    return NextResponse.json({imported:rows.length,skipped:transactionIds.length-rows.length})
  }catch(error){
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
