import type { SupabaseClient } from '@supabase/supabase-js'
import type { DocumentRow } from './mylife-data'

export type Vehicle = {
  id: string; make: string | null; model: string | null; year: number | null
  registration_number: string | null; vin: string | null; notes: string | null
  extra: Record<string, unknown>; created_at: string
}
export type VehicleRecord = {
  id: string; vehicle_id: string; record_type: string; issued_at: string | null
  expires_at: string | null; provider: string | null; policy_number: string | null
  notes: string | null; extra: Record<string, unknown>; created_at: string
}
export type VehiclePhoto = { bucket?: string; path?: string; data_url?: string; caption?: string; primary?: boolean }
export type AutoData = { vehicles: Vehicle[]; records: VehicleRecord[] }

export function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : null
}
export function vehicleType(vehicle: Vehicle) {
  const type = vehicle.extra?.vehicle_type
  return type === 'motorcycle' ? 'Motocicletă' : type === 'car' ? 'Mașină' : null
}
export function photos(vehicle: Vehicle): VehiclePhoto[] {
  const items = vehicle.extra?.photos
  if (!Array.isArray(items)) return []
  return items.flatMap((item): VehiclePhoto[] => {
    if (!item || typeof item !== 'object') return []
    const value=item as Record<string,unknown>
    const caption=typeof value.caption === 'string' ? value.caption : undefined
    const primary=value.primary === true
    const dataUrl=text(value.data_url)
    if (dataUrl?.startsWith('data:image/')) return [{data_url:dataUrl,caption,primary}]
    const bucket=text(value.bucket)
    const path=text(value.path)
    if (!bucket || !path) return []
    return [{bucket,path,caption,primary}]
  }).sort((a,b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)))
}
export function vehicleDocuments(vehicleId: string, documents: DocumentRow[]) {
  // Explicit metadata link only; no guesses based on plates, names or PDF titles.
  // Keep the user's manual Auto order in document metadata.
  return documents
    .map((document,index)=>({document,index}))
    .filter(item=>item.document.extra?.vehicle_id===vehicleId)
    .sort((a,b)=>{
      const aOrder=Number(a.document.extra?.auto_order)
      const bOrder=Number(b.document.extra?.auto_order)
      const aHas=Number.isFinite(aOrder)
      const bHas=Number.isFinite(bOrder)
      if(aHas&&bHas&&aOrder!==bOrder)return aOrder-bOrder
      if(aHas!==bHas)return aHas?-1:1
      return a.index-b.index
    })
    .map(item=>item.document)
}
export function recordCost(record: VehicleRecord) {
  const value = record.extra?.cost
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return null
  const amount = Number(value)
  const currency = text(record.extra?.currency)
  return Number.isFinite(amount) && amount >= 0 && currency && /^[A-Z]{3}$/.test(currency) ? { amount, currency } : null
}
export function documentStatus(expires: string | null, today: string) {
  if (!expires) return 'Fără dată expirare'
  const days = (Date.parse(expires.slice(0,10)) - Date.parse(today)) / 86400000
  if (!Number.isFinite(days)) return 'Dată nevalidă'
  return days < 0 ? 'Expirat' : days <= 30 ? 'Expiră curând' : 'Valid'
}
async function rows<T>(query: (from: number, to: number) => PromiseLike<{data: unknown[] | null; error: {message: string} | null}>): Promise<T[]> {
  const result: T[] = []
  for (let from = 0; ; from += 500) {
    const response = await query(from, from + 499)
    if (response.error) throw new Error(response.error.message)
    result.push(...(response.data ?? []) as T[])
    if (!response.data || response.data.length < 500) return result
  }
}
export async function loadAutoData(client: SupabaseClient): Promise<AutoData> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Conectează contul Supabase pentru a vedea vehiculele tale.')
  const userId = data.user.id
  const [vehicles, records] = await Promise.all([
    rows<Vehicle>((from,to) => client.from('vehicles').select('id,make,model,year,registration_number,vin,notes,extra,created_at').eq('user_id',userId).order('created_at',{ascending:false}).order('id').range(from,to)),
    rows<VehicleRecord>((from,to) => client.from('vehicle_records').select('id,vehicle_id,record_type,issued_at,expires_at,provider,policy_number,notes,extra,created_at').eq('user_id',userId).order('issued_at',{ascending:false}).order('id').range(from,to)),
  ])
  return {vehicles,records}
}

// Optional, clearly labelled UI examples. Never inserted into Supabase.
export const autoDemo: AutoData = {
  vehicles: [
    {id:'demo-car',make:'Exemplu mașină',model:'Model demonstrativ',year:2024,registration_number:null,vin:null,notes:'Exemplu de structură, fără date personale.',extra:{vehicle_type:'car',mileage_km:12000,fuel:'Electric',power_kw:150,transmission:'Automată',color:'Gri'},created_at:'2024-01-01'},
    {id:'demo-motorcycle',make:'Exemplu motocicletă',model:'Model demonstrativ',year:2023,registration_number:null,vin:null,notes:null,extra:{vehicle_type:'motorcycle',mileage_km:4000,fuel:'Benzină',power_kw:55,transmission:'Manuală'},created_at:'2023-01-01'},
  ],records:[],
}
