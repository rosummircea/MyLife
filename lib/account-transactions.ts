import type { Transaction } from './mylife-data'
import { bucharestDay } from './expense-report'

export function accountTransactionMonths(transactions: Transaction[], accountId: string) {
  const groups = new Map<string, Transaction[]>()
  const rows = transactions.filter(tx => (!tx.status || tx.status === 'posted') &&
    (tx.account_id === accountId || (tx.transaction_type === 'transfer' && tx.transfer_account_id === accountId)))
    .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime() || a.id.localeCompare(b.id))
  for (const tx of rows) {
    const month = bucharestDay(new Date(tx.transaction_date)).slice(0, 7)
    const group = groups.get(month) ?? []
    group.push(tx)
    groups.set(month, group)
  }
  return [...groups].sort(([a], [b]) => b.localeCompare(a)).map(([month, transactions]) => ({ month, transactions }))
}
