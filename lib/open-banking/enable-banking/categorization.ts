export type CategoryCandidate={id:string;name:string;parent_id:string|null;kind:string;is_active:boolean}

export function merchantKey(value:string|null|undefined){
  return (value??'').normalize('NFKC').trim().toLocaleLowerCase('ro-RO').replace(/\s+/g,' ')
}

const expenseRules:Array<{path:string[];keywords:string[]}>= [
  {path:['Cumpărături','Supermarket'],keywords:['kaufland','lidl','carrefour','mega image','auchan','profi','penny','selgros','supermarket']},
  {path:['Auto','Mașină','Combustibil'],keywords:['omv','petrom','rompetrol','mol ','lukoil','socar','combustibil','benzin','motorin']},
  {path:['Auto','Mașină','Parcare'],keywords:['parking','parcare','tpark','yeparking']},
  {path:['Auto','Mașină','Uber/Bolt/Bus'],keywords:['uber','bolt','metrorex','transport urban',' ctp ',' stb ']},
  {path:['Auto','Tren'],keywords:['cfr','tren','railway']},
  {path:['Mâncare și băuturi','În oraș'],keywords:['restaurant','bistro','pizza','kfc','mcdonald','glovo','tazz','food','grill','burger']},
  {path:['Mâncare și băuturi','Cafea, gustări și băuturi'],keywords:['coffee','cafe','starbucks','vending','5 to go']},
  {path:['Utilități','Electricitate'],keywords:['electric','enel',' ppc ','e.on',' eon ']},
  {path:['Utilități','Telefon + Internet'],keywords:['digi','orange','vodafone','telekom','internet']},
  {path:['Utilități','Aplicații și abonamente'],keywords:['apple.com/bill','google','netflix','spotify','youtube','hbo','openai','subscription']},
  {path:['Utilități','Taxe și comisioane'],keywords:['comision','commission','bank fee','taxă bancară']},
  {path:['Sănătate','Medicamente'],keywords:['farmacia','pharmacy','catena','dr max','sensiblu','help net']},
  {path:['Sănătate','Terapie'],keywords:['mental health','therapy','terapie','psiholog']},
  {path:['Călătorii','Zbor'],keywords:['wizz','ryanair','tarom','airline','flight']},
  {path:['Călătorii','Hotel'],keywords:['hotel','booking.com','airbnb']},
  {path:['Personal','Cosmetice'],keywords:['sephora','douglas','cosmetic']},
  {path:['Personal','Frizerie/Salon'],keywords:['frizer','salon','barber']},
  {path:['Personal','Gadgeturi'],keywords:['emag','altex','flanco','istyle']},
  {path:['Divertisment și sport','Cinema'],keywords:['cinema','cinemacity','movieplex']},
  {path:['Divertisment și sport','Sală'],keywords:['world class','18gym','fitness','gym']},
]

const incomeRules:Array<{path:string[];keywords:string[]}>= [
  {path:['Venituri','Salariu'],keywords:['salariu','salary','payroll','endava']},
  {path:['Venituri','Cadouri primite'],keywords:['cadou','gift']},
]

function categoryAtPath(categories:CategoryCandidate[],kind:string,path:string[]){
  let parent:string|null=null
  let found:CategoryCandidate|undefined
  for(const name of path){
    found=categories.find(category=>category.kind===kind&&category.is_active&&category.parent_id===parent&&merchantKey(category.name)===merchantKey(name))
    if(!found)return null
    parent=found.id
  }
  return found??null
}

export function predictedCategory(categories:CategoryCandidate[],kind:'expense'|'income',text:string){
  const normalized=` ${merchantKey(text)} `
  const rules=kind==='expense'?expenseRules:incomeRules
  for(const rule of rules){
    if(rule.keywords.some(keyword=>normalized.includes(keyword))){
      const category=categoryAtPath(categories,kind,rule.path)
      if(category)return category
    }
  }
  const direct=[...categories]
    .filter(category=>category.kind===kind&&category.is_active&&merchantKey(category.name).length>=4&&normalized.includes(merchantKey(category.name)))
    .sort((left,right)=>Number(Boolean(right.parent_id))-Number(Boolean(left.parent_id))||right.name.length-left.name.length)[0]
  if(direct)return direct
  return categoryAtPath(categories,kind,kind==='expense'?['Necategorizat']:['Venituri'])
}
