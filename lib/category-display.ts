import type {CategoryRow} from './mylife-data'
export const categoryIcons=['tag','food','home','car','health','shield','gift','plane','shopping','sport','pet','child','wallet','utilities','coffee','education'] as const
export const categoryColors=['#6ea8fe','#67d8c1','#a889f4','#f5bd63','#f07fa0','#75c8ff','#9fda7d','#fb9273','#d69cec','#e4ce72','#7dd5a5','#91a5ef']
export function categoryAppearance(row?:Pick<CategoryRow,'id'|'name'|'icon'|'color'>){
 const name=(row?.name??'').toLocaleLowerCase('ro');let hash=0;for(const c of row?.id??'')hash=(hash*31+c.charCodeAt(0))>>>0
 const inferred=/mâncare|restaurant|prânz|cină|dejun/.test(name)?'food':/casă|locuin/.test(name)?'home':/mașină|rca|casco|combustibil|transport|service/.test(name)?'car':/sănăt|medicament|terapie/.test(name)?'health':/asigur/.test(name)?'shield':/cadou|botez|nuntă/.test(name)?'gift':/călător|zbor|hotel/.test(name)?'plane':/cumpăr|haine|accesor|încăl/.test(name)?'shopping':/sport|sală/.test(name)?'sport':/animal/.test(name)?'pet':/patrick/.test(name)?'child':/venit|salariu|invest/.test(name)?'wallet':/utilit|electric|apă|internet/.test(name)?'utilities':/cafea/.test(name)?'coffee':/școal/.test(name)?'education':'tag'
 return {icon:categoryIcons.includes(row?.icon as typeof categoryIcons[number])?row!.icon!:inferred,color:row?.color&&/^#[\da-f]{6}$/i.test(row.color)?row.color:({'Animale':'#6ea8fe','Asigurări':'#a889f4','Cadouri':'#f5bd63','Călătorii':'#75c8ff','Casă':'#67d8c1','Cumpărături':'#f07fa0','Divertisment și sport':'#9fda7d','Investiții':'#fb9273','Mâncare și băuturi':'#e4ce72','Necategorizat':'#8d98a8','Patrick':'#d69cec','Personal':'#91a5ef','Rate':'#cbab86','Sănătate':'#e692bf','Transport':'#8ac5b3','Utilități':'#7dd5a5','Venituri':'#66d8a4'} as Record<string,string>)[row?.name??'']??categoryColors[hash%categoryColors.length]}
}
export function sortedCategories(rows:CategoryRow[]){return [...rows].sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)||a.name.localeCompare(b.name,'ro')||a.id.localeCompare(b.id))}
export function categoryRoot(id:string|null,rows:CategoryRow[]){let row=rows.find(c=>c.id===id);const seen=new Set<string>();while(row?.parent_id&&!seen.has(row.id)){seen.add(row.id);const parent=rows.find(c=>c.id===row!.parent_id);if(!parent)break;row=parent}return row}

/** Subcategories inherit their root color even if an older record has its own color. */
export function categoryPresentation(row:CategoryRow|undefined,rows:CategoryRow[]){
 const root=categoryRoot(row?.id??null,rows)??row
 return {...categoryAppearance(root),subcategory:!!row?.parent_id}
}
