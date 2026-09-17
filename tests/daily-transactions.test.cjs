const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
const mod={exports:{}}
new Function('exports','require','module',ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../lib/daily-transactions.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText)(mod.exports,require,mod)
const {dailyTransactionTotals}=mod.exports
const tx=(transaction_type,amount,currency='RON',status='posted')=>({transaction_type,amount,currency,status})
test('daily difference counts expenses and income in cents, without internal transfers',()=>{
assert.deepEqual(dailyTransactionTotals([tx('expense','523.07'),tx('expense','146.71'),tx('income','800.10'),tx('transfer',10000)]),[{currency:'RON',outgoing:66978,incoming:80010,net:13032}])
})
test('daily totals keep currencies separate and include positive adjustments',()=>{
assert.deepEqual(dailyTransactionTotals([tx('expense',100),tx('income',5,'EUR'),tx('adjustment',20)]),[{currency:'EUR',outgoing:0,incoming:500,net:500},{currency:'RON',outgoing:10000,incoming:2000,net:-8000}])
})
test('void, pending and invalid amounts cannot affect the day',()=>{
assert.deepEqual(dailyTransactionTotals([tx('expense',100,'RON','void'),tx('income',200,'RON','pending'),tx('expense',NaN),tx('expense',-10)]),[{currency:'RON',outgoing:0,incoming:0,net:0}])
})
test('empty days and transfer-only days show zero difference',()=>{
assert.equal(dailyTransactionTotals([])[0].net,0)
assert.deepEqual(dailyTransactionTotals([tx('transfer',25,'EUR')]),[{currency:'EUR',outgoing:0,incoming:0,net:0}])
})
