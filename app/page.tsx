import { headers } from 'next/headers'
import MyLifeApp from '@/components/MyLifeApp'
import { loadLocalSnapshot } from '@/lib/local-snapshot'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const initialData = await loadLocalSnapshot((await headers()).get('host'))
  return <MyLifeApp developmentAccess={process.env.MYLIFE_DEV_ACCESS === 'true'} initialData={initialData} />
}
