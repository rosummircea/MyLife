import 'server-only'

import type {SupabaseClient} from '@supabase/supabase-js'
import {merchantKey,predictedCategory,type CategoryCandidate} from './categorization'

type BankTransaction={id:string;external_transaction_id:string;status:string|null;made_on:string;amount:number|string;currency:string;description:string|null;merchant_name:string|null;merchant_category_code:string|null;first_seen_at:string}
type Rule={merchant_key:string;transaction_type:string;category_id:string}

function providerName(value:unknown){
  if(Array.isArray(value))return String((value[0] as {provider_name?:unknown}|undefined)?.provider_name??'bancă')
  return String((value as {provider_name?:unknown}|null)?.provider_name??'bancă')
}

export async function autoImportNewBankTransactions(admin:SupabaseClient,bankAccountId:string){
  const {data:bankAccount,error:accountError}=await admin.from('enable_banking_accounts')
    .select('id,user_id,household_id,finance_account_id,currency,auto_import_enabled_at,session:enable_banking_sessions!session_id(provider_name)')
    .eq('id',bankAccountId).maybeSingle()
  if(accountError)throw new Error(accountError.message)
  if(!bankAccount?.finance_account_id||!bankAccount.auto_import_enabled_at)return {imported:0}

  const {data:financeAccount,error:financeError}=await admin.from('finance_accounts').select('id,currency,is_active').eq('id',bankAccount.finance_account_id).eq('household_id',bankAccount.household_id).maybeSingle()
  if(financeError)throw new Error(financeError.message)
  if(!financeAccount||financeAccount.is_active===false)return {imported:0}

  const {data:transactions,error:transactionError}=await admin.from('enable_banking_transactions')
    .select('id,external_transaction_id,status,made_on,amount,currency,description,merchant_name,merchant_category_code,first_seen_at')
    .eq('account_id',bankAccount.id).gt('first_seen_at',bankAccount.auto_import_enabled_at).order('first_seen_at')
  if(transactionError)throw new Error(transactionError.message)
  const candidates=((transactions??[]) as BankTransaction[]).filter(transaction=>!['PDNG','PENDING'].includes(String(transaction.status??'').toUpperCase()))
  if(!candidates.length)return {imported:0}

  const candidateIds=candidates.map(transaction=>transaction.id)
  const [{data:existing,error:existingError},{data:person,error:personError},{data:categories,error:categoryError},{data:rules,error:ruleError}]=await Promise.all([
    admin.from('finance_transactions').select('id').in('id',candidateIds),
    admin.from('people').select('id').eq('auth_user_id',bankAccount.user_id).maybeSingle(),
    admin.from('finance_categories').select('id,name,parent_id,kind,is_active').or(`household_id.eq.${bankAccount.household_id},household_id.is.null`),
    admin.from('finance_merchant_category_rules').select('merchant_key,transaction_type,category_id').eq('household_id',bankAccount.household_id),
  ])
  if(existingError)throw new Error(existingError.message)
  if(personError)throw new Error(personError.message)
  if(categoryError)throw new Error(categoryError.message)
  if(ruleError)throw new Error(ruleError.message)
  if(!person)throw new Error('Profilul MyLife nu este asociat utilizatorului conexiunii bancare.')
  const existingIds=new Set((existing??[]).map(row=>row.id))
  const availableCategories=(categories??[]) as CategoryCandidate[]
  const activeCategoryIds=new Set(availableCategories.filter(category=>category.is_active).map(category=>category.id))
  const learned=new Map(((rules??[]) as Rule[]).filter(rule=>activeCategoryIds.has(rule.category_id)).map(rule=>[`${rule.transaction_type}:${rule.merchant_key}`,rule.category_id]))
  const now=new Date().toISOString(),provider=providerName(bankAccount.session)
  let imported=0

  for(const transaction of candidates){
    if(existingIds.has(transaction.id))continue
    const signedAmount=Number(transaction.amount)
    if(!Number.isFinite(signedAmount)||signedAmount===0)continue
    const transactionType=signedAmount<0?'expense':'income'
    const merchant=transaction.merchant_name?.trim()||null
    const title=merchant||transaction.description?.trim()||`Tranzacție ${provider}`
    const key=merchantKey(merchant||transaction.description)
    const learnedCategoryId=learned.get(`${transactionType}:${key}`)
    const guessed=learnedCategoryId?null:predictedCategory(availableCategories,transactionType,`${merchant??''} ${transaction.description??''} ${transaction.merchant_category_code??''}`)
    const categoryId=learnedCategoryId??guessed?.id??null
    const row={id:transaction.id,household_id:bankAccount.household_id,account_id:financeAccount.id,transfer_account_id:null,created_by_person_id:person.id,transaction_type:transactionType,amount:Math.abs(signedAmount),currency:String(transaction.currency||financeAccount.currency).trim().toUpperCase(),transaction_date:`${transaction.made_on}T12:00:00+03:00`,merchant,description:transaction.description,status:'posted',source:'manual',date_precision:'date',import_metadata:{title,affects_balance:true,imported_from:provider,enable_banking_transaction_id:transaction.id,enable_banking_external_transaction_id:transaction.external_transaction_id,enable_banking_account_id:bankAccount.id,imported_at:now,auto_imported:true,unseen:true,categorization_source:learnedCategoryId?'learned':guessed?'suggested':'uncategorized'}}
    const {error:insertError}=await admin.from('finance_transactions').insert(row)
    if(insertError){
      if(insertError.code==='23505')continue
      throw new Error(insertError.message)
    }
    if(categoryId){
      const {error:splitError}=await admin.from('finance_transaction_splits').insert({transaction_id:transaction.id,category_id:categoryId,amount:Math.abs(signedAmount)})
      if(splitError){await admin.from('finance_transactions').delete().eq('id',transaction.id);throw new Error(splitError.message)}
    }
    imported++
  }
  return {imported}
}
