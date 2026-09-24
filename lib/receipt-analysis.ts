export type ExpenseImageDocumentType =
  | 'receipt'
  | 'bank_transactions'
  | 'bank_statement'
  | 'invoice'
  | 'order_confirmation'
  | 'payment_confirmation'
  | 'handwritten_expenses'
  | 'other_expense_document'

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

export type ExpenseImageTransaction = {
  line_no:number
  merchant:string
  amount:number
  currency:string
  date:string|null
  date_text:string|null
  location:string|null
  description:string|null
  category_id:string
  category_path:string
  confidence:number
}

export type ReceiptAnalysis = {
  document_type:ExpenseImageDocumentType
  merchant:string
  date:string|null
  currency:string
  total:number
  items:ReceiptAnalysisItem[]
  splits:ReceiptAnalysisSplit[]
  transactions:ExpenseImageTransaction[]
  balanced:boolean
  difference:number
  warnings:string[]
}
