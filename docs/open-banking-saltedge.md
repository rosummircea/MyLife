# Salt Edge Open Banking

The integration uses Salt Edge Account Information API v6. `SALTEDGE_APP_ID` and
`SALTEDGE_SECRET` are server-only; the browser sends its Supabase access token to
MyLife API routes and never receives either Salt Edge credential or the Supabase
secret key.

## Current test flow

1. Apply `sql/open-banking-saltedge.sql` in the connected Supabase project.
2. Keep `SALTEDGE_LIVE=false` while the Salt Edge application is Pending/Test.
3. The Accounts screen offers **Testează conectarea** and opens the configured
   fake provider (`fakebank_with_updates_xf` by default).
4. Signed Salt Edge callbacks update the connection and idempotently upsert its
   accounts and posted/pending transactions into the Open Banking staging tables.
5. Test data stays separate from `finance_accounts` and `finance_transactions`,
   so it cannot change the family's real balances.

Callback URLs must use the stable production domain and must not redirect:

- `/api/open-banking/saltedge/success`
- `/api/open-banking/saltedge/fail`
- `/api/open-banking/saltedge/destroy`
- `/api/open-banking/saltedge/notify`
- `/api/open-banking/saltedge/provider-changes`
- `/api/open-banking/saltedge/consent-changes`

## Going live with Revolut

After Salt Edge approves Live access, confirm the exact Revolut provider code,
set `SALTEDGE_LIVE=true` and `SALTEDGE_PROVIDER_CODE` in Vercel, then redeploy.
Only after a successful live synchronization should a user explicitly map a
Salt Edge account to an existing MyLife finance account. That mapping is the
boundary where imported bank transactions may start affecting MyLife balances.
