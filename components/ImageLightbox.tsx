'use client'

import {X} from 'lucide-react'
import {useEffect,useRef} from 'react'
import './ImageLightbox.css'

export default function ImageLightbox({
  open,
  src,
  alt,
  onClose,
}:{open:boolean;src:string;alt:string;onClose:()=>void}){
  const dialogRef=useRef<HTMLDialogElement>(null)

  useEffect(()=>{
    const dialog=dialogRef.current
    if(!dialog)return
    if(open){
      if(!dialog.open)dialog.showModal()
    }else if(dialog.open){
      dialog.close()
    }
  },[open])

  return <dialog
    ref={dialogRef}
    className="imageLightbox"
    aria-label="Previzualizare imagine"
    onCancel={event=>{
      event.preventDefault()
      onClose()
    }}
    onClose={()=>{if(open)onClose()}}
    onClick={event=>{if(event.target===event.currentTarget)onClose()}}
  >
    <button type="button" className="imageLightboxClose" onClick={onClose} aria-label="Închide imaginea">
      <X size={24}/>
    </button>
    <div className="imageLightboxViewport">
      <img src={src} alt={alt}/>
    </div>
    <small>Apasă × sau în afara imaginii pentru a reveni.</small>
  </dialog>
}
