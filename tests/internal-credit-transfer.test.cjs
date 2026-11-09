const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const ts=require('typescript')

const source=readFileSync(join(__dirname,'../lib/open-banking/enable-banking/internal-credit-transfer.ts'),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}})
const moduleUnderTest={exports:{}}
new Function('exports','require','module',compiled.outputText)(moduleUnderTest.exports,require,moduleUnderTest)
const {inferInternalCreditTransfer,looksLikeInternalCreditTransfer}=moduleUnderTest.exports

const links=[
  {bankAccountId:'andreea-debit-bank',financeAccountId:'andreea-debit',accountType:'checking',ownerPersonId:'andreea',currency:'RON'},
  {bankAccountId:'andreea-credit-bank',financeAccountId:'andreea-credit',accountType:'credit_card',ownerPersonId:'andreea',currency:'RON'},
  {bankAccountId:'mircea-debit-bank',financeAccountId:'mircea-debit',accountType:'checking',ownerPersonId:'mircea',currency:'RON'},
]

test('recognizes Romanian internal card repayment descriptions',()=>{
  assert.equal(looksLikeInternalCreditTransfer('Plata OP intra - canal electronic;RULAJ;ANDREEA ELIZA ROSU'),true)
  assert.equal(looksLikeInternalCreditTransfer('Încasare OP - canal electronic; rulaj'),true)
  assert.equal(looksLikeInternalCreditTransfer('Plata la POS FARMACIA'),false)
})

test('infers Andreea debit to credit for the outgoing bank leg',()=>{
  assert.deepEqual(inferInternalCreditTransfer('andreea-debit-bank',-1000,'RON','Plata OP intra - canal electronic;RULAJ',links),{
    sourceBankAccountId:'andreea-debit-bank',destinationBankAccountId:'andreea-credit-bank',sourceFinanceAccountId:'andreea-debit',destinationFinanceAccountId:'andreea-credit'
  })
})

test('infers the same transfer from the incoming credit-card leg',()=>{
  assert.deepEqual(inferInternalCreditTransfer('andreea-credit-bank',1000,'RON','Încasare OP - canal electronic;RULAJ',links),{
    sourceBankAccountId:'andreea-debit-bank',destinationBankAccountId:'andreea-credit-bank',sourceFinanceAccountId:'andreea-debit',destinationFinanceAccountId:'andreea-credit'
  })
})

test('does not guess when multiple same-owner source or destination accounts are possible',()=>{
  const ambiguous=[...links,{bankAccountId:'andreea-second-credit-bank',financeAccountId:'andreea-second-credit',accountType:'credit_card',ownerPersonId:'andreea',currency:'RON'}]
  assert.equal(inferInternalCreditTransfer('andreea-debit-bank',-1000,'RON','Rulaj card',ambiguous),null)
})
