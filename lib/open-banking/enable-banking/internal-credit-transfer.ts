export type LinkedBankFinanceAccount={
  bankAccountId:string
  financeAccountId:string
  accountType:string
  ownerPersonId:string|null
  currency:string
  providerName:string
}

export type InferredCreditTransfer={
  sourceBankAccountId:string
  destinationBankAccountId:string
  sourceFinanceAccountId:string
  destinationFinanceAccountId:string
  sourceMatchText:string
  counterpartMatchText:string|null
  rememberRule:boolean
}

function normalized(value:unknown){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('ro-RO').replace(/\s+/g,' ').trim()}

export function looksLikeInternalCreditTransfer(value:unknown){
  const text=normalized(value)
  return /\b(plata op intra|incasare op|transfer(?: intre conturi)?|rulaj|alimentare card|card payment|credit card payment|plata card(?:ului)? de credit|top[- ]?up|revolut)\b/.test(text)
}

function isRevolut(link:LinkedBankFinanceAccount){return normalized(link.providerName).includes('revolut')}
function topUpSignature(text:string){return normalized(text).match(/top[- ]?up by \*\d+/)?.[0]??null}

export function inferInternalCreditTransfer(currentBankAccountId:string,signedAmount:number,currency:string,text:string,links:LinkedBankFinanceAccount[]):InferredCreditTransfer|null{
  if(!Number.isFinite(signedAmount)||signedAmount===0||!looksLikeInternalCreditTransfer(text))return null
  const current=links.find(link=>link.bankAccountId===currentBankAccountId)
  if(!current?.ownerPersonId)return null
  const normalizedCurrency=currency.trim().toUpperCase()
  const sameOwner=links.filter(link=>link.bankAccountId!==current.bankAccountId&&link.ownerPersonId===current.ownerPersonId&&link.currency.trim().toUpperCase()===normalizedCurrency)
  const topUp=topUpSignature(text)
  if(signedAmount>0&&isRevolut(current)&&topUp){
    const sources=sameOwner.filter(link=>!isRevolut(link)&&link.accountType!=='credit_card')
    if(sources.length!==1)return null
    return {sourceBankAccountId:sources[0].bankAccountId,destinationBankAccountId:current.bankAccountId,sourceFinanceAccountId:sources[0].financeAccountId,destinationFinanceAccountId:current.financeAccountId,sourceMatchText:'revolut',counterpartMatchText:topUp,rememberRule:true}
  }
  if(signedAmount<0&&!isRevolut(current)&&normalized(text).includes('revolut')){
    const destinations=sameOwner.filter(link=>isRevolut(link)&&link.accountType!=='credit_card')
    if(destinations.length!==1)return null
    return {sourceBankAccountId:current.bankAccountId,destinationBankAccountId:destinations[0].bankAccountId,sourceFinanceAccountId:current.financeAccountId,destinationFinanceAccountId:destinations[0].financeAccountId,sourceMatchText:'revolut',counterpartMatchText:'top-up',rememberRule:true}
  }
  if(signedAmount<0&&current.accountType!=='credit_card'){
    const destinations=sameOwner.filter(link=>link.accountType==='credit_card')
    if(destinations.length!==1)return null
    return {sourceBankAccountId:current.bankAccountId,destinationBankAccountId:destinations[0].bankAccountId,sourceFinanceAccountId:current.financeAccountId,destinationFinanceAccountId:destinations[0].financeAccountId,sourceMatchText:'',counterpartMatchText:null,rememberRule:false}
  }
  if(signedAmount>0&&current.accountType==='credit_card'){
    const sources=sameOwner.filter(link=>link.accountType!=='credit_card')
    if(sources.length!==1)return null
    return {sourceBankAccountId:sources[0].bankAccountId,destinationBankAccountId:current.bankAccountId,sourceFinanceAccountId:sources[0].financeAccountId,destinationFinanceAccountId:current.financeAccountId,sourceMatchText:'',counterpartMatchText:null,rememberRule:false}
  }
  return null
}
