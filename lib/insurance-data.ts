import type {CategoryRow,DocumentRow,MyLifeData,SplitRow,Transaction} from './mylife-data'

export type InsuranceKind='health'|'casco'|'rca'|'home'|'other'
export type InsuranceFrequency='monthly'|'quarterly'|'yearly'|null

export type InsurancePayment={
  id:string
  date:string
  amount:number
  currency:string
  transaction:Transaction
}

export type PolicyInstallment={number:number;date:string;amount:number;currency:string;paid:boolean|null}

export type InsurancePolicy={
  installments?:PolicyInstallment[]
  id:string
  kind:InsuranceKind
  title:string
  subtitle:string
  categoryName:string
  payments:InsurancePayment[]
  document:DocumentRow|null
  frequency:InsuranceFrequency
  nextPayment:{date:string;amount:number;currency:string;estimated:boolean}|null
  expiry:string|null
  coverageStart:string|null
  totalInstallments:number|null
  remainingInstallments:number|null
  status:'active'|'expiring'|'expired'|'unknown'
}

const norm=(value:string|undefined|null)=>(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
const day=(value:string)=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));const get=(type:string)=>parts.find(part=>part.type===type)?.value??'';return get('year')+'-'+get('month')+'-'+get('day')}
const parseDate=(value:string)=>Date.parse(value.slice(0,10)+'T12:00:00Z')
const daysBetween=(a:string,b:string)=>Math.round((parseDate(b)-parseDate(a))/86400000)
const numberValue=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'&&Number.isFinite(Number(value))?Number(value):null
const extraText=(document:DocumentRow|null,key:string)=>{const value=document?.extra?.[key];return typeof value==='string'&&value.trim()?value.trim():null}
const extraNumber=(document:DocumentRow|null,key:string)=>numberValue(document?.extra?.[key])

function descendants(categories:CategoryRow[],rootIds:Set<string>){
  const ids=new Set(rootIds)
  let changed=true
  while(changed){
    changed=false
    for(const category of categories){
      if(category.parent_id&&ids.has(category.parent_id)&&!ids.has(category.id)){ids.add(category.id);changed=true}
    }
  }
  return ids
}

function classify(category:CategoryRow,text:string):InsuranceKind{
  const name=norm(category.name),hay=norm(text)
  if(name==='sanatate'||hay.includes('cigna')||hay.includes('sanatate')||hay.includes('health insurance'))return 'health'
  if(name==='casco'||hay.includes('casco'))return 'casco'
  if(name==='rca'||/\brca\b/.test(hay))return 'rca'
  if(name==='locuinta'||hay.includes('locuint')||hay.includes('casa'))return 'home'
  return 'other'
}

function median(values:number[]){
  if(!values.length)return null
  const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2)
  return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2
}

function recurrence(payments:InsurancePayment[]):InsuranceFrequency{
  if(payments.length<2)return null
  const dates=[...new Set(payments.map(payment=>payment.date))].sort()
  if(dates.length<2)return null
  const intervals=dates.slice(1).map((date,index)=>daysBetween(dates[index],date)).filter(value=>value>0)
  const typical=median(intervals)
  if(typical===null)return null
  if(typical>=17&&typical<=45)return 'monthly'
  if(typical>=70&&typical<=115)return 'quarterly'
  if(typical>=300&&typical<=430)return 'yearly'
  return null
}

function addMonths(value:string,months:number){
  const source=new Date(value.slice(0,10)+'T12:00:00Z')
  const wanted=source.getUTCDate()
  const target=new Date(Date.UTC(source.getUTCFullYear(),source.getUTCMonth()+months,1,12))
  const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0,12)).getUTCDate()
  target.setUTCDate(Math.min(wanted,last))
  return target.toISOString().slice(0,10)
}

function nextRecurringPayment(payments:InsurancePayment[],frequency:InsuranceFrequency,today:string){
  if(!frequency||!payments.length)return null
  const months=frequency==='monthly'?1:frequency==='quarterly'?3:12
  const latest=[...payments].sort((a,b)=>a.date.localeCompare(b.date)).at(-1)!
  let date=addMonths(latest.date,months)
  for(let guard=0;date<=today&&guard<24;guard++)date=addMonths(date,months)
  return {date,amount:latest.amount,currency:latest.currency,estimated:true}
}

function documentSubtype(document:DocumentRow){
  return norm(typeof document.extra?.subtype==='string'?document.extra.subtype:document.document_type)
}

function matchingDocument(kind:InsuranceKind,payments:InsurancePayment[],documents:DocumentRow[]){
  const attached=payments.map(payment=>payment.transaction.attachment_document_id).filter(Boolean) as string[]
  const direct=documents.find(document=>attached.includes(document.id))
  if(direct)return direct
  if(kind==='home')return documents.filter(document=>document.document_type==='asigurare_locuinta_facultativa').sort((a,b)=>(b.issued_at??'').localeCompare(a.issued_at??''))[0]??null
  if(kind!=='rca'&&kind!=='casco')return null
  const candidates=documents.filter(document=>{
    const subtype=documentSubtype(document)
    return kind==='rca'?(subtype==='rca'||subtype.includes('rca')):(subtype==='casco'||subtype.includes('casco'))
  })
  return candidates.sort((a,b)=>(b.expires_at??'').localeCompare(a.expires_at??''))[0]??null
}

