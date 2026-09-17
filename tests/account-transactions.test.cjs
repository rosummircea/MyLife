const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),path=require('node:path')
function load(file){const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/'+file+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText;new Function('exports','require','module',code)(mod.exports,id=>id.startsWith('./')?load(id.slice(2)):require(id),mod);return mod.exports}
const {accountTransactionMonths}=load('account-transactions')
const tx=(id,date,props={})=>({id,account_id:'a',transaction_type:'expense',transaction_date:date,status:'posted',...props})
test('account history includes incoming and outgoing transfers once, excludes unrelated and void transactions',()=>{
const groups=accountTransactionMonths([tx('out','2026-09-17',{transaction_type:'transfer',transfer_account_id:'b'}),tx('in','2026-09-16',{transaction_type:'transfer',account_id:'b',transfer_account_id:'a'}),tx('other','2026-09-15',{account_id:'b'}),tx('void','2026-09-14',{status:'void'})],'a')
assert.deepEqual(groups[0].transactions.map(t=>t.id),['out','in'])
})
test('months use Bucharest dates and keep years separate in descending order',()=>{
const groups=accountTransactionMonths([tx('boundary','2026-08-31T21:30:00Z'),tx('aug','2026-08-20T12:00:00Z'),tx('old','2025-09-17T12:00:00Z')],'a')
assert.deepEqual(groups.map(g=>g.month),['2026-09','2026-08','2025-09'])
})
test('history does not truncate transactions and empty accounts have no month groups',()=>{
const rows=Array.from({length:1001},(_,i)=>tx(String(i),'2026-09-17T12:00:00Z'))
assert.equal(accountTransactionMonths(rows,'a')[0].transactions.length,1001)
assert.deepEqual(accountTransactionMonths(rows,'missing'),[])
})
