import type { ReactNode } from 'react'
import type { Transaction } from '@/lib/mylife-data'
import { dailyTransactionTotals } from '@/lib/daily-transactions'
import './DailyTransactionSummary.css'

export default function DailyTransactionSummary({ dateLabel, transactions, loading, monthly = false, action }: {
  dateLabel: string
  transactions: Transaction[]
  loading: boolean
  action?: ReactNode
  monthly?: boolean
}) {
  const actualTransactions=transactions.filter(tx=>!tx.is_forecast)
  const totals = dailyTransactionTotals(monthly ? actualTransactions.filter(tx => ['income', 'expense'].includes(tx.transaction_type)) : actualTransactions)
  const forecasts=transactions.filter(tx=>tx.is_forecast).reduce((rows,tx)=>{const currency=tx.currency.trim(),current=rows.get(currency)??0;rows.set(currency,current+Math.round(Number(tx.amount)*100));return rows},new Map<string,number>())
  const amount = (cents: number, currency: string) => `${cents > 0 ? '+' : cents < 0 ? '−' : ''}${new Intl.NumberFormat('ro-RO', { style: 'currency', currency }).format(Math.abs(cents) / 100)}`
  return <section className={`dailyTransactionSummary ${monthly?'monthly':''}`} aria-label={monthly ? "Rezumatul lunii" : "Rezumatul zilei"}>
    <header className={action?'dailyTransactionHeaderWithAction':undefined}>{action?<><div className="dailyTransactionHeading"><h2>{dateLabel}</h2><span>{loading?'Se încarcă…':`${transactions.length} tranzacții`}</span></div>{action}</>:<><h2>{dateLabel}</h2><span>{loading?'Se încarcă…':`${transactions.length} tranzacții`}</span></>}</header>
    <dl>
      {([{ key: 'outgoing', label: monthly ? 'Cheltuieli' : 'Ieșiri' }, { key: 'incoming', label: monthly ? 'Venituri' : 'Intrări' }, { key: 'net', label: 'Diferență' }] as const).map(metric => <div key={metric.key}>
        <dt>{metric.label}</dt>
        <dd>{loading ? <strong>—</strong> : totals.map(total => {
          const value = metric.key === 'outgoing' ? -total.outgoing : total[metric.key]
          return <strong key={total.currency} className={value < 0 ? 'dailyTransactionNegative' : value > 0 ? 'dailyTransactionPositive' : 'dailyTransactionZero'}>{amount(value, total.currency)}</strong>
      })}</dd>
      </div>)}
      {monthly&&<div className="dailyTransactionPotential"><dt>Potențială cheltuială</dt><dd>{loading?<strong>—</strong>:([...(forecasts.size?forecasts:new Map([['RON',0]]))]).map(([currency,value])=><strong key={currency}>{amount(-value,currency)}</strong>)}</dd></div>}
    </dl>
  </section>
}
