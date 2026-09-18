import type {Account,Transaction} from './mylife-data'
import type {Loan} from './loans'
import {remaining} from './loans'
import {accountOwner,accountAmounts} from './account-display'
import {bucharestDay} from './expense-report'
const cents=(amount:number|string)=>Math.round(Number(amount)*100)
export function financeOverview(accounts:Account[],transactions:Transaction[],loans:Loan[]|null,currency:string,today:string){
 const owners=new Map<string,{id:string;name:string;photo?:string;cash:number;creditBalance:number;net:number;available:number}>()
 let cash=0,creditBalance=0
 for(const account of accounts.filter(a=>a.currency.trim()===currency)){
  const balance=cents(account.current_balance??account.opening_balance);if(!Number.isFinite(balance))continue
  const owner=accountOwner(account),group=owners.get(owner.id)??{...owner,cash:0,creditBalance:0,net:0,available:0}
  if(account.account_type==='credit_card'){group.creditBalance+=balance;creditBalance+=balance}else{group.cash+=balance;cash+=balance}
  const creditAvailable=accountAmounts(account).available
  group.available+=account.account_type==='credit_card'?Math.max(0,creditAvailable===null?balance:cents(creditAvailable)):balance
  group.net+=balance;owners.set(owner.id,group)
 }
 const date=new Date(today+'T12:00:00Z'),month=today.slice(0,7),months=Array.from({length:6},(_,i)=>{const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()-5+i,1));return {key:d.toISOString().slice(0,7),label:d.toLocaleDateString('ro-RO',{month:'short',timeZone:'UTC'}),income:0,expenses:0}})
 let count=0
 for(const tx of transactions){if(tx.currency.trim()!==currency||(tx.status&&tx.status!=='posted'))continue;const day=bucharestDay(new Date(tx.transaction_date));if(day>today)continue;const bucket=months.find(m=>m.key===day.slice(0,7));if(!bucket)continue;const value=cents(tx.amount);if(!Number.isFinite(value)||value<0)continue;if(tx.transaction_type==='income')bucket.income+=value;else if(tx.transaction_type==='expense')bucket.expenses+=value;else continue;if(day.startsWith(month))count++}
 const current=months[5],net=current.income-current.expenses,elapsed=date.getUTCDate(),days=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate(),daily=current.expenses/elapsed,projected=Math.round(daily*days)
 const given=loans===null?null:loans.filter(l=>l.currency.trim()===currency&&l.direction==='given').reduce((s,l)=>s+cents(remaining(l)),0),received=loans===null?null:loans.filter(l=>l.currency.trim()===currency&&l.direction==='received').reduce((s,l)=>s+cents(remaining(l)),0)
 return {owners:[...owners.values()],cash,creditBalance,creditDebt:Math.max(0,-creditBalance),netBalance:cash+creditBalance,current:{...current,net,count},months,given,received,loanNet:given===null||received===null?null:given-received,afterLoans:given===null||received===null?null:cash+creditBalance+given-received,daily,projected,daysLeft:days-elapsed,elapsed,days}
}
