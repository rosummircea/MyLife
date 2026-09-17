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
