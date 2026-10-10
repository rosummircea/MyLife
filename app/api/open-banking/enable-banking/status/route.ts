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
    const seenProviders=new Set<string>()
    const latestSessions=(sessions??[]).filter(session=>{const key=`${session.provider_name??''}:${session.country_code??''}`;if(seenProviders.has(key))return false;seenProviders.add(key);return true})
    const accountIds=latestSessions.flatMap(session=>session.accounts??[]).map(account=>account.id)
    const transactionsByAccount=new Map<string,unknown[]>()
    if(accountIds.length){
      const {data:transactions,error:transactionsError}=await admin.from('enable_banking_transactions').select('id,account_id,status,made_on,amount,currency,description,merchant_name,merchant_category_code').eq('user_id',user.id).in('account_id',accountIds).order('made_on',{ascending:false}).limit(500)
      if(transactionsError)throw new Error(transactionsError.message)
      for(const transaction of transactions??[]){
        const rows=transactionsByAccount.get(transaction.account_id)??[]
        rows.push(transaction)
        transactionsByAccount.set(transaction.account_id,rows)
      }
    }
    const connections=latestSessions.map(session=>({...session,accounts:(session.accounts??[]).map(account=>({...account,transactions:transactionsByAccount.get(account.id)??[]})),status:session.status==='AUTHORIZED'?'active':'inactive',provider_code:'enable-banking',stage:null,consent_status:session.status}))
    return NextResponse.json({connections,mode:enableBankingMode()})
  }catch(error){
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