function policyTitle(kind:InsuranceKind,payments:InsurancePayment[],document:DocumentRow|null){
  const latest=[...payments].sort((a,b)=>b.date.localeCompare(a.date))[0]?.transaction
  const vehicle=extraText(document,'Vehicul')
  if(kind==='rca')return vehicle?'RCA · '+vehicle:'RCA'
  if(kind==='casco')return vehicle?'CASCO · '+vehicle:'CASCO'
  if(kind==='health'){
    const merchant=[...payments].reverse().map(payment=>payment.transaction.merchant).find(Boolean)
    return merchant?merchant+' Health':'Asigurare sănătate'
  }
  if(kind==='home')return latest?.title||'Asigurare locuință'
  return latest?.title||latest?.merchant||latest?.description||'Asigurare'
}

function statusFor(expiry:string|null,today:string):InsurancePolicy['status']{
  if(!expiry)return 'unknown'
  const days=daysBetween(today,expiry)
  if(days<0)return 'expired'
  if(days<=45)return 'expiring'
  return 'active'
}

function policySubtitle(kind:InsuranceKind,document:DocumentRow|null){
  if(document?.issuer)return document.issuer
  if(kind==='health')return 'Asigurare de sănătate'
  if(kind==='home')return 'Asigurare locuință'
  if(kind==='rca')return 'Răspundere civilă auto'
  if(kind==='casco')return 'Asigurare auto'
  return 'Din categoria Asigurări'
}

export function insurancePolicies(data:Pick<MyLifeData,'categories'|'splits'|'transactions'|'documents'>,today:string):InsurancePolicy[]{
  const roots=data.categories.filter(category=>norm(category.name)==='asigurari')
  if(!roots.length)return []
  const insuranceIds=descendants(data.categories,new Set(roots.map(root=>root.id)))
  const categoryById=new Map(data.categories.map(category=>[category.id,category]))
  const transactionById=new Map(data.transactions.map(transaction=>[transaction.id,transaction]))
  const rootIds=new Set(roots.map(root=>root.id))

  const rows=data.splits.flatMap((split:SplitRow)=>{
    if(!insuranceIds.has(split.category_id??''))return []
    const transaction=transactionById.get(split.transaction_id)
    const category=categoryById.get(split.category_id??'')
    if(!transaction||!category||transaction.transaction_type!=='expense'||(transaction.status&&transaction.status!=='posted'))return []
    const amount=Number(split.amount)
    if(!Number.isFinite(amount)||amount<0)return []
    const text=[transaction.title,transaction.merchant,transaction.description].filter(Boolean).join(' ')
    return [{split,transaction,category,amount,kind:classify(category,text),root:rootIds.has(category.id)}]
  })

  for(const row of rows){
    if(row.kind!=='other'||!row.root)continue
    const candidates=new Set(rows.filter(other=>other!==row&&other.kind!=='other'&&other.transaction.currency===row.transaction.currency&&Math.abs(other.amount-row.amount)<=Math.max(1,row.amount*.01)).map(other=>other.kind))
    if(candidates.size===1)row.kind=[...candidates][0]
  }

  const grouped=new Map<string,typeof rows>()
  for(const row of rows){
    const key=row.kind
    const group=grouped.get(key)??[]
    group.push(row);grouped.set(key,group)
  }

  return [...grouped.entries()].map(([key,group])=>{
    const kind=key as InsuranceKind
    const payments=group.map(row=>({id:row.transaction.id,date:day(row.transaction.transaction_date),amount:row.amount,currency:row.transaction.currency.trim(),transaction:row.transaction})).sort((a,b)=>a.date.localeCompare(b.date))
    const document=matchingDocument(kind,payments,data.documents)
    const rawInstallments=kind==='home'&&Array.isArray(document?.extra?.installments)?document.extra.installments:[]
    const installments:PolicyInstallment[]=rawInstallments.flatMap((item:unknown)=>{if(!item||typeof item!=='object')return [];const x=item as Record<string,unknown>;return typeof x.due_date==='string'&&typeof x.amount==='number'&&typeof x.number==='number'?[{number:x.number,date:x.due_date,amount:x.amount,currency:'RON',paid:x.paid===true?true:x.paid===false?false:null}]:[]}).sort((a,b)=>a.date.localeCompare(b.date))
    const frequency=installments.length?null:recurrence(payments)
    const totalInstallments=installments.length||extraNumber(document,'Număr rate')
    const uniquePaid=new Set(payments.map(payment=>payment.date)).size
    const remainingInstallments=installments.length?installments.filter(item=>item.paid!==true).length:totalInstallments===null?null:Math.max(0,totalInstallments-uniquePaid)
    const coverageStart=extraText(document,'Valabilă de la')??document?.issued_at??document?.document_date??null
    const expiry=document?.expires_at??extraText(document,'Valabilă până la')
    const due=extraText(document,'Scadență rată')
    const exactDue=due&&due>today&&(!totalInstallments||remainingInstallments===null||remainingInstallments>0)
      ? {date:due,amount:payments.at(-1)?.amount??0,currency:payments.at(-1)?.currency??'RON',estimated:false}
      : null
    const scheduled=installments.find(item=>item.paid!==true&&item.date>=today)
    const nextPayment=installments.length?(scheduled?{date:scheduled.date,amount:scheduled.amount,currency:scheduled.currency,estimated:false}:null):exactDue??nextRecurringPayment(payments,frequency,today)
    const categoryName=group.find(row=>!row.root)?.category.name??group[0]?.category.name??'Asigurări'
    return {
      id:key,kind,installments,title:policyTitle(kind,payments,document),subtitle:policySubtitle(kind,document),categoryName,payments,document,frequency,nextPayment,
      expiry:expiry??null,coverageStart,totalInstallments,remainingInstallments,status:statusFor(expiry??null,today),
    }
  }).sort((a,b)=>{
    const aNext=a.nextPayment?.date??a.expiry??'9999-12-31',bNext=b.nextPayment?.date??b.expiry??'9999-12-31'
    return aNext.localeCompare(bNext)||a.title.localeCompare(b.title,'ro')
  })
}
