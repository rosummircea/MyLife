'use client'
import type {CategoryRow} from '@/lib/mylife-data'
import {categoryRoot,sortedCategories} from '@/lib/category-display'
import CategoryIcon from './CategoryIcon'

export default function CategoryPicker({rows,value,onChange,label}:{rows:CategoryRow[];value:string|null;onChange:(id:string|null)=>void;label:string}){
  const root=categoryRoot(value,rows)
  const roots=sortedCategories(rows.filter(c=>!c.parent_id))
  const children=root?sortedCategories(rows.filter(c=>c.parent_id&&categoryRoot(c.id,rows)?.id===root.id)):[]
  return <div className="transactionCategoryPicker">
    <span className="transactionPickerLabel">{label}</span>
    <div className="transactionCategoryOptions" role="group" aria-label={label}>
      <button type="button" className={!root?'selected':''} aria-pressed={!root} onClick={()=>onChange(null)}>Fără categorie</button>
      {roots.map(category=><button type="button" key={category.id} className={root?.id===category.id?'selected':''} aria-pressed={root?.id===category.id} onClick={()=>onChange(category.id)}>
        <CategoryIcon category={category} categories={rows}/>
        <span>{category.name}</span>
      </button>)}
    </div>
    {root&&children.length>0&&<div className="transactionSubcategoryOptions">
      <span className="transactionPickerLabel">Subcategorie</span>
      <div role="group" aria-label="Subcategorie">
        <button type="button" className={value===root.id?'selected':''} aria-pressed={value===root.id} onClick={()=>onChange(root.id)}>
          <CategoryIcon category={root} categories={rows}/><span>Fără subcategorie</span>
        </button>
        {children.map(category=><button type="button" key={category.id} className={value===category.id?'selected':''} aria-pressed={value===category.id} onClick={()=>onChange(category.id)}>
          <CategoryIcon category={root} categories={rows}/><span>{category.name}</span>
        </button>)}
      </div>
    </div>}
  </div>
}