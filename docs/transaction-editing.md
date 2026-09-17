# Transaction editing

The transaction details dialog supports editing type, source account, transfer destination, amount, date, merchant, description and category allocations. Documents and retained split metadata remain associated. Transfers are supported only between distinct accounts with the same currency. Only posted transactions can be edited. Local snapshots are read-only.

## Database migration — approved and applied

sql/transaction-editing.sql was explicitly approved and applied on 2026-09-17. Current balances were verified unchanged after activation. SQL verification used rolled-back test transactions.

Existing opening_balance values are authoritative saved balance snapshots, already including historical transactions. The migration captures each existing transaction's original effect in import_metadata.balance_baseline, preserving other metadata and current balances. Account balance then equals the saved balance plus current posted effects minus captured original posted effects. New transactions without a baseline contribute their full effect. Editing never changes saved opening balances. This is a one-time initialization: do not repeat baseline capture over subsequently created transactions. Future bank balance imports must explicitly reconcile baselines.

finance_edit_transaction uses the public client and authenticated session. The SQL function runs as caller, respects RLS, locks the transaction, checks its expected version, and validates account ownership, currencies, allocation totals and categories. Transaction and split changes occur atomically. Retained splits keep IDs, person associations, memos and creation dates. Document associations remain unchanged. Unchanged dates preserve the original timestamp; changed dates are stored at noon in Europe/Bucharest with date precision.

After saving, shared application data reloads, including account balances, reports and the calendar. The approved database migration is active before publication of this frontend version.

## Verification

42 automated tests and build passed. SQL scenarios executed inside a rolled-back transaction: account reassignment, amount changes, expense/income conversion, transfer reversal, repeated editing, stale versions, unauthorized users, mismatched currencies, allocations, preserved split metadata and date changes. Tests do not modify real payments or balances.

Browser verification passed at 1280, 390 and 320 px: saving, account reassignment, allocation totals, conversion to transfer, shared refresh, and no horizontal overflow. Browser uses intercepted test responses; the authenticated editing RPC is now active in Supabase.

Explicit titles are stored in existing import_metadata.title and read through a JSON text projection. The backward-compatible finance_edit_transaction_with_title RPC saves title and all other edits atomically through the existing validated RPC. Empty titles revert to the original merchant/description or transfer-route fallback. No new columns were introduced. SQL title save/clear verification was rolled back and confirmed unchanged balances and merchant.
