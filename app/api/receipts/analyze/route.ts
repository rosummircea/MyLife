import {NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'
import type {ReceiptAnalysis,ReceiptAnalysisItem} from '@/lib/receipt-analysis'

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

export async function POST(request:Request){
  try{
    const authorization=request.headers.get('authorization')??''
    const token=authorization.startsWith('Bearer ')?authorization.slice(7):''
    if(!token)return NextResponse.json({error:'Autentificare necesară.'},{status:401})

    const body=await request.json() as {storagePath?:string;householdId?:string}
    if(!body.storagePath||!body.householdId)return NextResponse.json({error:'Lipsește fotografia bonului.'},{status:400})

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
    if(signedError||!signed?.signedUrl)return NextResponse.json({error:signedError?.message??'Fotografia nu poate fi citită.'},{status:400})

    const prompt=`Analizează bonul fiscal din imagine pentru aplicația personală de finanțe MyLife.

Extrage comerciantul, data, moneda, totalul și TOATE produsele cumpărate. Pentru fiecare produs atribuie exact un category_id din lista MyLife de mai jos.

Reguli importante:
- Folosește numai category_id-urile furnizate.
- Nu inventa categorii.
- Normalizează reducerile: aplică reducerea produsului la valoarea acelui produs și NU crea linii negative separate.
- Nu include subtotaluri, TVA, totaluri intermediare, metode de plată, carduri, puncte de fidelitate sau linii informative.
- Include garanțiile/depozitele de ambalaj dacă sunt efectiv taxate.
- line_total trebuie să fie suma finală plătită pentru acea linie și să fie >= 0.
- Dacă un articol nu poate fi clasificat sigur, folosește categoria Necategorizat.
- Suma tuturor line_total trebuie să fie egală cu totalul bonului, dacă bonul este lizibil.
- Păstrează eticheta de pe bon în raw_label și scrie o denumire curățată în normalized_label.
- confidence este între 0 și 1.

Categorii disponibile:
${categoryOptions.map(category=>`${category.id} | ${category.path}`).join('\n')}

Răspunde EXCLUSIV cu JSON valid, fără markdown, în forma:
{
  "merchant": "string",
  "date": "YYYY-MM-DD sau null",
  "currency": "RON",
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
      const message=openaiPayload.error?.message??'OpenAI API a refuzat analiza bonului.'
      throw new Error(`OpenAI API: ${message}`)
    }

    const outputText=openaiPayload.output
      ?.flatMap(item=>item.content??[])
      .find(item=>item.type==='output_text'&&typeof item.text==='string')
      ?.text

    if(!outputText)throw new Error('OpenAI API nu a returnat rezultatul analizei.')

    const parsed=jsonFromText(outputText) as {
      merchant?:unknown
      date?:unknown
      currency?:unknown
      total?:unknown
      items?:unknown
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

    if(!items.length)return NextResponse.json({error:'Nu am putut identifica produsele de pe bon.'},{status:422})

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
    const warnings=Array.isArray(parsed.warnings)?parsed.warnings.map(String).filter(Boolean):[]
    if(Math.abs(difference)>.05)warnings.push(`Produsele însumează ${itemsTotal.toFixed(2)} ${String(parsed.currency??'RON')}, iar totalul bonului este ${total.toFixed(2)}.`)

    const analysis:ReceiptAnalysis={
      merchant:String(parsed.merchant??'Bon').trim()||'Bon',
      date:typeof parsed.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)?parsed.date:null,
      currency:String(parsed.currency??'RON').trim().toUpperCase()||'RON',
      total,
      items,
      splits,
      balanced:Math.abs(difference)<=.05&&total>0,
      difference,
      warnings,
    }

    return NextResponse.json(analysis)
  }catch(error){
    console.error('Receipt analysis failed',error)
    const message=error instanceof Error?error.message:'Analiza bonului a eșuat.'
    const lower=message.toLowerCase()
    if(lower.includes('openai api')&&(lower.includes('insufficient_quota')||lower.includes('quota')||lower.includes('billing'))){
      return NextResponse.json({
        error:'OpenAI API nu are credit disponibil. Adaugă billing/credit în OpenAI Platform, apoi apasă din nou „Analizează”. Bonul rămâne salvat.',
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
