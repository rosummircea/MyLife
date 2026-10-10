import {NextResponse} from 'next/server'
import {adminClient,authenticatedUser,routeError} from '@/lib/open-banking/server'

export const runtime='nodejs'

export async function GET(request:Request,{params}:{params:Promise<{accountId:string}>}){
  try{
    const user=await authenticatedUser(request)
    const {accountId}=await params
    const admin=adminClient()
    const {data:account,error:accountError}=await admin.from('enable_banking_accounts').select('id,household_id,finance_account_id,name,currency,balance,available_amount,iban_last4').eq('id',accountId).eq('user_id',user.id).maybeSingle()
    if(accountError)throw new Error(accountError.message)
    if(!account)throw Object.assign(new Error('Contul bancar sincronizat nu există.'),{status:404})
    const url=new URL(request.url)
    const offset=Math.max(0,Number.parseInt(url.searchParams.get('offset')||'0',10)||0)
    const limit=Math.min(50,Math.max(1,Number.parseInt(url.searchParams.get('limit')||'50',10)||50))
    const {data:transactions,count,error}=await admin.from('enable_banking_transactions').select('id,account_id,status,made_on,amount,currency,description,merchant_name,merchant_category_code',{count:'exact'}).eq('user_id',user.id).eq('account_id',accountId).order('made_on',{ascending:false}).range(offset,offset+limit-1)
    if(error)throw new Error(error.message)
    const {data:imports,error:importsError}=await admin.from('finance_transactions').select('id,import_metadata').eq('household_id',account.household_id).eq('account_id',account.finance_account_id||'00000000-0000-0000-0000-000000000000').eq('status','posted')
    if(importsError)throw new Error(importsError.message)
    const imported=new Map<string,string>()
    for(const row of imports??[]){const bankTransactionId=(row.import_metadata as Record<string,unknown>|null)?.enable_banking_transaction_id;if(typeof bankTransactionId==='string')imported.set(bankTransactionId,row.id)}
    const total=count??0
    return NextResponse.json({account,transactions:(transactions??[]).map(transaction=>({...transaction,finance_transaction_id:imported.get(transaction.id)??null})),total,next_offset:offset+(transactions?.length??0)<total?offset+(transactions?.length??0):null})
  }catch(error){
    const {status,message}=routeError(error)
    return NextResponse.json({error:message},{status})
  }
}
