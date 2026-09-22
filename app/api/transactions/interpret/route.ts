import {NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'

export const runtime='nodejs'
export const maxDuration=60

type CategoryRow={
  id:string
  name:string
  parent_id:string|null
  kind:string
  is_active:boolean
}
type AccountRow={
  id:string
  name:string
  currency:string
  institution:string|null
  account_type:string
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

function bucharestToday(){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Europe/Bucharest',
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
  }).formatToParts(new Date())
  const value=Object.fromEntries(parts.map(part=>[part.type,part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function jsonFromText(text:string){
  const trimmed=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')
  try{return JSON.parse(trimmed)}
  catch{
    const start=trimmed.indexOf('{')
    const end=trimmed.lastIndexOf('}')
    if(start<0||end<=start)throw new Error('Modelul nu a returnat JSON valid.')
    return JSON.parse(trimmed.slice(start,end+1))
  }
}

export async function POST(request:Request){
  try{
    const authorization=request.headers.get('authorization')??''
    const token=authorization.startsWith('Bearer ')?authorization.slice(7):''
    if(!token)return NextResponse.json({error:'Autentificare necesară.'},{status:401})

    const body=await request.json() as {text?:string;householdId?:string}
    const text=body.text?.trim()??''
    if(!text)return NextResponse.json({error:'Scrie sau dictează tranzacția.'},{status:400})
    if(text.length>4000)return NextResponse.json({error:'Textul este prea lung.'},{status:400})
    if(!body.householdId)return NextResponse.json({error:'Lipsește familia MyLife.'},{status:400})

    const url=process.env.NEXT_PUBLIC_SUPABASE_URL
    const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if(!url||!key)return NextResponse.json({error:'Supabase nu este configurat pe server.'},{status:500})

    const supabase=createClient(url,key,{
      auth:{persistSession:false,autoRefreshToken:false},
      global:{headers:{Authorization:`Bearer ${token}`}},
    })
    const {data:{user},error:userError}=await supabase.auth.getUser(token)
    if(userError||!user)return NextResponse.json({error:'Sesiunea nu mai este validă.'},{status:401})

    const [{data:accounts,error:accountsError},{data:categories,error:categoriesError}]=await Promise.all([
      supabase.from('finance_accounts')
        .select('id,name,currency,institution,account_type,is_active')
        .eq('household_id',body.householdId)
        .eq('is_active',true)
        .order('name'),
      supabase.from('finance_categories')
        .select('id,name,parent_id,kind,is_active')
        .or(`household_id.eq.${body.householdId},household_id.is.null`)
        .in('kind',['expense','income'])
        .eq('is_active',true)
        .order('name'),
    ])
    if(accountsError)return NextResponse.json({error:accountsError.message},{status:403})
    if(categoriesError)return NextResponse.json({error:categoriesError.message},{status:403})
    if(!accounts?.length)return NextResponse.json({error:'Nu există conturi active în MyLife.'},{status:400})

    const accountRows=accounts as AccountRow[]
    const categoryRows=(categories??[]) as CategoryRow[]
    const byCategoryId=new Map(categoryRows.map(category=>[category.id,category]))
    const categoryOptions=categoryRows.map(category=>({
      id:category.id,
      kind:category.kind,
      path:categoryPath(category,byCategoryId),
    }))
    const today=bucharestToday()

    const prompt=`Interpretează textul utilizatorului ca o singură tranzacție financiară MyLife.
Textul este în principal în limba română. Data de azi în România este ${today}.

TEXT:
${text}

CONTURI DISPONIBILE:
${accountRows.map(account=>`${account.id} | ${account.name} | ${account.institution??'-'} | ${account.currency} | ${account.account_type}`).join('\n')}

CATEGORII DISPONIBILE:
${categoryOptions.map(category=>`${category.id} | ${category.kind} | ${category.path}`).join('\n')}

Reguli:
- transaction_type trebuie să fie expense, income sau transfer.
- amount este o sumă pozitivă. Nu inventa suma dacă nu este menționată: folosește 0 și adaugă warning.
- Interpretează expresii precum azi, ieri, alaltăieri folosind data de azi de mai sus.
- day trebuie să fie YYYY-MM-DD.
- Folosește account_id numai din lista de conturi și numai când textul îl indică suficient de clar. Altfel null.
- Pentru transfer, transfer_account_id este contul destinație și trebuie să fie diferit de account_id. Altfel null.
- Dacă moneda nu este spusă, folosește moneda contului identificat; dacă nu există cont identificat, folosește RON.
- Pentru expense sau income, category_id trebuie să fie exact un UUID din categoria corespunzătoare tipului. Alege categoria semantic cea mai potrivită. Dacă nu este clar, preferă o categorie numită Necategorizat dacă există.
- Pentru transfer, category_id trebuie să fie null.
- merchant este comerciantul sau contrapartea, dacă apare.
- title trebuie să fie scurt, natural și util în listă.
- description păstrează contextul util din textul original.
- confidence este între 0 și 1.
- Nu inventa conturi, comercianți sau detalii care nu pot fi deduse.

Răspunde EXCLUSIV cu JSON valid:
{
  "transaction_type":"expense",
  "amount":0,
  "currency":"RON",
  "day":"YYYY-MM-DD",
  "title":"string",
  "merchant":"string",
  "description":"string",
  "account_id":null,
  "transfer_account_id":null,
  "category_id":null,
  "confidence":0.9,
  "warnings":[]
}`

    const openaiKey=process.env.OPENAI_API_KEY
    if(!openaiKey)return NextResponse.json({error:'OpenAI API nu este configurat pe server.'},{status:503})

    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{
        Authorization:`Bearer ${openaiKey}`,
        'Content-Type':'application/json',
      },
      body:JSON.stringify({
        model:'gpt-5.6-luna',
        reasoning:{effort:'none'},
        input:[{role:'user',content:[{type:'input_text',text:prompt}]}],
        text:{format:{type:'json_object'}},
      }),
    })

    const payload=await response.json() as {
      output?:Array<{content?:Array<{type?:string;text?:string}>}>
      error?:{message?:string}
    }
    if(!response.ok){
      const message=payload.error?.message??'OpenAI nu a putut interpreta tranzacția.'
      return NextResponse.json({error:message},{status:502})
    }

    const outputText=payload.output
      ?.flatMap(item=>item.content??[])
      .find(item=>item.type==='output_text'&&typeof item.text==='string')
      ?.text
    if(!outputText)return NextResponse.json({error:'OpenAI nu a returnat interpretarea tranzacției.'},{status:502})

    const parsed=jsonFromText(outputText) as Record<string,unknown>
    const transactionType=['expense','income','transfer'].includes(String(parsed.transaction_type))
      ?String(parsed.transaction_type)
      :'expense'
    const amountNumber=Number(parsed.amount)
    const amount=Number.isFinite(amountNumber)&&amountNumber>=0?Math.round(amountNumber*100)/100:0

    const accountIds=new Set(accountRows.map(account=>account.id))
    const requestedAccount=typeof parsed.account_id==='string'&&accountIds.has(parsed.account_id)?parsed.account_id:null
    let requestedTransfer=typeof parsed.transfer_account_id==='string'&&accountIds.has(parsed.transfer_account_id)?parsed.transfer_account_id:null
    if(requestedTransfer===requestedAccount)requestedTransfer=null

    const selectedAccount=requestedAccount?accountRows.find(account=>account.id===requestedAccount):undefined
    const parsedCurrency=typeof parsed.currency==='string'?parsed.currency.trim().toUpperCase():''
    const currency=/^[A-Z]{3}$/.test(parsedCurrency)?parsedCurrency:(selectedAccount?.currency.trim().toUpperCase()||'RON')
    const day=typeof parsed.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(parsed.day)?parsed.day:today

    let categoryId:null|string=null
    if(transactionType!=='transfer'){
      const requestedCategory=typeof parsed.category_id==='string'?parsed.category_id:null
      const validRequested=requestedCategory
        ?categoryOptions.find(category=>category.id===requestedCategory&&category.kind===transactionType)
        :undefined
      const uncategorized=categoryOptions.find(category=>
        category.kind===transactionType&&category.path.toLocaleLowerCase('ro').split(' → ').pop()==='necategorizat'
      )
      categoryId=validRequested?.id??uncategorized?.id??categoryOptions.find(category=>category.kind===transactionType)?.id??null
    }

    const warnings=Array.isArray(parsed.warnings)?parsed.warnings.map(String).filter(Boolean):[]
    if(!amount)warnings.push('Nu am identificat sigur suma. Completeaz-o înainte de salvare.')
    if(!requestedAccount)warnings.push(transactionType==='transfer'?'Alege contul sursă înainte de salvare.':'Alege contul folosit înainte de salvare.')
    if(transactionType==='transfer'&&!requestedTransfer)warnings.push('Alege contul destinație înainte de salvare.')

    return NextResponse.json({
      transaction_type:transactionType,
      amount,
      currency,
      day,
      title:String(parsed.title??'').trim(),
      merchant:String(parsed.merchant??'').trim(),
      description:String(parsed.description??text).trim()||text,
      account_id:requestedAccount,
      transfer_account_id:transactionType==='transfer'?requestedTransfer:null,
      category_id:categoryId,
      confidence:Math.max(0,Math.min(1,Number(parsed.confidence)||0)),
      warnings:[...new Set(warnings)],
    })
  }catch(error){
    console.error('Natural language transaction interpretation failed',error)
    return NextResponse.json({error:error instanceof Error?error.message:'Textul nu a putut fi interpretat.'},{status:500})
  }
}
