import {NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'

export const runtime='nodejs'
export const maxDuration=60

const TYPES=['health_lab','health_imaging','health_prescription','health_discharge','health_consultation','health_other'] as const
type DocType=(typeof TYPES)[number]

function cleanText(value:unknown){return typeof value==='string'&&value.trim()?value.trim():null}
function cleanDate(value:unknown){const v=cleanText(value);return v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null}
function docType(value:unknown):DocType{const v=cleanText(value) as DocType|null;return v&&TYPES.includes(v)?v:'health_other'}
function jsonFromText(text:string){const trimmed=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{return JSON.parse(trimmed)}catch{const a=trimmed.indexOf('{'),b=trimmed.lastIndexOf('}');if(a<0||b<=a)throw new Error('Modelul nu a returnat JSON valid.');return JSON.parse(trimmed.slice(a,b+1))}}

export async function POST(request:Request){
  try{
    const authorization=request.headers.get('authorization')??''
    const token=authorization.startsWith('Bearer ')?authorization.slice(7):''
    if(!token)return NextResponse.json({error:'Autentificare necesară.'},{status:401})
    const body=await request.json() as {documentId?:string}
    const documentId=body.documentId?.trim()??''
    if(!documentId)return NextResponse.json({error:'Lipsește documentul.'},{status:400})

    const url=process.env.NEXT_PUBLIC_SUPABASE_URL
    const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const openaiKey=process.env.OPENAI_API_KEY
    if(!url||!key)return NextResponse.json({error:'Supabase nu este configurat.'},{status:500})
    if(!openaiKey)return NextResponse.json({error:'Analiza AI nu este configurată.'},{status:503})

    const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}})
    const {data:{user},error:userError}=await supabase.auth.getUser(token)
    if(userError||!user)return NextResponse.json({error:'Sesiunea nu este validă.'},{status:401})

    const {data:document,error:documentError}=await supabase.from('documents')
      .select('id,document_type,source_filename,mime_type,storage_path,document_date,issuer,notes,extra')
      .eq('id',documentId).eq('user_id',user.id).maybeSingle()
    if(documentError)return NextResponse.json({error:documentError.message},{status:403})
    if(!document||document.extra?.domain!=='health')return NextResponse.json({error:'Documentul medical nu există.'},{status:404})
    if(!document.storage_path)return NextResponse.json({error:'Documentul nu are fișier atașat.'},{status:400})

    const {data:signed,error:signedError}=await supabase.storage.from('mylife-documents').createSignedUrl(document.storage_path.replace(/^mylife-documents\//,''),300)
    if(signedError||!signed?.signedUrl)return NextResponse.json({error:'Fișierul nu poate fi citit.'},{status:400})

    const mime=(document.mime_type||'').toLowerCase()
    const ext=(document.source_filename||document.storage_path).split('.').pop()?.toLowerCase()
    const isPdf=mime==='application/pdf'||ext==='pdf'
    const isImage=mime.startsWith('image/')||['jpg','jpeg','png','webp'].includes(ext??'')
    if(!isPdf&&!isImage)return NextResponse.json({error:'Sunt acceptate PDF, JPG, PNG și WebP.'},{status:415})

    const prompt=`Analizează documentul medical atașat exclusiv pentru organizare în aplicația personală MyLife.

Nu formula diagnostic nou, nu da recomandări medicale și nu interpreta dacă valorile sunt bune sau rele.
Extrage doar informații explicite din document.

document_type trebuie să fie exact una dintre:
- health_lab
- health_imaging
- health_prescription
- health_discharge
- health_consultation
- health_other

health_category trebuie să fie una dintre: lab, imaging, prescription, discharge, consultation, other.

title: titlu uman foarte scurt (ex. "Analize sânge", "RMN genunchi", "Rețetă cardiologie").
issuer: laboratorul, clinica, spitalul sau medicul emitent dacă este explicit.
document_date: YYYY-MM-DD doar dacă data este explicită.
summary: maximum două propoziții, strict factual, descriind ce tip de document este și ce conține la nivel general. Fără concluzii clinice proprii.
confidence: 0..1.

Răspunde exclusiv JSON:
{"document_type":"health_other","health_category":"other","title":null,"issuer":null,"document_date":null,"summary":null,"confidence":0}`

    const filePart=isPdf?{type:'input_file',file_url:signed.signedUrl}:{type:'input_image',image_url:signed.signedUrl,detail:'high'}
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{Authorization:`Bearer ${openaiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'gpt-5.6-terra',reasoning:{effort:'none'},input:[{role:'user',content:[{type:'input_text',text:prompt},filePart]}],text:{format:{type:'json_object'}}}),
    })
    const payload=await response.json() as {output?:Array<{content?:Array<{type?:string;text?:string}>}>;error?:{message?:string}}
    if(!response.ok)return NextResponse.json({error:payload.error?.message??'AI nu a putut analiza documentul.'},{status:502})
    const output=payload.output?.flatMap(item=>item.content??[]).find(item=>item.type==='output_text'&&typeof item.text==='string')?.text
    if(!output)return NextResponse.json({error:'AI nu a returnat rezultatul.'},{status:502})
    const parsed=jsonFromText(output) as Record<string,unknown>

    const nextExtra={
      ...(document.extra&&typeof document.extra==='object'?document.extra:{}),
      domain:'health',
      health_category:cleanText(parsed.health_category)??document.extra?.health_category??'other',
      health_title:cleanText(parsed.title)??document.extra?.health_title??document.source_filename??'Document medical',
      ai_analyzed_at:new Date().toISOString(),
      ai_confidence:Math.max(0,Math.min(1,Number(parsed.confidence)||0)),
    }
    const update={
      document_type:docType(parsed.document_type),
      issuer:cleanText(parsed.issuer)??document.issuer,
      document_date:cleanDate(parsed.document_date)??document.document_date,
      notes:cleanText(parsed.summary)??document.notes,
      extra:nextExtra,
      updated_at:new Date().toISOString(),
    }
    const {data:saved,error:saveError}=await supabase.from('documents').update(update).eq('id',document.id).eq('user_id',user.id).select('*').single()
    if(saveError)return NextResponse.json({error:saveError.message},{status:403})
    return NextResponse.json({document:saved})
  }catch(error){
    console.error('Health document analysis failed',error)
    return NextResponse.json({error:error instanceof Error?error.message:'Analiza documentului a eșuat.'},{status:500})
  }
}
