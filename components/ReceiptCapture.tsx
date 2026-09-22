'use client'

import {Camera,CheckCircle2,ImagePlus,RefreshCw,Trash2} from 'lucide-react'
import {useEffect,useMemo,useRef,useState} from 'react'
import {bucharestDay} from '@/lib/expense-report'
import {getSupabaseClient} from '@/lib/supabase'
import type {MyLifeData} from '@/lib/mylife-data'
import type {ReceiptAnalysis,ReceiptAnalysisItem,ReceiptAnalysisSplit} from '@/lib/receipt-analysis'

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

function categoryPaths(data:MyLifeData){
  const rows=data.categories.filter(category=>category.kind==='expense'&&category.is_active)
  const byId=new Map(rows.map(row=>[row.id,row]))
  const path=(id:string)=>{
    const names:string[]=[]
    let current=byId.get(id)
    const seen=new Set<string>()
    while(current&&!seen.has(current.id)){
      seen.add(current.id)
      names.unshift(current.name)
      current=current.parent_id?byId.get(current.parent_id):undefined
    }
    return names.join(' → ')
  }
  return rows.map(category=>({id:category.id,path:path(category.id)})).sort((a,b)=>a.path.localeCompare(b.path,'ro'))
}

function rebuildSplits(items:ReceiptAnalysisItem[]):ReceiptAnalysisSplit[]{
  const cents=new Map<string,{path:string;amount:number}>()
  for(const item of items){
    const current=cents.get(item.category_id)??{path:item.category_path,amount:0}
    current.amount+=Math.round(item.line_total*100)
    cents.set(item.category_id,current)
  }
  return [...cents.entries()].map(([category_id,value])=>({
    category_id,
    category_path:value.path,
    amount:value.amount/100,
  })).sort((a,b)=>b.amount-a.amount)
}

