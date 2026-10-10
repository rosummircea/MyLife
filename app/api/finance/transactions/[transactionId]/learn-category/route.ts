import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,householdForUser,routeError} from '@/lib/open-banking/server'
import {merchantKey} from '@/lib/open-banking/enable-banking/categorization'

export const runtime='nodejs'

export async function POST(request:Request,{params}:{params:Promise<{transactionId:string}>}){
  try{
    const user=await authenticatedUser(request)
    const {transactionId}=await params
    const admin=adminClient()
    const {householdId}=await householdForUser(admin,user.id)
    const {data:transaction,error}=await admin.from('finance_transactions').select('id,household_id,status,transaction_type,merchant,description,import_metadata').eq('id',transactionId).maybeSingle()
    if(error)throw new Error(error.message)
    if(!transaction||transaction.household_id!==householdId||transaction.status!=='posted')throw Object.assign(new Error('Tranzacția nu este disponibilă.'),{status:404})
    const metadata=(transaction.import_metadata&&typeof transaction.import_metadata==='object'&&!Array.isArray(transaction.import_metadata)?transaction.import_metadata:{}) as Record<string,unknown>
    if(!metadata.enable_banking_transaction_id)return NextResponse.json({learned:false})
    if(!['expense','income'].includes(transaction.transaction_type))return NextResponse.json({learned:false})
    const {data:splits,error:splitError}=await admin.from('finance_transaction_splits').select('category_id').eq('transaction_id',transaction.id)
    if(splitError)throw new Error(splitError.message)
    const categoryIds=[...new Set((splits??[]).map(split=>split.category_id).filter(Boolean))] as string[]
    if(categoryIds.length!==1)return NextResponse.json({learned:false})
    const categoryId=categoryIds[0]
    const {data:category,error:categoryError}=await admin.from('finance_categories').select('id').eq('id',categoryId).eq('kind',transaction.transaction_type).eq('is_active',true).or(`household_id.eq.${householdId},household_id.is.null`).maybeSingle()
    if(categoryError)throw new Error(categoryError.message)
    if(!category)return NextResponse.json({learned:false})
    const merchantName=String(transaction.merchant||transaction.description||'').trim()
    const key=merchantKey(merchantName)
    if(!key)return NextResponse.json({learned:false})
    const {error:ruleError}=await admin.from('finance_merchant_category_rules').upsert({household_id:householdId,merchant_key:key,merchant_name:merchantName,transaction_type:transaction.transaction_type,category_id:categoryId,updated_at:new Date().toISOString()},{onConflict:'household_id,merchant_key,transaction_type'})
    if(ruleError)throw new Error(ruleError.message)
    return NextResponse.json({learned:true})
  }catch(error){
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
