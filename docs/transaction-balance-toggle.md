# Efect asupra soldurilor

Add and edit share TransactionEditor, with the balance switch enabled by default for new records. The flag is saved in import_metadata.affects_balance; missing flags remain enabled. OFF transactions stay visible in lists and reports but contribute zero to balances, including after deletion. Editing recalculates the difference between the saved and new contribution for every involved account; transfers update both sides.

Historical balance_baseline metadata is preserved. Existing transactions already included in a saved reference balance are not charged a second time. Switching a changed historical transaction OFF cancels its delta against that reference. Deleting an enabled historical transaction reverses its original effect. No baseline is recaptured.

Apply sql/transaction-balance-toggle.sql before publishing this frontend. The authenticated, security-invoker RPC wrappers reuse existing permission, currency, allocation and stale-update checks, and persist the flag in the same database transaction. No new schema or public credentials are introduced.
