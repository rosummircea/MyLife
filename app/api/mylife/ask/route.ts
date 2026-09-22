import {NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'

export const runtime='nodejs'
export const maxDuration=60

type Intent={
  intent:'open_document'|'spending'|'account_balance'|'help'|'unsupported'
  period?:'today'|'yesterday'|'this_week'|'this_month'
  document_query?:string
  account_query?:string
}

function jsonFromText(text:string){
  const trimmed=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')
  try{return JSON.parse(trimmed)}
  catch{
    const start=trimmed.indexOf('{'),end=trimmed.lastIndexOf('}')
    if(start<0||end<=start)throw new Error('Modelul nu a returnat JSON valid.')
    return JSON.parse(trimmed.slice(start,end+1))
  }
}

function normalized(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('ro').replace(/[^a-z0-9]+/g,' ').trim()
}

function bucharestDay(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(date)
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function addDays(day:string,delta:number){
  const [year,month,date]=day.split('-').map(Number)
  return new Date(Date.UTC(year,month-1,date+delta)).toISOString().slice(0,10)
}

function weekdayMondayZero(day:string){
  const jsDay=new Date(`${day}T12:00:00Z`).getUTCDay()
  return (jsDay+6)%7
}

function bucharestOffsetMs(utc:Date){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Europe/Bucharest',
    year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',
    hourCycle:'h23',
  }).formatToParts(utc)
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]))
  const asUtc=Date.UTC(
    Number(values.year),Number(values.month)-1,Number(values.day),
    Number(values.hour),Number(values.minute),Number(values.second)
  )
  return asUtc-utc.getTime()
}

function bucharestMidnightUtc(day:string){
  const nominal=new Date(`${day}T00:00:00Z`)
  let offset=bucharestOffsetMs(nominal)
  let result=new Date(nominal.getTime()-offset)
  const corrected=bucharestOffsetMs(result)
  if(corrected!==offset){
    offset=corrected
    result=new Date(nominal.getTime()-offset)
  }
  return result
}

function periodRange(period:Intent['period']){
  const today=bucharestDay()
  let start=today
  let end=addDays(today,1)
  if(period==='yesterday'){
    start=addDays(today,-1)
    end=today
  }else if(period==='this_week'){
    start=addDays(today,-weekdayMondayZero(today))
  }else if(period==='this_month'){
    start=`${today.slice(0,7)}-01`
  }
  return {start,end,startIso:bucharestMidnightUtc(start).toISOString(),endIso:bucharestMidnightUtc(end).toISOString()}
}

function periodLabel(period:Intent['period']){
  if(period==='yesterday')return 'Ieri'
  if(period==='this_week')return 'Săptămâna aceasta'
  if(period==='this_month')return 'Luna aceasta'
  return 'Astăzi'
}

function documentTypeHint(query:string){
  const q=normalized(query)
  if(/\brca\b/.test(q)||q.includes('asigurare auto obligatorie'))return 'asigurare_auto_rca'
  if(/\bcasco\b/.test(q))return 'asigurare_auto_casco'
  if(/\bpad\b/.test(q)||q.includes('asigurare locuinta'))return 'asigurare_locuinta_pad'
  if(/\bbuletin\b/.test(q)||q.includes('carte identitate')||q==='ci')return 'carte_identitate'
  if(/\bfactura\b/.test(q)||/\bbon\b/.test(q))return 'invoice'
  return null
}

function scoreDocument(row:{document_type:string;source_filename:string|null;issuer:string|null;notes:string|null},query:string){
  const needle=normalized(query)
  const typeHint=documentTypeHint(query)
  let score=typeHint&&row.document_type===typeHint?100:0
  const fields=[row.document_type,row.source_filename??'',row.issuer??'',row.notes??''].map(normalized)
  for(const field of fields){
    if(!field)continue
    if(field===needle)score=Math.max(score,90)
    else if(field.includes(needle)||needle.includes(field))score=Math.max(score,60)
    for(const token of needle.split(' ').filter(token=>token.length>2))if(field.includes(token))score+=5
  }
  return score
}

