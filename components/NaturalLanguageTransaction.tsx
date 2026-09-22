'use client'

import {Mic,PenLine,Sparkles,Square,Trash2} from 'lucide-react'
import {useEffect,useRef,useState} from 'react'
import {getSupabaseClient} from '@/lib/supabase'
import type {MyLifeData,Transaction} from '@/lib/mylife-data'
import type {TransactionEdit} from '@/lib/transaction-edit'
import TransactionEditor,{type TransactionCreateMode} from './TransactionEditor'

type InterpretedTransaction={
  transaction_type:'expense'|'income'|'transfer'
  amount:number
  currency:string
  day:string
  title:string
  merchant:string
  description:string
  account_id:string|null
  transfer_account_id:string|null
  category_id:string|null
  confidence:number
  warnings:string[]
}

function audioExtension(type:string){
  if(type.includes('webm'))return 'webm'
  if(type.includes('ogg'))return 'ogg'
  if(type.includes('wav'))return 'wav'
  return 'm4a'
}

function preferredAudioMime(){
  if(typeof MediaRecorder==='undefined')return ''
  for(const mime of ['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus']){
    if(MediaRecorder.isTypeSupported(mime))return mime
  }
  return ''
}

export default function NaturalLanguageTransaction({data,onCompleted}:{data:MyLifeData|null;onCompleted:()=>void}){
  const recorderRef=useRef<MediaRecorder|null>(null)
  const streamRef=useRef<MediaStream|null>(null)
  const chunksRef=useRef<Blob[]>([])
  const stopTimerRef=useRef<number|null>(null)
  const [expanded,setExpanded]=useState(false)
  const [text,setText]=useState('')
  const [recording,setRecording]=useState(false)
  const [transcribing,setTranscribing]=useState(false)
  const [interpreting,setInterpreting]=useState(false)
  const [saving,setSaving]=useState(false)
  const [draft,setDraft]=useState<InterpretedTransaction|null>(null)
  const [error,setError]=useState('')

  useEffect(()=>()=>cleanupRecorder(),[])

  function cleanupRecorder(){
    if(stopTimerRef.current!==null){
      window.clearTimeout(stopTimerRef.current)
      stopTimerRef.current=null
    }
    streamRef.current?.getTracks().forEach(track=>track.stop())
    streamRef.current=null
    recorderRef.current=null
    chunksRef.current=[]
  }

  async function accessToken(){
    const client=getSupabaseClient()
    if(!client)throw new Error('Conexiunea la Supabase nu este disponibilă.')
    const {data:sessionData,error:sessionError}=await client.auth.getSession()
    const token=sessionData.session?.access_token
    if(sessionError||!token)throw new Error(sessionError?.message??'Sesiunea nu mai este validă.')
    return token
  }

  async function transcribe(blob:Blob){
    setTranscribing(true)
    setError('')
    try{
      const token=await accessToken()
      const extension=audioExtension(blob.type)
      const file=new File([blob],`dictare.${extension}`,{type:blob.type||'audio/mp4'})
      const form=new FormData()
      form.append('audio',file)
      const response=await fetch('/api/transcriptions',{
        method:'POST',
        headers:{Authorization:`Bearer ${token}`},
        body:form,
      })
      const payload=await response.json() as {text?:string;error?:string}
      if(!response.ok)throw new Error(payload.error??'Dictarea nu a putut fi transcrisă.')
      const transcript=payload.text?.trim()
      if(!transcript)throw new Error('Nu am detectat vorbire în înregistrare.')
      setText(current=>current.trim()?`${current.trim()} ${transcript}`:transcript)
      setDraft(null)
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
      recorder.onerror=()=>setError('Înregistrarea audio s-a oprit cu o eroare.')
      recorder.onstop=()=>{
        const type=recorder.mimeType||chunksRef.current[0]?.type||'audio/mp4'
        const blob=new Blob(chunksRef.current,{type})
        setRecording(false)
        if(stopTimerRef.current!==null){
          window.clearTimeout(stopTimerRef.current)
          stopTimerRef.current=null
        }
        stream.getTracks().forEach(track=>track.stop())
        streamRef.current=null
        recorderRef.current=null
        const hasAudio=blob.size>0
        chunksRef.current=[]
        if(hasAudio)void transcribe(blob)
      }
      recorder.start()
      setRecording(true)
      stopTimerRef.current=window.setTimeout(()=>{
        if(recorder.state==='recording')recorder.stop()
      },60_000)
    }catch(recordError){
      cleanupRecorder()
      setRecording(false)
      setError(recordError instanceof Error&&recordError.name==='NotAllowedError'
        ?'Permite accesul la microfon pentru dictare.'
        :'Microfonul nu a putut fi pornit.')
    }
  }

  function stopRecording(){
    const recorder=recorderRef.current
    if(recorder?.state==='recording')recorder.stop()
  }

  async function interpret(){
    if(!data){setError('Datele MyLife nu sunt încă încărcate.');return}
    const value=text.trim()
    if(!value){setError('Scrie sau dictează tranzacția.');return}
    setInterpreting(true)
    setError('')
    try{
      const token=await accessToken()
      const response=await fetch('/api/transactions/interpret',{
        method:'POST',
        headers:{
          Authorization:`Bearer ${token}`,
          'Content-Type':'application/json',
        },
        body:JSON.stringify({text:value,householdId:data.profile.householdId}),
      })
      const payload=await response.json() as InterpretedTransaction&{error?:string}
      if(!response.ok)throw new Error(payload.error??'Textul nu a putut fi interpretat.')
      setDraft(payload)
    }catch(interpretError){
      setError(interpretError instanceof Error?interpretError.message:'Textul nu a putut fi interpretat.')
    }finally{
      setInterpreting(false)
    }
  }

  const busy=recording||transcribing||interpreting||saving
  const createMode:TransactionCreateMode=draft?.transaction_type==='transfer'?'transfer':'standard'

  const transaction:Transaction|undefined=draft?{
    id:crypto.randomUUID(),
    transaction_type:draft.transaction_type,
    amount:draft.amount,
    currency:draft.currency,
    transaction_date:`${draft.day}T12:00:00Z`,
    account_id:draft.account_id??'',
    transfer_account_id:draft.transfer_account_id,
    merchant:draft.merchant||null,
    description:draft.description||null,
    title:draft.title||null,
  }:undefined

  const initialValues:Partial<TransactionEdit>|undefined=draft?{
    transaction_type:draft.transaction_type,
    amount:draft.amount,
    currency:draft.currency,
    day:draft.day,
    title:draft.title,
    merchant:draft.merchant,
    description:draft.description,
    account_id:draft.account_id??'',
    transfer_account_id:draft.transfer_account_id,
    ...(draft.category_id&&draft.transaction_type!=='transfer'
      ?{splits:[{category_id:draft.category_id,amount:draft.amount}]}
      :{}),
  }:undefined

  if(!expanded)return <button type="button" className="quickAddOption" disabled={!data} onClick={()=>setExpanded(true)}>
    <PenLine size={20}/>
    <span><strong>Scrie sau dictează</strong><small>Descrii tranzacția în română, iar MyLife pregătește datele pentru verificare.</small></span>
    <em>Română</em>
  </button>

  return <section className="naturalLanguageTransaction" aria-label="Scrie sau dictează tranzacția">
    <header className="naturalLanguageHeader">
      <div><strong>Scrie sau dictează</strong><small>Vorbește natural în română. Verifici totul înainte de salvare.</small></div>
      <button type="button" disabled={busy} onClick={()=>{setExpanded(false);setDraft(null);setError('')}} aria-label="Închide introducerea prin text">×</button>
    </header>

    {!draft?<div className="naturalLanguageComposer">
      <textarea
        value={text}
        maxLength={4000}
        disabled={busy&& !recording}
        onChange={event=>{setText(event.target.value);setDraft(null)}}
        placeholder="Ex.: Am plătit 85 de lei la Lidl din Revolut pentru cumpărături, ieri."
        lang="ro"
        autoCapitalize="sentences"
      />
      <div className="naturalLanguageActions">
        <button
          type="button"
          className={recording?'recording':''}
          disabled={transcribing||interpreting}
          aria-pressed={recording}
          onClick={()=>recording?stopRecording():void startRecording()}
        >
          {recording?<Square size={17}/>:<Mic size={18}/>}
          {recording?'Oprește':'Dictează'}
        </button>
        <button type="button" className="naturalLanguageAnalyze" disabled={busy||!text.trim()} onClick={()=>void interpret()}>
          <Sparkles size={17}/>
          {interpreting?'Interpretez…':'Interpretează'}
        </button>
        {text?<button type="button" disabled={busy} onClick={()=>{setText('');setDraft(null);setError('')}} aria-label="Șterge textul"><Trash2 size={17}/></button>:null}
      </div>
      {recording?<p className="naturalLanguageStatus"><span/> Ascult în română… apasă Oprește când ai terminat.</p>:null}
      {transcribing?<p className="naturalLanguageStatus"><span/> Transcriu dictarea în română…</p>:null}
    </div>:null}

    {draft&&transaction&&data&&initialValues?<div className="naturalLanguageReview">
      <div className="naturalLanguageOriginal">
        <small>Ai spus / ai scris</small>
        <p>{text}</p>
        <button type="button" disabled={saving} onClick={()=>setDraft(null)}>Modifică textul</button>
      </div>
      {draft.warnings?.length?<div className="naturalLanguageWarnings">{draft.warnings.map((warning,index)=><p key={index}>{warning}</p>)}</div>:null}
      <TransactionEditor
        key={transaction.id}
        creating
        createMode={createMode}
        transaction={transaction}
        initialValues={initialValues}
        data={data}
        onCancel={()=>setDraft(null)}
        onSaved={onCompleted}
        onSavingChange={setSaving}
      />
    </div>:null}

    {error?<p className="quickAddUploadError" role="alert">{error}</p>:null}
  </section>
}
