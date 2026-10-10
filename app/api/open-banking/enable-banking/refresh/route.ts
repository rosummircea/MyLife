import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,routeError} from '@/lib/open-banking/server'
import {refreshEnableBankingSessions} from '@/lib/open-banking/enable-banking/refresh'

export const runtime='nodejs'

export async function POST(request:Request){
  try{
    const user=await authenticatedUser(request)
    const admin=adminClient()
    const results=await refreshEnableBankingSessions(admin,{userId:user.id})
    return NextResponse.json({ok:true,results})
  }catch(error){
    console.error('[Enable Banking] refresh failed',error)
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
