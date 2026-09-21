'use client'

import type {CategoryRow} from '@/lib/mylife-data'
import {sortedCategories} from '@/lib/category-display'
import CategoryIcon from './CategoryIcon'

type Props = {
  rows: CategoryRow[]
  value: string | null
  onChange: (id: string | null) => void
  label: string
}

export default function CategoryPicker({rows,value,onChange,label}:Props){
  const byId = new Map(rows.map(row => [row.id,row]))
  const selected = value ? byId.get(value) : undefined

  const path: CategoryRow[] = []
  let cursor = selected
  const seen = new Set<string>()
  while(cursor && !seen.has(cursor.id)){
    seen.add(cursor.id)
    path.unshift(cursor)
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined
  }

  const roots = sortedCategories(rows.filter(row => !row.parent_id))
  const selectedRoot = path[0]

  const levels: {parent:CategoryRow;children:CategoryRow[];selectedChild?:CategoryRow}[] = []
  if(selectedRoot){
    let parent = selectedRoot
    let depth = 0
    while(parent){
      const children = sortedCategories(rows.filter(row => row.parent_id === parent.id))
      if(!children.length) break
      const selectedChild = path[depth + 1]
      levels.push({parent,children,selectedChild})
      if(!selectedChild) break
      parent = selectedChild
      depth += 1
    }
  }

  return <div className="transactionCategoryPicker">
    <span className="transactionPickerLabel">{label}</span>

    <div className="transactionCategoryOptions" role="group" aria-label={label}>
      <button type="button" className={!selectedRoot ? 'selected' : ''} aria-pressed={!selectedRoot} onClick={() => onChange(null)}>
        <span>Fără categorie</span>
      </button>
      {roots.map(category => {
        const active = selectedRoot?.id === category.id
        return <button type="button" key={category.id} className={active ? 'selected' : ''} aria-pressed={active} onClick={() => onChange(category.id)}>
          <CategoryIcon category={category} categories={rows}/>
          <span>{category.name}</span>
        </button>
      })}
    </div>

    {levels.map((level,index) => {
      const parentIsCurrent = value === level.parent.id
      const levelLabel = index === 0 ? 'Subcategorie' : `Subcategorie · ${level.parent.name}`
      return <div className="transactionSubcategoryOptions" key={level.parent.id}>
        <span className="transactionPickerLabel">{levelLabel}</span>
        <div role="group" aria-label={levelLabel}>
          <button type="button" className={parentIsCurrent ? 'selected' : ''} aria-pressed={parentIsCurrent} onClick={() => onChange(level.parent.id)}>
            <CategoryIcon category={level.parent} categories={rows} subcategory={index > 0}/>
            <span>{index === 0 ? 'Fără subcategorie' : `Doar ${level.parent.name}`}</span>
          </button>
          {level.children.map(category => {
            const active = level.selectedChild?.id === category.id
            return <button type="button" key={category.id} className={active ? 'selected' : ''} aria-pressed={active} onClick={() => onChange(category.id)}>
              <CategoryIcon category={category} categories={rows} subcategory/>
              <span>{category.name}</span>
            </button>
          })}
        </div>
      </div>
    })}
  </div>
}
