import type { CategoryRow, SplitRow, Transaction } from './mylife-data'

export type ExpenseSubcategory = { id: string; name: string; amount: number; color: string }
export type ExpenseCategory = ExpenseSubcategory & { percent: number; subcategories: ExpenseSubcategory[] }
export type ReportPeriod = 'Zi' | 'Săptămână' | 'Lună' | 'An' | 'Custom'
export type DateRange = { from: string; to: string }

const palette = ['#6ea8fe', '#67d8c1', '#a889f4', '#f5bd63', '#f07fa0', '#75c8ff', '#9fda7d', '#8d98a8']
function colorFor(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return palette[hash % palette.length]
}
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' })
export function bucharestDay(date: Date) {
  const parts = dayFormatter.formatToParts(date)
  const part = (type: string) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
function calendarDate(date: Date) { return date.toISOString().slice(0, 10) }
export function reportRange(period: ReportPeriod, anchor: string, custom: DateRange): DateRange {
  if (period === 'Custom') return custom
  const date = new Date(`${anchor}T12:00:00Z`)
  const year = date.getUTCFullYear(), month = date.getUTCMonth()
  if (period === 'Zi') return { from: anchor, to: anchor }
  if (period === 'Lună') return { from: calendarDate(new Date(Date.UTC(year, month, 1))), to: calendarDate(new Date(Date.UTC(year, month + 1, 0))) }
  if (period === 'An') return { from: `${year}-01-01`, to: `${year}-12-31` }
  const monday = new Date(date)
  monday.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6)
  return { from: calendarDate(monday), to: calendarDate(sunday) }
}

// Allocate tenths by largest remainder so the chart and displayed list total 100%.
function percentages(amounts: number[]) {
  const total = amounts.reduce((sum, amount) => sum + amount, 0)
  if (total <= 0) return amounts.map(() => 0)
  const shares = amounts.map((amount) => amount / total * 1000)
  const units = shares.map(Math.floor)
  const remaining = 1000 - units.reduce((sum, unit) => sum + unit, 0)
  const order = shares.map((share, index) => ({ index, fraction: share - units[index] })).sort((a, b) => b.fraction - a.fraction)
  for (let index = 0; index < remaining; index++) units[order[index].index]++
  return units.map((unit) => unit / 10)
}
export function subcategoryDistribution(category: ExpenseCategory) {
  const shares = percentages(category.subcategories.map((item) => item.amount))
  return category.subcategories.map((item, index) => ({ ...item, percent: shares[index] }))
}
export function distributionGradient(items: { color: string; percent: number }[]) {
  let cursor = 0
  return items.map((item) => {
    const start = cursor; cursor += item.percent
    return `${item.color} ${start}% ${cursor}%`
  }).join(', ')
}

export function buildExpenseReport(transactions: Transaction[], categories: CategoryRow[], splits: SplitRow[], range: DateRange) {
  const expenseRows = categories.filter((item) => item.kind === 'expense')
  const categoryById = new Map(expenseRows.map((item) => [item.id, item]))
  const centsByCategory = new Map<string, number>()
  const splitsByTransaction = new Map<string, SplitRow[]>()
  for (const split of splits) {
    const group = splitsByTransaction.get(split.transaction_id) ?? []
    group.push(split); splitsByTransaction.set(split.transaction_id, group)
  }
  const uncategorized = '__uncategorized'
  let excludedCurrencies = 0, transactionCount = 0
  const add = (id: string, cents: number) => centsByCategory.set(id, (centsByCategory.get(id) ?? 0) + cents)
  for (const transaction of transactions) {
    if (transaction.transaction_type !== 'expense') continue
    const day = bucharestDay(new Date(transaction.transaction_date))
    if (day < range.from || day > range.to) continue
    if (transaction.currency.trim() !== 'RON') { excludedCurrencies++; continue }
    transactionCount++
    const total = Math.round(Number(transaction.amount) * 100)
    let allocated = 0
    for (const split of splitsByTransaction.get(transaction.id) ?? []) {
      const cents = Math.round(Number(split.amount) * 100)
      add(split.category_id && categoryById.has(split.category_id) ? split.category_id : uncategorized, cents)
      allocated += cents
    }
    if (allocated > total) throw new Error('Există tranzacții cu subcategorii care depășesc suma cheltuită.')
    if (allocated < total) add(uncategorized, total - allocated)
  }
  // Resolve every descendant to its top-level category and immediate child branch.
  const roots = new Map<string, { row: CategoryRow; direct: number; branches: Map<string, number> }>()
  for (const [id, cents] of centsByCategory) {
    if (!cents || id === uncategorized) continue
    let row = categoryById.get(id)!, branch: CategoryRow | null = null
    const seen = new Set<string>()
    while (row.parent_id && categoryById.has(row.parent_id)) {
      if (seen.has(row.id)) throw new Error('Ierarhia categoriilor conține o buclă.')
      seen.add(row.id); branch = row; row = categoryById.get(row.parent_id)!
    }
    const root = roots.get(row.id) ?? { row, direct: 0, branches: new Map<string, number>() }
    if (branch) root.branches.set(branch.id, (root.branches.get(branch.id) ?? 0) + cents)
    else root.direct += cents
    roots.set(row.id, root)
  }
  const result: ExpenseCategory[] = [...roots.values()].map(({ row, direct, branches }) => {
    const subcategories = expenseRows.filter((child) => child.parent_id === row.id && (child.is_active || branches.has(child.id)))
      .map((child) => ({ id: child.id, name: child.name, amount: (branches.get(child.id) ?? 0) / 100, color: colorFor(child.id) }))
    if (direct) subcategories.push({ id: `${row.id}-direct`, name: 'Fără subcategorie', amount: direct / 100, color: '#8d98a8' })
    subcategories.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'ro'))
    const total = direct + [...branches.values()].reduce((sum, cents) => sum + cents, 0)
    return { id: row.id, name: row.name, color: colorFor(row.id), amount: total / 100, percent: 0, subcategories }
  })
  const unknown = centsByCategory.get(uncategorized) ?? 0
  if (unknown) result.push({ id: uncategorized, name: 'Necategorizat', amount: unknown / 100, percent: 0, color: '#8d98a8', subcategories: [{ id: `${uncategorized}-direct`, name: 'Fără categorie', amount: unknown / 100, color: '#8d98a8' }] })
  result.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'ro'))
  const shares = percentages(result.map((item) => item.amount))
  return {
    categories: result.map((item, index) => ({ ...item, percent: shares[index] })),
    total: result.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100,
    transactionCount, excludedCurrencies,
  }
}

