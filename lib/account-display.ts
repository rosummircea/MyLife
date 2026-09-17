import type { Account } from './mylife-data'

const family: Record<string,{name:string;photo:string}> = {
  'f8a973d1-bf60-4d55-9b7c-70880495a029': {name:'Mircea',photo:'/accounts/mircea.png'},
  '9ed62f2a-7787-42d1-8bc7-4f9eaaca2417': {name:'Andreea',photo:'/accounts/andreea.png'},
}
export function accountOwner(account: Account) {
  const known = account.owner_person_id ? family[account.owner_person_id] : undefined
  if (account.owner_person_id) return {id:account.owner_person_id,name:account.owner?.display_name || known?.name || 'Proprietar neprecizat',photo:known?.photo}
  // Compatibility with the older localhost snapshot, which lacks ownership fields.
  const legacy = !('owner_person_id' in account) ? Object.entries(family).find(([,person])=>new RegExp(`\\b${person.name}\\b`,'i').test(account.name)) : undefined
  return legacy ? {id:legacy[0],...legacy[1]} : {id:'unassigned',name:'Conturi comune / fără proprietar',photo:undefined}
}
export function accountBank(account: Account) {
  const institution = account.institution ?? (!('institution' in account) ? account.name : '')
  if (/revolut/i.test(institution)) return {name:'Revolut',icon:'/accounts/revolut.png'}
  if (/banca transilvania|\bbt\b/i.test(institution)) return {name:'Banca Transilvania',icon:'/accounts/bt.png'}
  if (/\bbcr\b/i.test(institution)) return {name:'BCR',icon:'/accounts/bcr.png'}
  return {name:account.account_type==='cash'?'Numerar':institution || 'Alt cont',icon:null}
}
export function accountAmounts(account: Account) {
  const balance = Number(account.current_balance ?? account.opening_balance)
  const limit = account.credit_limit === null ? null : Number(account.credit_limit)
  const credit = account.account_type === 'credit_card'
  const available = credit && limit !== null && Number.isFinite(limit) && limit >= 0 ? (Math.round(limit*100)+Math.round(balance*100))/100 : null
  // RON thresholds do not imply currency conversion for other currencies.
  const color = credit && balance < 0 ? 'red' : balance === 0 ? 'neutral' : balance < 0 ? 'red' : account.currency.trim()==='RON' ? balance < 200 ? 'red' : balance < 1000 ? 'orange' : 'green' : 'green'
  return {balance,available,credit,color}
}
