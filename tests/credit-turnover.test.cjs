const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const ts=require('typescript')

const source=readFileSync(join(__dirname,'../lib/credit-turnover.ts'),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}})
const moduleUnderTest={exports:{}}
new Function('exports','require','module',compiled.outputText)(moduleUnderTest.exports,require,moduleUnderTest)
const {creditTurnoverForMonth}=moduleUnderTest.exports

const accounts=[
  {id:'credit',account_type:'credit_card',currency:'RON'},
  {id:'current',account_type:'checking',currency:'RON'},
]

test('counts repayments and transfers received by credit cards in the selected month',()=>{
  const transactions=[
    {id:'income',transaction_type:'income',account_id:'credit',amount:500,currency:'RON',transaction_date:'2026-11-02T12:00:00Z'},
    {id:'transfer',transaction_type:'transfer',account_id:'current',transfer_account_id:'credit',amount:250,currency:'RON',transaction_date:'2026-11-03T12:00:00Z'},
    {id:'purchase',transaction_type:'expense',account_id:'credit',amount:100,currency:'RON',transaction_date:'2026-11-04T12:00:00Z'},
    {id:'old',transaction_type:'income',account_id:'credit',amount:900,currency:'RON',transaction_date:'2026-10-31T12:00:00Z'},
  ]
  assert.deepEqual(creditTurnoverForMonth(accounts,transactions,'2026-11'),{completed:75000,creditAccountCount:1})
})

test('ignores mirrored, void and balance-neutral rows',()=>{
  const transactions=[
    {id:'mirror',transaction_type:'transfer',transfer_account_id:'credit',transfer_mirror:true,amount:100,currency:'RON',transaction_date:'2026-11-02'},
    {id:'void',transaction_type:'income',account_id:'credit',status:'void',amount:100,currency:'RON',transaction_date:'2026-11-02'},
    {id:'neutral',transaction_type:'income',account_id:'credit',affects_balance:false,amount:100,currency:'RON',transaction_date:'2026-11-02'},
  ]
  assert.equal(creditTurnoverForMonth(accounts,transactions,'2026-11').completed,0)
})