export type ExpenseTrendTarget = { categoryId: string; subcategoryId?: string }
export type ExpenseTrendPoint = { key: string; label: string; fullLabel: string; amount: number }

// Use the same report aggregation for every bucket, including descendants,
// direct parent allocations and uncategorized remainders.
export function buildExpenseTrend(transactions: Transaction[], categories: CategoryRow[], splits: SplitRow[], range: DateRange, period: ReportPeriod, target: ExpenseTrendTarget) {
  const from = new Date(`${range.from}T12:00:00Z`), to = new Date(`${range.to}T12:00:00Z`)
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || range.from > range.to) throw new Error('Perioada graficului nu este validă.')
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
  const unit = period === 'An' || (period === 'Custom' && days > 62) ? 'month' : period === 'Zi' ? 'hour' : 'day'
  const hourFormatter = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', hour: '2-digit', hourCycle: 'h23' })
  const points: ExpenseTrendPoint[] = []
  if (unit === 'hour') {
    for (let hour = 0; hour < 24; hour++) {
      const key = String(hour).padStart(2, '0')
      points.push({ key, label: key, fullLabel: `${range.from} · ${key}:00–${key}:59`, amount: 0 })
    }
  } else {
    const cursor = unit === 'month' ? new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1, 12)) : new Date(from)
    while (cursor <= to) {
      const day = calendarDate(cursor), key = unit === 'month' ? day.slice(0, 7) : day
      points.push({ key, label: cursor.toLocaleDateString('ro-RO', { timeZone: 'UTC', ...(unit === 'month' ? { month: 'short' } : { day: 'numeric' }) }), fullLabel: cursor.toLocaleDateString('ro-RO', { timeZone: 'UTC', ...(unit === 'month' ? { month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long', year: 'numeric' }) }), amount: 0 })
      if (unit === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1)
      else cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }
  const grouped = new Map<string, Transaction[]>()
  const eligibleIds = new Set<string>()
  for (const transaction of transactions) {
    if (transaction.transaction_type !== 'expense' || transaction.currency.trim() !== 'RON') continue
    const date = new Date(transaction.transaction_date), day = bucharestDay(date)
    if (day < range.from || day > range.to) continue
    const key = unit === 'month' ? day.slice(0, 7) : unit === 'hour' ? hourFormatter.format(date) : day
    const group = grouped.get(key) ?? []; group.push(transaction); grouped.set(key, group)
    eligibleIds.add(transaction.id)
  }
  const splitGroups = new Map<string, SplitRow[]>()
  for (const split of splits) {
    if (!eligibleIds.has(split.transaction_id)) continue
    const group = splitGroups.get(split.transaction_id) ?? []; group.push(split); splitGroups.set(split.transaction_id, group)
  }
  for (const point of points) {
    const rows = grouped.get(point.key) ?? []
    if (!rows.length) continue
    const bucket = buildExpenseReport(rows, categories, rows.flatMap((row) => splitGroups.get(row.id) ?? []), range)
    const category = bucket.categories.find((item) => item.id === target.categoryId)
    point.amount = target.subcategoryId ? category?.subcategories.find((item) => item.id === target.subcategoryId)?.amount ?? 0 : category?.amount ?? 0
  }
  return { unit, points, total: points.reduce((sum, point) => sum + Math.round(point.amount * 100), 0) / 100 }
}
