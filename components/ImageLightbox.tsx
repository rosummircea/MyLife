'use client'

import {X} from 'lucide-react'
import {useEffect} from 'react'
import {createPortal} from 'react-dom'
import './ImageLightbox.css'

export default function ImageLightbox({
  open,
  src,
  alt,
  onClose,
}:{open:boolean;src:string;alt:string;onClose:()=>void}){
  useEffect(()=>{
    if(!open)return
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape')onClose()
    }
    document.addEventListener('keydown',onKeyDown)
    return ()=>document.removeEventListener('keydown',onKeyDown)
  },[open,onClose])

  if(!open||typeof document==='undefined')return null

  return createPortal(
    <div
      className="imageLightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Previzualizare imagine"
      onClick={event=>{if(event.target===event.currentTarget)onClose()}}
    >
      <button type="button" className="imageLightboxClose" onClick={onClose} aria-label="Închide imaginea">
        <X size={24}/>
      </button>
      <div className="imageLightboxViewport" onClick={event=>{if(event.target===event.currentTarget)onClose()}}>
        <img src={src} alt={alt}/>
      </div>
      <small>Apasă × sau în afara imaginii pentru a reveni.</small>
    </div>,
    document.body
  )
}
