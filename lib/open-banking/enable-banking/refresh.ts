import 'server-only'

import type {SupabaseClient} from '@supabase/supabase-js'
import {syncEnableBankingSession} from './sync'

type SessionRow={id:string;external_session_id:string;last_synced_at:string|null;last_error_message:string|null;updated_at:string}

const BACKGROUND_REFRESH_INTERVAL_MS=6*60*60*1000

export async function refreshEnableBankingSessions(admin:SupabaseClient,options:{userId?:string;sessionId?:string;continueOnError?:boolean;maxSessions?:number;respectInterval?:boolean}={}){
  let query=admin.from('enable_banking_sessions').select('id,external_session_id,last_synced_at,last_error_message,updated_at').eq('status','AUTHORIZED')
  if(options.userId)query=query.eq('user_id',options.userId)
  if(options.sessionId)query=query.eq('id',options.sessionId)
  const {data,error}=await query
  if(error)throw new Error(error.message)

  const now=Date.now()
  const respectInterval=options.respectInterval!==false
  const sessions=((data as SessionRow[]|null)??[]).map(session=>{
    // Failed bank attempts use updated_at as their cooldown anchor so one bank
    // cannot monopolize every staggered cron slot and starve the other banks.
    const attemptedAt=session.last_error_message?session.updated_at:session.last_synced_at
    const attemptedMs=attemptedAt?new Date(attemptedAt).getTime():0
    return {session,attemptedMs,nextRefreshAt:attemptedMs+BACKGROUND_REFRESH_INTERVAL_MS}
  }).sort((a,b)=>a.attemptedMs-b.attemptedMs)
  const due=sessions.filter(item=>!respectInterval||!item.attemptedMs||item.nextRefreshAt<=now)
  const selected=typeof options.maxSessions==='number'?due.slice(0,Math.max(0,options.maxSessions)):due
  const results=[]
  for(const {session} of selected){
    try{
      results.push({sessionId:session.external_session_id,ok:true,result:await syncEnableBankingSession(admin,session.external_session_id)})
    }catch(error){
      if(!options.continueOnError)throw error
      const message=error instanceof Error?error.message:'Sincronizarea nu a reușit.'
      console.error(`[Enable Banking] scheduled refresh failed for session ${session.external_session_id}`,error)
      results.push({sessionId:session.external_session_id,ok:false,error:message})
    }
  }
  if(!selected.length&&options.sessionId)throw Object.assign(new Error('Conexiunea bancară nu este disponibilă.'),{status:404})
  return results
}
