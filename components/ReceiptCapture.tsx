'use client'

import {Camera,CheckCircle2,ImagePlus,Trash2} from 'lucide-react'
import {useEffect,useRef,useState} from 'react'
import {bucharestDay} from '@/lib/expense-report'
import {getSupabaseClient} from '@/lib/supabase'

type UploadedReceipt = {
  documentId:string
  storagePath:string
  fileName:string
  previewUrl:string
}

function extensionFor(file:File){
  const fromName=file.name.split('.').pop()?.toLowerCase()
  if(fromName&&['jpg','jpeg','png','webp','heic','heif'].includes(fromName))return fromName
  const byMime:Record<string,string>={
    'image/jpeg':'jpg',
    'image/png':'png',
    'image/webp':'webp',
    'image/heic':'heic',
    'image/heif':'heif',
  }
  return byMime[file.type]??'jpg'
}

export default function ReceiptCapture(){
  const inputRef=useRef<HTMLInputElement>(null)
  const [receipt,setReceipt]=useState<UploadedReceipt|null>(null)
  const [uploading,setUploading]=useState(false)
  const [error,setError]=useState('')

  useEffect(()=>()=>{if(receipt?.previewUrl)URL.revokeObjectURL(receipt.previewUrl)},[receipt?.previewUrl])

  async function removeReceipt(target=receipt){
    if(!target)return
    const client=getSupabaseClient()
    if(!client)return
    setError('')
    const {error:storageError}=await client.storage.from('mylife-documents').remove([target.storagePath])
    const {error:documentError}=await client.from('documents').delete().eq('id',target.documentId)
    if(storageError||documentError){
      setError(storageError?.message??documentError?.message??'Bonul nu a putut fi șters.')
      return
    }
    URL.revokeObjectURL(target.previewUrl)
    setReceipt(null)
  }

  async function upload(file:File){
    const client=getSupabaseClient()
    if(!client){setError('Conexiunea la Supabase nu este disponibilă.');return}
    if(!file.type.startsWith('image/')){setError('Alege o fotografie a bonului.');return}
    if(file.size>50*1024*1024){setError('Imaginea depășește limita de 50 MB.');return}

    setUploading(true)
    setError('')
    try{
      const {data:{user},error:userError}=await client.auth.getUser()
      if(userError||!user)throw new Error(userError?.message??'Nu ești autentificat.')

      if(receipt){
        const {error:oldStorageError}=await client.storage.from('mylife-documents').remove([receipt.storagePath])
        if(oldStorageError)throw new Error(oldStorageError.message)
        const {error:oldDocumentError}=await client.from('documents').delete().eq('id',receipt.documentId)
        if(oldDocumentError)throw new Error(oldDocumentError.message)
        URL.revokeObjectURL(receipt.previewUrl)
        setReceipt(null)
      }

      const ext=extensionFor(file)
      const storagePath=`${user.id}/receipts/${crypto.randomUUID()}.${ext}`
      const {error:uploadError}=await client.storage.from('mylife-documents').upload(storagePath,file,{
        contentType:file.type||'image/jpeg',
        cacheControl:'3600',
        upsert:false,
      })
      if(uploadError)throw new Error(uploadError.message)

      const {data:document,error:documentError}=await client.from('documents').insert({
        user_id:user.id,
        document_type:'invoice',
        source_filename:file.name||`bon.${ext}`,
        mime_type:file.type||'image/jpeg',
        document_date:bucharestDay(new Date()),
        storage_path:storagePath,
        notes:'Bon încărcat din Finanțe',
        extra:{kind:'receipt',receipt_status:'captured',source:'finance_transaction_camera'},
      }).select('id').single()

      if(documentError||!document){
        await client.storage.from('mylife-documents').remove([storagePath])
        throw new Error(documentError?.message??'Metadatele bonului nu au putut fi salvate.')
      }

      setReceipt({
        documentId:document.id,
        storagePath,
        fileName:file.name||`bon.${ext}`,
        previewUrl:URL.createObjectURL(file),
      })
    }catch(uploadError){
      setError(uploadError instanceof Error?uploadError.message:'Bonul nu a putut fi încărcat.')
    }finally{
      setUploading(false)
      if(inputRef.current)inputRef.current.value=''
    }
  }

  return <section className="receiptCapture" aria-label="Scanează bon">
    <input
      ref={inputRef}
      className="receiptCaptureInput"
      type="file"
      accept="image/*"
      capture="environment"
      onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file)}}
    />

    {!receipt?<button type="button" className="receiptCaptureButton" disabled={uploading} onClick={()=>inputRef.current?.click()}>
      <Camera size={20}/>
      <span><strong>{uploading?'Se încarcă bonul…':'Scanează bon'}</strong><small>Deschide camera și salvează fotografia în MyLife.</small></span>
    </button>:<div className="receiptCapturePreview">
      <img src={receipt.previewUrl} alt="Previzualizare bon"/>
      <div>
        <span className="receiptCaptureReady"><CheckCircle2 size={16}/> Bon încărcat</span>
        <strong>{receipt.fileName}</strong>
        <small>Pasul următor va analiza automat produsele și categoriile.</small>
        <div className="receiptCaptureActions">
          <button type="button" disabled={uploading} onClick={()=>inputRef.current?.click()}><ImagePlus size={16}/> Schimbă poza</button>
          <button type="button" disabled={uploading} onClick={()=>void removeReceipt()}><Trash2 size={16}/> Șterge</button>
        </div>
      </div>
    </div>}

    {error?<p className="receiptCaptureError" role="alert">{error}</p>:null}
  </section>
}