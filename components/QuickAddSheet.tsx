'use client'

import {FileUp,Image as ImageIcon,X} from 'lucide-react'
import {useEffect,useRef,useState} from 'react'
import ReceiptCapture from './ReceiptCapture'
import NaturalLanguageTransaction from './NaturalLanguageTransaction'
import {bucharestDay} from '@/lib/expense-report'
import {getSupabaseClient} from '@/lib/supabase'
import type {MyLifeData} from '@/lib/mylife-data'
import './QuickAddSheet.css'

type UploadKind='gallery'|'files'

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

export default function QuickAddSheet({onClose,data,onSaved}:{onClose:()=>void;data:MyLifeData|null;onSaved:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null)
  const galleryInput=useRef<HTMLInputElement>(null)
  const filesInput=useRef<HTMLInputElement>(null)
  const [uploadingKind,setUploadingKind]=useState<UploadKind|null>(null)
  const [uploadError,setUploadError]=useState('')

  useEffect(()=>{dialog.current?.showModal()},[])

  async function uploadDocument(file:File,kind:UploadKind){
    const client=getSupabaseClient()
    if(!client){setUploadError('Conexiunea la Supabase nu este disponibilă.');return}

    const ext=extensionFor(file)
    const mime=mimeFor(file,ext)
    const isImage=mime.startsWith('image/')
    const allowed=mime==='application/pdf'||['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(mime)

    if(kind==='gallery'&&!isImage){setUploadError('Alege o fotografie din galerie.');return}
    if(!allowed){setUploadError('Poți încărca momentan PDF, JPG, PNG, WEBP, HEIC sau HEIF.');return}
    if(file.size>50*1024*1024){setUploadError('Fișierul depășește limita de 50 MB.');return}

    setUploadingKind(kind)
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

      const source=kind==='gallery'?'quick_add_gallery':'quick_add_files'
      const {error:documentError}=await client.from('documents').insert({
        user_id:user.id,
        document_type:kind==='gallery'?'photo':'document',
        source_filename:file.name||`document.${ext}`,
        mime_type:mime,
        document_date:bucharestDay(new Date()),
        storage_path:storagePath,
        notes:kind==='gallery'?'Poză încărcată din Quick Add':'Document încărcat din Quick Add',
        extra:{kind:'quick_add_upload',source,upload_status:'stored'},
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
      setUploadingKind(null)
      if(galleryInput.current)galleryInput.current.value=''
      if(filesInput.current)filesInput.current.value=''
    }
  }

  const busy=uploadingKind!==null

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
        ref={galleryInput}
        className="quickAddHiddenInput"
        type="file"
        accept="image/*"
        onChange={event=>{const file=event.target.files?.[0];if(file)void uploadDocument(file,'gallery')}}
      />
      <input
        ref={filesInput}
        className="quickAddHiddenInput"
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
        onChange={event=>{const file=event.target.files?.[0];if(file)void uploadDocument(file,'files')}}
      />

      <div className="quickAddOptions">
        <ReceiptCapture menuMode data={data} onCompleted={()=>{onSaved();dialog.current?.close()}}/>

        <button type="button" className="quickAddOption" disabled={busy} onClick={()=>galleryInput.current?.click()}>
          <ImageIcon size={20}/>
          <span><strong>{uploadingKind==='gallery'?'Se încarcă poza…':'Alege o poză din galerie'}</strong><small>JPG, PNG, WEBP sau HEIC. O salvăm în MyLife.</small></span>
          <em>Galerie</em>
        </button>

        <button type="button" className="quickAddOption" disabled={busy} onClick={()=>filesInput.current?.click()}>
          <FileUp size={20}/>
          <span><strong>{uploadingKind==='files'?'Se încarcă documentul…':'Alege un document din Files'}</strong><small>PDF sau imagine, până la 50 MB.</small></span>
          <em>Files</em>
        </button>

        <NaturalLanguageTransaction data={data} onCompleted={()=>{onSaved();dialog.current?.close()}}/>
      </div>

      {uploadError?<p className="quickAddUploadError" role="alert">{uploadError}</p>:null}
    </div>
  </dialog>
}
