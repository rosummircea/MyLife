const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const ts=require('typescript')
const source=readFileSync(join(__dirname,'../lib/budgets.ts'),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}})
const budgetModule={exports:{}}
new Function('exports','require','module',compiled.outputText)(budgetModule.exports,require,budgetModule)
const {budgetStatus,monthRange,shiftBudgetMonth}=budgetModule.exports

test('budget colors reflect remaining room and overspending',()=>{
  assert.equal(budgetStatus(70,100).tone,'healthy')
  assert.equal(budgetStatus(85,100).tone,'warning')
  assert.equal(budgetStatus(95,100).tone,'critical')
  assert.equal(budgetStatus(120,100).tone,'over')
  assert.equal(budgetStatus(120,100).progress,100)
})

test('budget month navigation and ranges cross years correctly',()=>{
  assert.equal(shiftBudgetMonth('2026-12',1),'2027-01')
  assert.equal(shiftBudgetMonth('2026-01',-1),'2025-12')
  assert.deepEqual(monthRange('2024-02'),{from:'2024-02-01',to:'2024-02-29'})
})
