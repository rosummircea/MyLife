import 'server-only'

import {createSign} from 'node:crypto'

const BASE_URL='https://api.enablebanking.com'

type EnableBankingError={detail?:string;message?:string;error?:string;code?:string}

export class EnableBankingApiError extends Error{
  constructor(public status:number,public code:string|undefined,message:string){super(message)}
}

function credentials(){
  const applicationId=process.env.ENABLE_BANKING_APPLICATION_ID
  const privateKey=process.env.ENABLE_BANKING_PRIVATE_KEY?.replace(/\\n/g,'\n')
  if(!applicationId||!privateKey)throw new Error('Enable Banking nu este configurat pe server.')
  return {applicationId,privateKey}
}

function encoded(value:unknown){return Buffer.from(JSON.stringify(value)).toString('base64url')}
function errorText(value:unknown){
  if(typeof value==='string'&&value.trim())return value
  if(value&&typeof value==='object')try{return JSON.stringify(value)}catch{}
  return ''
}

export function enableBankingToken(now=Math.floor(Date.now()/1000)){
  const {applicationId,privateKey}=credentials()
  const unsigned=`${encoded({typ:'JWT',alg:'RS256',kid:applicationId})}.${encoded({iss:'enablebanking.com',aud:'api.enablebanking.com',iat:now,exp:now+300})}`
  const signature=createSign('RSA-SHA256').update(unsigned).end().sign(privateKey).toString('base64url')
  return `${unsigned}.${signature}`
}

export async function enableBankingRequest<T>(path:string,init:RequestInit={}):Promise<T>{
  const response=await fetch(BASE_URL+path,{
    ...init,
    cache:'no-store',
    headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${enableBankingToken()}`,...init.headers},
  })
  const payload=await response.json().catch(()=>({})) as T&EnableBankingError
  if(!response.ok)throw new EnableBankingApiError(response.status,errorText(payload.code)||errorText(payload.error)||undefined,errorText(payload.detail)||errorText(payload.message)||`Enable Banking a răspuns cu ${response.status}.`)
  return payload
}

export function enableBankingMode(){return process.env.ENABLE_BANKING_ENVIRONMENT?.toLowerCase()==='production'?'live':'test'}
