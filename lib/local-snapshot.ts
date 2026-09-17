import 'server-only'
import { readFile } from 'node:fs/promises'
import type { MyLifeData } from './mylife-data'

// A private, ignored absolute path supplied only in the local environment.
// Never import snapshot JSON into the bundle or expose it on a public host.
export async function loadLocalSnapshot(host: string | null): Promise<MyLifeData | null> {
  const path = process.env.MYLIFE_LOCAL_SNAPSHOT_PATH
  if (process.env.MYLIFE_DEV_ACCESS !== 'true' || process.env.VERCEL || !path || !path.startsWith('/')) return null
  if (!host || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return null
  try {
    const data: MyLifeData = JSON.parse(await readFile(path, 'utf8'))
    if (data.source !== 'snapshot' || !data.profile?.householdId || !data.capturedAt ||
      ![data.accounts, data.transactions, data.categories, data.splits, data.documents].every(Array.isArray)) return null
    return data
  } catch {
    return null
  }
}
