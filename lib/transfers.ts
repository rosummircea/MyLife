import type { Account, Transaction } from './mylife-data'
export function transferLabel(transaction:Transaction,accounts:Account[]) {
  const source=transaction.source_account?.name ?? accounts.find(account=>account.id===transaction.account_id)?.name ?? 'Cont sursă indisponibil'
  const destination=transaction.destination_account?.name ?? accounts.find(account=>account.id===transaction.transfer_account_id)?.name ?? 'Cont destinație indisponibil'
  return `${source} → ${destination}`
}
