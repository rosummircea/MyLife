import {createHash} from 'node:crypto'
import {NextRequest,NextResponse} from 'next/server'
import {adminClient} from '@/lib/open-banking/server'
import {enableBankingRequest} from '@/lib/open-banking/enable-banking/api'
import {syncEnableBankingSession} from '@/lib/open-banking/enable-banking/sync'

export const runtime='nodejs'

type SessionResponse={session_id:string;accounts:Array<{uid:string}>;aspsp:{name:string;country:string};psu_type:string;access:{valid_until?:string}}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex')

function back(request:NextRequest,status:string){
  const origin=process.env.NEXT_PUBLIC_APP_URL||request.nextUrl.origin
  return NextResponse.redirect(new URL(`/?module=finance&tab=accounts&bank=${encodeURIComponent(status)}`,origin))
}

export async function GET(request:NextRequest){
  const state=request.nextUrl.searchParams.get('state')||''
  const code=request.nextUrl.searchParams.get('code')||''
  const remoteError=request.nextUrl.searchParams.get('error_description')||request.nextUrl.searchParams.get('error')
  if(!state)return back(request,'invalid-state')
  const admin=adminClient()
  try{
    const {data:authorization,error}=await admin.from('enable_banking_authorizations').select('*').eq('state_hash',hash(state)).maybeSingle()
    if(error)throw new Error(error.message)
    if(!authorization||authorization.status!=='pending'||new Date(authorization.expires_at).getTime()<Date.now())return back(request,'expired')
    if(remoteError||!code){
      await admin.from('enable_banking_authorizations').update({status:'failed',error_message:remoteError||'Autorizarea a fost anulată.',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',authorization.id)
      return back(request,'cancelled')
    }

    const session=await enableBankingRequest<SessionResponse>('/sessions',{method:'POST',body:JSON.stringify({code})})
    const now=new Date().toISOString()
    if(!session.accounts?.length){
      await admin.from('enable_banking_authorizations').update({status:'failed',completed_at:now,error_message:'Enable Banking nu a returnat niciun cont. Contul trebuie permis mai întâi pentru aplicația live restricționată.',updated_at:now}).eq('id',authorization.id)
      return back(request,'no-accounts')
    }
    const {error:insertError}=await admin.from('enable_banking_sessions').upsert({authorization_id:authorization.id,user_id:authorization.user_id,household_id:authorization.household_id,external_session_id:session.session_id,provider_name:session.aspsp.name,country_code:session.aspsp.country,status:'AUTHORIZED',consent_valid_until:session.access?.valid_until??null,raw:session,updated_at:now},{onConflict:'external_session_id'})
    if(insertError)throw new Error(insertError.message)
    const {error:completeError}=await admin.from('enable_banking_authorizations').update({status:'completed',completed_at:now,error_message:null,updated_at:now}).eq('id',authorization.id)
    if(completeError)throw new Error(completeError.message)
    await syncEnableBankingSession(admin,session.session_id)
    return back(request,'connected')
  }catch(error){
    console.error('[Enable Banking] callback failed',error)
    const {data:authorization}=await admin.from('enable_banking_authorizations').select('id').eq('state_hash',hash(state)).maybeSingle()
    if(authorization)await admin.from('enable_banking_authorizations').update({status:'failed',error_message:error instanceof Error?error.message:'Conectarea nu a putut fi finalizată.',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',authorization.id)
    return back(request,'failed')
  }
}
