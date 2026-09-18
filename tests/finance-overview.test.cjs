const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),path=require('node:path')
function load(file){const m={exports:{}};new Function('exports','require','module',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/'+file+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText)(m.exports,id=>id.startsWith('./')?load(id.slice(2)):require(id),m);return m.exports}
const {financeOverview}=load('finance-overview')
const account=(id,name,balance,changes={})=>({id,name,account_type:'checking',currency:'RON',opening_balance:999,current_balance:balance,credit_limit:23000,...changes})
const tx=(id,type,amount,day='2026-09-17T12:00:00Z',changes={})=>({id,transaction_type:type,amount,transaction_date:day,currency:'RON',status:'posted',...changes})
const loan=(direction,amount,repaid_amount=0,currency='RON')=>({direction,amount,repaid_amount,currency})
test('owner net sums all saved current balances and excludes unused credit limits',()=>{const m=financeOverview([account('a','BT Mircea RON',100),account('b','Revolut Mircea RON',200),account('c','BT Card Andreea RON',-500,{account_type:'credit_card'}),account('d','BT Andreea RON',1000),account('e','EUR Mircea',900,{currency:'EUR'})],[],[],'RON','2026-09-18');assert.equal(m.cash,1300*100);assert.equal(m.netBalance,800*100);assert.equal(m.owners.find(o=>o.name==='Mircea').net,300*100);assert.equal(m.owners.find(o=>o.name==='Andreea').net,500*100)})
test('settlement uses remaining loans with correct signs and keeps unavailable data unknown',()=>{const m=financeOverview([account('a','Mircea',1000)],[],[loan('given',200,50),loan('received',100,20),loan('given',100,100),loan('given',999,0,'EUR')],'RON','2026-09-18');assert.equal(m.given,15000);assert.equal(m.received,8000);assert.equal(m.loanNet,7000);assert.equal(m.afterLoans,107000);assert.equal(financeOverview([],[],null,'RON','2026-09-18').afterLoans,null)})
test('monthly operational flow excludes transfers, adjustments, void, foreign and future records',()=>{const rows=[tx('a','income',100.01),tx('b','expense',20.02),tx('transfer','transfer',999),tx('adjustment','adjustment',999),tx('void','expense',999,undefined,{status:'void'}),tx('future','expense',999,'2026-09-19T12:00:00Z'),tx('eur','income',999,undefined,{currency:'EUR'}),tx('aug','expense',50,'2026-08-17T12:00:00Z')];const m=financeOverview([],rows,[],'RON','2026-09-18');assert.equal(m.current.income,10001);assert.equal(m.current.expenses,2002);assert.equal(m.current.net,7999);assert.equal(m.current.count,2);assert.equal(m.months[4].expenses,5000);assert.equal(m.projected,Math.round(2002/18*30))})
test('months cross year boundaries and transaction grouping uses Bucharest local dates',()=>{const m=financeOverview([],[tx('a','expense',10,'2025-12-31T22:30:00Z')],[],'RON','2026-01-01');assert.deepEqual(m.months.map(m=>m.key),['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01']);assert.equal(m.current.expenses,1000);assert.equal(m.daysLeft,30)})

test('owner availability includes remaining credit while retaining signed debt and net wealth',()=>{
 const m=financeOverview([account('cash','BT Andreea RON',185.58),account('credit','BT Card Andreea RON',-19123.64,{account_type:'credit_card'})],[],[],'RON','2026-09-18')
 const owner=m.owners.find(o=>o.name==='Andreea')
 assert.equal(owner.available,406194)
 assert.equal(owner.creditBalance,-1912364)
 assert.equal(owner.net,-1893806)
 assert.equal(m.netBalance,-1893806)
})
test('availability handles multiple credit cards, no limit, over-limit debt and currency isolation',()=>{
 const m=financeOverview([account('cash','Mircea',100),account('a','Mircea',-50,{account_type:'credit_card',credit_limit:200}),account('b','Mircea',-300,{account_type:'credit_card',credit_limit:200}),account('c','Mircea',-40,{account_type:'credit_card',credit_limit:null}),account('d','Mircea',25,{account_type:'credit_card',credit_limit:null}),account('e','Mircea',999,{currency:'EUR'})],[],[],'RON','2026-09-18')
 assert.equal(m.owners[0].available,27500)
 assert.equal(m.owners[0].creditBalance,-36500)
})
