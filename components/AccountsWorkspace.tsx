'use client'

import Image from 'next/image'
import { Banknote, Landmark, UserRound } from 'lucide-react'
import type { Account } from '@/lib/mylife-data'
import { accountAmounts, accountBank, accountOwner } from '@/lib/account-display'
import './AccountsWorkspace.css'

const accountTypes: Record<string,string> = {checking:'Cont curent',cash:'Numerar',credit_card:'Card de credit',savings:'Economii'}
const money = (amount:number,currency:string) => new Intl.NumberFormat('ro-RO',{style:'currency',currency:currency.trim()}).format(amount)
export default function AccountsWorkspace({accounts,loading}:{accounts:Account[];loading:boolean}) {
  const groups = new Map<string,{owner:ReturnType<typeof accountOwner>;accounts:Account[]}>()
  for (const account of accounts) {
    const owner=accountOwner(account)
    const group=groups.get(owner.id) ?? {owner,accounts:[]}
    group.accounts.push(account);groups.set(owner.id,group)
  }
  const sorted=Array.from(groups.values()).sort((a,b)=>({Mircea:0,Andreea:1}[a.owner.name]??2)-({Mircea:0,Andreea:1}[b.owner.name]??2)||a.owner.name.localeCompare(b.owner.name))
  return <section className="accountsWorkspace"><div className="sectionTitle"><h2>Conturi</h2><span>{loading?'Se încarcă…':`${accounts.length} active`}</span></div>
    {loading ? <div className="emptyState" role="status">Se încarcă conturile…</div> : !accounts.length ? <div className="emptyState">Nu există conturi active.</div> : sorted.map(group=><section className="accountsOwnerSection" key={group.owner.id} aria-label={`Conturile ${group.owner.name}`}><header className="accountsOwnerHeader">{group.owner.photo ? <Image className="accountsPortrait" src={group.owner.photo} alt={group.owner.name} width={64} height={64}/> : <div className="accountsPortrait accountsAvatarFallback"><UserRound size={26}/></div>}<div><p>CONTURI PERSONALE</p><h3>{group.owner.name}</h3></div><span>{group.accounts.length} conturi</span></header><div className="accountsOwnerGrid">{group.accounts.map(account=><AccountCard key={account.id} account={account}/>)}</div></section>)}
  </section>
}
function AccountCard({account}:{account:Account}) {
  const bank=accountBank(account)
  const {balance,available,credit,color}=accountAmounts(account)
  const currency=account.currency.trim()
  const title=account.name
  return <article className="accountsBalanceCard"><header><div className="accountsBankIcon">{bank.icon?<Image src={bank.icon} alt={bank.name} width={32} height={32}/>:account.account_type==='cash'?<Banknote size={24}/>:<Landmark size={24}/>}</div><div><h4>{title}</h4><span>{bank.name} · {accountTypes[account.account_type] || account.account_type.replace(/_/g,' ')}</span></div></header><div className="accountsAmountArea"><span>{credit && available!==null?'Disponibil pe card':credit?'Sold card de credit':'Sold'}</span><strong className={`accountsAmount accountsAmount-${color}`}>{money(available ?? balance,currency)}</strong></div>{credit && <div className="accountsCreditDetails">{balance<0?<p><span>Datorie</span><strong className="accountsAmount-red">−{money(Math.abs(balance),currency)}</strong></p>:<p><span>Sold card</span><strong>{money(balance,currency)}</strong></p>}{account.credit_limit!==null && <p><span>Limită credit</span><strong>{money(Number(account.credit_limit),currency)}</strong></p>}{available===null && <small>Limita nu este disponibilă; disponibilul nu poate fi calculat.</small>}</div>}<small className="accountsBalanceSource">Pe baza soldului inițial salvat{credit?' și a limitei de credit':''}</small></article>
}
