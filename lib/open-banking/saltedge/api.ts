import 'server-only'

const BASE_URL='https://www.saltedge.com/api/v6'

type SaltEdgeEnvelope<T>={data:T;meta?:{next_id?:string|null;next_page?:string|null}}
type SaltEdgeError={error_class?:string;error_message?:string;message?:string}

export class SaltEdgeApiError extends Error{
  constructor(public status:number,public errorClass:string|undefined,message:string){super(message)}
}

function credentials(){
  const appId=process.env.SALTEDGE_APP_ID
  const secret=process.env.SALTEDGE_SECRET
  if(!appId||!secret)throw new Error('Salt Edge nu este configurat pe server.')
  return {appId,secret}
}

export async function saltedgeRequest<T>(path:string,init:RequestInit={}):Promise<SaltEdgeEnvelope<T>>{
  const {appId,secret}=credentials()
  const response=await fetch(BASE_URL+path,{
    ...init,
    cache:'no-store',
    headers:{Accept:'application/json','Content-Type':'application/json','App-id':appId,Secret:secret,...init.headers},
  })
  const payload=await response.json().catch(()=>({})) as SaltEdgeEnvelope<T>&SaltEdgeError
  if(!response.ok)throw new SaltEdgeApiError(response.status,payload.error_class,payload.error_message||payload.message||`Salt Edge a răspuns cu ${response.status}.`)
  return payload
}

export async function saltedgeList<T>(path:string,params:Record<string,string>){
  const rows:T[]=[]
  let fromId:string|undefined
  for(let page=0;page<100;page++){
    const query=new URLSearchParams({...params,per_page:'100'})
    if(fromId)query.set('from_id',fromId)
    const payload=await saltedgeRequest<T[]>(`${path}?${query}`)
    rows.push(...payload.data)
    const nextId=payload.meta?.next_id??undefined
    if(!nextId||nextId===fromId)break
    fromId=nextId
  }
  return rows
}
