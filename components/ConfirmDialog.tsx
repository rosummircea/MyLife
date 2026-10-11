'use client'

import {useEffect,useId,useRef,type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {X} from 'lucide-react'
import './ConfirmDialog.css'

export default function ConfirmDialog({open,title,description,children,confirmLabel='Confirmă',cancelLabel='Renunță',busy=false,danger=false,onConfirm,onCancel}:{open:boolean;title:string;description?:ReactNode;children?:ReactNode;confirmLabel?:string;cancelLabel?:string;busy?:boolean;danger?:boolean;onConfirm:()=>void;onCancel:()=>void}){
  const titleId=useId(),descriptionId=useId(),dialogRef=useRef<HTMLDialogElement>(null),cancelRef=useRef<HTMLButtonElement>(null),cancelCallbackRef=useRef(onCancel),busyRef=useRef(busy)
  useEffect(()=>{cancelCallbackRef.current=onCancel;busyRef.current=busy},[onCancel,busy])
  useEffect(()=>{
    if(!open)return
    const previous=document.body.style.overflow
    document.body.style.overflow='hidden'
    if(!dialogRef.current?.open)dialogRef.current?.showModal()
    const timer=window.setTimeout(()=>cancelRef.current?.focus(),0)
    return()=>{window.clearTimeout(timer);if(dialogRef.current?.open)dialogRef.current.close();document.body.style.overflow=previous}
  },[open])
  if(!open||typeof document==='undefined')return null
  return createPortal(<dialog ref={dialogRef} className="confirmDialog" role={danger?'alertdialog':'dialog'} aria-modal="true" aria-labelledby={titleId} aria-describedby={description?descriptionId:undefined} onCancel={event=>{event.preventDefault();if(!busyRef.current)cancelCallbackRef.current()}} onMouseDown={event=>{if(event.target===event.currentTarget&&!busyRef.current)cancelCallbackRef.current()}}>
      <header><div><span>{danger?'CONFIRMARE ȘTERGERE':'CONFIRMARE'}</span><h2 id={titleId}>{title}</h2></div><button type="button" className="confirmDialogClose" aria-label="Închide confirmarea" disabled={busy} onClick={onCancel}><X size={20}/></button></header>
      {description&&<div id={descriptionId} className="confirmDialogDescription">{description}</div>}
      {children&&<div className="confirmDialogBody">{children}</div>}
      <footer><button ref={cancelRef} type="button" className="confirmDialogCancel" disabled={busy} onClick={onCancel}>{cancelLabel}</button><button type="button" className={danger?'confirmDialogConfirm danger':'confirmDialogConfirm'} disabled={busy} onClick={onConfirm}>{confirmLabel}</button></footer>
  </dialog>,document.body)
}
