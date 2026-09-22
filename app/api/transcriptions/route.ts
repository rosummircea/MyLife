import {NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'

export const runtime='nodejs'
export const maxDuration=60

const allowedAudioTypes=new Set([
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/m4a',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
])

export async function POST(request:Request){
  try{
    const authorization=request.headers.get('authorization')??''
    const token=authorization.startsWith('Bearer ')?authorization.slice(7):''
    if(!token)return NextResponse.json({error:'Autentificare necesară.'},{status:401})

    const url=process.env.NEXT_PUBLIC_SUPABASE_URL
    const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if(!url||!key)return NextResponse.json({error:'Supabase nu este configurat pe server.'},{status:500})

    const supabase=createClient(url,key,{
      auth:{persistSession:false,autoRefreshToken:false},
      global:{headers:{Authorization:`Bearer ${token}`}},
    })
    const {data:{user},error:userError}=await supabase.auth.getUser(token)
    if(userError||!user)return NextResponse.json({error:'Sesiunea nu mai este validă.'},{status:401})

    const form=await request.formData()
    const audio=form.get('audio')
    if(!(audio instanceof File))return NextResponse.json({error:'Lipsește înregistrarea audio.'},{status:400})
    if(audio.size<=0)return NextResponse.json({error:'Înregistrarea este goală.'},{status:400})
    if(audio.size>12*1024*1024)return NextResponse.json({error:'Înregistrarea este prea lungă. Încearcă o dictare mai scurtă.'},{status:413})
    const baseAudioType=audio.type.split(';')[0]
    if(baseAudioType&&!allowedAudioTypes.has(baseAudioType))return NextResponse.json({error:'Format audio nesuportat.'},{status:415})

    const openaiKey=process.env.OPENAI_API_KEY
    if(!openaiKey)return NextResponse.json({error:'OpenAI API nu este configurat pe server.'},{status:503})

    const openaiForm=new FormData()
    openaiForm.append('file',audio,audio.name||'dictare.m4a')
    openaiForm.append('model','gpt-4o-mini-transcribe')
    openaiForm.append('language','ro')
    openaiForm.append('response_format','json')
    openaiForm.append('prompt','Transcrie fidel în limba română. Păstrează corect numele comercianților, băncile, sumele și monedele.')

    const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{
      method:'POST',
      headers:{Authorization:`Bearer ${openaiKey}`},
      body:openaiForm,
    })
    const payload=await response.json() as {text?:string;error?:{message?:string}}
    if(!response.ok){
      const message=payload.error?.message??'OpenAI nu a putut transcrie înregistrarea.'
      return NextResponse.json({error:message},{status:502})
    }

    const text=payload.text?.trim()
    if(!text)return NextResponse.json({error:'Nu am detectat vorbire în înregistrare.'},{status:422})
    return NextResponse.json({text})
  }catch(error){
    console.error('Romanian transcription failed',error)
    return NextResponse.json({error:error instanceof Error?error.message:'Dictarea nu a putut fi transcrisă.'},{status:500})
  }
}
