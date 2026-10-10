import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,routeError} from '@/lib/open-banking/server'

export const runtime='nodejs'

export async function DELETE(request:Request){
  try{
    const user=await authenticatedUser(request)
    const admin=adminClient()
    const {data:sessions,error:lookupError}=await admin.from('enable_banking_sessions').select('id').eq('user_id',user.id).ilike('provider_name','%mock%')
    if(lookupError)throw new Error(lookupError.message)
    const sessionIds=(sessions??[]).map(session=>session.id)
    if(sessionIds.length){
      const {error:deleteSessionsError}=await admin.from('enable_banking_sessions').delete().eq('user_id',user.id).in('id',sessionIds)
      if(deleteSessionsError)throw new Error(deleteSessionsError.message)
    }
    const {error:deleteAuthorizationsError}=await admin.from('enable_banking_authorizations').delete().eq('user_id',user.id).ilike('provider_name','%mock%')
    if(deleteAuthorizationsError)throw new Error(deleteAuthorizationsError.message)
    return NextResponse.json({deleted_sessions:sessionIds.length})
  }catch(error){
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
