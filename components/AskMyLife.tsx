'use client'

import {ExternalLink,MessageCircleQuestion,Mic,Send,Square,Trash2} from 'lucide-react'
import {useEffect,useRef,useState} from 'react'
import {getSupabaseClient} from '@/lib/supabase'

type AskResponse={
  kind:'text'|'document'
  answer:string
  document?:{
    id:string
    label:string
    documentType:string
    signedUrl:string
    expiresAt?:string|null
    documentDate?:string|null
  }
}

function preferredAudioMime(){
  if(typeof MediaRecorder==='undefined')return ''
  for(const mime of ['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus']){
    if(MediaRecorder.isTypeSupported(mime))return mime
  }
  return ''
}

function audioExtension(type:string){
  if(type.includes('webm'))return 'webm'
  if(type.includes('ogg'))return 'ogg'
  if(type.includes('wav'))return 'wav'
  return 'm4a'
}

export default function AskMyLife(){
  const recorderRef=useRef<MediaRecorder|null>(null)
  const streamRef=useRef<MediaStream|null>(null)
  const chunksRef=useRef<Blob[]>([])
  const timerRef=useRef<number|null>(null)
  const [expanded,setExpanded]=useState(false)
  const [question,setQuestion]=useState('')
  const [answer,setAnswer]=useState<AskResponse|null>(null)
  const [asking,setAsking]=useState(false)
  const [recording,setRecording]=useState(false)
  const [transcribing,setTranscribing]=useState(false)
  const [error,setError]=useState('')

  useEffect(()=>()=>cleanupRecorder(),[])

  function cleanupRecorder(){
    if(timerRef.current!==null){
      window.clearTimeout(timerRef.current)
      timerRef.current=null
    }
    streamRef.current?.getTracks().forEach(track=>track.stop())
    streamRef.current=null
    recorderRef.current=null
    chunksRef.current=[]
  }

  async function accessToken(){
    const client=getSupabaseClient()
    if(!client)throw new Error('Conexiunea la Supabase nu este disponibilă.')
    const {data,error}=await client.auth.getSession()
    const token=data.session?.access_token
    if(error||!token)throw new Error(error?.message??'Sesiunea nu mai este validă.')
    return token
  }

  async function transcribe(blob:Blob){
    setTranscribing(true)
    setError('')
    try{
      const token=await accessToken()
      const file=new File([blob],`intrebare.${audioExtension(blob.type)}`,{type:blob.type||'audio/mp4'})
      const form=new FormData()
      form.append('audio',file)
      const response=await fetch('/api/transcriptions',{
        method:'POST',
        headers:{Authorization:`Bearer ${token}`},
        body:form,
      })
      const payload=await response.json() as {text?:string;error?:string}
      if(!response.ok)throw new Error(payload.error??'Dictarea nu a putut fi transcrisă.')
      if(!payload.text?.trim())throw new Error('Nu am detectat vorbire.')
      setQuestion(payload.text.trim())
      setAnswer(null)
    }catch(transcriptionError){
      setError(transcriptionError instanceof Error?transcriptionError.message:'Dictarea nu a putut fi transcrisă.')
    }finally{
      setTranscribing(false)
    }
  }

  async function startRecording(){
    setError('')
    if(typeof navigator==='undefined'||!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
      setError('Browserul nu permite dictarea audio pe acest dispozitiv.')
      return
    }
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true})
      const mime=preferredAudioMime()
      const recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream)
      streamRef.current=stream
      recorderRef.current=recorder
      chunksRef.current=[]
      recorder.ondataavailable=event=>{if(event.data.size)chunksRef.current.push(event.data)}
      recorder.onstop=()=>{
        const type=recorder.mimeType||chunksRef.current[0]?.type||'audio/mp4'
        const blob=new Blob(chunksRef.current,{type})
        setRecording(false)
        if(timerRef.current!==null){
          window.clearTimeout(timerRef.current)
          timerRef.current=null
        }
        stream.getTracks().forEach(track=>track.stop())
        streamRef.current=null
        recorderRef.current=null
        chunksRef.current=[]
        if(blob.size)void transcribe(blob)
      }
      recorder.start()
      setRecording(true)
      timerRef.current=window.setTimeout(()=>{
        if(recorder.state==='recording')recorder.stop()
      },45_000)
    }catch(recordError){
      cleanupRecorder()
      setRecording(false)
      setError(recordError instanceof Error&&recordError.name==='NotAllowedError'
        ?'Permite accesul la microfon pentru dictare.'
        :'Microfonul nu a putut fi pornit.')
    }
  }

  function stopRecording(){
    if(recorderRef.current?.state==='recording')recorderRef.current.stop()
  }

  async function ask(){
    const value=question.trim()
    if(!value){setError('Scrie sau dictează o întrebare.');return}
    setAsking(true)
    setError('')
    setAnswer(null)
    try{
      const token=await accessToken()
      const response=await fetch('/api/mylife/ask',{
        method:'POST',
        headers:{
          Authorization:`Bearer ${token}`,
          'Content-Type':'application/json',
        },
        body:JSON.stringify({question:value}),
      })
      const payload=await response.json() as AskResponse&{error?:string}
      if(!response.ok)throw new Error(payload.error??'MyLife nu a putut răspunde.')
      setAnswer(payload)
    }catch(askError){
      setError(askError instanceof Error?askError.message:'MyLife nu a putut răspunde.')
    }finally{
      setAsking(false)
    }
  }

  const busy=asking||recording||transcribing

  if(!expanded)return <button type="button" className="quickAddOption quickAddAskOption" onClick={()=>setExpanded(true)}>
    <MessageCircleQuestion size={20}/>
    <span><strong>Întreabă MyLife</strong><small>Documente, cheltuieli și solduri din datele tale reale.</small></span>
    <em>Nou</em>
  </button>

  return <section className="askMyLife" aria-label="Întreabă MyLife">
    <header className="askMyLifeHeader">
      <div>
        <strong>Întreabă MyLife</strong>
        <small>Răspunsurile sunt calculate din datele tale din MyLife.</small>
      </div>
      <button type="button" disabled={busy} onClick={()=>{setExpanded(false);setAnswer(null);setError('')}} aria-label="Închide Întreabă MyLife">×</button>
    </header>

    <textarea
      value={question}
      disabled={busy&& !recording}
      maxLength={1000}
      lang="ro"
      autoCapitalize="sentences"
      placeholder="Ex.: Deschide RCA · Cât am cheltuit azi? · Câți bani am în Revolut Mircea?"
      onChange={event=>{setQuestion(event.target.value);setAnswer(null)}}
    />

    <div className="askMyLifeActions">
      <button type="button" className={recording?'recording':''} disabled={asking||transcribing} onClick={()=>recording?stopRecording():void startRecording()}>
        {recording?<Square size={16}/>:<Mic size={17}/>}
        {recording?'Oprește':'Dictează'}
      </button>
      <button type="button" className="askMyLifeSend" disabled={busy||!question.trim()} onClick={()=>void ask()}>
        <Send size={16}/>
        {asking?'Caut…':'Întreabă'}
      </button>
      {question?<button type="button" disabled={busy} aria-label="Șterge întrebarea" onClick={()=>{setQuestion('');setAnswer(null);setError('')}}><Trash2 size={16}/></button>:null}
    </div>

    {recording?<p className="askMyLifeStatus"><span/> Ascult în română…</p>:null}
    {transcribing?<p className="askMyLifeStatus"><span/> Transcriu întrebarea…</p>:null}

    {answer?<div className="askMyLifeAnswer">
      <p>{answer.answer}</p>
      {answer.kind==='document'&&answer.document?.signedUrl?<button type="button" onClick={()=>window.open(answer.document!.signedUrl,'_blank','noopener,noreferrer')}>
        <ExternalLink size={16}/> Deschide {answer.document.label}
      </button>:null}
    </div>:null}

    {error?<p className="quickAddUploadError" role="alert">{error}</p>:null}
  </section>
}
