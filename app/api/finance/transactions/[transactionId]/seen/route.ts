import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,householdForUser,routeError} from '@/lib/open-banking/server'

export const runtime='nodejs'

export async function POST(request:Request,{params}:{params:Promise<{transactionId:string}>}){
  try{
    const user=await authenticatedUser(request)
    const {transactionId}=await params
    const admin=adminClient()
    const {householdId}=await householdForUser(admin,user.id)
    const {data:transaction,error}=await admin.from('finance_transactions').select('id,household_id,status,import_metadata').eq('id',transactionId).maybeSingle()
    if(error)throw new Error(error.message)
    if(!transaction||transaction.household_id!==householdId||transaction.status!=='posted')throw Object.assign(new Error('Tranzacția nu este disponibilă.'),{status:404})
    const metadata=(transaction.import_metadata&&typeof transaction.import_metadata==='object'&&!Array.isArray(transaction.import_metadata)?transaction.import_metadata:{}) as Record<string,unknown>
    if(metadata.auto_imported!==true||metadata.unseen!==true)return NextResponse.json({seen:false})
    const {error:updateError}=await admin.from('finance_transactions').update({import_metadata:{...metadata,unseen:false,seen_at:new Date().toISOString()}}).eq('id',transaction.id).eq('household_id',householdId)
    if(updateError)throw new Error(updateError.message)
    return NextResponse.json({seen:true})
  }catch(error){
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
