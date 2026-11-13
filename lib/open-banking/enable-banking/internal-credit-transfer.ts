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

export type BankTransferCandidate={
  id:string
  accountId:string
  amount:number
  currency:string
  madeOn:string
  description:string|null
  merchantName:string|null
}

function normalized(value:unknown){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('ro-RO').replace(/\s+/g,' ').trim()}

export function looksLikeInternalCreditTransfer(value:unknown){
  const text=normalized(value)
  return /\b(plata op intra|incasare op|transfer(?: intre conturi)?|rulaj|alimentare card|card payment|credit card payment|plata card(?:ului)? de credit|top[- ]?up|revolut)\b/.test(text)
}

function looksLikeCreditCardRepayment(value:unknown){
  const text=normalized(value)
  return /\b(rulaj|alimentare card|card payment|credit card payment|plata card(?:ului)? de credit)\b/.test(text)
}

function isRevolut(link:LinkedBankFinanceAccount){return normalized(link.providerName).includes('revolut')}
function topUpSignature(text:string){return normalized(text).match(/top[- ]?up by \*\d+/)?.[0]??null}
function transferReference(text:string){return normalized(text).match(/\bref(?:erinta)?\s*[:#-]?\s*([a-z0-9-]{6,})\b/)?.[1]??null}
function dayDistance(first:string,second:string){return Math.abs(new Date(`${first}T12:00:00Z`).getTime()-new Date(`${second}T12:00:00Z`).getTime())/86_400_000}

export function inferExactBankPairTransfer(currentBankAccountId:string,transaction:BankTransferCandidate,links:LinkedBankFinanceAccount[],transactions:BankTransferCandidate[]):InferredCreditTransfer|null{
  if(!Number.isFinite(transaction.amount)||transaction.amount===0||!looksLikeInternalCreditTransfer(`${transaction.merchantName??''} ${transaction.description??''}`))return null
  const current=links.find(link=>link.bankAccountId===currentBankAccountId)
  if(!current?.ownerPersonId)return null
  const currentText=normalized(`${transaction.merchantName??''} ${transaction.description??''}`)
  const currentDescription=normalized(transaction.description)
  const reference=transferReference(currentText)
  const matches=transactions.filter(candidate=>{
    if(candidate.id===transaction.id||candidate.accountId===currentBankAccountId||candidate.amount!==-transaction.amount)return false
    if(candidate.currency.trim().toUpperCase()!==transaction.currency.trim().toUpperCase()||dayDistance(candidate.madeOn,transaction.madeOn)>1)return false
    const candidateLink=links.find(link=>link.bankAccountId===candidate.accountId)
    if(!candidateLink||candidateLink.ownerPersonId!==current.ownerPersonId||candidateLink.financeAccountId===current.financeAccountId)return false
    const candidateText=normalized(`${candidate.merchantName??''} ${candidate.description??''}`)
    const sharedReference=reference&&transferReference(candidateText)===reference
    const sameInternalDescription=currentDescription.length>=12&&currentDescription===normalized(candidate.description)
    return Boolean(sharedReference||sameInternalDescription)
  })
  if(matches.length!==1)return null
  const counterpart=matches[0]
  const counterpartLink=links.find(link=>link.bankAccountId===counterpart.accountId)
  if(!counterpartLink)return null
  const source=transaction.amount<0?current:counterpartLink
  const destination=transaction.amount>0?current:counterpartLink
  const signature=reference??normalized(transaction.description)
  return {sourceBankAccountId:source.bankAccountId,destinationBankAccountId:destination.bankAccountId,sourceFinanceAccountId:source.financeAccountId,destinationFinanceAccountId:destination.financeAccountId,sourceMatchText:signature,counterpartMatchText:signature,rememberRule:false}
}

export function isBookedReplacement(current:BankTransferCandidate&{status:string|null},previous:BankTransferCandidate&{status:string|null}){
  const currentStatus=normalized(current.status),previousStatus=normalized(previous.status)
  if(current.accountId!==previous.accountId||current.id===previous.id||currentStatus!=='book'||previousStatus==='book')return false
  if(current.amount!==previous.amount||current.currency.trim().toUpperCase()!==previous.currency.trim().toUpperCase()||dayDistance(current.madeOn,previous.madeOn)>3)return false
  return normalized(`${current.merchantName??''} ${current.description??''}`)===normalized(`${previous.merchantName??''} ${previous.description??''}`)
}

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
  if(signedAmount<0&&current.accountType!=='credit_card'&&looksLikeCreditCardRepayment(text)){
    const destinations=sameOwner.filter(link=>link.accountType==='credit_card')
    if(destinations.length!==1)return null
    return {sourceBankAccountId:current.bankAccountId,destinationBankAccountId:destinations[0].bankAccountId,sourceFinanceAccountId:current.financeAccountId,destinationFinanceAccountId:destinations[0].financeAccountId,sourceMatchText:'',counterpartMatchText:null,rememberRule:false}
  }
  if(signedAmount>0&&current.accountType==='credit_card'&&looksLikeCreditCardRepayment(text)){
    const sources=sameOwner.filter(link=>link.accountType!=='credit_card')
    if(sources.length!==1)return null
    return {sourceBankAccountId:sources[0].bankAccountId,destinationBankAccountId:current.bankAccountId,sourceFinanceAccountId:sources[0].financeAccountId,destinationFinanceAccountId:current.financeAccountId,sourceMatchText:'',counterpartMatchText:null,rememberRule:false}
  }
  return null
}
