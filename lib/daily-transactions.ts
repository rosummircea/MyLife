import type { Transaction } from './mylife-data'

export function dailyTransactionTotals(transactions: Transaction[]) {
  const totals = new Map<string, { currency: string; outgoing: number; incoming: number; net: number }>()
  for (const tx of transactions) {
    if (tx.status && tx.status !== 'posted') continue
    const currency = tx.currency.trim()
    const cents = Math.round(Number(tx.amount) * 100)
    if (!currency || !Number.isFinite(cents) || cents < 0) continue
    const group = totals.get(currency) ?? { currency, outgoing: 0, incoming: 0, net: 0 }
    if (tx.transaction_type === 'expense') group.outgoing += cents
    if (tx.transaction_type === 'income' || tx.transaction_type === 'adjustment') group.incoming += cents
    group.net = group.incoming - group.outgoing
    totals.set(currency, group)
  }
  return totals.size ? [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency)) : [{ currency: 'RON', outgoing: 0, incoming: 0, net: 0 }]
}
