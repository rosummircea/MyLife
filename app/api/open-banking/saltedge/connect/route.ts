import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,householdForUser,routeError} from '@/lib/open-banking/server'
import {SaltEdgeApiError,saltedgeList,saltedgeRequest} from '@/lib/open-banking/saltedge/api'

export const runtime='nodejs'

type Customer={customer_id:string;identifier:string}
type ConnectResponse={connect_url:string;expires_at:string;customer_id:string}

async function ensureCustomer(userId:string,householdId:string){
  const admin=adminClient()
  const {data:existing,error}=await admin.from('open_banking_customers').select('*').eq('user_id',userId).eq('household_id',householdId).maybeSingle()
  if(error)throw new Error(error.message)
  if(existing)return existing
  const identifier=`mylife_${userId}`
  let remote:Customer|undefined
  try{
    remote=(await saltedgeRequest<Customer>('/customers',{method:'POST',body:JSON.stringify({data:{identifier}})})).data
  }catch(reason){
    if(!(reason instanceof SaltEdgeApiError)||reason.errorClass!=='DuplicatedCustomer')throw reason
    remote=(await saltedgeList<Customer>('/customers',{})).find(customer=>customer.identifier===identifier)
    if(!remote)throw new Error('Clientul Salt Edge există, dar nu a putut fi identificat.')
  }
  const {data:stored,error:storeError}=await admin.from('open_banking_customers').insert({user_id:userId,household_id:householdId,saltedge_customer_id:remote.customer_id,identifier}).select('*').single()
  if(storeError)throw new Error(storeError.message)
  return stored
}

export async function POST(request:Request){
  try{
    const user=await authenticatedUser(request)
    const admin=adminClient()
    const {householdId}=await householdForUser(admin,user.id)
    const customer=await ensureCustomer(user.id,householdId)
    const origin=process.env.NEXT_PUBLIC_APP_URL||new URL(request.url).origin
    const today=new Date()
    const from=new Date(Date.UTC(today.getUTCFullYear()-1,today.getUTCMonth(),today.getUTCDate())).toISOString().slice(0,10)
    const live=process.env.SALTEDGE_LIVE==='true'
    const providerCode=process.env.SALTEDGE_PROVIDER_CODE||(live?'revolut_ro':'fakebank_with_updates_xf')
    const body={data:{
      customer_id:customer.saltedge_customer_id,
      consent:{scopes:['accounts','transactions'],from_date:from},
      attempt:{fetch_scopes:['accounts','balance','transactions'],fetch_from_date:from,custom_fields:{mylife_user_id:user.id,household_id:householdId},locale:'ro',store_credentials:true,unduplication_strategy:'delete_duplicated',return_to:`${origin}/?module=finance&tab=accounts`},
      widget:{show_account_overview:true,show_consent_confirmation:true,credentials_strategy:'store',skip_provider_selection:true,skip_stages_screen:false,theme:'dark',allowed_countries:[live?'RO':'XF'],popular_providers_country:live?'RO':'XF'},
      provider:{code:providerCode,include_sandboxes:!live},return_connection_id:true,return_error_class:true,categorization:'personal',automatic_refresh:true,
    }}
    const result=(await saltedgeRequest<ConnectResponse>('/connections/connect',{method:'POST',body:JSON.stringify(body)})).data
    return NextResponse.json({connectUrl:result.connect_url,expiresAt:result.expires_at,mode:live?'live':'test'})
  }catch(error){
    console.error('[Salt Edge] connect failed',error)
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
