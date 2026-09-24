import {NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'
import type {
  ExpenseImageDocumentType,
  ExpenseImageTransaction,
  ReceiptAnalysis,
  ReceiptAnalysisItem,
} from '@/lib/receipt-analysis'

// Redeploy trigger after OPENAI_API_KEY configuration
export const runtime='nodejs'
export const maxDuration=60

type CategoryRow={
  id:string
  name:string
  parent_id:string|null
  kind:string
  is_active:boolean
}

const DOCUMENT_TYPES:ExpenseImageDocumentType[]=[
  'receipt',
  'bank_transactions',
  'bank_statement',
  'invoice',
  'order_confirmation',
  'payment_confirmation',
  'handwritten_expenses',
  'other_expense_document',
]

function categoryPath(category:CategoryRow,byId:Map<string,CategoryRow>){
  const names:string[]=[]
  let current:CategoryRow|undefined=category
  const seen=new Set<string>()
  while(current&&!seen.has(current.id)){
    seen.add(current.id)
    names.unshift(current.name)
    current=current.parent_id?byId.get(current.parent_id):undefined
  }
  return names.join(' → ')
}

function jsonFromText(text:string){
  const trimmed=text.trim().replace(/^\`\`\`(?:json)?\s*/i,'').replace(/\s*\`\`\`$/,'')
  try{return JSON.parse(trimmed)}
  catch{
    const start=trimmed.indexOf('{')
    const end=trimmed.lastIndexOf('}')
    if(start<0||end<=start)throw new Error('Modelul nu a returnat JSON valid.')
    return JSON.parse(trimmed.slice(start,end+1))
  }
}

function money(value:unknown){
  const number=typeof value==='number'?value:Number(value)
  return Number.isFinite(number)?Math.round(number*100)/100:0
}

function dateOrNull(value:unknown){
  return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:null
}

function textOrNull(value:unknown){
  if(typeof value!=='string')return null
  const trimmed=value.trim()
  return trimmed||null
}

function documentType(value:unknown):ExpenseImageDocumentType{
  const candidate=typeof value==='string'?value.trim() as ExpenseImageDocumentType:'other_expense_document'
  return DOCUMENT_TYPES.includes(candidate)?candidate:'other_expense_document'
}

function bucharestToday(){
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'Europe/Bucharest',
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
  }).formatToParts(new Date())
  const value=(type:string)=>parts.find(part=>part.type===type)?.value??''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export async function POST(request:Request){
  try{
    const authorization=request.headers.get('authorization')??''
    const token=authorization.startsWith('Bearer ')?authorization.slice(7):''
    if(!token)return NextResponse.json({error:'Autentificare necesară.'},{status:401})

    const body=await request.json() as {storagePath?:string;householdId?:string}
    if(!body.storagePath||!body.householdId)return NextResponse.json({error:'Lipsește imaginea de analizat.'},{status:400})

    const url=process.env.NEXT_PUBLIC_SUPABASE_URL
    const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if(!url||!key)return NextResponse.json({error:'Supabase nu este configurat pe server.'},{status:500})

    const supabase=createClient(url,key,{
      auth:{persistSession:false,autoRefreshToken:false},
      global:{headers:{Authorization:`Bearer ${token}`}},
    })
    const {data:{user},error:userError}=await supabase.auth.getUser(token)
    if(userError||!user)return NextResponse.json({error:'Sesiunea nu mai este validă.'},{status:401})

    const {data:categories,error:categoryError}=await supabase
      .from('finance_categories')
      .select('id,name,parent_id,kind,is_active')
      .or(`household_id.eq.${body.householdId},household_id.is.null`)
      .eq('kind','expense')
      .eq('is_active',true)

    if(categoryError)return NextResponse.json({error:categoryError.message},{status:403})
    if(!categories?.length)return NextResponse.json({error:'Nu există categorii de cheltuieli disponibile.'},{status:400})

    const categoryRows=categories as CategoryRow[]
    const byId=new Map(categoryRows.map(category=>[category.id,category]))
    const categoryOptions=categoryRows
      .map(category=>({id:category.id,path:categoryPath(category,byId)}))
      .sort((a,b)=>a.path.localeCompare(b.path,'ro'))

    const uncategorized=categoryOptions.find(category=>category.path.toLocaleLowerCase('ro')==='necategorizat')??categoryOptions[0]
    const validCategoryIds=new Set(categoryOptions.map(category=>category.id))

    const {data:signed,error:signedError}=await supabase.storage
      .from('mylife-documents')
      .createSignedUrl(body.storagePath,180)
    if(signedError||!signed?.signedUrl)return NextResponse.json({error:signedError?.message??'Imaginea nu poate fi citită.'},{status:400})

    const today=bucharestToday()
    const prompt=`Analizează imaginea pentru aplicația personală de finanțe MyLife.

IMPORTANT: NU presupune că imaginea este un bon fiscal. Scopul este să identifici orice cheltuială sau listă de cheltuieli vizibilă în imagine.

Imaginea poate fi:
- bon fiscal
- screenshot din Apple Wallet / Google Wallet
- screenshot dintr-o aplicație bancară
- extras de cont sau listă de tranzacții
- factură
- confirmare de comandă
- confirmare de plată
- listă scrisă de mână cu cheltuieli
- alt document financiar

Clasifică document_type folosind EXACT una dintre valorile:
receipt, bank_transactions, bank_statement, invoice, order_confirmation, payment_confirmation, handwritten_expenses, other_expense_document.

Reguli generale:
- Extrage numai cheltuieli reale. Nu transforma solduri, limite de card, venituri, rambursări sau transferuri între conturi în cheltuieli.
- O singură imagine poate conține mai multe tranzacții distincte.
- Sumele cheltuielilor se întorc pozitive.
- Folosește numai category_id-urile furnizate mai jos. Nu inventa categorii.
- Dacă nu poți clasifica sigur o cheltuială, folosește categoria Necategorizat.
- confidence este între 0 și 1.
- Nu inventa comerciant, locație sau dată dacă nu sunt vizibile ori deductibile în siguranță.
- Astăzi este ${today} în fusul orar Europe/Bucharest.
- Transformă date relative precum "Today", "Yesterday", "Azi", "Ieri" în YYYY-MM-DD raportat la data de mai sus și păstrează textul original în date_text.
- Dacă data nu poate fi stabilită sigur, date trebuie să fie null.

Pentru document_type = receipt:
- Completează merchant, date, currency, total și TOATE produsele în items.
- transactions trebuie să fie [].
- Normalizează reducerile: aplică reducerea produsului la produs și NU crea linii negative separate.
- Nu include subtotaluri, TVA, totaluri intermediare, metode de plată, carduri, puncte de fidelitate sau linii informative.
- Include garanțiile/depozitele de ambalaj dacă sunt efectiv taxate.
- line_total trebuie să fie suma finală plătită pentru acea linie și să fie >= 0.
- Suma tuturor line_total trebuie să fie egală cu totalul bonului dacă bonul este lizibil.
- Păstrează eticheta de pe bon în raw_label și scrie o denumire curățată în normalized_label.

Pentru orice alt document_type:
- items trebuie să fie [].
- Pune în transactions FIECARE cheltuială distinctă vizibilă.
- O factură, confirmare de comandă sau confirmare de plată cu o singură cheltuială trebuie să producă exact o tranzacție.
- Un screenshot/extras cu mai multe rânduri trebuie să producă o tranzacție pentru fiecare rând de cheltuială.
- merchant este numele comerciantului/beneficiarului dacă este vizibil.
- amount este suma acelei tranzacții.
- currency este moneda acelei tranzacții.
- location este locația doar dacă apare în imagine.
- description este un text scurt util doar dacă există informație suplimentară relevantă.

Categorii disponibile:
${categoryOptions.map(category=>`${category.id} | ${category.path}`).join('\n')}

Răspunde EXCLUSIV cu JSON valid, fără markdown, în forma:
{
  "document_type": "receipt | bank_transactions | bank_statement | invoice | order_confirmation | payment_confirmation | handwritten_expenses | other_expense_document",
  "merchant": "string sau null",
  "date": "YYYY-MM-DD sau null",
  "currency": "RON sau altă monedă, ori null",
  "total": 0,
  "items": [
    {
      "raw_label": "string",
      "normalized_label": "string",
      "quantity": 1,
      "unit_price": 0,
      "line_total": 0,
      "category_id": "uuid",
      "confidence": 0.95
    }
  ],
  "transactions": [
    {
      "merchant": "string",
      "amount": 0,
      "currency": "RON",
      "date": "YYYY-MM-DD sau null",
      "date_text": "textul original al datei sau null",
      "location": "string sau null",
      "description": "string sau null",
      "category_id": "uuid",
      "confidence": 0.95
    }
  ],
  "warnings": []
}`

    const openaiKey=process.env.OPENAI_API_KEY
    if(!openaiKey)return NextResponse.json({error:'OpenAI API nu este configurat pe server.'},{status:503})

    const openaiResponse=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{
        Authorization:`Bearer ${openaiKey}`,
        'Content-Type':'application/json',
      },
      body:JSON.stringify({
        model:'gpt-5.6-terra',
        input:[{
          role:'user',
          content:[
            {type:'input_text',text:prompt},
            {type:'input_image',image_url:signed.signedUrl,detail:'high'},
          ],
        }],
        text:{format:{type:'json_object'}},
      }),
    })

    const openaiPayload=await openaiResponse.json() as {
      output?:Array<{content?:Array<{type?:string;text?:string}>}>
      error?:{message?:string;code?:string}
    }

    if(!openaiResponse.ok){
      const message=openaiPayload.error?.message??'OpenAI API a refuzat analiza imaginii.'
      throw new Error(`OpenAI API: ${message}`)
    }

    const outputText=openaiPayload.output
      ?.flatMap(item=>item.content??[])
      .find(item=>item.type==='output_text'&&typeof item.text==='string')
      ?.text

    if(!outputText)throw new Error('OpenAI API nu a returnat rezultatul analizei.')

    const parsed=jsonFromText(outputText) as {
      document_type?:unknown
      merchant?:unknown
      date?:unknown
      currency?:unknown
      total?:unknown
      items?:unknown
      transactions?:unknown
      warnings?:unknown
    }

    const rawItems=Array.isArray(parsed.items)?parsed.items:[]
    const items:ReceiptAnalysisItem[]=rawItems.map((raw,index)=>{
      const item=raw&&typeof raw==='object'?raw as Record<string,unknown>:{}
      const requestedCategory=typeof item.category_id==='string'?item.category_id:''
      const categoryId=validCategoryIds.has(requestedCategory)?requestedCategory:uncategorized.id
      const path=categoryOptions.find(category=>category.id===categoryId)?.path??uncategorized.path
      const quantity=item.quantity===null?null:Number(item.quantity)
      const unitPrice=item.unit_price===null?null:money(item.unit_price)
      const confidence=Math.max(0,Math.min(1,Number(item.confidence) || 0))
      return {
        line_no:index+1,
        raw_label:String(item.raw_label??item.normalized_label??`Articol ${index+1}`).trim(),
        normalized_label:String(item.normalized_label??item.raw_label??`Articol ${index+1}`).trim(),
        quantity:Number.isFinite(quantity as number)?quantity:null,
        unit_price:unitPrice===null?null:unitPrice,
        line_total:Math.max(0,money(item.line_total)),
        category_id:categoryId,
        category_path:path,
        confidence,
      }
    }).filter(item=>item.line_total>0)

    const rawTransactions=Array.isArray(parsed.transactions)?parsed.transactions:[]
    const transactions:ExpenseImageTransaction[]=rawTransactions.map((raw,index)=>{
      const transaction=raw&&typeof raw==='object'?raw as Record<string,unknown>:{}
      const requestedCategory=typeof transaction.category_id==='string'?transaction.category_id:''
      const categoryId=validCategoryIds.has(requestedCategory)?requestedCategory:uncategorized.id
      const path=categoryOptions.find(category=>category.id===categoryId)?.path??uncategorized.path
      const description=textOrNull(transaction.description)
      const merchant=textOrNull(transaction.merchant)??description??`Cheltuială ${index+1}`
      return {
        line_no:index+1,
        merchant,
        amount:Math.max(0,money(transaction.amount)),
        currency:String(transaction.currency??parsed.currency??'RON').trim().toUpperCase()||'RON',
        date:dateOrNull(transaction.date),
        date_text:textOrNull(transaction.date_text),
        location:textOrNull(transaction.location),
        description,
        category_id:categoryId,
        category_path:path,
        confidence:Math.max(0,Math.min(1,Number(transaction.confidence) || 0)),
      }
    }).filter(transaction=>transaction.amount>0)

    const requestedDocumentType=documentType(parsed.document_type)
    const detectedDocumentType:ExpenseImageDocumentType=items.length
      ?'receipt'
      :transactions.length
        ?(requestedDocumentType==='receipt'?'bank_transactions':requestedDocumentType)
        :requestedDocumentType

    if(!items.length&&!transactions.length){
      return NextResponse.json({error:'Nu am putut identifica nicio cheltuială în imagine.'},{status:422})
    }

    const warnings=Array.isArray(parsed.warnings)?parsed.warnings.map(String).filter(Boolean):[]

    if(items.length){
      const splitCents=new Map<string,number>()
      for(const item of items){
        splitCents.set(item.category_id,(splitCents.get(item.category_id)??0)+Math.round(item.line_total*100))
      }
      const splits=[...splitCents.entries()].map(([category_id,cents])=>({
        category_id,
        category_path:categoryOptions.find(category=>category.id===category_id)?.path??uncategorized.path,
        amount:cents/100,
      })).sort((a,b)=>b.amount-a.amount)

      const total=money(parsed.total)
      const itemsTotal=Math.round(items.reduce((sum,item)=>sum+item.line_total,0)*100)/100
      const difference=Math.round((total-itemsTotal)*100)/100
      const currency=String(parsed.currency??'RON').trim().toUpperCase()||'RON'
      if(Math.abs(difference)>.05)warnings.push(`Produsele însumează ${itemsTotal.toFixed(2)} ${currency}, iar totalul documentului este ${total.toFixed(2)}.`)

      const analysis:ReceiptAnalysis={
        document_type:'receipt',
        merchant:String(parsed.merchant??'Bon').trim()||'Bon',
        date:dateOrNull(parsed.date),
        currency,
        total,
        items,
        splits,
        transactions:[],
        balanced:Math.abs(difference)<=.05&&total>0,
        difference,
        warnings,
      }
      return NextResponse.json(analysis)
    }

    const currencies=[...new Set(transactions.map(transaction=>transaction.currency))]
    const dates=[...new Set(transactions.map(transaction=>transaction.date).filter((value):value is string=>!!value))]
    const singleCurrency=currencies.length===1?currencies[0]:'MULTI'
    const total=currencies.length===1
      ?Math.round(transactions.reduce((sum,transaction)=>sum+transaction.amount,0)*100)/100
      :0
    if(currencies.length>1)warnings.push('Imaginea conține cheltuieli în mai multe monede; contul de plată trebuie verificat pentru fiecare tranzacție.')

    const analysis:ReceiptAnalysis={
      document_type:detectedDocumentType,
      merchant:transactions.length===1?transactions[0].merchant:`${transactions.length} cheltuieli`,
      date:dates.length===1?dates[0]:null,
      currency:singleCurrency,
      total,
      items:[],
      splits:[],
      transactions,
      balanced:true,
      difference:0,
      warnings,
    }

    return NextResponse.json(analysis)
  }catch(error){
    console.error('Expense image analysis failed',error)
    const message=error instanceof Error?error.message:'Analiza imaginii a eșuat.'
    const lower=message.toLowerCase()
    if(lower.includes('openai api')&&(lower.includes('insufficient_quota')||lower.includes('quota')||lower.includes('billing'))){
      return NextResponse.json({
        error:'OpenAI API nu are credit disponibil. Adaugă billing/credit în OpenAI Platform, apoi apasă din nou „Analizează”. Imaginea rămâne salvată.',
      },{status:503})
    }
    if(lower.includes('openai api')&&(lower.includes('api key')||lower.includes('authentication')||lower.includes('incorrect api key'))){
      return NextResponse.json({
        error:'Cheia OpenAI API nu este validă. Verifică OPENAI_API_KEY în Vercel și încearcă din nou.',
      },{status:503})
    }
    return NextResponse.json({error:message},{status:500})
  }
}
