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
    const connections=(sessions??[]).map(session=>({...session,status:session.status==='AUTHORIZED'?'active':'inactive',provider_code:'enable-banking',stage:null,consent_status:session.status}))
    return NextResponse.json({connections,mode:enableBankingMode()})
  }catch(error){
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
