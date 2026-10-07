const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),path=require('node:path')
function load(file){const m={exports:{}};new Function('exports','require','module',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/'+file+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m.exports,id=>id.startsWith('./')?load(id.slice(2)):require(id),m);return m.exports}
const {sortDailyTransactions,moveTransactionId}=load('transaction-order')
const tx=(id,time,changes={})=>({id,transaction_type:'expense',amount:10,currency:'RON',transaction_date:time,merchant:null,description:null,...changes})

test('daily transactions show newest first and use created time for date-only ties',()=>{
 const rows=[
  tx('late','2026-10-07T18:00:00+03:00',{created_at:'2026-10-07T15:00:00Z'}),
  tx('date-b','2026-10-07T00:00:00+03:00',{created_at:'2026-10-07T09:00:00Z'}),
  tx('date-a','2026-10-07T00:00:00+03:00',{created_at:'2026-10-07T08:00:00Z'}),
 ]
 assert.deepEqual(sortDailyTransactions(rows).map(row=>row.id),['late','date-b','date-a'])
})

test('manual day order wins while new unranked transactions stay at the top',()=>{
 const rows=[
  tx('a','2026-10-07T08:00:00+03:00',{day_sort_order:2}),
  tx('b','2026-10-07T09:00:00+03:00',{day_sort_order:0}),
  tx('c','2026-10-07T10:00:00+03:00',{day_sort_order:1}),
  tx('new','2026-10-07T07:00:00+03:00',{day_sort_order:null}),
 ]
 assert.deepEqual(sortDailyTransactions(rows).map(row=>row.id),['new','b','c','a'])
})

test('drag move repositions one transaction without changing the others',()=>{
 assert.deepEqual(moveTransactionId(['a','b','c','d'],'a','c'),['b','c','a','d'])
 assert.deepEqual(moveTransactionId(['a','b','c','d'],'d','b'),['a','d','b','c'])
})
