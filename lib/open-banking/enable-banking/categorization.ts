export type CategoryCandidate={id:string;name:string;parent_id:string|null;kind:string;is_active:boolean}

export function merchantKey(value:string|null|undefined){
  return (value??'').normalize('NFKC').trim().toLocaleLowerCase('ro-RO').replace(/\s+/g,' ')
}