export default function ReceiptCapture({
  menuMode=false,
  data,
  onCompleted,
}:{menuMode?:boolean;data?:MyLifeData|null;onCompleted?:()=>void}){
  const inputRef=useRef<HTMLInputElement>(null)
  const receiptRef=useRef<UploadedReceipt|null>(null)
  const [receipt,setReceipt]=useState<UploadedReceipt|null>(null)
  const [analysis,setAnalysis]=useState<ReceiptAnalysis|null>(null)
  const [selectedAccountId,setSelectedAccountId]=useState('')
  const [uploading,setUploading]=useState(false)
  const [analyzing,setAnalyzing]=useState(false)
  const [confirming,setConfirming]=useState(false)
  const [error,setError]=useState('')

  const categories=useMemo(()=>data?categoryPaths(data):[],[data])
  const matchingAccounts=useMemo(()=>data?.accounts.filter(account=>account.is_active!==false&&(!analysis||account.currency.trim().toUpperCase()===analysis.currency))??[],[data,analysis])

  useEffect(()=>{receiptRef.current=receipt},[receipt])


  async function cleanupReceipt(target:UploadedReceipt,mutate=true){
    const client=getSupabaseClient()
    if(!client)return false
    const [{error:storageError},{error:documentError}]=await Promise.all([
      client.storage.from('mylife-documents').remove([target.storagePath]),
      client.from('documents').delete().eq('id',target.documentId),
    ])
    if(storageError||documentError){
      if(mutate)setError(storageError?.message??documentError?.message??'Bonul temporar nu a putut fi șters.')
      return false
    }
    URL.revokeObjectURL(target.previewUrl)
    if(receiptRef.current?.documentId===target.documentId)receiptRef.current=null
    if(mutate){
      setReceipt(null)
      setAnalysis(null)
      setSelectedAccountId('')
    }
    return true
  }

  async function removeReceipt(){
    if(!receipt)return
    setError('')
    await cleanupReceipt(receipt,true)
  }

  async function analyzeReceipt(target:UploadedReceipt){
    if(!data){setError('Datele MyLife nu sunt încă încărcate.');return}
    const client=getSupabaseClient()
    if(!client){setError('Conexiunea la Supabase nu este disponibilă.');return}
    setAnalyzing(true)
    setAnalysis(null)
    setSelectedAccountId('')
    setError('')
    try{
      const {data:sessionData,error:sessionError}=await client.auth.getSession()
      const accessToken=sessionData.session?.access_token
      if(sessionError||!accessToken)throw new Error(sessionError?.message??'Sesiunea nu mai este validă.')

      const response=await fetch('/api/receipts/analyze',{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          Authorization:`Bearer ${accessToken}`,
        },
        body:JSON.stringify({
          storagePath:target.storagePath,
          householdId:data.profile.householdId,
        }),
      })
      const payload=await response.json()
      if(!response.ok)throw new Error(payload?.error??'Analiza bonului a eșuat.')
      const result=payload as ReceiptAnalysis
      setAnalysis(result)
      const exactCurrency=data.accounts.filter(account=>account.is_active!==false&&account.currency.trim().toUpperCase()===result.currency)
      if(exactCurrency.length===1)setSelectedAccountId(exactCurrency[0].id)
      await client.from('documents').update({
        extra:{kind:'receipt',receipt_status:'review',temporary:false,source:'quick_add_camera'},
      }).eq('id',target.documentId)
    }catch(analysisError){
      setError(analysisError instanceof Error?analysisError.message:'Analiza bonului a eșuat.')
    }finally{
      setAnalyzing(false)
    }
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
        const removed=await cleanupReceipt(receipt,true)
        if(!removed)throw new Error('Bonul anterior nu a putut fi curățat.')
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
        notes:'Bon încărcat din Quick Add',
        extra:{kind:'receipt',receipt_status:'captured',temporary:false,source:'quick_add_camera'},
      }).select('id').single()

      if(documentError||!document){
        await client.storage.from('mylife-documents').remove([storagePath])
        throw new Error(documentError?.message??'Metadatele bonului nu au putut fi salvate.')
      }

      const uploaded={
        documentId:document.id,
        storagePath,
        fileName:file.name||`bon.${ext}`,
        previewUrl:URL.createObjectURL(file),
      }
      receiptRef.current=uploaded
      setReceipt(uploaded)
      await analyzeReceipt(uploaded)
    }catch(uploadError){
      setError(uploadError instanceof Error?uploadError.message:'Bonul nu a putut fi încărcat.')
    }finally{
      setUploading(false)
      if(inputRef.current)inputRef.current.value=''
    }
  }

  function changeItemCategory(index:number,categoryId:string){
    if(!analysis)return
    const option=categories.find(category=>category.id===categoryId)
    if(!option)return
    const items=analysis.items.map((item,itemIndex)=>itemIndex===index?{...item,category_id:categoryId,category_path:option.path}:item)
    setAnalysis({...analysis,items,splits:rebuildSplits(items)})
  }

  async function confirmTransaction(){
    if(!data||!analysis||!receipt)return
    if(!analysis.balanced){setError('Totalul articolelor nu este încă reconciliat cu totalul bonului. Reanalizează poza.');return}
    const account=data.accounts.find(item=>item.id===selectedAccountId)
    if(!account){setError('Alege contul din care ai plătit.');return}
    if(account.currency.trim().toUpperCase()!==analysis.currency){setError('Moneda contului nu corespunde cu moneda bonului.');return}

    const client=getSupabaseClient()
    if(!client)return
    setConfirming(true)
    setError('')
    const transactionId=crypto.randomUUID()
    try{
      const {data:created,error:createError}=await client.rpc('finance_create_transaction_with_balance',{
        p_household_id:data.profile.householdId,
        p_affects_balance:true,
        p_title:analysis.merchant||'Bon scanat',
        p_id:transactionId,
        p_type:'expense',
        p_account_id:account.id,
        p_transfer_account_id:null,
        p_amount:analysis.total,
        p_currency:analysis.currency,
        p_day:analysis.date??bucharestDay(new Date()),
        p_merchant:analysis.merchant,
        p_description:'Bon scanat și analizat automat',
        p_splits:analysis.splits.map(split=>({category_id:split.category_id,amount:split.amount})),
      })
      if(createError)throw new Error(createError.message)

      const createdUpdatedAt=created&&typeof created==='object'&&'updated_at' in created?String(created.updated_at):null
      const {data:linkedTransaction,error:linkError}=await client.from('finance_transactions')
        .update({attachment_document_id:receipt.documentId,source:'receipt'})
        .eq('id',transactionId)
        .select('updated_at')
        .single()

      if(linkError){
        if(createdUpdatedAt)await client.rpc('finance_delete_transaction',{p_id:transactionId,p_expected_updated_at:createdUpdatedAt})
        throw new Error(`Bonul nu a putut fi atașat tranzacției: ${linkError.message}`)
      }

      const rollbackUpdatedAt=linkedTransaction?.updated_at?String(linkedTransaction.updated_at):createdUpdatedAt

      const {error:itemsError}=await client.from('finance_receipt_items').insert(analysis.items.map(item=>({
        transaction_id:transactionId,
        line_no:item.line_no,
        raw_label:item.raw_label,
        normalized_label:item.normalized_label,
        quantity:item.quantity,
        unit_price:item.unit_price,
        line_total:item.line_total,
        category_id:item.category_id,
        ai_confidence:item.confidence,
        metadata:{source:'receipt_ai',category_path:item.category_path},
      })))

      if(itemsError){
        if(rollbackUpdatedAt)await client.rpc('finance_delete_transaction',{p_id:transactionId,p_expected_updated_at:rollbackUpdatedAt})
        throw new Error(`Produsele nu au putut fi salvate: ${itemsError.message}`)
      }

      const {error:documentUpdateError}=await client.from('documents').update({
        issuer:analysis.merchant,
        document_date:analysis.date??bucharestDay(new Date()),
        extra:{kind:'receipt',receipt_status:'confirmed',temporary:false,source:'quick_add_camera',transaction_id:transactionId},
      }).eq('id',receipt.documentId)

      if(documentUpdateError){
        if(rollbackUpdatedAt)await client.rpc('finance_delete_transaction',{p_id:transactionId,p_expected_updated_at:rollbackUpdatedAt})
        throw new Error(`Bonul nu a putut fi finalizat: ${documentUpdateError.message}`)
      }

      URL.revokeObjectURL(receipt.previewUrl)
      receiptRef.current=null
      setReceipt(null)
      setAnalysis(null)
      onCompleted?.()
    }catch(confirmError){
      setError(confirmError instanceof Error?confirmError.message:'Tranzacția nu a putut fi salvată.')
    }finally{
      setConfirming(false)
    }
  }

  const busy=uploading||analyzing||confirming

  return <section className={`receiptCapture ${menuMode?'receiptCaptureMenuMode':''}`} aria-label="Scanează bon">
    <input
      ref={inputRef}
      className="receiptCaptureInput"
      type="file"
      accept="image/*"
      capture="environment"
      onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file)}}
    />

    {!receipt?<button type="button" className="receiptCaptureButton" disabled={busy} onClick={()=>inputRef.current?.click()}>
      <Camera size={20}/>
      <span><strong>{uploading?'Se încarcă bonul…':menuMode?'Fă o poză':'Scanează bon'}</strong><small>{menuMode?'Deschide camera, salvează și analizează bonul.':'Deschide camera, salvează și analizează bonul.'}</small></span>
    </button>:<div className="receiptCaptureFlow">
      <div className="receiptCapturePreview">
        <img src={receipt.previewUrl} alt="Previzualizare bon"/>
        <div>
          <span className="receiptCaptureReady"><CheckCircle2 size={16}/> {analyzing?'Se analizează…':analysis?'Gata pentru review':'Bon încărcat'}</span>
          <strong>{receipt.fileName}</strong>
          <small>{analyzing?'Citesc produsele și le clasific în categoriile tale.':analysis?'Verifică datele înainte de confirmare.':'Poza este salvată în MyLife. Poți porni din nou analiza.'}</small>
          <div className="receiptCaptureActions">
            <button type="button" disabled={busy} onClick={()=>inputRef.current?.click()}><ImagePlus size={16}/> Schimbă poza</button>
            <button type="button" disabled={busy} onClick={()=>void analyzeReceipt(receipt)}><RefreshCw size={16}/> {analysis?'Reanalizează':'Analizează'}</button>
            <button type="button" disabled={busy} onClick={()=>void removeReceipt()}><Trash2 size={16}/> Șterge</button>
          </div>
        </div>
      </div>

      {analyzing?<div className="receiptAnalysisLoading"><span/> Analizez bonul cu AI…</div>:null}

      {analysis?<div className="receiptReview">
        <div className="receiptReviewHeader">
          <div><small>Comerciant</small><strong>{analysis.merchant}</strong></div>
          <div className="receiptReviewTotal"><small>Total</small><strong>{analysis.total.toLocaleString('ro-RO',{minimumFractionDigits:2,maximumFractionDigits:2})} {analysis.currency}</strong></div>
        </div>
        <div className="receiptReviewMeta"><span>{analysis.date??'Data nu a fost citită'}</span><span>{analysis.items.length} articole</span></div>

        <label className="receiptAccountSelect">Plătit din
          <select value={selectedAccountId} onChange={event=>setSelectedAccountId(event.target.value)}>
            <option value="">Alege contul</option>
            {matchingAccounts.map(account=><option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>

        <div className="receiptSplitSummary">
          <strong>Defalcare propusă</strong>
          {analysis.splits.map(split=><div key={split.category_id}><span>{split.category_path}</span><b>{split.amount.toLocaleString('ro-RO',{minimumFractionDigits:2,maximumFractionDigits:2})} {analysis.currency}</b></div>)}
        </div>

        <div className="receiptItemsReview">
          <strong>Produse</strong>
          {analysis.items.map((item,index)=><div className="receiptReviewItem" key={`${item.line_no}-${item.raw_label}`}>
            <div><span>{item.normalized_label}</span><small>{item.quantity&&item.quantity!==1?`${item.quantity} × `:''}{item.raw_label}</small></div>
            <b>{item.line_total.toLocaleString('ro-RO',{minimumFractionDigits:2,maximumFractionDigits:2})}</b>
            <select aria-label={`Categoria pentru ${item.normalized_label}`} value={item.category_id} onChange={event=>changeItemCategory(index,event.target.value)}>
              {categories.map(category=><option key={category.id} value={category.id}>{category.path}</option>)}
            </select>
          </div>)}
        </div>

        {analysis.warnings.length?<div className="receiptReviewWarnings">{analysis.warnings.map((warning,index)=><p key={index}>{warning}</p>)}</div>:null}
        {!analysis.balanced?<p className="receiptBalanceError">Diferență față de total: {analysis.difference.toLocaleString('ro-RO',{minimumFractionDigits:2,maximumFractionDigits:2})} {analysis.currency}. Confirmarea este blocată până la o analiză corectă.</p>:null}

        <div className="receiptConfirmActions">
          <button type="button" className="receiptConfirmButton" disabled={busy||!analysis.balanced||!selectedAccountId} onClick={()=>void confirmTransaction()}>{confirming?'Se salvează…':'Confirmă tranzacția'}</button>
          <small>După confirmare, bonul rămâne salvat și atașat tranzacției, împreună cu defalcarea și produsele extrase.</small>
        </div>
      </div>:null}
    </div>}

    {error?<p className="receiptCaptureError" role="alert">{error}</p>:null}
  </section>
}
