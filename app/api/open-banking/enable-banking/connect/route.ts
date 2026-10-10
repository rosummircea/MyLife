import {createHash,randomBytes} from 'node:crypto'
import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,householdForUser,routeError} from '@/lib/open-banking/server'
import {enableBankingMode,enableBankingRequest} from '@/lib/open-banking/enable-banking/api'

export const runtime='nodejs'

type AuthorizationResponse={url:string;authorization_id:string;psu_id_hash:string}
type AspspResponse={aspsps:Array<{name:string;country:string}>}
type BankKey='revolut'|'bcr'|'bt'

const bankAliases:Record<BankKey,string[]>={
  revolut:['revolut'],
  bcr:['banca comerciala romana','bcr'],
  bt:['banca transilvania'],
}

function stateHash(state:string){return createHash('sha256').update(state).digest('hex')}
function normalized(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}

async function providerFor(bank:BankKey,mode:'test'|'live',countryCode:string){
  if(mode==='test')return 'Mock ASPSP'
  const result=await enableBankingRequest<AspspResponse>(`/aspsps?country=${encodeURIComponent(countryCode)}&psu_type=personal&service=AIS`)
  const provider=result.aspsps.find(candidate=>bankAliases[bank].some(alias=>normalized(candidate.name).includes(alias)))
  if(!provider)throw new Error(bank==='bcr'?'Banca Comercială Română nu este disponibilă momentan în Enable Banking.':bank==='bt'?'Banca Transilvania nu este disponibilă momentan în Enable Banking.':'Revolut nu este disponibil momentan în Enable Banking.')
  return provider.name
}

export async function POST(request:Request){
  try{
    const user=await authenticatedUser(request)
    const body=await request.json().catch(()=>({})) as {bank?:BankKey}
    const bank:BankKey=body.bank==='bcr'?'bcr':body.bank==='bt'?'bt':'revolut'
    const admin=adminClient()
    const {householdId}=await householdForUser(admin,user.id)
    const origin=process.env.NEXT_PUBLIC_APP_URL||new URL(request.url).origin
    const mode=enableBankingMode()
    const countryCode=process.env.ENABLE_BANKING_ASPSP_COUNTRY||'RO'
    const providerName=await providerFor(bank,mode,countryCode)
    const state=randomBytes(32).toString('base64url')
    const expiresAt=new Date(Date.now()+15*60*1000).toISOString()
    const validUntil=new Date(Date.now()+90*24*60*60*1000).toISOString()
    const {data:authorization,error:storeError}=await admin.from('enable_banking_authorizations').insert({user_id:user.id,household_id:householdId,state_hash:stateHash(state),provider_name:providerName,country_code:countryCode,status:'pending',expires_at:expiresAt}).select('id').single()
    if(storeError)throw new Error(storeError.message)

    try{
      // A household may connect more than one bank customer (for example Mircea and
      // Andreea).  Use a distinct PSU identifier for every consent so Enable Banking
      // does not group both bank logins as the same person.
      const psuId=`${user.id}:${authorization.id}`
      const result=await enableBankingRequest<AuthorizationResponse>('/auth',{method:'POST',body:JSON.stringify({access:{balances:true,transactions:true,valid_until:validUntil},aspsp:{name:providerName,country:countryCode},state,redirect_url:`${origin}/api/open-banking/enable-banking/callback`,psu_type:'personal',language:'en',psu_id:psuId})})
      const {error:updateError}=await admin.from('enable_banking_authorizations').update({authorization_id:result.authorization_id,raw:{authorization_id:result.authorization_id,psu_id_hash:result.psu_id_hash},updated_at:new Date().toISOString()}).eq('id',authorization.id)
      if(updateError)throw new Error(updateError.message)
      return NextResponse.json({connectUrl:result.url,mode})
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
