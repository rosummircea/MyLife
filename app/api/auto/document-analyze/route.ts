import {NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'

export const runtime='nodejs'
export const maxDuration=60

const AUTO_TYPES=[
  'asigurare_auto_rca',
  'asigurare_auto_casco',
  'certificat_inmatriculare',
  'carte_identitate_vehicul',
  'rovinieta',
  'document_auto',
] as const

type AutoType=(typeof AUTO_TYPES)[number]

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

function textOrNull(value:unknown){
  if(typeof value!=='string')return null
  const trimmed=value.trim()
  return trimmed||null
}

function dateOrNull(value:unknown){
  if(typeof value!=='string')return null
  const trimmed=value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed)?trimmed:null
}

function autoType(value:unknown):AutoType{
  const candidate=typeof value==='string'?value.trim() as AutoType:'document_auto'
  return AUTO_TYPES.includes(candidate)?candidate:'document_auto'
}

function bucharestToday(){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(new Date())
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export async function POST(request:Request){
  try{
    const authorization=request.headers.get('authorization')??''
    const token=authorization.startsWith('Bearer ')?authorization.slice(7):''
    if(!token)return NextResponse.json({error:'Autentificare necesară.'},{status:401})

    const body=await request.json() as {documentId?:string}
    const documentId=body.documentId?.trim()??''
    if(!documentId)return NextResponse.json({error:'Lipsește documentul de analizat.'},{status:400})

    const url=process.env.NEXT_PUBLIC_SUPABASE_URL
    const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const openaiKey=process.env.OPENAI_API_KEY
    if(!url||!key)return NextResponse.json({error:'Supabase nu este configurat pe server.'},{status:500})
    if(!openaiKey)return NextResponse.json({error:'Analiza AI nu este configurată pe server.'},{status:503})

    const supabase=createClient(url,key,{
      auth:{persistSession:false,autoRefreshToken:false},
      global:{headers:{Authorization:`Bearer ${token}`}},
    })
    const {data:{user},error:userError}=await supabase.auth.getUser(token)
    if(userError||!user)return NextResponse.json({error:'Sesiunea nu mai este validă.'},{status:401})

    const {data:document,error:documentError}=await supabase.from('documents')
      .select('id,document_type,source_filename,mime_type,storage_path,issued_at,expires_at,issuing_country,issuing_authority,document_date,issuer,notes,extra')
      .eq('id',documentId)
      .eq('user_id',user.id)
      .maybeSingle()

    if(documentError)return NextResponse.json({error:documentError.message},{status:403})
    if(!document)return NextResponse.json({error:'Documentul nu există.'},{status:404})
    if(!document.storage_path)return NextResponse.json({error:'Documentul nu are fișier atașat.'},{status:400})

    const {data:signed,error:signedError}=await supabase.storage
      .from('mylife-documents')
      .createSignedUrl(document.storage_path.replace(/^mylife-documents\//,''),300)
    if(signedError||!signed?.signedUrl)return NextResponse.json({error:signedError?.message??'Fișierul nu poate fi citit.'},{status:400})

    const today=bucharestToday()
    const prompt=`Analizează acest document auto pentru aplicația personală MyLife.

Scop: completează automat metadatele documentului, fără să inventezi informații.
Astăzi este ${today} în Europe/Bucharest.

Clasifică document_type folosind EXACT una dintre valorile:
- asigurare_auto_rca
- asigurare_auto_casco
- certificat_inmatriculare
- carte_identitate_vehicul
- rovinieta
- document_auto

Reguli:
- issued_at = data emiterii / începutului valabilității numai dacă este explicită.
- expires_at = data expirării / "valabil până la" numai dacă este explicită. Pentru talon/CIV fără termen, null.
- document_date = data principală a documentului dacă este explicită; altfel null.
- issuer = compania/instituția emitentă.
- issuing_country = cod ISO-2 (ex. RO) doar dacă este clar.
- issuing_authority = autoritatea emitentă dacă este distinctă.
- policy_number = numărul poliței / documentului, dacă este lizibil.
- registration_number = numărul de înmatriculare dacă apare.
- vin = seria VIN dacă apare.
- Nu deduce date lipsă din cunoștințe generale.
- confidence între 0 și 1 reflectă cât de sigură este extracția.
- notes trebuie să fie o propoziție scurtă doar dacă există ceva util care nu încape în câmpurile de mai sus.

Răspunde EXCLUSIV cu JSON valid:
{
  "document_type":"document_auto",
  "issued_at":null,
  "expires_at":null,
  "document_date":null,
  "issuer":null,
  "issuing_country":null,
  "issuing_authority":null,
  "policy_number":null,
  "registration_number":null,
  "vin":null,
  "notes":null,
  "confidence":0.0
}`

    const mime=(document.mime_type||'').toLowerCase()
    const extension=(document.source_filename||document.storage_path).split('.').pop()?.toLowerCase()
    const isPdf=mime==='application/pdf'||extension==='pdf'
    const isImage=mime.startsWith('image/')||['jpg','jpeg','png','webp','gif','avif'].includes(extension??'')
    if(!isPdf&&!isImage)return NextResponse.json({error:'AI poate analiza momentan PDF, JPG, PNG și WebP.'},{status:415})

    const filePart=isPdf
      ?{type:'input_file',file_url:signed.signedUrl,detail:'high'}
      :{type:'input_image',image_url:signed.signedUrl,detail:'high'}

    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{Authorization:`Bearer ${openaiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'gpt-5.6-terra',
        reasoning:{effort:'none'},
        input:[{role:'user',content:[{type:'input_text',text:prompt},filePart]}],
        text:{format:{type:'json_object'}},
      }),
    })

    const payload=await response.json() as {
      output?:Array<{content?:Array<{type?:string;text?:string}>}>
      error?:{message?:string}
    }
    if(!response.ok){
      return NextResponse.json({error:payload.error?.message??'AI nu a putut analiza documentul.'},{status:502})
    }

    const outputText=payload.output
      ?.flatMap(item=>item.content??[])
      .find(item=>item.type==='output_text'&&typeof item.text==='string')
      ?.text
    if(!outputText)return NextResponse.json({error:'AI nu a returnat rezultatul analizei.'},{status:502})

    const parsed=jsonFromText(outputText) as Record<string,unknown>
    const nextExtra={
      ...(document.extra&&typeof document.extra==='object'?document.extra:{}),
      ai_analyzed_at:new Date().toISOString(),
      ai_confidence:Math.max(0,Math.min(1,Number(parsed.confidence)||0)),
      ...(textOrNull(parsed.policy_number)?{policy_number:textOrNull(parsed.policy_number)}:{}),
      ...(textOrNull(parsed.registration_number)?{registration_number:textOrNull(parsed.registration_number)}:{}),
      ...(textOrNull(parsed.vin)?{vin:textOrNull(parsed.vin)}:{}),
    }

    const detectedType=autoType(parsed.document_type)
    const update={
      document_type:detectedType==='document_auto'&&document.document_type!=='document_auto'?document.document_type:detectedType,
      issued_at:dateOrNull(parsed.issued_at)??document.issued_at,
      expires_at:dateOrNull(parsed.expires_at)??document.expires_at,
      document_date:dateOrNull(parsed.document_date)??document.document_date,
      issuer:textOrNull(parsed.issuer)??document.issuer,
      issuing_country:textOrNull(parsed.issuing_country)?.toUpperCase()??document.issuing_country,
      issuing_authority:textOrNull(parsed.issuing_authority)??document.issuing_authority,
      notes:textOrNull(parsed.notes)??document.notes,
      extra:nextExtra,
    }

    const {data:saved,error:saveError}=await supabase.from('documents')
      .update(update)
      .eq('id',document.id)
      .eq('user_id',user.id)
      .select('id,document_type,source_filename,mime_type,storage_path,issued_at,expires_at,issuing_country,issuing_authority,document_date,issuer,notes,extra')
      .single()

    if(saveError)return NextResponse.json({error:saveError.message},{status:403})
    return NextResponse.json({document:saved,confidence:nextExtra.ai_confidence})
  }catch(error){
    console.error('Auto document AI analysis failed',error)
    return NextResponse.json({error:error instanceof Error?error.message:'Analiza AI a documentului a eșuat.'},{status:500})
  }
}
