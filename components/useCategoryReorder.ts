'use client'
import {useEffect,useRef,useState} from 'react'
import type {PointerEvent as ReactPointerEvent, KeyboardEvent} from 'react'
import type {CategoryRow} from '@/lib/mylife-data'
import {sortedCategories} from '@/lib/category-display'
import {reorderCategory} from '@/lib/category-reorder'
import {getSupabaseClient} from '@/lib/supabase'

export default function useCategoryReorder(rows:CategoryRow[], onChange:(rows:CategoryRow[])=>void, onError:(message:string)=>void) {
  const current=useRef(rows);current.current=rows
  const change=useRef(onChange);change.current=onChange
  const error=useRef(onError);error.current=onError
  const active=useRef<{id:string;pointer:number;startY:number;startX:number;offsetX:number;offsetY:number;width:number;height:number;index:number;moved:boolean;original:CategoryRow[];cleanup:()=>void}|null>(null)
  const queue=useRef(Promise.resolve())
  const generations=useRef(new Map<string,number>())
  const confirmed=useRef(new Map<string,string[]>())
  const [dragging,setDragging]=useState<string|null>(null)
  const [ghost,setGhost]=useState<{id:string;x:number;y:number;width:number;height:number;index:number;target:string|null;after:boolean}|null>(null)
  const [saving,setSaving]=useState(0)
  const [announcement,setAnnouncement]=useState('')
  const siblings=(source:CategoryRow,list=current.current)=>sortedCategories(list.filter(row=>row.kind===source.kind&&row.parent_id===source.parent_id))
  function update(next:CategoryRow[]){current.current=next;change.current(next)}
  function persist(source:CategoryRow,original:CategoryRow[]){
    const key=`${source.kind}:${source.parent_id??'root'}`,before=siblings(source,original).map(row=>row.id),ids=siblings(source).map(row=>row.id)
    if(ids.join()===before.join())return
    if(!confirmed.current.has(key))confirmed.current.set(key,before)
    const generation=(generations.current.get(key)??0)+1;generations.current.set(key,generation)
    setSaving(count=>count+1);error.current('')
    queue.current=queue.current.then(async()=>{
      try {const client=getSupabaseClient();if(!client)throw Error('Conectează-te pentru a salva ordinea.')
        const result=await client.rpc('finance_reorder_categories',{p_ids:ids});if(result.error)throw Error(result.error.message)
        confirmed.current.set(key,ids)
      }catch(e){
        if(generations.current.get(key)===generation){const order=new Map((confirmed.current.get(key)??before).map((id,index)=>[id,index]));update(current.current.map(row=>order.has(row.id)?{...row,sort_order:order.get(row.id)!}:row))}
        error.current(`Ordinea nu a putut fi salvată. ${e instanceof Error?e.message:''}`)
      }finally{setSaving(count=>count-1)}
    })
  }
  function start(e:ReactPointerEvent<HTMLButtonElement>,source:CategoryRow){
    if(e.button!==0||active.current)return
    e.currentTarget.setPointerCapture(e.pointerId)
    let frame=0
    let point:PointerEvent|null=null
    const onMove=(event:PointerEvent)=>{point=event;move(event)}
    const onUp=(event:PointerEvent)=>finish(event)
    const onCancel=(event:PointerEvent)=>finish(event,true)
    const onEscape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape')finish({pointerId:e.pointerId},true)}
    const onBlur=()=>finish({pointerId:e.pointerId},true)
    const cleanup=()=>{cancelAnimationFrame(frame);window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);window.removeEventListener('pointercancel',onCancel);window.removeEventListener('keydown',onEscape);window.removeEventListener('blur',onBlur)}
    window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);window.addEventListener('pointercancel',onCancel);window.addEventListener('keydown',onEscape);window.addEventListener('blur',onBlur)
    const element=e.currentTarget.closest<HTMLElement>('[data-category-id]')
    if(!element){cleanup();return}
    const box=element.getBoundingClientRect()
    active.current={id:source.id,pointer:e.pointerId,startY:e.clientY,startX:e.clientX,offsetX:e.clientX-box.left,offsetY:e.clientY-box.top,width:box.width,height:box.height,index:siblings(source).findIndex(row=>row.id===source.id),moved:false,original:current.current,cleanup}
    const tick=()=>{if(point&&active.current?.moved&&(point.clientY<90||point.clientY>window.innerHeight-100))move(point);frame=requestAnimationFrame(tick)}
    frame=requestAnimationFrame(tick)
  }
  function move(e:Pick<ReactPointerEvent<HTMLButtonElement>,'pointerId'|'clientY'|'clientX'>){
    const drag=active.current;if(!drag||drag.pointer!==e.pointerId)return
    if(!drag.moved&&Math.hypot(e.clientY-drag.startY,e.clientX-drag.startX)<5)return
    drag.moved=true
    const source=current.current.find(row=>row.id===drag.id);if(!source)return
    const others=siblings(source).filter(row=>row.id!==source.id)
    const elements=Array.from(document.querySelectorAll<HTMLElement>('[data-category-id]'))
    const index=others.filter(row=>{const element=elements.find(el=>el.dataset.categoryId===row.id);if(!element)return false;const box=element.getBoundingClientRect();return e.clientY>box.top+box.height/2}).length
    drag.index=index
    setDragging(source.id)
    setGhost({id:source.id,x:Math.max(4,Math.min(window.innerWidth-drag.width-4,e.clientX-drag.offsetX)),y:e.clientY-drag.offsetY,width:drag.width,height:drag.height,index,target:others[index]?.id??others.at(-1)?.id??null,after:index===others.length})
    setAnnouncement(`${source.name}, poziția ${index+1} din ${others.length+1}.`)
    // Continue dragging long lists near the edges of the viewport.
    if(e.clientY<90)window.scrollBy(0,-18)
    else if(e.clientY>window.innerHeight-100)window.scrollBy(0,18)
  }
  function finish(e:Pick<ReactPointerEvent<HTMLButtonElement>,'pointerId'>,cancel=false){const drag=active.current;if(!drag||drag.pointer!==e.pointerId)return;drag.cleanup();active.current=null;setDragging(null);setGhost(null)
    if(cancel){setAnnouncement('Mutare anulată.');return}
    const source=current.current.find(row=>row.id===drag.id);if(source&&drag.moved){const original=current.current;update(reorderCategory(original,source.id,drag.index));persist(source,original)}
  }
  function keyboard(e:KeyboardEvent<HTMLButtonElement>,source:CategoryRow){
    if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return
    e.preventDefault();const original=current.current,list=siblings(source),index=list.findIndex(row=>row.id===source.id)
    const next=e.key==='Home'?0:e.key==='End'?list.length-1:Math.max(0,Math.min(list.length-1,index+(e.key==='ArrowUp'?-1:1)))
    update(reorderCategory(original,source.id,next));persist(source,original);setAnnouncement(`${source.name}, poziția ${next+1} din ${list.length}.`)
  }
  useEffect(()=>()=>{active.current?.cleanup()},[])
  return {dragging,ghost,saving,announcement,start,keyboard}
}
