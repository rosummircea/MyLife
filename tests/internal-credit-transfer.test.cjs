const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const ts=require('typescript')

const source=readFileSync(join(__dirname,'../lib/open-banking/enable-banking/internal-credit-transfer.ts'),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}})
const moduleUnderTest={exports:{}}
new Function('exports','require','module',compiled.outputText)(moduleUnderTest.exports,require,moduleUnderTest)
const {inferInternalCreditTransfer,inferExactBankPairTransfer,isBookedReplacement,looksLikeInternalCreditTransfer}=moduleUnderTest.exports

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

test('pairs exact opposite BT legs using their shared bank reference',()=>{
  const pairLinks=[...links]
  const debit={id:'debit',accountId:'andreea-debit-bank',amount:-2000,currency:'RON',madeOn:'2026-11-09',merchantName:'ROSU ANDREEA ELIZA',description:'P2P BTPay; Transfer to myself; REF: B67EWAL263130027'}
  const credit={id:'credit',accountId:'andreea-credit-bank',amount:2000,currency:'RON',madeOn:'2026-11-09',merchantName:'ROSU ANDREEA ELIZA',description:'P2P BTPay; Transfer to myself; REF: B67EWAL263130027'}
  assert.deepEqual(inferExactBankPairTransfer(debit.accountId,debit,pairLinks,[debit,credit]),{
    sourceBankAccountId:'andreea-debit-bank',destinationBankAccountId:'andreea-credit-bank',sourceFinanceAccountId:'andreea-debit',destinationFinanceAccountId:'andreea-credit',sourceMatchText:'b67ewal263130027',counterpartMatchText:'b67ewal263130027',rememberRule:false
  })
})

test('does not convert an unmatched payment into a transfer',()=>{
  const football={id:'football',accountId:'andreea-debit-bank',amount:-400,currency:'RON',madeOn:'2026-11-09',merchantName:'Fotbal Patrick',description:'Plata OP intra - fotbal'}
  assert.equal(inferExactBankPairTransfer(football.accountId,football,links,[football]),null)
})

test('recognizes a booked replacement only when the prior bank row was pending',()=>{
  const pending={id:'pending',accountId:'andreea-debit-bank',amount:-200,currency:'RON',madeOn:'2026-11-10',merchantName:'Revolut',description:'Top up',status:'PDNG'}
  const booked={...pending,id:'booked',madeOn:'2026-11-11',status:'BOOK'}
  assert.equal(isBookedReplacement(booked,pending),true)
  assert.equal(isBookedReplacement(booked,{...pending,status:'BOOK'}),false)
})
