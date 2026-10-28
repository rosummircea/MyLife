const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const ts=require('typescript')
const source=readFileSync(join(__dirname,'../lib/budgets.ts'),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}})
const budgetModule={exports:{}}
new Function('exports','require','module',compiled.outputText)(budgetModule.exports,require,budgetModule)
const {budgetCoverageTone,budgetPlanSummary,budgetStatus,isBudgetCategory,isValidTotalBudget,monthRange,shiftBudgetMonth}=budgetModule.exports

test('budget categories include loans and exclude pets and uncategorized',()=>{
  assert.equal(isBudgetCategory({name:'Împrumut'}),true)
  assert.equal(isBudgetCategory({name:'Imprumut'}),true)
  assert.equal(isBudgetCategory({name:'Animale'}),false)
  assert.equal(isBudgetCategory({name:'Necategorizat'}),false)
  assert.equal(isBudgetCategory({name:'Mâncare și băuturi'}),true)
})

test('budget colors reflect remaining room and overspending',()=>{
  assert.equal(budgetStatus(0,0).tone,'healthy')
  assert.equal(budgetStatus(1,0).tone,'over')
  assert.equal(budgetStatus(1,0).remaining,-1)
  assert.equal(budgetStatus(70,100).tone,'healthy')
  assert.equal(budgetStatus(85,100).tone,'warning')
  assert.equal(budgetStatus(95,100).tone,'critical')
  assert.equal(budgetStatus(120,100).tone,'over')
  assert.equal(budgetStatus(120,100).progress,100)
})

test('budget coverage colors show whether income can fund the remaining budget',()=>{
  assert.equal(budgetCoverageTone(200,300,800),'available')
  assert.equal(budgetCoverageTone(600,300,800),'caution')
  assert.equal(budgetCoverageTone(900,100,800),'over')
  assert.equal(budgetCoverageTone(500,-10,800),'over')
})

test('budget plan keeps category overruns separate from positive category balances',()=>{
  const summary=budgetPlanSummary(150,500,200,[{spent:150,budget:100},{spent:0,budget:100}])
  assert.equal(summary.totalRemaining,50)
  assert.equal(summary.categoryRemaining,100)
  assert.equal(summary.categoryOverrun,50)
  assert.equal(summary.projectedSpending,250)
  assert.equal(summary.projectedBudgetDifference,50)
  assert.equal(summary.tone,'caution')
})

test('total budget includes spending from categories without a budget',()=>{
  const summary=budgetPlanSummary(180,300,250,[{spent:150,budget:200}])
  assert.equal(summary.unbudgetedSpent,30)
  assert.equal(summary.totalRemaining,70)
  assert.equal(summary.categoryRemaining,50)
  assert.equal(summary.projectedSpending,230)
  assert.equal(summary.tone,'available')
})

test('total budget cannot be lower than the category budgets',()=>{
  assert.equal(isValidTotalBudget(11,10),true)
  assert.equal(isValidTotalBudget(10,10),true)
  assert.equal(isValidTotalBudget(9.99,10),false)
  assert.equal(isValidTotalBudget(Number.NaN,10),false)
})

test('budget month navigation and ranges cross years correctly',()=>{
  assert.equal(shiftBudgetMonth('2026-12',1),'2027-01')
  assert.equal(shiftBudgetMonth('2026-01',-1),'2025-12')
  assert.deepEqual(monthRange('2024-02'),{from:'2024-02-01',to:'2024-02-29'})
})
