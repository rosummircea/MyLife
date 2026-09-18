import type {CategoryRow} from './mylife-data'
import {sortedCategories} from './category-display'

/** Reordering never changes a category's parent or its descendants. */
export function reorderCategory(rows:CategoryRow[], id:string, index:number) {
  const source=rows.find(row=>row.id===id)
  if(!source)return rows
  const siblings=sortedCategories(rows.filter(row=>row.kind===source.kind&&row.parent_id===source.parent_id))
  const old=siblings.findIndex(row=>row.id===id)
  siblings.splice(old,1)
  siblings.splice(Math.max(0,Math.min(index,siblings.length)),0,source)
  const order=new Map(siblings.map((row,i)=>[row.id,i]))
  return rows.map(row=>order.has(row.id)?{...row,sort_order:order.get(row.id)!}:row)
}
