'use client'

import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {ChevronDown,GripVertical,Pencil,Plus,Search,Store,Trash2,X} from 'lucide-react'
import type {CategoryRow,MyLifeData} from '@/lib/mylife-data'
import {categoryAppearance,categoryIcons,categoryColors,sortedCategories} from '@/lib/category-display'
import {getSupabaseClient} from '@/lib/supabase'
import CategoryIcon from './CategoryIcon'
import useCategoryReorder from './useCategoryReorder'
import ConfirmDialog from './ConfirmDialog'
import './CategoriesWorkspace.css'

type Draft={id?:string;name:string;kind:string;parent_id:string|null;icon:string;color:string;is_active:boolean}
type MerchantRule={id:string;merchant_key:string;merchant_name:string;transaction_type:'expense'|'income';category_id:string;created_at:string;updated_at:string}
type RuleDraft={id?:string;merchant_name:string;transaction_type:'expense'|'income';category_id:string}

async function authorizedRequest(path:string,init?:RequestInit){
  const client=getSupabaseClient()
  if(!client)throw new Error('Conectează-te pentru administrarea regulilor.')
  const {data:{session}}=await client.auth.getSession()
  if(!session?.access_token)throw new Error('Sesiunea nu mai este validă.')
  const response=await fetch(path,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,...init?.headers}})
  const payload=await response.json().catch(()=>({})) as {error?:string;rules?:MerchantRule[];rule?:MerchantRule}
  if(!response.ok)throw new Error(payload.error||'Operațiunea nu a reușit.')
  return payload
}

