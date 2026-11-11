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
  {bankAccountId:'andreea-debit-bank',financeAccountId:'andreea-debit',accountType:'checking',ownerPersonId:'andreea',currency:'RON',providerName:'Banca Transilvania'},
  {bankAccountId:'andreea-credit-bank',financeAccountId:'andreea-credit',accountType:'credit_card',ownerPersonId:'andreea',currency:'RON',providerName:'Banca Transilvania'},
  {bankAccountId:'mircea-debit-bank',financeAccountId:'mircea-debit',accountType:'checking',ownerPersonId:'mircea',currency:'RON',providerName:'Banca Comercială Română'},
]

test('recognizes Romanian internal card repayment descriptions',()=>{
  assert.equal(looksLikeInternalCreditTransfer('Plata OP intra - canal electronic;RULAJ;ANDREEA ELIZA ROSU'),true)
  assert.equal(looksLikeInternalCreditTransfer('Încasare OP - canal electronic; rulaj'),true)
  assert.equal(looksLikeInternalCreditTransfer('Plata la POS FARMACIA'),false)
})

test('infers Andreea debit to credit for the outgoing bank leg',()=>{
  assert.deepEqual(inferInternalCreditTransfer('andreea-debit-bank',-1000,'RON','Plata OP intra - canal electronic;RULAJ',links),{
    sourceBankAccountId:'andreea-debit-bank',destinationBankAccountId:'andreea-credit-bank',sourceFinanceAccountId:'andreea-debit',destinationFinanceAccountId:'andreea-credit',sourceMatchText:'',counterpartMatchText:null,rememberRule:false
  })
})

test('infers the same transfer from the incoming credit-card leg',()=>{
  assert.deepEqual(inferInternalCreditTransfer('andreea-credit-bank',1000,'RON','Încasare OP - canal electronic;RULAJ',links),{
    sourceBankAccountId:'andreea-debit-bank',destinationBankAccountId:'andreea-credit-bank',sourceFinanceAccountId:'andreea-debit',destinationFinanceAccountId:'andreea-credit',sourceMatchText:'',counterpartMatchText:null,rememberRule:false
  })
})

test('does not guess when multiple same-owner source or destination accounts are possible',()=>{
  const ambiguous=[...links,{bankAccountId:'andreea-second-credit-bank',financeAccountId:'andreea-second-credit',accountType:'credit_card',ownerPersonId:'andreea',currency:'RON',providerName:'Banca Transilvania'}]
  assert.equal(inferInternalCreditTransfer('andreea-debit-bank',-1000,'RON','Rulaj card',ambiguous),null)
})

test('learns BT Andreea to Revolut Andreea from the incoming top-up',()=>{
  const topUpLinks=[...links,{bankAccountId:'andreea-revolut-bank',financeAccountId:'andreea-revolut',accountType:'checking',ownerPersonId:'andreea',currency:'RON',providerName:'Revolut'}]
  assert.deepEqual(inferInternalCreditTransfer('andreea-revolut-bank',200,'RON','Apple Pay Top-Up by *8010',topUpLinks),{
    sourceBankAccountId:'andreea-debit-bank',destinationBankAccountId:'andreea-revolut-bank',sourceFinanceAccountId:'andreea-debit',destinationFinanceAccountId:'andreea-revolut',sourceMatchText:'revolut',counterpartMatchText:'top-up by *8010',rememberRule:true
  })
})

test('recognizes the delayed BT debit as the same Revolut top-up',()=>{
  const topUpLinks=[...links,{bankAccountId:'andreea-revolut-bank',financeAccountId:'andreea-revolut',accountType:'checking',ownerPersonId:'andreea',currency:'RON',providerName:'Revolut'}]
  assert.deepEqual(inferInternalCreditTransfer('andreea-debit-bank',-200,'RON','Tranzactie comerciant Revolut**8010',topUpLinks),{
    sourceBankAccountId:'andreea-debit-bank',destinationBankAccountId:'andreea-revolut-bank',sourceFinanceAccountId:'andreea-debit',destinationFinanceAccountId:'andreea-revolut',sourceMatchText:'revolut',counterpartMatchText:'top-up',rememberRule:true
  })
})
