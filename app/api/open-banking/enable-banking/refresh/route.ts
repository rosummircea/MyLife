import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,routeError} from '@/lib/open-banking/server'
import {refreshEnableBankingSessions} from '@/lib/open-banking/enable-banking/refresh'

export const runtime='nodejs'
export const maxDuration=180

export async function POST(request:Request){
  try{
    const user=await authenticatedUser(request)
    const admin=adminClient()
    const body=await request.json().catch(()=>({})) as {connectionId?:unknown}
    const connectionId=typeof body.connectionId==='string'?body.connectionId:null
    if(!connectionId)throw Object.assign(new Error('Alege conexiunea bancară pe care vrei să o actualizezi.'),{status:400})
    const results=await refreshEnableBankingSessions(admin,{userId:user.id,sessionId:connectionId,maxSessions:1,respectInterval:false})
    return NextResponse.json({ok:true,results})
  }catch(error){
    console.error('[Enable Banking] refresh failed',error)
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
