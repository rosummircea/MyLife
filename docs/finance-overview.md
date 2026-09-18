# Finance overview

Overview contains widgets only. The former three-account shortcut and recent-transactions list were removed. Each owner widget sums all current balances in the selected currency: ordinary/cash accounts plus the signed credit-card balance, never the credit limit. Unknown/common owners remain in their own group. The family net uses the same totals.

Loans use the existing authenticated, household-scoped, paginated loadLoans query and RLS. Settlement = current family net + remaining loans given − remaining loans received. Repaid amounts are excluded. Loans have no ownership relation, so settlement is shown for the family rather than invented individual allocations. Missing/failed/snapshot loan data displays unknown values, not zero.

Monthly flow and the six-month chart count posted expenses/income through today's Bucharest date; internal transfers and balance adjustments are excluded. Currencies remain separate, with no invented exchange rate. Spending pace divides elapsed-month expenses by calendar days elapsed and extrapolates to month end, explicitly labelled as an estimate. Category spending uses the same report aggregation and icons in RON.

The purchase calculator subtracts outstanding received loans, product price and a user-chosen reserve from net owned funds. Outstanding receivables and unused credit limits are excluded. It does not reserve unrecorded future bills. When loans are unknown, the calculation is clearly marked partial. Inputs are local, do not create transactions or change balances.

Files: components/FinanceOverview.tsx, components/FinanceOverview.css, components/MyLifeApp.tsx, lib/finance-overview.ts, tests/finance-overview.test.cjs, docs/finance-overview.md. No database/schema changes.

Validation: production build, TypeScript, 60 unit tests; browser fixtures at 1280/390/320 pixels verify balances, settlement, affordability, currency separation and no horizontal overflow. Existing authenticated finance_loans query confirmed readable; real financial data remains unchanged.
