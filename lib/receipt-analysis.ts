export type ReceiptAnalysisItem = {
  line_no:number
  raw_label:string
  normalized_label:string
  quantity:number|null
  unit_price:number|null
  line_total:number
  category_id:string
  category_path:string
  confidence:number
}

export type ReceiptAnalysisSplit = {
  category_id:string
  category_path:string
  amount:number
}

export type ReceiptAnalysis = {
  merchant:string
  date:string|null
  currency:string
  total:number
  items:ReceiptAnalysisItem[]
  splits:ReceiptAnalysisSplit[]
  balanced:boolean
  difference:number
  warnings:string[]
}
