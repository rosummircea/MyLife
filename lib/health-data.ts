import type { SupabaseClient } from '@supabase/supabase-js'
import type { DocumentRow } from './mylife-data'

export type HealthVisit={
  id:string
  user_id:string
  doctor_name:string|null
  specialty:string
  clinic:string|null
  scheduled_at:string
  status:'planned'|'completed'|'cancelled'
  notes:string|null
  summary:string|null
  extra:Record<string,unknown>
  created_at:string
  updated_at:string
}

export type HealthMetricType=
  |'resting_heart_rate'
  |'sleep_duration'
  |'respiratory_rate'
  |'vo2_max'
  |'steps'
  |'weight'
  |'spo2'
  |'blood_pressure'

export type HealthMeasurement={
  id:string
  user_id:string
  metric_type:HealthMetricType
  value:number
  secondary_value:number|null
  unit:string
  measured_at:string
  source:'manual'|'apple_health'|'import'|'device'
  notes:string|null
  extra:Record<string,unknown>
  created_at:string
  updated_at:string
}

export type HealthData={
  visits:HealthVisit[]
  measurements:HealthMeasurement[]
}

export const metricMeta:Record<HealthMetricType,{label:string;unit:string;shortUnit:string}> = {
  resting_heart_rate:{label:'Puls în repaus',unit:'bătăi/min',shortUnit:'bpm'},
  sleep_duration:{label:'Somn',unit:'ore',shortUnit:'h'},
  respiratory_rate:{label:'Rată respiratorie',unit:'respirații/min',shortUnit:'rpm'},
  vo2_max:{label:'VO₂ max',unit:'ml/kg/min',shortUnit:'ml/kg/min'},
  steps:{label:'Pași',unit:'pași',shortUnit:'pași'},
  weight:{label:'Greutate',unit:'kg',shortUnit:'kg'},
  spo2:{label:'Saturație oxigen',unit:'%',shortUnit:'%'},
  blood_pressure:{label:'Tensiune arterială',unit:'mmHg',shortUnit:'mmHg'},
}

export async function loadHealthData(client:SupabaseClient):Promise<HealthData>{
  const {data:auth,error:authError}=await client.auth.getUser()
  if(authError||!auth.user)throw new Error('Sesiunea Supabase nu este validă.')
  const [{data:visits,error:visitsError},{data:measurements,error:measurementsError}]=await Promise.all([
    client.from('health_visits').select('*').eq('user_id',auth.user.id).order('scheduled_at',{ascending:false}),
    client.from('health_measurements').select('*').eq('user_id',auth.user.id).order('measured_at',{ascending:false}).limit(1000),
  ])
  if(visitsError)throw new Error(`Vizite: ${visitsError.message}`)
  if(measurementsError)throw new Error(`Date sănătate: ${measurementsError.message}`)
  return {
    visits:(visits??[]) as HealthVisit[],
    measurements:(measurements??[]).map(item=>({...item,value:Number(item.value),secondary_value:item.secondary_value===null?null:Number(item.secondary_value)})) as HealthMeasurement[],
  }
}

export function healthDocuments(documents:DocumentRow[]){
  return documents.filter(document=>document.extra?.domain==='health')
}

export function healthDocumentTitle(document:DocumentRow){
  const explicit=typeof document.extra?.health_title==='string'?document.extra.health_title.trim():''
  if(explicit)return explicit
  const map:Record<string,string>={
    health_lab:'Analize',
    health_imaging:'Imagistică',
    health_prescription:'Rețetă',
    health_discharge:'Bilet externare',
    health_consultation:'Raport consultație',
    health_other:'Document medical',
  }
  return map[document.document_type]??document.source_filename??'Document medical'
}

export function healthDocumentCategory(document:DocumentRow){
  const category=typeof document.extra?.health_category==='string'?document.extra.health_category:''
  return category||document.document_type.replace(/^health_/,'')
}
