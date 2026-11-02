import type {Account,Transaction} from './mylife-data'

const cents=(value:number|string)=>Math.round(Number(value)*100)
const enabled=(value:boolean|string|undefined)=>value!==false&&value!=='false'

export function creditTurnoverForMonth(accounts:Account[],transactions:Transaction[],month:string,currency='RON'){
  const creditAccounts=new Set(accounts.filter(account=>account.account_type==='credit_card'&&account.currency.trim()===currency).map(account=>account.id))
  let completed=0
  for(const transaction of transactions){
    if(transaction.currency.trim()!==currency||transaction.transaction_date.slice(0,7)!==month||!enabled(transaction.affects_balance)||(transaction.status&&transaction.status!=='posted'))continue
    if(transaction.transfer_mirror===true||transaction.transfer_mirror==='true')continue
    const amount=cents(transaction.amount)
    if(!Number.isFinite(amount)||amount<=0)continue
    const directCredit=transaction.transaction_type==='income'&&!!transaction.account_id&&creditAccounts.has(transaction.account_id)
    const transferCredit=transaction.transaction_type==='transfer'&&!!transaction.transfer_account_id&&creditAccounts.has(transaction.transfer_account_id)
    if(directCredit||transferCredit)completed+=amount
  }
  return {completed,creditAccountCount:creditAccounts.size}
}
