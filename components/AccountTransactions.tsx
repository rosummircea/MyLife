'use client'

import { ArrowLeft } from 'lucide-react'
import type { Account, MyLifeData, Transaction } from '@/lib/mylife-data'
import { accountTransactionMonths } from '@/lib/account-transactions'
import { accountAmounts } from '@/lib/account-display'
import TransactionsList from './TransactionsList'
import './AccountTransactions.css'

export default function AccountTransactions({ account, data, loading, onBack, onSelect }: {
  account: Account
  data: MyLifeData | null
  loading: boolean
  onBack: () => void
  onSelect: (transaction: Transaction) => void
}) {
  const months = accountTransactionMonths(data?.transactions ?? [], account.id)
  const { balance, color } = accountAmounts(account)
  return <section className="accountTransactions" aria-label={`Tranzacțiile ${account.name}`}>
    <button className="accountTransactionsBack" type="button" onClick={onBack}><ArrowLeft size={18}/>Înapoi la conturi</button>
    <header className="accountTransactionsHeader"><div><h2>{account.name}</h2><p>Toate tranzacțiile · transferuri trimise și primite</p></div><div><span>Sold actual</span><strong className={`accountTransactionsBalance-${color}`}>{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: account.currency.trim() }).format(balance)}</strong></div></header>
    {loading ? <div className="emptyState" role="status">Se încarcă tranzacțiile…</div> : !months.length ? <div className="emptyState">Nu există tranzacții înregistrate în acest cont.</div> : months.map(group => <section key={group.month} className="accountTransactionsMonth">
      <header><h3>{new Date(group.month + '-01T12:00:00Z').toLocaleDateString('ro-RO', { month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest' })}</h3><span>{group.transactions.length} tranzacții</span></header>
      <TransactionsList accounts={data?.accounts ?? []} transactions={group.transactions} categories={data?.categories ?? []} splits={data?.splits ?? []} contextAccountId={account.id} onSelect={onSelect}/>
    </section>)}
  </section>
}
