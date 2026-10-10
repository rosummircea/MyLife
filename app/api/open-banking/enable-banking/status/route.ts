import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,routeError} from '@/lib/open-banking/server'
import {enableBankingMode} from '@/lib/open-banking/enable-banking/api'

export const runtime='nodejs'

export async function GET(request:Request){
  try{
    const user=await authenticatedUser(request)
    const admin=adminClient()
    const {data:sessions,error}=await admin.from('enable_banking_sessions').select('id,provider_name,country_code,status,last_error_message,last_synced_at,updated_at,accounts:enable_banking_accounts(id,name,nature,currency,balance,available_amount,iban_last4,status,finance_account_id)').eq('user_id',user.id).order('updated_at',{ascending:false})
    if(error)throw new Error(error.message)
    const activeSessions=(sessions??[]).filter(session=>(session.accounts??[]).length>0)
    const accountIds=activeSessions.flatMap(session=>session.accounts??[]).map(account=>account.id)
    const accountSummaries=new Map<string,{transaction_count:number;transactions:unknown[]}>()
    await Promise.all(accountIds.map(async accountId=>{
      const {data:transactions,count,error:transactionsError}=await admin.from('enable_banking_transactions').select('id,account_id,status,made_on,amount,currency,description,merchant_name,merchant_category_code',{count:'exact'}).eq('user_id',user.id).eq('account_id',accountId).order('made_on',{ascending:false}).range(0,4)
      if(transactionsError)throw new Error(transactionsError.message)
      accountSummaries.set(accountId,{transaction_count:count??0,transactions:transactions??[]})
    }))
    const connections=activeSessions.map(session=>({...session,accounts:(session.accounts??[]).map(account=>({...account,...(accountSummaries.get(account.id)??{transaction_count:0,transactions:[]})})),status:session.status==='AUTHORIZED'?'active':'inactive',provider_code:'enable-banking',stage:null,consent_status:session.status}))
    return NextResponse.json({connections,mode:enableBankingMode()})
  }catch(error){
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
