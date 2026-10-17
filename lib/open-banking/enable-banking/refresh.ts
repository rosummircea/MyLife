import 'server-only'

import type {SupabaseClient} from '@supabase/supabase-js'
import {syncEnableBankingSession} from './sync'

type SessionRow={external_session_id:string}

export async function refreshEnableBankingSessions(admin:SupabaseClient,options:{userId?:string;continueOnError?:boolean}={}){
  let query=admin.from('enable_banking_sessions').select('external_session_id').eq('status','AUTHORIZED').order('updated_at',{ascending:false})
  if(options.userId)query=query.eq('user_id',options.userId)
  const {data,error}=await query
  if(error)throw new Error(error.message)

  const sessions=(data as SessionRow[]|null)??[]
  const results=[]
  for(const session of sessions){
    try{
      results.push({sessionId:session.external_session_id,ok:true,result:await syncEnableBankingSession(admin,session.external_session_id)})
    }catch(error){
      if(!options.continueOnError)throw error
      const message=error instanceof Error?error.message:'Sincronizarea nu a reușit.'
      console.error(`[Enable Banking] scheduled refresh failed for session ${session.external_session_id}`,error)
      results.push({sessionId:session.external_session_id,ok:false,error:message})
    }
  }
  return results
}
