import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,routeError} from '@/lib/open-banking/server'

export const runtime='nodejs'

export async function POST(request:Request,{params}:{params:Promise<{accountId:string}>}){
  try{
    const user=await authenticatedUser(request)
    const {accountId}=await params
    const body=await request.json() as {financeAccountId?:string|null}
    const admin=adminClient()
    const {data:bankAccount,error:bankError}=await admin.from('enable_banking_accounts').select('id,household_id,currency').eq('id',accountId).eq('user_id',user.id).maybeSingle()
    if(bankError)throw new Error(bankError.message)
    if(!bankAccount)throw Object.assign(new Error('Contul sincronizat nu există.'),{status:404})
    let financeAccountId:string|null=null
    if(body.financeAccountId){
      const {data:financeAccount,error:financeError}=await admin.from('finance_accounts').select('id,currency,is_active').eq('id',body.financeAccountId).eq('household_id',bankAccount.household_id).maybeSingle()
      if(financeError)throw new Error(financeError.message)
      if(!financeAccount||financeAccount.is_active===false)throw Object.assign(new Error('Contul MyLife ales nu este disponibil.'),{status:400})
      if(String(financeAccount.currency).trim().toUpperCase()!==String(bankAccount.currency).trim().toUpperCase())throw Object.assign(new Error('Conturile trebuie să folosească aceeași monedă.'),{status:400})
      financeAccountId=financeAccount.id
    }
    const now=new Date().toISOString()
    const {error:updateError}=await admin.from('enable_banking_accounts').update({finance_account_id:financeAccountId,auto_import_enabled_at:financeAccountId?now:null,updated_at:now}).eq('id',bankAccount.id).eq('user_id',user.id)
    if(updateError)throw new Error(updateError.message)
    return NextResponse.json({finance_account_id:financeAccountId})
  }catch(error){
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
