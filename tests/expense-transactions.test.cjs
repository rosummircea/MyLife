const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),path=require('node:path')
function load(file){const mod={exports:{}};new Function('exports','require','module',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/'+file+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText)(mod.exports,id=>id.startsWith('./')?load(id.slice(2)):require(id),mod);return mod.exports}
const {expenseContributionTransactions}=load('expense-transactions'),{buildExpenseReport}=load('expense-report')
const categories=[{id:'root',name:'Asigurări',kind:'expense',parent_id:null,is_active:true},{id:'sub',name:'Sănătate',kind:'expense',parent_id:'root',is_active:true},{id:'child',name:'Cigna',kind:'expense',parent_id:'sub',is_active:true}]
const tx=(id,amount,changes={})=>({id,amount,transaction_type:'expense',currency:'RON',transaction_date:'2026-09-17T12:00:00Z',...changes}),range={from:'2026-09-01',to:'2026-09-30'}
test('subcategory contributions equal report total and retain original transaction amounts',()=>{
const transactions=[tx('a',500),tx('b',150)],splits=[{id:'1',transaction_id:'a',category_id:'sub',amount:200},{id:'2',transaction_id:'b',category_id:'child',amount:150}]
const rows=expenseContributionTransactions(transactions,categories,splits,range,{categoryId:'root',subcategoryId:'sub'})
assert.equal(rows.reduce((s,r)=>s+r.amount,0),350);assert.equal(rows[0].transaction.amount,500)
assert.equal(buildExpenseReport(transactions,categories,splits,range).categories.find(c=>c.id==='root').subcategories.find(c=>c.id==='sub').amount,350)
})
test('period and currency filters exclude unrelated transaction types and dates',()=>{
const transactions=[tx('a',10),tx('old',99,{transaction_date:'2026-08-31T20:59:00Z'}),tx('foreign',99,{currency:'EUR'}),tx('income',99,{transaction_type:'income'}),tx('transfer',99,{transaction_type:'transfer'})]
const splits=transactions.map(t=>({id:t.id,transaction_id:t.id,category_id:'sub',amount:t.amount}))
assert.deepEqual(expenseContributionTransactions(transactions,categories,splits,range,{categoryId:'root',subcategoryId:'sub'}).map(r=>r.transaction.id),['a'])
})
test('direct parent allocations and uncategorized remainders reconcile to their virtual subcategory',()=>{
const transactions=[tx('a',30)],splits=[{id:'1',transaction_id:'a',category_id:'root',amount:12.34}]
assert.equal(expenseContributionTransactions(transactions,categories,splits,range,{categoryId:'root',subcategoryId:'root-direct'})[0].amount,12.34)
assert.equal(expenseContributionTransactions(transactions,categories,splits,range,{categoryId:'__uncategorized',subcategoryId:'__uncategorized-direct'})[0].amount,17.66)
assert.deepEqual(expenseContributionTransactions(transactions,categories,splits,range,{categoryId:'root',subcategoryId:'sub'}),[])
})
