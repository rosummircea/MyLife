# Enable Banking in MyLife

The integration uses Enable Banking Account Information API. Imported Sandbox data is stored separately from `finance_accounts` and `finance_transactions`; it never changes the balances shown by MyLife until an explicit account mapping/import feature is added.

## Server configuration

Apply `sql/open-banking-enable-banking.sql` to the connected Supabase project, then configure these Vercel server-only variables:

- `ENABLE_BANKING_APPLICATION_ID`
- `ENABLE_BANKING_PRIVATE_KEY`
- `ENABLE_BANKING_ENVIRONMENT` (`sandbox` or `production`)
- `ENABLE_BANKING_ASPSP_NAME`
- `ENABLE_BANKING_ASPSP_COUNTRY`
- `NEXT_PUBLIC_APP_URL`

The registered Enable Banking redirect URL must be exactly:

`https://my-life-sable.vercel.app/api/open-banking/enable-banking/callback`

Sandbox uses `Mock ASPSP` in Romania. A separate Production application is required for a real Revolut connection. When the environment is `production`, MyLife defaults to `Revolut` in `RO`; the two ASPSP variables may still override this.

Production application URLs:

- Privacy policy: `https://my-life-sable.vercel.app/privacy`
- Terms: `https://my-life-sable.vercel.app/terms`
- Redirect: `https://my-life-sable.vercel.app/api/open-banking/enable-banking/callback`

## Flow

1. The authenticated user starts the connection from Finance → Accounts.
2. MyLife stores a short-lived, hashed state and starts Enable Banking authorization.
3. The callback validates state, exchanges the one-time code for a session, and imports accounts, balances, and the last year of transactions.
4. Manual refresh synchronizes every active session. External data remains in the `enable_banking_*` staging tables.
