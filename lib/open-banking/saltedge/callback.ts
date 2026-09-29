import 'server-only'

import {createVerify} from 'node:crypto'
import {NextRequest,NextResponse} from 'next/server'
import {adminClient} from '@/lib/open-banking/server'
import {syncSaltEdgeConnection} from './sync'

export type SaltEdgeCallbackType='success'|'fail'|'destroy'|'notify'|'provider-changes'|'consent-changes'

const AIS_V6_PUBLIC_KEY=`-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA8qxSS5BmftHK/eyW+o98
NR89TyDmz1V8e6yyFdoMPddEYN4Bcidkk2whoJEc/T/AKghHQ9Nq+DuebnRYYcSJ
YT99VbR1PpIw2R9i8z+DZ79hoizy6z+rwxGANnJOr5BDF5HUKJ8uKS9yGRieojFv
Y9j+rxH6Fj6P90bO4d2igYYspKVoI3Zb3hWS0LrWN+JXAaW9qcOmQPTgO0WG0MUK
gB3NNMfN7gMIkl3chbaULiEgVciP2qZTIGb1b7IDr5+fA9oVVGaXiybdieGHIa4J
S7JNTf0JjWrIKd2DaczKULnghqNQsnoCu+S8BurEOJR5EN1BBfQBPlbSh+ru1zgZ
AQIDAQAB
-----END PUBLIC KEY-----`

function callbackUrl(request:NextRequest){
  const forwardedHost=request.headers.get('x-forwarded-host')
  const forwardedProto=request.headers.get('x-forwarded-proto')
  if(!forwardedHost)return request.url
  const url=new URL(request.url)
  return `${forwardedProto||'https'}://${forwardedHost}${url.pathname}${url.search}`
}

function validSignature(request:NextRequest,body:string){
  const signature=request.headers.get('signature')
  const version=request.headers.get('signature-key-version')
  if(!signature||version!=='6.0')return false
  const verifier=createVerify('RSA-SHA256')
  verifier.update(`${callbackUrl(request)}|${body}`)
  verifier.end()
  return verifier.verify(AIS_V6_PUBLIC_KEY,signature,'base64')
}

type CallbackPayload={data?:{connection_id?:string;customer_id?:string;stage?:string;status?:string;consent_status?:string;error_class?:string;error_message?:string;provider_code?:string};meta?:{version?:string}}

export async function handleSaltEdgeCallback(request:NextRequest,callbackType:SaltEdgeCallbackType){
  const rawBody=await request.text()
  if(!validSignature(request,rawBody)){
    console.warn(`[Salt Edge] ${callbackType}: invalid callback signature`)
    return NextResponse.json({ok:false},{status:401})
  }
  try{
    const payload=JSON.parse(rawBody) as CallbackPayload
    const data=payload.data
    if(!data||payload.meta?.version!=='6')return NextResponse.json({ok:false},{status:400})
    const connectionId=data.connection_id
    const admin=adminClient()

    if(callbackType==='provider-changes'){
      console.info('[Salt Edge] provider change received',data.provider_code??'unknown')
      return NextResponse.json({ok:true})
    }
    if(!connectionId)return NextResponse.json({ok:false},{status:400})
    const now=new Date().toISOString()

    if(callbackType==='destroy'){
      const {error}=await admin.from('open_banking_connections').update({status:'removed',stage:'destroyed',updated_at:now}).eq('saltedge_connection_id',connectionId)
      if(error)throw new Error(error.message)
      return NextResponse.json({ok:true})
    }
    if(callbackType==='fail'){
      try{await syncSaltEdgeConnection(admin,connectionId)}catch(syncError){console.warn('[Salt Edge] failed connection could not be synchronized',syncError)}
      const {error}=await admin.from('open_banking_connections').update({status:'inactive',stage:'failed',last_error_class:data.error_class??null,last_error_message:data.error_message??null,updated_at:now}).eq('saltedge_connection_id',connectionId)
      if(error)throw new Error(error.message)
      return NextResponse.json({ok:true})
    }
    if(callbackType==='consent-changes'){
      const {error}=await admin.from('open_banking_connections').update({consent_status:data.consent_status??data.status??null,updated_at:now}).eq('saltedge_connection_id',connectionId)
      if(error)throw new Error(error.message)
      return NextResponse.json({ok:true})
    }
    if(callbackType==='success'||data.stage==='finish_fetching')await syncSaltEdgeConnection(admin,connectionId)
    else{
      const {error}=await admin.from('open_banking_connections').update({stage:data.stage??null,updated_at:now}).eq('saltedge_connection_id',connectionId)
      if(error)throw new Error(error.message)
    }
    return NextResponse.json({ok:true})
  }catch(error){
    console.error(`[Salt Edge] ${callbackType} callback failed`,error)
    return NextResponse.json({ok:false},{status:500})
  }
}