async function classifyQuestion(question:string,openaiKey:string):Promise<Intent>{
  const today=bucharestDay()
  const prompt=`Clasifică întrebarea utilizatorului către aplicația personală MyLife.
Limba este română. Astăzi în România este ${today}.

ÎNTREBARE:
${question}

Intenții acceptate:
- open_document: utilizatorul vrea să găsească/deschidă un document personal. Pune termenul relevant în document_query.
- spending: utilizatorul întreabă cât a cheltuit. period trebuie să fie today, yesterday, this_week sau this_month.
- account_balance: utilizatorul întreabă soldul/câți bani are într-un cont. Pune numele sugerat în account_query.
- help: întreabă ce poate face această funcție.
- unsupported: orice altceva.

Nu răspunde la întrebare și nu inventa date personale. Doar clasifică.

JSON exclusiv:
{"intent":"spending","period":"today","document_query":"","account_query":""}`

  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{Authorization:`Bearer ${openaiKey}`,'Content-Type':'application/json'},
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
  if(!response.ok)throw new Error(payload.error?.message??'OpenAI nu a putut interpreta întrebarea.')
  const outputText=payload.output?.flatMap(item=>item.content??[]).find(item=>item.type==='output_text'&&typeof item.text==='string')?.text
  if(!outputText)throw new Error('OpenAI nu a returnat clasificarea întrebării.')
  return jsonFromText(outputText) as Intent
}

