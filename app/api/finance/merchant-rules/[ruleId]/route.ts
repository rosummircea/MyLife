import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,householdForUser,routeError} from '@/lib/open-banking/server'
import {merchantKey} from '@/lib/open-banking/enable-banking/categorization'

export const runtime='nodejs'

async function ownedRule(request:Request,ruleId:string){
  const user=await authenticatedUser(request)
  const admin=adminClient()
  const {householdId}=await householdForUser(admin,user.id)
  const {data,error}=await admin.from('finance_merchant_category_rules').select('id').eq('id',ruleId).eq('household_id',householdId).maybeSingle()
  if(error)throw new Error(error.message)
  if(!data)throw Object.assign(new Error('Regula nu mai există.'),{status:404})
  return {admin,householdId}
}

export async function PATCH(request:Request,{params}:{params:Promise<{ruleId:string}>}){
  try{
    const {ruleId}=await params
    const {admin,householdId}=await ownedRule(request,ruleId)
    const body=await request.json() as {merchant_name?:unknown;transaction_type?:unknown;category_id?:unknown}
    const merchantName=String(body.merchant_name??'').trim()
    const transactionType=String(body.transaction_type??'')
    const categoryId=String(body.category_id??'')
    const key=merchantKey(merchantName)
    if(!key)throw Object.assign(new Error('Completează numele comerciantului.'),{status:400})
    if(merchantName.length>1000)throw Object.assign(new Error('Numele comerciantului este prea lung.'),{status:400})
    if(!['expense','income'].includes(transactionType))throw Object.assign(new Error('Tipul regulii nu este valid.'),{status:400})
    const {data:category,error:categoryError}=await admin.from('finance_categories').select('id,kind,is_active').eq('id',categoryId).or(`household_id.eq.${householdId},household_id.is.null`).maybeSingle()
    if(categoryError)throw new Error(categoryError.message)
    if(!category||category.kind!==transactionType||!category.is_active)throw Object.assign(new Error('Alege o categorie activă potrivită tipului tranzacției.'),{status:400})
    const {data,error}=await admin.from('finance_merchant_category_rules').update({merchant_key:key,merchant_name:merchantName,transaction_type:transactionType,category_id:categoryId,updated_at:new Date().toISOString()}).eq('id',ruleId).eq('household_id',householdId).select('id,merchant_key,merchant_name,transaction_type,category_id,created_at,updated_at').single()
    if(error){
      if(error.code==='23505')throw Object.assign(new Error('Există deja o regulă pentru acest comerciant și acest tip de tranzacție.'),{status:409})
      throw new Error(error.message)
    }
    return NextResponse.json({rule:data})
  }catch(error){
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}

export async function DELETE(request:Request,{params}:{params:Promise<{ruleId:string}>}){
  try{
    const {ruleId}=await params
    const {admin,householdId}=await ownedRule(request,ruleId)
    const {error}=await admin.from('finance_merchant_category_rules').delete().eq('id',ruleId).eq('household_id',householdId)
    if(error)throw new Error(error.message)
    return NextResponse.json({deleted:true})
  }catch(error){
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
