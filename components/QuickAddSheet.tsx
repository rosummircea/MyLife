'use client'

import {FileUp,Image as ImageIcon,PenLine,X} from 'lucide-react'
import {useEffect,useRef} from 'react'
import ReceiptCapture from './ReceiptCapture'
import './QuickAddSheet.css'

export default function QuickAddSheet({onClose}:{onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null)

  useEffect(()=>{dialog.current?.showModal()},[])

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

      <div className="quickAddOptions">
        <ReceiptCapture menuMode/>

        <button type="button" className="quickAddOption" disabled>
          <ImageIcon size={20}/>
          <span><strong>Alege o poză din galerie</strong><small>O adăugăm în pasul următor.</small></span>
          <em>În curând</em>
        </button>

        <button type="button" className="quickAddOption" disabled>
          <FileUp size={20}/>
          <span><strong>Alege un document din Files</strong><small>PDF, imagine sau alt document.</small></span>
          <em>În curând</em>
        </button>

        <button type="button" className="quickAddOption" disabled>
          <PenLine size={20}/>
          <span><strong>Scrie sau dictează</strong><small>Descrii tranzacția în limbaj natural.</small></span>
          <em>În curând</em>
        </button>
      </div>
    </div>
  </dialog>
}