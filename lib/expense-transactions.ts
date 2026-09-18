import type { CategoryRow, SplitRow, Transaction } from './mylife-data'
import { buildExpenseReport, bucharestDay, type DateRange, type ExpenseTrendTarget } from './expense-report'

// Reuse report allocation rules, including descendant categories and uncategorized remainders.
export function expenseContributionTransactions(transactions: Transaction[], categories: CategoryRow[], splits: SplitRow[], range: DateRange, target: ExpenseTrendTarget) {
  const groups = new Map<string, SplitRow[]>()
  for (const split of splits) {
    const rows = groups.get(split.transaction_id) ?? []
    rows.push(split)
    groups.set(split.transaction_id, rows)
  }
  return transactions.flatMap(transaction => {
    if (transaction.transaction_type !== 'expense' || transaction.currency.trim() !== 'RON') return []
    const day = bucharestDay(new Date(transaction.transaction_date))
    if (day < range.from || day > range.to) return []
    const category = buildExpenseReport([transaction], categories, groups.get(transaction.id) ?? [], range).categories.find(item => item.id === target.categoryId)
    const amount = target.subcategoryId ? category?.subcategories.find(item => item.id === target.subcategoryId)?.amount ?? 0 : category?.amount ?? 0
    return amount > 0 ? [{ transaction, amount }] : []
  }).sort((a, b) => new Date(b.transaction.transaction_date).getTime() - new Date(a.transaction.transaction_date).getTime() || a.transaction.id.localeCompare(b.transaction.id))
}
