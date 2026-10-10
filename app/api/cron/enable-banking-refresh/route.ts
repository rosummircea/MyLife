import {timingSafeEqual} from 'node:crypto'
import {NextResponse} from 'next/server'
import {refreshEnableBankingSessions} from '@/lib/open-banking/enable-banking/refresh'
import {adminClient} from '@/lib/open-banking/server'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60

function authorized(request:Request){
  const secret=process.env.CRON_SECRET
  const authorization=request.headers.get('authorization')??''
  if(!secret||!authorization.startsWith('Bearer '))return false
  const received=Buffer.from(authorization.slice(7))
  const expected=Buffer.from(secret)
  return received.length===expected.length&&timingSafeEqual(received,expected)
}

export async function POST(request:Request){
  if(!authorized(request))return NextResponse.json({error:'Neautorizat.'},{status:401})
  try{
    const results=await refreshEnableBankingSessions(adminClient(),{continueOnError:true})
    const failed=results.filter(result=>!result.ok).length
    return NextResponse.json({ok:failed===0,synced:results.length-failed,failed})
  }catch(error){
    console.error('[Enable Banking] scheduled refresh failed',error)
    return NextResponse.json({error:error instanceof Error?error.message:'Sincronizarea programată nu a reușit.'},{status:500})
  }
}

export const GET=POST
