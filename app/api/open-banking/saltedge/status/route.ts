import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,routeError} from '@/lib/open-banking/server'

export const runtime='nodejs'

export async function GET(request:Request){
  try{
    const user=await authenticatedUser(request)
    const admin=adminClient()
    const {data:connections,error}=await admin.from('open_banking_connections')
      .select('id,provider_code,provider_name,country_code,status,stage,consent_status,last_error_class,last_error_message,last_synced_at,updated_at,accounts:open_banking_accounts(id,name,nature,currency,balance,available_amount,iban_last4,status,finance_account_id)')
      .eq('user_id',user.id).order('updated_at',{ascending:false})
    if(error)throw new Error(error.message)
    return NextResponse.json({connections:connections??[],mode:process.env.SALTEDGE_LIVE==='true'?'live':'test'})
  }catch(error){
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
