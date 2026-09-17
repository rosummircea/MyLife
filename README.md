# MyLife

MyLife is a personal and family life dashboard backed by Supabase.

Current focus:
- Home dashboard for all life areas
- Documents
- Finance
- Health
- Auto
- Home
- Travel
- Family
- Notes

The app is being built as a Next.js + TypeScript PWA-style web app. Supabase is the durable data layer; ChatGPT is the conversational input and reasoning layer.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Fill the Supabase public URL and publishable key.
3. Run `npm install`.
4. Run `npm run dev`.

No service-role key should ever be exposed to the browser or committed to this repository.

For temporary UI development without login, set `MYLIFE_DEV_ACCESS=true` in
`.env.local` and restart the server (rebuild when using `npm run start`). This opens
the main app directly with the Mircea development profile. The setting defaults
to false. The profile itself does not create a Supabase session.
Set it to false and rebuild/restart to restore the existing Supabase login flow.

## Real data

The app reads the signed-in person's active household, accounts, posted
transactions, category hierarchy, expense splits and document metadata through
the public Supabase client under RLS. A saved session is restored after refresh;
`Conectează live` opens the existing login form during temporary development
access. Queries are paginated and errors are shown with a retry control.

For a local preview without authentication, `MYLIFE_LOCAL_SNAPSHOT_PATH` can point
to a private JSON export outside this repository. It is read only for loopback
hosts with development access enabled, never on Vercel. Its capture time is shown
in the UI; it is not a live connection and does not automatically refresh from
Supabase. A valid Supabase session replaces the snapshot with live data.

Expense reports use posted RON transactions and their splits. Totals use integer
cents, group all descendants into the top-level category and child branch, and
include missing allocations as uncategorized. Rounded percentages total 100%.
Dates use Europe/Bucharest; day, Monday–Sunday week, month, year and custom ranges
are supported. Separately imported historical aggregates and other currencies
are excluded until their overlap/conversion rules are defined. Account cards
show opening balances, not reconciled current balances.

`sql/fix-people-select-policy.sql` records the correction applied to the existing
recursive `people` SELECT policy. It reuses the existing household membership
helper and retains self/active-household access.
