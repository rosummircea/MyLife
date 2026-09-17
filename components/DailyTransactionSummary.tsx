import type { Transaction } from '@/lib/mylife-data'
import { dailyTransactionTotals } from '@/lib/daily-transactions'
import './DailyTransactionSummary.css'

export default function DailyTransactionSummary({ dateLabel, transactions, loading }: {
  dateLabel: string
  transactions: Transaction[]
  loading: boolean
}) {
  const totals = dailyTransactionTotals(transactions)
  const amount = (cents: number, currency: string) => `${cents > 0 ? '+' : cents < 0 ? '−' : ''}${new Intl.NumberFormat('ro-RO', { style: 'currency', currency }).format(Math.abs(cents) / 100)}`
  return <section className="dailyTransactionSummary" aria-label="Rezumatul zilei">
    <header><h2>{dateLabel}</h2><span>{loading ? 'Se încarcă…' : `${transactions.length} tranzacții`}</span></header>
    <dl>
      {([{ key: 'outgoing', label: 'Ieșiri' }, { key: 'incoming', label: 'Intrări' }, { key: 'net', label: 'Diferență' }] as const).map(metric => <div key={metric.key}>
        <dt>{metric.label}</dt>
        <dd>{loading ? <strong>—</strong> : totals.map(total => {
          const value = metric.key === 'outgoing' ? -total.outgoing : total[metric.key]
          return <strong key={total.currency} className={value < 0 ? 'dailyTransactionNegative' : value > 0 ? 'dailyTransactionPositive' : 'dailyTransactionZero'}>{amount(value, total.currency)}</strong>
        })}</dd>
      </div>)}
    </dl>
    {transactions.some(tx => tx.transaction_type === 'transfer') && <p>Transferurile între conturi nu influențează diferența zilei.</p>}
  </section>
}