export default function CategoriesWorkspace({data,onSaved,kind,onKindChange,onCategoriesChange}:{onCategoriesChange:(rows:CategoryRow[])=>void;data:MyLifeData;onSaved:()=>void;kind:string;onKindChange:(kind:string)=>void}){
  const [draft,setDraft]=useState<Draft|null>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [deleting,setDeleting]=useState<CategoryRow|null>(null)
  const [expanded,setExpanded]=useState<Set<string>>(()=>new Set())
  const [rules,setRules]=useState<MerchantRule[]>([])
  const [rulesLoading,setRulesLoading]=useState(false)
  const [ruleBusy,setRuleBusy]=useState(false)
  const [ruleError,setRuleError]=useState('')
  const [ruleSearch,setRuleSearch]=useState('')
  const [rulesOpen,setRulesOpen]=useState(false)
  const [ruleDraft,setRuleDraft]=useState<RuleDraft|null>(null)
  const [deletingRule,setDeletingRule]=useState<MerchantRule|null>(null)
  const [merchantExpanded,setMerchantExpanded]=useState<Set<string>>(()=>new Set())
  const editorDialog=useRef<HTMLDialogElement>(null)
  const rulesDialog=useRef<HTMLDialogElement>(null)
  const ruleEditorDialog=useRef<HTMLDialogElement>(null)
  const rows=sortedCategories(data.categories.filter(category=>category.kind===kind))
  const live=data.source==='live'

  useEffect(()=>{if(draft&&!editorDialog.current?.open)editorDialog.current?.showModal()},[draft])
  useEffect(()=>{if(rulesOpen&&!rulesDialog.current?.open)rulesDialog.current?.showModal()},[rulesOpen])
  useEffect(()=>{if(ruleDraft&&!ruleEditorDialog.current?.open)ruleEditorDialog.current?.showModal()},[ruleDraft])

  const loadRules=useCallback(async()=>{
    if(!live)return
    setRulesLoading(true)
    setRuleError('')
    try{
      const payload=await authorizedRequest('/api/finance/merchant-rules')
      setRules(payload.rules??[])
    }catch(loadError){
      setRuleError(loadError instanceof Error?loadError.message:'Regulile nu au putut fi încărcate.')
    }finally{setRulesLoading(false)}
  },[live])

  useEffect(()=>{void loadRules()},[loadRules,data.profile.householdId])

  function toggleCategory(id:string){setExpanded(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next})}
  function toggleMerchants(id:string){setMerchantExpanded(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next})}
  async function mutate(action:()=>PromiseLike<{error:{message:string}|null}>){
    if(busy)return
    setBusy(true);setError('')
    try{const result=await action();if(result.error)throw Error(result.error.message);setDraft(null);setDeleting(null);onSaved()}
    catch(mutationError){setError(mutationError instanceof Error?mutationError.message:'Operațiunea nu a reușit.')}
    finally{setBusy(false)}
  }
  function edit(row?:CategoryRow,parent?:CategoryRow){
    setError('')
    setDraft(row?{...row,...categoryAppearance(row)}:{name:'',kind,parent_id:parent?.id??null,...categoryAppearance(parent??{id:crypto.randomUUID(),name:''}),is_active:true})
  }
  function categoryPath(categoryId:string){
    const category=data.categories.find(row=>row.id===categoryId)
    if(!category)return 'Categorie indisponibilă'
    const parent=category.parent_id?data.categories.find(row=>row.id===category.parent_id):null
    return parent?`${parent.name} → ${category.name}`:category.name
  }
  function openRuleEditor(rule?:MerchantRule,category?:CategoryRow){
    setRuleError('')
    const transactionType=(rule?.transaction_type??(category?.kind==='income'?'income':'expense')) as 'expense'|'income'
    const firstCategory=data.categories.find(row=>row.kind===transactionType&&row.is_active)
    setRuleDraft(rule?{id:rule.id,merchant_name:rule.merchant_name,transaction_type:rule.transaction_type,category_id:rule.category_id}:{merchant_name:'',transaction_type:transactionType,category_id:category?.id??firstCategory?.id??''})
  }
  async function saveRule(){
    if(!ruleDraft||ruleBusy)return
    setRuleBusy(true);setRuleError('')
    try{
      const payload=await authorizedRequest(ruleDraft.id?`/api/finance/merchant-rules/${ruleDraft.id}`:'/api/finance/merchant-rules',{method:ruleDraft.id?'PATCH':'POST',body:JSON.stringify(ruleDraft)})
      if(payload.rule)setRules(current=>[...current.filter(rule=>rule.id!==payload.rule?.id),payload.rule!].sort((a,b)=>a.merchant_name.localeCompare(b.merchant_name,'ro')))
      setRuleDraft(null)
    }catch(saveError){setRuleError(saveError instanceof Error?saveError.message:'Regula nu a putut fi salvată.')}
    finally{setRuleBusy(false)}
  }
  async function deleteRule(){
    if(!deletingRule||ruleBusy)return
    setRuleBusy(true);setRuleError('')
    try{await authorizedRequest(`/api/finance/merchant-rules/${deletingRule.id}`,{method:'DELETE'});setRules(current=>current.filter(rule=>rule.id!==deletingRule.id));setDeletingRule(null)}
    catch(deleteError){setRuleError(deleteError instanceof Error?deleteError.message:'Regula nu a putut fi ștearsă.')}
    finally{setRuleBusy(false)}
  }

  const reorder=useCategoryReorder(data.categories,onCategoriesChange,setError)
  const ghostRow=data.categories.find(row=>row.id===reorder.ghost?.id)
  const forbidden=new Set<string>()
  if(draft?.id){forbidden.add(draft.id);let changed=true;while(changed){changed=false;for(const row of rows)if(row.parent_id&&forbidden.has(row.parent_id)&&!forbidden.has(row.id)){forbidden.add(row.id);changed=true}}}

  const filteredRules=useMemo(()=>{
    const query=ruleSearch.trim().toLocaleLowerCase('ro-RO')
    return rules.filter(rule=>!query||rule.merchant_name.toLocaleLowerCase('ro-RO').includes(query)||categoryPath(rule.category_id).toLocaleLowerCase('ro-RO').includes(query))
  },[rules,ruleSearch,data.categories])

  function merchantList(category:CategoryRow){
    const categoryRules=rules.filter(rule=>rule.category_id===category.id)
    return <div className="categoryMerchantArea">
      <button type="button" className="categoryMerchantToggle" aria-expanded={merchantExpanded.has(category.id)} onClick={()=>toggleMerchants(category.id)}><Store size={14}/>{categoryRules.length?`${categoryRules.length} ${categoryRules.length===1?'comerciant salvat':'comercianți salvați'}`:'Adaugă comerciant'}<ChevronDown size={14}/></button>
      {merchantExpanded.has(category.id)?<div className="categoryMerchantList">
        {categoryRules.map(rule=><div className="categoryMerchantItem" key={rule.id}><span><strong>{rule.merchant_name}</strong><small>Potrivire exactă după normalizarea numelui</small></span><div><button type="button" aria-label={`Editează regula pentru ${rule.merchant_name}`} onClick={()=>openRuleEditor(rule)}><Pencil size={15}/></button><button type="button" aria-label={`Șterge regula pentru ${rule.merchant_name}`} onClick={()=>{setRuleError('');setDeletingRule(rule)}}><Trash2 size={15}/></button></div></div>)}
        {!categoryRules.length?<p>Nicio regulă salvată pentru această categorie.</p>:null}
        <button type="button" className="categoryMerchantAdd" onClick={()=>openRuleEditor(undefined,category)}><Plus size={15}/> Adaugă comerciant</button>
      </div>:null}
    </div>
  }

  function tree(parent:string|null,depth=0):React.ReactNode{
    return rows.filter(category=>category.parent_id===parent).map(row=><div className={`categoryBranch ${reorder.dragging===row.id?'categoryBranchDragging':''} ${reorder.ghost?.target===row.id?reorder.ghost.after?'categoryDropAfter':'categoryDropBefore':''}`} key={row.id}>
      <div data-category-id={row.id} className={`categoryRow ${!row.is_active?'archived':''} ${reorder.dragging===row.id?'categoryDragging':''}`} style={{marginLeft:Math.min(depth,4)*18}}>
        <button className="categoryDragHandle" aria-label={`Reordonează ${row.name}`} title="Trage pentru reordonare; cu tastatura folosește săgețile sus/jos" disabled={!live||busy||!row.household_id} onPointerDown={event=>reorder.start(event,row)} onKeyDown={event=>reorder.keyboard(event,row)}><GripVertical size={18}/></button>
        <CategoryIcon category={row} categories={data.categories}/>
        <div className="categoryName">
          {!row.parent_id&&rows.some(child=>child.parent_id===row.id)?<button type="button" className="categoryExpandToggle" aria-expanded={expanded.has(row.id)} aria-controls={`category-children-${row.id}`} aria-label={`${expanded.has(row.id)?'Ascunde':'Arată'} subcategoriile ${row.name}`} onClick={()=>toggleCategory(row.id)}><strong>{row.name}</strong><ChevronDown size={16}/></button>:<strong>{row.name}</strong>}
          <small>{!row.is_active?'Arhivată':depth?'Subcategorie':`${rows.filter(child=>child.parent_id===row.id).length} subcategorii`}</small>
          {['expense','income'].includes(row.kind)?merchantList(row):null}
        </div>
        <div className="categoryActions">{!row.parent_id&&<button aria-label={`Adaugă subcategorie în ${row.name}`} disabled={!live||busy} onClick={()=>edit(undefined,row)}><Plus size={16}/></button>}<button aria-label={`Editează ${row.name}`} disabled={!live||busy||!row.household_id} onClick={()=>edit(row)}><Pencil size={16}/></button><button aria-label={`Șterge ${row.name}`} disabled={!live||busy||!row.household_id} onClick={()=>{setDeleting(row);setError('')}}><Trash2 size={16}/></button></div>
      </div>
      <div id={`category-children-${row.id}`} hidden={!expanded.has(row.id)}>{tree(row.id,depth+1)}</div>
    </div>)
  }

  const ruleCategoryOptions=data.categories.filter(category=>category.kind===ruleDraft?.transaction_type&&category.is_active)

  return <section className="categoriesWorkspace">
    <div className="sectionTitle categoriesHeader"><div className="categoryKinds">{[['expense','Cheltuieli'],['income','Venituri'],['transfer','Transferuri']].map(([value,label])=><button key={value} aria-pressed={kind===value} onClick={()=>{onKindChange(value);setDraft(null);setDeleting(null);setExpanded(new Set())}}>{label}</button>)}</div><div className="categoriesHeaderActions"><button type="button" className="merchantRulesButton" disabled={!live||rulesLoading} onClick={()=>{setRuleError('');setRulesOpen(true)}}><Store size={16}/>{rulesLoading?'Se încarcă…':'Reguli comercianți'}</button><div className="financeCreateAction"><button className="financePrimaryAction" disabled={!live||busy} onClick={()=>edit()}><span aria-hidden="true">+</span> Categorie nouă</button></div></div></div>
    <p className="categorySaveStatus" role="status">{reorder.saving?'Se salvează ordinea…':''}</p><span className="categoryReorderAnnouncement" aria-live="polite">{reorder.announcement}</span>
    {!live&&<p>Conectează-te pentru administrarea categoriilor.</p>}{error&&<p role="alert" className="transactionEditError">{error}</p>}{ruleError&&!rulesOpen&&!ruleDraft&&!deletingRule?<p role="alert" className="transactionEditError">{ruleError}</p>:null}

    <ConfirmDialog open={Boolean(deleting)} danger busy={busy} title={`Ștergi „${deleting?.name??''}”?`} description="Ștergerea este definitivă. Categoriile cu tranzacții, reguli de comercianți sau subcategorii trebuie mai întâi eliberate." confirmLabel={busy?'Se șterge…':'Confirmă ștergerea'} onCancel={()=>setDeleting(null)} onConfirm={()=>{const client=getSupabaseClient();if(client&&deleting)void mutate(()=>client.from('finance_categories').delete().eq('id',deleting.id).select('id').single())}}>{error&&<p role="alert">{error}</p>}</ConfirmDialog>
    <ConfirmDialog open={Boolean(deletingRule)} danger busy={ruleBusy} title={`Ștergi regula pentru „${deletingRule?.merchant_name??''}”?`} description="Tranzacțiile existente rămân neschimbate. Doar tranzacțiile viitoare nu vor mai primi automat această categorie." confirmLabel={ruleBusy?'Se șterge…':'Șterge regula'} onCancel={()=>setDeletingRule(null)} onConfirm={()=>void deleteRule()}>{ruleError&&<p role="alert">{ruleError}</p>}</ConfirmDialog>

    {draft&&<dialog ref={editorDialog} className="categoryEditorSheet" aria-labelledby="category-editor-title" onClose={()=>{if(!busy)setDraft(null)}} onCancel={event=>{if(busy)event.preventDefault()}} onClick={event=>{if(!busy&&event.target===event.currentTarget)event.currentTarget.close()}}><header><h2 id="category-editor-title">{draft.id?'Editează categoria':draft.parent_id?'Subcategorie nouă':'Categorie nouă'}</h2><button type="button" aria-label="Închide" disabled={busy} onClick={()=>editorDialog.current?.close()}><X size={20}/></button></header><form className="categoryEditor" onSubmit={event=>{event.preventDefault();if(!draft.name.trim()){setError('Completează numele categoriei.');return}const client=getSupabaseClient();if(!client)return;const {id,...values}=draft;if(values.parent_id){const parent=rows.find(row=>row.id===values.parent_id);Object.assign(values,categoryAppearance(parent))}void mutate(()=>id?client.from('finance_categories').update({...values,name:values.name.trim()}).eq('id',id).select('id').single():client.from('finance_categories').insert({...values,name:values.name.trim(),household_id:data.profile.householdId,sort_order:Math.max(0,...rows.filter(category=>category.parent_id===draft.parent_id).map(category=>category.sort_order??0))+1}))}}><fieldset disabled={busy}><label>Nume<input required autoFocus maxLength={120} value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></label><label>Categoria părinte<select aria-label="Categoria părinte" value={draft.parent_id??''} onChange={event=>setDraft({...draft,parent_id:event.target.value||null})}><option value="">Categorie principală</option>{rows.filter(category=>!category.parent_id&&!forbidden.has(category.id)&&category.household_id===data.profile.householdId&&(!draft.id||!rows.some(child=>child.parent_id===draft.id))).map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>{!draft.parent_id&&<label>Iconiță<select aria-label="Iconiță" value={draft.icon} onChange={event=>setDraft({...draft,icon:event.target.value})}>{categoryIcons.map(icon=><option key={icon} value={icon}>{({tag:'Etichetă',food:'Mâncare',home:'Casă',car:'Mașină',health:'Sănătate',shield:'Asigurări',gift:'Cadouri',plane:'Călătorii',shopping:'Cumpărături',sport:'Sport',pet:'Animale',child:'Copil',wallet:'Venituri',utilities:'Utilități',coffee:'Cafea',education:'Educație'} as Record<string,string>)[icon]}</option>)}</select></label>}{!draft.parent_id&&<div className="categorySwatches">{categoryColors.map(color=><button key={color} type="button" aria-label={`Culoare ${color}`} aria-pressed={draft.color===color} style={{background:color}} onClick={()=>setDraft({...draft,color})}/>)}<input aria-label="Culoare personalizată" type="color" value={draft.color} onChange={event=>setDraft({...draft,color:event.target.value})}/><CategoryIcon category={{id:draft.id??'',name:draft.name,icon:draft.icon,color:draft.color}}/></div>}{draft.parent_id&&<p>Culoarea este moștenită de la categoria principală.</p>}<label><input type="checkbox" checked={draft.is_active} onChange={event=>setDraft({...draft,is_active:event.target.checked})}/> Activă în selectoarele de tranzacții</label><div><button type="submit">{busy?'Se salvează…':'Salvează categoria'}</button><button type="button" onClick={()=>editorDialog.current?.close()}>Renunță</button></div></fieldset></form></dialog>}

    {rulesOpen&&<dialog ref={rulesDialog} className="categoryEditorSheet merchantRulesSheet" aria-labelledby="merchant-rules-title" onClose={()=>setRulesOpen(false)} onCancel={event=>{if(ruleBusy)event.preventDefault()}} onClick={event=>{if(!ruleBusy&&event.target===event.currentTarget)event.currentTarget.close()}}><header><div><h2 id="merchant-rules-title">Reguli comercianți</h2><p>{rules.length} {rules.length===1?'regulă salvată':'reguli salvate'}</p></div><button type="button" aria-label="Închide" disabled={ruleBusy} onClick={()=>rulesDialog.current?.close()}><X size={20}/></button></header><div className="merchantRulesToolbar"><label><Search size={17}/><input autoFocus type="search" value={ruleSearch} onChange={event=>setRuleSearch(event.target.value)} placeholder="Caută comerciant sau categorie"/></label><button type="button" onClick={()=>openRuleEditor()}><Plus size={16}/> Adaugă regulă</button></div>{ruleError?<p role="alert" className="transactionEditError">{ruleError}</p>:null}<div className="merchantRulesFullList">{filteredRules.map(rule=><div className="merchantRuleCard" key={rule.id}><span><strong>{rule.merchant_name}</strong><small>{rule.transaction_type==='income'?'Venit':'Cheltuială'} · {categoryPath(rule.category_id)}</small></span><div><button type="button" aria-label={`Editează ${rule.merchant_name}`} onClick={()=>openRuleEditor(rule)}><Pencil size={16}/></button><button type="button" aria-label={`Șterge ${rule.merchant_name}`} onClick={()=>setDeletingRule(rule)}><Trash2 size={16}/></button></div></div>)}{!filteredRules.length?<p>{ruleSearch?'Nu am găsit nicio regulă.':'Nu există încă reguli salvate.'}</p>:null}</div></dialog>}

    {ruleDraft&&<dialog ref={ruleEditorDialog} className="categoryEditorSheet merchantRuleEditorSheet" aria-labelledby="merchant-rule-editor-title" onClose={()=>{if(!ruleBusy)setRuleDraft(null)}} onCancel={event=>{if(ruleBusy)event.preventDefault()}} onClick={event=>{if(!ruleBusy&&event.target===event.currentTarget)event.currentTarget.close()}}><header><h2 id="merchant-rule-editor-title">{ruleDraft.id?'Editează regula':'Regulă nouă'}</h2><button type="button" aria-label="Închide" disabled={ruleBusy} onClick={()=>ruleEditorDialog.current?.close()}><X size={20}/></button></header><form className="categoryEditor" onSubmit={event=>{event.preventDefault();void saveRule()}}><fieldset disabled={ruleBusy}><label>Comerciant<input required autoFocus maxLength={1000} value={ruleDraft.merchant_name} onChange={event=>setRuleDraft({...ruleDraft,merchant_name:event.target.value})} placeholder="Ex. APPLE.COM/BILL"/><small>Regula ignoră diferențele dintre litere mari și mici și spațiile suplimentare.</small></label><label>Tip<select value={ruleDraft.transaction_type} onChange={event=>{const transactionType=event.target.value as 'expense'|'income';const first=data.categories.find(category=>category.kind===transactionType&&category.is_active);setRuleDraft({...ruleDraft,transaction_type:transactionType,category_id:first?.id??''})}}><option value="expense">Cheltuială</option><option value="income">Venit</option></select></label><label>Categorie<select required value={ruleDraft.category_id} onChange={event=>setRuleDraft({...ruleDraft,category_id:event.target.value})}><option value="" disabled>Alege categoria</option>{ruleCategoryOptions.map(category=><option key={category.id} value={category.id}>{categoryPath(category.id)}</option>)}</select></label>{ruleError?<p role="alert" className="transactionEditError">{ruleError}</p>:null}<div><button type="submit">{ruleBusy?'Se salvează…':'Salvează regula'}</button><button type="button" onClick={()=>ruleEditorDialog.current?.close()}>Renunță</button></div></fieldset></form></dialog>}

    {reorder.ghost&&ghostRow&&createPortal(<div className="categoryDragGhost" aria-hidden="true" style={{left:reorder.ghost.x,top:reorder.ghost.y,width:reorder.ghost.width,minHeight:reorder.ghost.height}}><GripVertical size={18}/><CategoryIcon category={ghostRow} categories={data.categories}/><div><strong>{ghostRow.name}</strong><small>Poziția {reorder.ghost.index+1} din {rows.filter(row=>row.parent_id===ghostRow.parent_id).length}{!ghostRow.parent_id&&rows.some(row=>row.parent_id===ghostRow.id)?' · cu subcategorii':''}</small></div></div>,document.body)}
    <div className="categoryTree">{tree(null)}{!rows.length&&<p>Nu există categorii. Adaugă prima categorie.</p>}</div>
  </section>
}
