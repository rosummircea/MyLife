'use client'

import Image from 'next/image'
import { ArrowRight, Banknote, Landmark, UserRound } from 'lucide-react'
import type { Account, CategoryRow, SplitRow, Transaction } from '@/lib/mylife-data'
import { accountBank, accountOwner } from '@/lib/account-display'
import { transferLabel } from '@/lib/transfers'
import './TransactionsList.css'

export default function TransactionsList({ accounts, transactions, categories, splits, emptyMessage = 'Nu există tranzacții disponibile.', onSelect, focusedId }: {
  accounts: Account[]
  transactions: Transaction[]
  categories: CategoryRow[]
  splits: SplitRow[]
  emptyMessage?: string
  onSelect: (transaction: Transaction) => void
  focusedId?: string
}) {
  const categoriesById = new Map(categories.map(category => [category.id, category]))
  const allocations = new Map<string, SplitRow[]>()
  for (const split of splits) {
    const rows = allocations.get(split.transaction_id) ?? []
    rows.push(split)
    allocations.set(split.transaction_id, rows)
  }
  const categoryPath = (id: string | null) => {
    if (!id) return 'Fără categorie'
    const path: string[] = []
    const seen = new Set<string>()
    let category = categoriesById.get(id)
    if (!category) return 'Categorie indisponibilă'
    while (category && !seen.has(category.id)) {
      seen.add(category.id)
      path.unshift(category.name)
      category = category.parent_id ? categoriesById.get(category.parent_id) : undefined
    }
    return path.join(' › ')
  }
  return <div className="listPanel transactionList">
    {!transactions.length && <div className="emptyState">{emptyMessage}</div>}
    {transactions.map(tx => {
      const resolveAccount = (id: string | null | undefined, record: Transaction['source_account']): Account | null =>
        accounts.find(item => item.id === id) ?? (record ? {
          id: id ?? 'unavailable', account_type: 'unknown', opening_balance: 0,
          currency: tx.currency, credit_limit: null, ...record,
        } : null)
      const account = resolveAccount(tx.account_id, tx.source_account)
      const destination = resolveAccount(tx.transfer_account_id, tx.destination_account)
      const rows = allocations.get(tx.id) ?? []
      const paths = [...new Set(rows.map(split => categoryPath(split.category_id)))]
      if (tx.transaction_type === 'expense' || tx.transaction_type === 'income') {
        if (!rows.length || rows.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) < Math.round(Number(tx.amount) * 100)) {
          if (!paths.includes('Fără categorie')) paths.push('Fără categorie')
        }
      }
      const incoming = tx.transaction_type === 'income' || tx.transaction_type === 'adjustment'
      const outgoing = tx.transaction_type === 'expense'
      const route = tx.transaction_type === 'transfer' ? transferLabel(tx, accounts) : null
      const title = tx.title?.trim() || route || tx.merchant || tx.description || 'Tranzacție'
      return <button type="button" className={`listRow transactionRow ${route ? 'transactionRow-transfer' : ''} ${focusedId === tx.id ? 'transactionFocused' : ''}`} id={`transaction-${tx.id}`} key={tx.id} onClick={() => onSelect(tx)}>
        {route ? <span className="transactionTransferAccounts">
          <AccountIdentity account={account} direction="Din contul"/>
          <ArrowRight className="transactionTransferArrow" size={18} aria-hidden="true"/>
          <AccountIdentity account={destination} direction="În contul"/>
        </span> : <AccountIdentity account={account}/>}
        <div className="transactionRowInfo">
          <strong className="transactionRowTitle">{title}</strong>
          <span className="transactionRowAccount">{route || account?.name || 'Cont indisponibil'}</span>
          <span className="transactionRowCategories">{paths.length ? paths.join(' · ') : tx.transaction_type === 'transfer' ? 'Transfer între conturi' : 'Ajustare de sold'}</span>
          <span className="transactionRowDate">{new Date(tx.transaction_date).toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' })}</span>
        </div>
        <strong className={`transactionRowAmount ${outgoing ? 'transactionRowAmount-outgoing' : incoming ? 'transactionRowAmount-incoming' : ''}`}>
          {outgoing ? '−' : incoming ? '+' : ''}{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: tx.currency.trim() }).format(Number(tx.amount))}
        </strong>
      </button>
    })}
  </div>
}

function AccountIdentity({ account, direction }: { account: Account | null; direction?: string }) {
  const owner = account ? accountOwner(account) : null
  const bank = account ? accountBank(account) : null
  const label = `${direction ? direction + ': ' : ''}${account ? owner?.name + ' · ' + account.name : 'Cont indisponibil'}`
  return <span className="transactionAccountIdentity" role="img" aria-label={label} title={label}>
    <span className="transactionAccountBank">
      {bank?.icon ? <Image src={bank.icon} alt="" width={36} height={36}/> : account?.account_type === 'cash' ? <Banknote size={26}/> : <Landmark size={26}/>}
    </span>
    <span className="transactionAccountOwnerBadge">
      {owner?.photo ? <Image className="transactionAccountPortrait" src={owner.photo} alt="" width={24} height={24}/> : <UserRound size={14}/>}
    </span>
  </span>
}
