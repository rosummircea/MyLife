import DemoApp from '@/components/DemoApp'
import MyLifeApp from '@/components/MyLifeApp'

export default function Page() {
  const hasSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )

  return hasSupabaseConfig ? <MyLifeApp /> : <DemoApp />
}
