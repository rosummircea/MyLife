import type { RecurringRule, Transaction } from './mylife-data'
import { bucharestDay } from './expense-report'

export type ForecastTransaction = Transaction & {
  is_forecast: true
  recurring_rule_id: string
  forecast_category_id: string | null
}

const normalized = (value: string | null | undefined) => (value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ro').replace(/[^a-z0-9]+/g, ' ').trim()

const isoDay = (date: Date) => date.toISOString().slice(0, 10)
const parseDay = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`)
const monthEnd = (month: string, offset: number) => {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number + offset, 0, 12))
}
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000)
const addMonths = (date: Date, months: number) => {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 12))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate()
  target.setUTCDate(Math.min(date.getUTCDate(), last))
  return target
}
const dayDistance = (left: string, right: string) => Math.abs(parseDay(left).getTime() - parseDay(right).getTime()) / 86400000
const identity = (transaction: Transaction) => normalized(transaction.merchant || transaction.title || transaction.description)

export function recurringForecasts(rules: RecurringRule[], transactions: Transaction[], today: string): ForecastTransaction[] {
  const currentMonth = today.slice(0, 7)
  const windowStart = parseDay(`${currentMonth}-01`)
  const posted = transactions.filter(tx => (!tx.status || tx.status === 'posted') && tx.transaction_type === 'expense')
  const sourceById = new Map(transactions.map(tx => [tx.id, tx]))
  const forecasts: ForecastTransaction[] = []

  for (const rule of rules) {
    if (!rule.is_active || rule.kind !== 'expense' || !['weekly', 'monthly', 'quarterly'].includes(rule.frequency)) continue
    const source = sourceById.get(rule.source_transaction_id)
    const expectedAmount = Number(rule.expected_amount ?? source?.amount)
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) continue
    const expectedIdentity = identity(source ?? { merchant: rule.name, title: rule.name, description: rule.name } as Transaction)
    const horizon = Math.max(0, Math.min(12, Number(rule.forecast_months) || 2))
    const windowEnd = monthEnd(currentMonth, rule.frequency === 'quarterly' ? Math.max(horizon, 3) : horizon)
    const fallbackDay = (source?.transaction_date ?? today).slice(0, 10)
    let occurrence = parseDay(rule.next_due_date ?? fallbackDay)
    const advance = (date: Date) => rule.frequency === 'weekly' ? addDays(date, 7) : addMonths(date, rule.frequency === 'quarterly' ? 3 : 1)
    while (occurrence < windowStart) occurrence = advance(occurrence)

    while (occurrence <= windowEnd) {
      const day = isoDay(occurrence)
      const month = day.slice(0, 7)
      const fulfilled = posted.some(tx => {
        if (tx.account_id !== rule.account_id || expectedIdentity === '' || identity(tx) !== expectedIdentity) return false
        const actualDay = bucharestDay(new Date(tx.transaction_date))
        return rule.frequency === 'weekly' ? dayDistance(actualDay, day) <= 3 : actualDay.slice(0, 7) === month
      })
      if (!fulfilled) forecasts.push({
        id: `forecast:${rule.id}:${day}`,
        recurring_rule_id: rule.id,
        forecast_category_id: rule.category_id,
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
      occurrence = advance(occurrence)
    }
  }
  return forecasts.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.id.localeCompare(b.id))
}

export function forecastTotal(forecasts: ForecastTransaction[], month: string, currency = 'RON') {
  return forecasts.reduce((sum, item) => item.currency.trim() === currency && item.transaction_date.slice(0, 7) === month ? sum + Math.round(Number(item.amount) * 100) : sum, 0)
}
