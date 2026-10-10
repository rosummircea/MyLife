import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,routeError} from '@/lib/open-banking/server'
import {syncEnableBankingSession} from '@/lib/open-banking/enable-banking/sync'

export const runtime='nodejs'

export async function POST(request:Request){
  try{
    const user=await authenticatedUser(request)
    const admin=adminClient()
    const {data:sessions,error}=await admin.from('enable_banking_sessions').select('external_session_id,provider_name,country_code,updated_at').eq('user_id',user.id).eq('status','AUTHORIZED').order('updated_at',{ascending:false})
    if(error)throw new Error(error.message)
    const seenProviders=new Set<string>()
    const latestSessions=(sessions??[]).filter(session=>{const key=`${session.provider_name??''}:${session.country_code??''}`;if(seenProviders.has(key))return false;seenProviders.add(key);return true})
    const results=[]
    for(const session of latestSessions)results.push(await syncEnableBankingSession(admin,session.external_session_id))
    return NextResponse.json({ok:true,results})
  }catch(error){
    console.error('[Enable Banking] refresh failed',error)
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
