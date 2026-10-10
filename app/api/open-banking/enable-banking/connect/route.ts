import {createHash,randomBytes} from 'node:crypto'
import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,householdForUser,routeError} from '@/lib/open-banking/server'
import {enableBankingMode,enableBankingRequest} from '@/lib/open-banking/enable-banking/api'

export const runtime='nodejs'

type AuthorizationResponse={url:string;authorization_id:string;psu_id_hash:string}

function stateHash(state:string){return createHash('sha256').update(state).digest('hex')}

export async function POST(request:Request){
  try{
    const user=await authenticatedUser(request)
    const admin=adminClient()
    const {householdId}=await householdForUser(admin,user.id)
    const origin=process.env.NEXT_PUBLIC_APP_URL||new URL(request.url).origin
    const providerName=process.env.ENABLE_BANKING_ASPSP_NAME||'Mock ASPSP'
    const countryCode=process.env.ENABLE_BANKING_ASPSP_COUNTRY||'RO'
    const state=randomBytes(32).toString('base64url')
    const expiresAt=new Date(Date.now()+15*60*1000).toISOString()
    const validUntil=new Date(Date.now()+90*24*60*60*1000).toISOString()
    const {data:authorization,error:storeError}=await admin.from('enable_banking_authorizations').insert({user_id:user.id,household_id:householdId,state_hash:stateHash(state),provider_name:providerName,country_code:countryCode,status:'pending',expires_at:expiresAt}).select('id').single()
    if(storeError)throw new Error(storeError.message)

    try{
      const result=await enableBankingRequest<AuthorizationResponse>('/auth',{method:'POST',body:JSON.stringify({access:{balances:true,transactions:true,valid_until:validUntil},aspsp:{name:providerName,country:countryCode},state,redirect_url:`${origin}/api/open-banking/enable-banking/callback`,psu_type:'personal',language:'en',psu_id:user.id})})
      const {error:updateError}=await admin.from('enable_banking_authorizations').update({authorization_id:result.authorization_id,raw:{authorization_id:result.authorization_id,psu_id_hash:result.psu_id_hash},updated_at:new Date().toISOString()}).eq('id',authorization.id)
      if(updateError)throw new Error(updateError.message)
      return NextResponse.json({connectUrl:result.url,mode:enableBankingMode()})
    }catch(error){
      await admin.from('enable_banking_authorizations').update({status:'failed',error_message:error instanceof Error?error.message:'Enable Banking nu a pornit conectarea.',updated_at:new Date().toISOString()}).eq('id',authorization.id)
      throw error
    }
  }catch(error){
    console.error('[Enable Banking] connect failed',error)
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
