'use client'

import {FileUp,Image as ImageIcon,ReceiptText,X} from 'lucide-react'
import {useEffect,useRef,useState} from 'react'
import ReceiptCapture from './ReceiptCapture'
import NaturalLanguageTransaction from './NaturalLanguageTransaction'
import {bucharestDay} from '@/lib/expense-report'
import {getSupabaseClient} from '@/lib/supabase'
import type {MyLifeData} from '@/lib/mylife-data'
import './QuickAddSheet.css'

const mimeByExtension:Record<string,string>={
  jpg:'image/jpeg',
  jpeg:'image/jpeg',
  png:'image/png',
  webp:'image/webp',
  heic:'image/heic',
  heif:'image/heif',
  pdf:'application/pdf',
}

function extensionFor(file:File){
  const ext=file.name.split('.').pop()?.toLowerCase()
  if(ext&&mimeByExtension[ext])return ext
  const byMime=Object.entries(mimeByExtension).find(([,mime])=>mime===file.type)?.[0]
  return byMime??'bin'
}

function mimeFor(file:File,ext:string){
  return file.type||mimeByExtension[ext]||'application/octet-stream'
}

type PendingImage={file:File;previewUrl:string}

export default function QuickAddSheet({onClose,data,onSaved}:{onClose:()=>void;data:MyLifeData|null;onSaved:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null)
  const attachmentInput=useRef<HTMLInputElement>(null)
  const [uploading,setUploading]=useState(false)
  const [uploadError,setUploadError]=useState('')
  const [pendingImage,setPendingImage]=useState<PendingImage|null>(null)
  const [receiptFile,setReceiptFile]=useState<File|null>(null)

  useEffect(()=>{dialog.current?.showModal()},[])
  useEffect(()=>()=>{if(pendingImage)URL.revokeObjectURL(pendingImage.previewUrl)},[pendingImage])

  async function uploadDocument(file:File){
    const client=getSupabaseClient()
    if(!client){setUploadError('Conexiunea la Supabase nu este disponibilă.');return}

    const ext=extensionFor(file)
    const mime=mimeFor(file,ext)
    const isImage=mime.startsWith('image/')
    const allowed=mime==='application/pdf'||['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(mime)

    if(!allowed){setUploadError('Poți încărca momentan PDF, JPG, PNG, WEBP, HEIC sau HEIF.');return}
    if(file.size>50*1024*1024){setUploadError('Fișierul depășește limita de 50 MB.');return}

    setUploading(true)
    setUploadError('')
    try{
      const {data:{user},error:userError}=await client.auth.getUser()
      if(userError||!user)throw new Error(userError?.message??'Nu ești autentificat.')

      const storagePath=`${user.id}/quick-add/${crypto.randomUUID()}.${ext}`
      const {error:storageError}=await client.storage.from('mylife-documents').upload(storagePath,file,{
        contentType:mime,
        cacheControl:'3600',
        upsert:false,
      })
      if(storageError)throw new Error(storageError.message)

      const {error:documentError}=await client.from('documents').insert({
        user_id:user.id,
        document_type:isImage?'photo':'document',
        source_filename:file.name||`document.${ext}`,
        mime_type:mime,
        document_date:bucharestDay(new Date()),
        storage_path:storagePath,
        notes:isImage?'Poză încărcată din Quick Add':'Document încărcat din Quick Add',
        extra:{kind:'quick_add_upload',source:'quick_add_attachment',upload_status:'stored'},
      })

      if(documentError){
        await client.storage.from('mylife-documents').remove([storagePath])
        throw new Error(documentError.message)
      }

      onSaved()
      dialog.current?.close()
    }catch(error){
      setUploadError(error instanceof Error?error.message:'Fișierul nu a putut fi încărcat.')
    }finally{
      setUploading(false)
      if(attachmentInput.current)attachmentInput.current.value=''
    }
  }

  function selectedAttachment(file:File){
    setUploadError('')
    if(file.size>50*1024*1024){
      setUploadError('Fișierul depășește limita de 50 MB.')
      return
    }
    const ext=extensionFor(file)
    const mime=mimeFor(file,ext)
    const isImage=mime.startsWith('image/')
    const allowed=mime==='application/pdf'||['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(mime)
    if(!allowed){
      setUploadError('Poți încărca momentan PDF, JPG, PNG, WEBP, HEIC sau HEIF.')
      return
    }
    if(isImage){
      setPendingImage(current=>{
        if(current)URL.revokeObjectURL(current.previewUrl)
        return {file,previewUrl:URL.createObjectURL(file)}
      })
      return
    }
    void uploadDocument(file)
  }

  function analyzePendingImage(){
    if(!pendingImage)return
    setReceiptFile(pendingImage.file)
    URL.revokeObjectURL(pendingImage.previewUrl)
    setPendingImage(null)
  }

  function savePendingImage(){
    if(!pendingImage)return
    const file=pendingImage.file
    URL.revokeObjectURL(pendingImage.previewUrl)
    setPendingImage(null)
    void uploadDocument(file)
  }

  const busy=uploading

  return <dialog
    ref={dialog}
    className="quickAddSheet"
    aria-labelledby="quick-add-title"
    onClose={onClose}
    onClick={event=>{if(event.target===event.currentTarget)event.currentTarget.close()}}
  >
    <div className="quickAddSheetBody">
      <header>
        <div>
          <h2 id="quick-add-title">Adaugă în MyLife</h2>
          <p>Alege cum vrei să introduci informația.</p>
        </div>
        <button type="button" className="quickAddClose" onClick={()=>dialog.current?.close()} aria-label="Închide"><X size={20}/></button>
      </header>

      <input
        ref={attachmentInput}
        className="quickAddHiddenInput"
        type="file"
        accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
        onChange={event=>{const selected=event.target.files?.[0];if(selected)selectedAttachment(selected)}}
      />

      <div className="quickAddOptions">
        <button type="button" className="quickAddOption quickAddUnifiedAttachment" disabled={busy} onClick={()=>attachmentInput.current?.click()}>
          <FileUp size={20}/>
          <span>
            <strong>{uploading?'Se încarcă…':'Adaugă poză sau document'}</strong>
            <small>Cameră, galerie sau Files · PDF ori imagine.</small>
          </span>
          <em>Deschide</em>
        </button>

        {pendingImage?<section className="quickAddImageChoice">
          <img src={pendingImage.previewUrl} alt="Previzualizare imagine selectată"/>
          <div>
            <strong>{pendingImage.file.name||'Imagine selectată'}</strong>
            <small>Ce vrei să facă MyLife cu imaginea?</small>
            <div>
              <button type="button" disabled={busy} onClick={analyzePendingImage}><ReceiptText size={16}/> Analizează ca bon</button>
              <button type="button" disabled={busy} onClick={savePendingImage}><ImageIcon size={16}/> Salvează poza</button>
            </div>
          </div>
        </section>:null}

        <ReceiptCapture
          menuMode
          hideInitialTrigger
          externalFile={receiptFile}
          onExternalFileConsumed={()=>setReceiptFile(null)}
          data={data}
          onCompleted={()=>{onSaved();dialog.current?.close()}}
        />

        <NaturalLanguageTransaction data={data} onCompleted={()=>{onSaved();dialog.current?.close()}}/>
      </div>

      {uploadError?<p className="quickAddUploadError" role="alert">{uploadError}</p>:null}
    </div>
  </dialog>
}
