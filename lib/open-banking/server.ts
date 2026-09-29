import 'server-only'

import {createClient, type SupabaseClient, type User} from '@supabase/supabase-js'

export function serverConfig(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const adminKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!publicKey)throw new Error('Supabase nu este configurat pe server.')
  if(!adminKey)throw new Error('Cheia Supabase pentru operațiuni server nu este configurată.')
  return {url,publicKey,adminKey}
}

export function adminClient():SupabaseClient{
  const {url,adminKey}=serverConfig()
  return createClient(url,adminKey,{auth:{persistSession:false,autoRefreshToken:false}})
}

export async function authenticatedUser(request:Request):Promise<User>{
  const authorization=request.headers.get('authorization')??''
  const token=authorization.startsWith('Bearer ')?authorization.slice(7):''
  if(!token)throw Object.assign(new Error('Autentificare necesară.'),{status:401})
  const {url,publicKey}=serverConfig()
  const client=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:{user},error}=await client.auth.getUser(token)
  if(error||!user)throw Object.assign(new Error('Sesiunea nu mai este validă.'),{status:401})
  return user
}

export async function householdForUser(admin:SupabaseClient,userId:string){
  const {data:person,error:personError}=await admin.from('people').select('id').eq('auth_user_id',userId).maybeSingle()
  if(personError)throw new Error(personError.message)
  if(!person)throw new Error('Profilul MyLife nu este asociat contului autentificat.')
  const {data:membership,error}=await admin.from('household_members').select('household_id').eq('person_id',person.id).eq('status','active').order('joined_at').limit(1).maybeSingle()
  if(error)throw new Error(error.message)
  if(!membership)throw new Error('Nu există o familie activă pentru acest profil.')
  return {personId:person.id,householdId:String(membership.household_id)}
}

export function routeError(error:unknown){
  const status=typeof error==='object'&&error&&'status'in error&&typeof error.status==='number'?error.status:500
  const message=error instanceof Error?error.message:'Operațiunea nu a reușit.'
  return {status,message}
}
