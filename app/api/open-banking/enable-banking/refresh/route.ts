import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,routeError} from '@/lib/open-banking/server'
import {syncEnableBankingSession} from '@/lib/open-banking/enable-banking/sync'

export const runtime='nodejs'

export async function POST(request:Request){
  try{
    const user=await authenticatedUser(request)
    const admin=adminClient()
    const {data:sessions,error}=await admin.from('enable_banking_sessions').select('external_session_id').eq('user_id',user.id).eq('status','AUTHORIZED')
    if(error)throw new Error(error.message)
    const results=[]
    for(const session of sessions??[])results.push(await syncEnableBankingSession(admin,session.external_session_id))
    return NextResponse.json({ok:true,results})
  }catch(error){
    console.error('[Enable Banking] refresh failed',error)
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
