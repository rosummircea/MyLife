# Calendar and accounts management

The transaction month summary follows the displayed calendar month, defaults to the current Bucharest month, and sums posted income and expenses separately per currency. Internal transfers and balance adjustments do not inflate monthly income/expenses. Calendar activity uses green/red dots, both for internal transfers. Changing month clears day selection; Today explicitly selects today.

Accounts support create/edit/archive/restore and confirmed deletion. Archived accounts are accessible through a toggle. Owners are loaded from active household memberships. `finance_manage_account` is an authenticated security-invoker RPC with RLS, household finance permission, owner validation, explicit version checks, currency validation and numeric amount validation. Deletion is blocked by transaction references, frozen balance-baseline references, recurring rules or balance snapshots. Currency/type cannot change once history exists.

The editor labels the editable balance **Sold de referință**. Derived current balance remains reference balance plus transaction deltas. Increasing the reference balance by 100 increases current balance by 100, without replaying historical transactions. Credit limit stays an editor field to calculate available credit; it is not shown as a card row.

Applied migration source: `sql/account-management.sql`. Snapshot SELECT policy uses the existing secure `mylife_auth.is_household_member` helper so safe deletion checks can read related snapshots. No secret keys or new tables.

Validation: production build, TypeScript, 60 unit tests; intercepted browser fixtures at 1280/390/320 px for month summary, day clearing, dots and account forms. Authenticated SQL rollback tests cover create/edit balance, archive/restore/delete, stale versions and used-account deletion. No test records were retained.

Changed files:
- components/MyLifeApp.tsx
- components/TransactionsCalendar.tsx
- components/TransactionsCalendar.css
- components/DailyTransactionSummary.tsx
- components/AccountsWorkspace.tsx
- components/AccountsWorkspace.css
- lib/mylife-data.ts
- sql/account-management.sql
- docs/account-management.md
