import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,householdForUser,routeError} from '@/lib/open-banking/server'
import {merchantKey} from '@/lib/open-banking/enable-banking/categorization'

export const runtime='nodejs'

async function categoryForRule(admin:ReturnType<typeof adminClient>,householdId:string,categoryId:string,transactionType:string){
  const {data,error}=await admin.from('finance_categories').select('id,kind,is_active').eq('id',categoryId).or(`household_id.eq.${householdId},household_id.is.null`).maybeSingle()
  if(error)throw new Error(error.message)
  if(!data||data.kind!==transactionType||!data.is_active)throw Object.assign(new Error('Alege o categorie activă potrivită tipului tranzacției.'),{status:400})
  return data
}

export async function GET(request:Request){
  try{
    const user=await authenticatedUser(request)
    const admin=adminClient()
    const {householdId}=await householdForUser(admin,user.id)
    const {data,error}=await admin.from('finance_merchant_category_rules').select('id,merchant_key,merchant_name,transaction_type,category_id,created_at,updated_at').eq('household_id',householdId).order('merchant_name')
    if(error)throw new Error(error.message)
    return NextResponse.json({rules:data??[]})
  }catch(error){
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}

export async function POST(request:Request){
  try{
    const user=await authenticatedUser(request)
    const admin=adminClient()
    const {householdId}=await householdForUser(admin,user.id)
    const body=await request.json() as {merchant_name?:unknown;transaction_type?:unknown;category_id?:unknown}
    const merchantName=String(body.merchant_name??'').trim()
    const transactionType=String(body.transaction_type??'')
    const categoryId=String(body.category_id??'')
    const key=merchantKey(merchantName)
    if(!key)throw Object.assign(new Error('Completează numele comerciantului.'),{status:400})
    if(merchantName.length>1000)throw Object.assign(new Error('Numele comerciantului este prea lung.'),{status:400})
    if(!['expense','income'].includes(transactionType))throw Object.assign(new Error('Tipul regulii nu este valid.'),{status:400})
    await categoryForRule(admin,householdId,categoryId,transactionType)
    const {data,error}=await admin.from('finance_merchant_category_rules').insert({household_id:householdId,merchant_key:key,merchant_name:merchantName,transaction_type:transactionType,category_id:categoryId}).select('id,merchant_key,merchant_name,transaction_type,category_id,created_at,updated_at').single()
    if(error){
      if(error.code==='23505')throw Object.assign(new Error('Există deja o regulă pentru acest comerciant și acest tip de tranzacție.'),{status:409})
      throw new Error(error.message)
    }
    return NextResponse.json({rule:data},{status:201})
  }catch(error){
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
