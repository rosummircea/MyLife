import 'server-only'

import type {SupabaseClient} from '@supabase/supabase-js'
import {merchantKey,predictedCategory,type CategoryCandidate} from './categorization'

type BankTransaction={id:string;external_transaction_id:string;status:string|null;made_on:string;amount:number|string;currency:string;description:string|null;merchant_name:string|null;merchant_category_code:string|null;first_seen_at:string}
type Rule={merchant_key:string;transaction_type:string;category_id:string}
type TransferRule={id:string;source_bank_account_id:string;counterpart_bank_account_id:string|null;source_finance_account_id:string;destination_finance_account_id:string;source_match_text:string;counterpart_match_text:string|null;date_tolerance_days:number}
type ExistingImport={id:string;import_metadata:Record<string,unknown>|null;transaction_type:string;account_id:string;transfer_account_id:string|null}

function normalized(value:unknown){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('ro-RO').replace(/\s+/g,' ').trim()}
function transactionText(transaction:Pick<BankTransaction,'merchant_name'|'description'>){return normalized(`${transaction.merchant_name??''} ${transaction.description??''}`)}
function shiftedDay(day:string,offset:number){const value=new Date(`${day}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+offset);return value.toISOString().slice(0,10)}
function bankReferences(metadata:Record<string,unknown>){
  const references=new Set<string>()
  if(typeof metadata.enable_banking_transaction_id==='string')references.add(metadata.enable_banking_transaction_id)
  if(typeof metadata.enable_banking_counterpart_transaction_id==='string')references.add(metadata.enable_banking_counterpart_transaction_id)
  if(Array.isArray(metadata.enable_banking_transaction_ids))for(const id of metadata.enable_banking_transaction_ids)if(typeof id==='string')references.add(id)
  return references
}

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
  const candidates=(transactions??[]) as BankTransaction[]
  if(!candidates.length)return {imported:0}

  const candidateIds=candidates.map(transaction=>transaction.id)
  const [{data:existing,error:existingError},{data:transferImports,error:transferImportsError},{data:person,error:personError},{data:categories,error:categoryError},{data:rules,error:ruleError},{data:transferRules,error:transferRulesError}]=await Promise.all([
    admin.from('finance_transactions').select('id,import_metadata,transaction_type,account_id,transfer_account_id').in('id',candidateIds).eq('status','posted'),
    admin.from('finance_transactions').select('id,import_metadata,transaction_type,account_id,transfer_account_id').eq('household_id',bankAccount.household_id).eq('transaction_type','transfer').eq('status','posted'),
    admin.from('people').select('id').eq('auth_user_id',bankAccount.user_id).maybeSingle(),
    admin.from('finance_categories').select('id,name,parent_id,kind,is_active').or(`household_id.eq.${bankAccount.household_id},household_id.is.null`),
    admin.from('finance_merchant_category_rules').select('merchant_key,transaction_type,category_id').eq('household_id',bankAccount.household_id),
    admin.from('finance_bank_transfer_rules').select('id,source_bank_account_id,counterpart_bank_account_id,source_finance_account_id,destination_finance_account_id,source_match_text,counterpart_match_text,date_tolerance_days').eq('household_id',bankAccount.household_id).or(`source_bank_account_id.eq.${bankAccount.id},counterpart_bank_account_id.eq.${bankAccount.id}`),
  ])
  if(existingError)throw new Error(existingError.message)
  if(transferImportsError)throw new Error(transferImportsError.message)
  if(personError)throw new Error(personError.message)
  if(categoryError)throw new Error(categoryError.message)
  if(ruleError)throw new Error(ruleError.message)
  if(transferRulesError)throw new Error(transferRulesError.message)
  if(!person)throw new Error('Profilul MyLife nu este asociat utilizatorului conexiunii bancare.')
  const existingById=new Map<string,{id:string;metadata:Record<string,unknown>;transaction_type:string;account_id:string;transfer_account_id:string|null}>()
  for(const row of [...(existing??[]),...(transferImports??[])] as ExistingImport[]){
    const metadata=(row.import_metadata??{}) as Record<string,unknown>
    const value={id:row.id,metadata,transaction_type:row.transaction_type,account_id:row.account_id,transfer_account_id:row.transfer_account_id}
    existingById.set(row.id,value)
    for(const bankId of bankReferences(metadata))existingById.set(bankId,value)
  }
  const availableCategories=(categories??[]) as CategoryCandidate[]
  const activeCategoryIds=new Set(availableCategories.filter(category=>category.is_active).map(category=>category.id))
  const learned=new Map(((rules??[]) as Rule[]).filter(rule=>activeCategoryIds.has(rule.category_id)).map(rule=>[`${rule.transaction_type}:${rule.merchant_key}`,rule.category_id]))
  const rememberedTransfers=(transferRules??[]) as TransferRule[]
  const now=new Date().toISOString(),provider=providerName(bankAccount.session)
  let imported=0

  for(const transaction of candidates){
    const signedAmount=Number(transaction.amount)
    if(!Number.isFinite(signedAmount)||signedAmount===0)continue
    const incomingRule=signedAmount>0?rememberedTransfers.find(rule=>rule.counterpart_bank_account_id===bankAccount.id&&transactionText(transaction).includes(normalized(rule.counterpart_match_text))):undefined
    const existingImport=existingById.get(transaction.id)
    if(existingImport){
      // Some banks expose a card top-up credit before (or without) the matching
      // debit from the source bank. A remembered counterpart signature is enough
      // to turn that credit into the canonical transfer immediately.
      if(incomingRule&&existingImport.id===transaction.id&&existingImport.transaction_type!=='transfer'){
        const bankIds=Array.from(new Set([...bankReferences(existingImport.metadata),transaction.id]))
        const metadata={...existingImport.metadata,title:existingImport.metadata.title??transaction.merchant_name??transaction.description??'Transfer bancar',enable_banking_transaction_ids:bankIds,enable_banking_counterpart_transaction_id:transaction.id,transfer_rule_id:incomingRule.id,categorization_source:'transfer_rule'}
        const {error:splitDeleteError}=await admin.from('finance_transaction_splits').delete().eq('transaction_id',existingImport.id)
        if(splitDeleteError)throw new Error(splitDeleteError.message)
        const {error:updateError}=await admin.from('finance_transactions').update({account_id:incomingRule.source_finance_account_id,transfer_account_id:incomingRule.destination_finance_account_id,transaction_type:'transfer',amount:Math.abs(signedAmount),import_metadata:metadata}).eq('id',existingImport.id).eq('status','posted')
        if(updateError)throw new Error(updateError.message)
        const value={id:existingImport.id,metadata,transaction_type:'transfer',account_id:incomingRule.source_finance_account_id,transfer_account_id:incomingRule.destination_finance_account_id}
        for(const bankId of bankIds)existingById.set(bankId,value)
        imported++
        continue
      }
      if(existingImport.metadata.enable_banking_status!==transaction.status&&existingImport.id===transaction.id){
        const {error:updateError}=await admin.from('finance_transactions').update({import_metadata:{...existingImport.metadata,enable_banking_status:transaction.status}}).eq('id',existingImport.id)
        if(updateError)throw new Error(updateError.message)
      }
      continue
    }
    const transactionType=signedAmount<0?'expense':'income'
    const merchant=transaction.merchant_name?.trim()||null
    const title=merchant||transaction.description?.trim()||`Tranzacție ${provider}`
    const transferRule=signedAmount<0?rememberedTransfers.find(rule=>rule.source_bank_account_id===bankAccount.id&&transactionText(transaction).includes(normalized(rule.source_match_text))):undefined
    if(transferRule){
      let counterpart:BankTransaction|undefined
      if(transferRule.counterpart_bank_account_id){
        const {data:counterparts,error:counterpartError}=await admin.from('enable_banking_transactions')
          .select('id,external_transaction_id,status,made_on,amount,currency,description,merchant_name,merchant_category_code,first_seen_at')
          .eq('account_id',transferRule.counterpart_bank_account_id).eq('amount',Math.abs(signedAmount))
          .gte('made_on',shiftedDay(transaction.made_on,-transferRule.date_tolerance_days)).lte('made_on',shiftedDay(transaction.made_on,transferRule.date_tolerance_days))
        if(counterpartError)throw new Error(counterpartError.message)
        const counterpartNeedle=normalized(transferRule.counterpart_match_text)
        counterpart=((counterparts??[]) as BankTransaction[]).filter(candidate=>!counterpartNeedle||transactionText(candidate).includes(counterpartNeedle)).sort((a,b)=>Math.abs(new Date(a.made_on).getTime()-new Date(transaction.made_on).getTime())-Math.abs(new Date(b.made_on).getTime()-new Date(transaction.made_on).getTime()))[0]
      }
      if(counterpart){
        const {data:counterpartImport,error:counterpartImportError}=await admin.from('finance_transactions').select('id,import_metadata').eq('id',counterpart.id).eq('status','posted').maybeSingle()
        if(counterpartImportError)throw new Error(counterpartImportError.message)
        if(counterpartImport&&((counterpartImport.import_metadata??{}) as Record<string,unknown>).auto_imported===true){
          const {error:splitDeleteError}=await admin.from('finance_transaction_splits').delete().eq('transaction_id',counterpart.id)
          if(splitDeleteError)throw new Error(splitDeleteError.message)
          const {error:counterpartDeleteError}=await admin.from('finance_transactions').delete().eq('id',counterpart.id)
          if(counterpartDeleteError)throw new Error(counterpartDeleteError.message)
        }
      }
      const bankIds=[transaction.id,...(counterpart?[counterpart.id]:[])]
      const row={id:transaction.id,household_id:bankAccount.household_id,account_id:transferRule.source_finance_account_id,transfer_account_id:transferRule.destination_finance_account_id,created_by_person_id:person.id,transaction_type:'transfer',amount:Math.abs(signedAmount),currency:String(transaction.currency||financeAccount.currency).trim().toUpperCase(),transaction_date:`${transaction.made_on}T12:00:00+03:00`,merchant,description:transaction.description,status:'posted',source:'manual',date_precision:'date',import_metadata:{title,affects_balance:true,imported_from:provider,enable_banking_transaction_id:transaction.id,enable_banking_transaction_ids:bankIds,enable_banking_counterpart_transaction_id:counterpart?.id??null,enable_banking_external_transaction_id:transaction.external_transaction_id,enable_banking_account_id:bankAccount.id,enable_banking_status:transaction.status,transfer_rule_id:transferRule.id,imported_at:now,auto_imported:true,unseen:true,categorization_source:'transfer_rule'}}
      const {error:insertError}=await admin.from('finance_transactions').insert(row)
      if(insertError){if(insertError.code==='23505')continue;throw new Error(insertError.message)}
      const value={id:transaction.id,metadata:row.import_metadata,transaction_type:'transfer',account_id:transferRule.source_finance_account_id,transfer_account_id:transferRule.destination_finance_account_id}
      for(const bankId of bankIds)existingById.set(bankId,value)
      imported++
      continue
    }
    if(incomingRule){
      const {data:sources,error:sourceError}=await admin.from('enable_banking_transactions')
        .select('id,external_transaction_id,status,made_on,amount,currency,description,merchant_name,merchant_category_code,first_seen_at')
        .eq('account_id',incomingRule.source_bank_account_id).eq('amount',-Math.abs(signedAmount))
        .gte('made_on',shiftedDay(transaction.made_on,-incomingRule.date_tolerance_days)).lte('made_on',shiftedDay(transaction.made_on,incomingRule.date_tolerance_days))
      if(sourceError)throw new Error(sourceError.message)
      const sourceNeedle=normalized(incomingRule.source_match_text)
      const source=((sources??[]) as BankTransaction[]).filter(candidate=>transactionText(candidate).includes(sourceNeedle)).sort((a,b)=>Math.abs(new Date(a.made_on).getTime()-new Date(transaction.made_on).getTime())-Math.abs(new Date(b.made_on).getTime()-new Date(transaction.made_on).getTime()))[0]
      if(source){
        let sourceImport=existingById.get(source.id)
        if(!sourceImport){
          const {data:storedSource,error:storedSourceError}=await admin.from('finance_transactions').select('id,import_metadata,transaction_type,account_id,transfer_account_id').eq('id',source.id).eq('status','posted').maybeSingle()
          if(storedSourceError)throw new Error(storedSourceError.message)
          if(storedSource){
            const stored=storedSource as ExistingImport
            sourceImport={id:stored.id,metadata:stored.import_metadata??{},transaction_type:stored.transaction_type,account_id:stored.account_id,transfer_account_id:stored.transfer_account_id}
          }
        }
        if(sourceImport){
          const bankIds=Array.from(new Set([...bankReferences(sourceImport.metadata),transaction.id]))
          const metadata={...sourceImport.metadata,enable_banking_transaction_ids:bankIds,enable_banking_counterpart_transaction_id:transaction.id,transfer_rule_id:incomingRule.id,categorization_source:'transfer_rule'}
          if(sourceImport.transaction_type!=='transfer'){
            const {error:splitDeleteError}=await admin.from('finance_transaction_splits').delete().eq('transaction_id',sourceImport.id)
            if(splitDeleteError)throw new Error(splitDeleteError.message)
          }
          const {error:updateError}=await admin.from('finance_transactions').update({account_id:incomingRule.source_finance_account_id,transfer_account_id:incomingRule.destination_finance_account_id,transaction_type:'transfer',amount:Math.abs(signedAmount),import_metadata:metadata}).eq('id',sourceImport.id)
          if(updateError)throw new Error(updateError.message)
          const value={id:sourceImport.id,metadata,transaction_type:'transfer',account_id:incomingRule.source_finance_account_id,transfer_account_id:incomingRule.destination_finance_account_id}
          for(const bankId of bankIds)existingById.set(bankId,value)
        }
        // If the source side has not been imported yet, defer this credit. The
        // source account will create the canonical transfer once it is synced.
        continue
      }
      const bankIds=[transaction.id]
      const row={id:transaction.id,household_id:bankAccount.household_id,account_id:incomingRule.source_finance_account_id,transfer_account_id:incomingRule.destination_finance_account_id,created_by_person_id:person.id,transaction_type:'transfer',amount:Math.abs(signedAmount),currency:String(transaction.currency||financeAccount.currency).trim().toUpperCase(),transaction_date:`${transaction.made_on}T12:00:00+03:00`,merchant:transaction.merchant_name?.trim()||null,description:transaction.description,status:'posted',source:'manual',date_precision:'date',import_metadata:{title:transaction.merchant_name?.trim()||transaction.description?.trim()||'Transfer bancar',affects_balance:true,imported_from:provider,enable_banking_transaction_id:transaction.id,enable_banking_transaction_ids:bankIds,enable_banking_counterpart_transaction_id:transaction.id,enable_banking_external_transaction_id:transaction.external_transaction_id,enable_banking_account_id:bankAccount.id,enable_banking_status:transaction.status,transfer_rule_id:incomingRule.id,imported_at:now,auto_imported:true,unseen:true,categorization_source:'transfer_rule'}}
      const {error:insertError}=await admin.from('finance_transactions').insert(row)
      if(insertError){if(insertError.code==='23505')continue;throw new Error(insertError.message)}
      existingById.set(transaction.id,{id:transaction.id,metadata:row.import_metadata,transaction_type:'transfer',account_id:incomingRule.source_finance_account_id,transfer_account_id:incomingRule.destination_finance_account_id})
      imported++
      continue
    }
    const key=merchantKey(merchant||transaction.description)
    const learnedCategoryId=learned.get(`${transactionType}:${key}`)
    const guessed=learnedCategoryId?null:predictedCategory(availableCategories,transactionType,`${merchant??''} ${transaction.description??''} ${transaction.merchant_category_code??''}`)
    const categoryId=learnedCategoryId??guessed?.id??null
    const row={id:transaction.id,household_id:bankAccount.household_id,account_id:financeAccount.id,transfer_account_id:null,created_by_person_id:person.id,transaction_type:transactionType,amount:Math.abs(signedAmount),currency:String(transaction.currency||financeAccount.currency).trim().toUpperCase(),transaction_date:`${transaction.made_on}T12:00:00+03:00`,merchant,description:transaction.description,status:'posted',source:'manual',date_precision:'date',import_metadata:{title,affects_balance:true,imported_from:provider,enable_banking_transaction_id:transaction.id,enable_banking_external_transaction_id:transaction.external_transaction_id,enable_banking_account_id:bankAccount.id,enable_banking_status:transaction.status,imported_at:now,auto_imported:true,unseen:true,categorization_source:learnedCategoryId?'learned':guessed?'suggested':'uncategorized'}}
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