export async function POST(request:Request){
  try{
    const authorization=request.headers.get('authorization')??''
    const token=authorization.startsWith('Bearer ')?authorization.slice(7):''
    if(!token)return NextResponse.json({error:'Autentificare necesară.'},{status:401})

    const body=await request.json() as {question?:string}
    const question=body.question?.trim()??''
    if(!question)return NextResponse.json({error:'Scrie întrebarea pentru MyLife.'},{status:400})
    if(question.length>1000)return NextResponse.json({error:'Întrebarea este prea lungă.'},{status:400})

    const url=process.env.NEXT_PUBLIC_SUPABASE_URL
    const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const openaiKey=process.env.OPENAI_API_KEY
    if(!url||!key)return NextResponse.json({error:'Supabase nu este configurat pe server.'},{status:500})
    if(!openaiKey)return NextResponse.json({error:'OpenAI API nu este configurat pe server.'},{status:503})

    const supabase=createClient(url,key,{
      auth:{persistSession:false,autoRefreshToken:false},
      global:{headers:{Authorization:`Bearer ${token}`}},
    })
    const {data:{user},error:userError}=await supabase.auth.getUser(token)
    if(userError||!user)return NextResponse.json({error:'Sesiunea nu mai este validă.'},{status:401})

    const intent=await classifyQuestion(question,openaiKey)

    if(intent.intent==='help'){
      return NextResponse.json({
        kind:'text',
        answer:'Poți întreba, de exemplu: „Deschide RCA”, „Cât am cheltuit azi?”, „Cât am cheltuit luna aceasta?” sau „Câți bani am în Revolut?”.',
      })
    }

    if(intent.intent==='open_document'){
      const {data:documents,error:documentsError}=await supabase.from('documents')
        .select('id,document_type,source_filename,issuer,notes,storage_path,expires_at,document_date,created_at')
        .eq('user_id',user.id)
        .order('created_at',{ascending:false})
      if(documentsError)throw new Error(documentsError.message)

      const query=(intent.document_query||question).trim()
      const ranked=(documents??[])
        .filter(document=>document.storage_path)
        .map(document=>({document,score:scoreDocument(document,query)}))
        .filter(item=>item.score>0)
        .sort((a,b)=>b.score-a.score)

      if(!ranked.length){
        return NextResponse.json({kind:'text',answer:`Nu am găsit în MyLife un document care să corespundă cu „${query}”.`})
      }

      const chosen=ranked[0].document
      const {data:signed,error:signedError}=await supabase.storage.from('mylife-documents').createSignedUrl(chosen.storage_path!,300)
      if(signedError||!signed?.signedUrl)throw new Error(signedError?.message??'Documentul nu a putut fi deschis.')

      const label=chosen.source_filename||chosen.issuer||chosen.document_type.replaceAll('_',' ')
      return NextResponse.json({
        kind:'document',
        answer:`Am găsit documentul „${label}”. Linkul securizat este valabil 5 minute.`,
        document:{
          id:chosen.id,
          label,
          documentType:chosen.document_type,
          signedUrl:signed.signedUrl,
          expiresAt:chosen.expires_at,
          documentDate:chosen.document_date,
        },
      })
    }

    const {data:person,error:personError}=await supabase.from('people')
      .select('id').eq('auth_user_id',user.id).maybeSingle()
    if(personError)throw new Error(personError.message)
    if(!person)return NextResponse.json({error:'Profilul MyLife nu este asociat contului.'},{status:403})
    const {data:membership,error:membershipError}=await supabase.from('household_members')
      .select('household_id').eq('person_id',person.id).eq('status','active').order('joined_at').limit(1).maybeSingle()
    if(membershipError)throw new Error(membershipError.message)
    if(!membership)return NextResponse.json({error:'Nu există o familie MyLife activă.'},{status:403})
    const householdId=membership.household_id

    if(intent.intent==='spending'){
      const period=intent.period&&['today','yesterday','this_week','this_month'].includes(intent.period)?intent.period:'today'
      const range=periodRange(period)
      const {data:transactions,error:transactionsError}=await supabase.from('finance_transactions')
        .select('amount,currency')
        .eq('household_id',householdId)
        .eq('transaction_type','expense')
        .eq('status','posted')
        .gte('transaction_date',range.startIso)
        .lt('transaction_date',range.endIso)
      if(transactionsError)throw new Error(transactionsError.message)

      const totals=new Map<string,{cents:number;count:number}>()
      for(const transaction of transactions??[]){
        const currency=String(transaction.currency||'RON').trim().toUpperCase()
        const current=totals.get(currency)??{cents:0,count:0}
        current.cents+=Math.round(Number(transaction.amount)*100)
        current.count+=1
        totals.set(currency,current)
      }
      if(!totals.size)return NextResponse.json({kind:'text',answer:`${periodLabel(period)} nu ai nicio cheltuială înregistrată în MyLife.`})
      const parts=[...totals.entries()].map(([currency,value])=>
        `${new Intl.NumberFormat('ro-RO',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value.cents/100)} ${currency} (${value.count} ${value.count===1?'tranzacție':'tranzacții'})`
      )
      return NextResponse.json({kind:'text',answer:`${periodLabel(period)} ai cheltuit ${parts.join(' și ')}.`})
    }

    if(intent.intent==='account_balance'){
      const {data:accounts,error:accountsError}=await supabase.from('finance_accounts')
        .select('id,name,currency,institution,account_type')
        .eq('household_id',householdId)
        .eq('is_active',true)
        .order('name')
      if(accountsError)throw new Error(accountsError.message)
      const query=normalized(intent.account_query||question)
      const matches=(accounts??[]).map(account=>{
        const haystack=normalized(`${account.name} ${account.institution??''} ${account.account_type}`)
        let score=0
        if(haystack===query)score=100
        else if(haystack.includes(query)||query.includes(normalized(account.name)))score=70
        for(const token of query.split(' ').filter(token=>token.length>2))if(haystack.includes(token))score+=5
        return {account,score}
      }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score)

      if(!matches.length)return NextResponse.json({kind:'text',answer:'Nu am identificat contul. Spune numele lui, de exemplu „Câți bani am în Revolut Mircea?”.'})
      const account=matches[0].account
      const {data:balance,error:balanceError}=await supabase.rpc('finance_account_balance',{p_account_id:account.id})
      if(balanceError)throw new Error(balanceError.message)
      const value=Number(balance??0)
      return NextResponse.json({
        kind:'text',
        answer:`Soldul actual pentru ${account.name} este ${new Intl.NumberFormat('ro-RO',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value)} ${account.currency.trim()}.`,
      })
    }

    return NextResponse.json({
      kind:'text',
      answer:'Întrebarea este clară, dar încă nu am o acțiune MyLife pentru ea. Momentan pot deschide documente, calcula cheltuieli pe perioade și spune soldul unui cont.',
    })
  }catch(error){
    console.error('MyLife question failed',error)
    return NextResponse.json({error:error instanceof Error?error.message:'Întrebarea nu a putut fi procesată.'},{status:500})
  }
}
