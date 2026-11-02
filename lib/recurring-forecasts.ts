import type { RecurringRule, Transaction } from './mylife-data'
import { bucharestDay } from './expense-report'

export type ForecastTransaction = Transaction & {
  is_forecast: true
  recurring_rule_id: string
}

const normalized = (value: string | null | undefined) => (value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ro').replace(/[^a-z0-9]+/g, ' ').trim()

const monthAt = (month: string, offset: number) => {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7)
}

const dayInMonth = (month: string, preferredDay: number) => {
  const [year, number] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate()
  return `${month}-${String(Math.min(preferredDay, lastDay)).padStart(2, '0')}`
}

const identity = (transaction: Transaction) => normalized(transaction.merchant || transaction.title || transaction.description)

export function recurringForecasts(rules: RecurringRule[], transactions: Transaction[], today: string): ForecastTransaction[] {
  const currentMonth = today.slice(0, 7)
  const posted = transactions.filter(tx => (!tx.status || tx.status === 'posted') && tx.transaction_type === 'expense')
  const sourceById = new Map(transactions.map(tx => [tx.id, tx]))
  const forecasts: ForecastTransaction[] = []

  for (const rule of rules) {
    if (!rule.is_active || rule.kind !== 'expense' || rule.frequency !== 'monthly') continue
    const source = sourceById.get(rule.source_transaction_id)
    const expectedAmount = Number(rule.expected_amount ?? source?.amount)
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) continue
    const dueDay = Number((rule.next_due_date ?? source?.transaction_date ?? `${today}T12:00:00Z`).slice(8, 10)) || 1
    const expectedIdentity = identity(source ?? { merchant: rule.name, title: rule.name, description: rule.name } as Transaction)
    const horizon = Math.max(0, Math.min(12, Number(rule.forecast_months) || 2))

    for (let offset = 0; offset <= horizon; offset++) {
      const month = monthAt(currentMonth, offset)
      const fulfilled = posted.some(tx => {
        if (tx.account_id !== rule.account_id || bucharestDay(new Date(tx.transaction_date)).slice(0, 7) !== month) return false
        return expectedIdentity !== '' && identity(tx) === expectedIdentity
      })
      if (fulfilled) continue
      const day = dayInMonth(month, dueDay)
      forecasts.push({
        id: `forecast:${rule.id}:${month}`,
        recurring_rule_id: rule.id,
        is_forecast: true,
        transaction_type: 'expense',
        amount: expectedAmount,
        currency: rule.currency,
        transaction_date: `${day}T12:00:00Z`,
        account_id: rule.account_id ?? undefined,
        merchant: source?.merchant ?? rule.name,
        title: source?.title ?? rule.name,
        description: source?.description ?? `Previziune recurentă · ${rule.name}`,
        status: 'forecast',
        affects_balance: false,
      })
    }
  }
  return forecasts.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.id.localeCompare(b.id))
}

export function forecastTotal(forecasts: ForecastTransaction[], month: string, currency = 'RON') {
  return forecasts.reduce((sum, item) => item.currency.trim() === currency && item.transaction_date.slice(0, 7) === month ? sum + Math.round(Number(item.amount) * 100) : sum, 0)
}
