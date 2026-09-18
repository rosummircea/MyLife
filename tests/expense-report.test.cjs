const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const ts = require('typescript')

// Execute the actual TypeScript module without adding a test runtime dependency.
const source = readFileSync(join(__dirname, '../lib/expense-report.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } })
const reportModule = { exports: {} }
new Function('exports', 'require', 'module', compiled.outputText)(reportModule.exports, name=>{if(name==='./category-display'){const m={exports:{}};new Function('exports','require','module',ts.transpileModule(readFileSync(join(__dirname,'../lib/category-display.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m.exports,require,m);return m.exports}return require(name)}, reportModule)
const { buildExpenseReport, reportRange, bucharestDay, subcategoryDistribution } = reportModule.exports
const range = { from: '2026-09-01', to: '2026-09-30' }
const root = { id: 'transport', parent_id: null, name: 'Transport', kind: 'expense', is_active: true }
const car = { id: 'car', parent_id: root.id, name: 'Mașină', kind: 'expense', is_active: true }
const fuel = { id: 'fuel', parent_id: car.id, name: 'Combustibil', kind: 'expense', is_active: true }
const train = { id: 'train', parent_id: root.id, name: 'Tren', kind: 'expense', is_active: true }
const tx = (id, amount, extra = {}) => ({ id, amount, transaction_type: 'expense', currency: 'RON', transaction_date: '2026-09-17T12:00:00Z', merchant: null, description: null, ...extra })
const split = (id, transaction_id, category_id, amount) => ({ id, transaction_id, category_id, amount })

function assertDistribution(category) {
  assert.equal(Math.round(category.subcategories.reduce((sum, item) => sum + item.amount, 0) * 100), Math.round(category.amount * 100))
  assert.equal(subcategoryDistribution(category).reduce((sum, item) => sum + Math.round(item.percent * 10), 0), 1000)
}

test('rolls grandchildren into their immediate parent branch and keeps unspent active children', () => {
  const report = buildExpenseReport([tx('one', 120)], [root, car, fuel, train], [split('a', 'one', fuel.id, 100), split('b', 'one', root.id, 20)], range)
  assert.equal(report.total, 120)
  assert.equal(report.categories.length, 1)
  assert.equal(report.categories[0].subcategories.find(item => item.id === car.id).amount, 100)
  assert.equal(report.categories[0].subcategories.find(item => item.id === train.id).amount, 0)
  assert.equal(report.categories[0].subcategories.find(item => item.name === 'Fără subcategorie').amount, 20)
  assertDistribution(report.categories[0])
})
test('preserves cents and rounds a three-way distribution to exactly 100%', () => {
  const children = ['a', 'b', 'c'].map(id => ({ ...car, id }))
  const report = buildExpenseReport([tx('one', 0.03)], [root, ...children], children.map(item => split(item.id, 'one', item.id, 0.01)), range)
  assert.equal(report.total, 0.03)
  assertDistribution(report.categories[0])
  assert.deepEqual(subcategoryDistribution(report.categories[0]).map(item => item.percent), [33.4, 33.3, 33.3])
})
test('accounts for partial, missing and unknown-category allocations without losing money', () => {
  const report = buildExpenseReport([tx('one', 100), tx('two', 20), tx('three', 10)], [root], [split('a', 'one', root.id, 60), split('b', 'three', 'missing', 10)], range)
  assert.equal(report.total, 130)
  assert.equal(report.categories.find(item => item.id === '__uncategorized').amount, 70)
  report.categories.forEach(assertDistribution)
})
test('excludes income, transfers, other periods and foreign currencies', () => {
  const report = buildExpenseReport([tx('one', 10), tx('income', 100, {transaction_type:'income'}), tx('transfer', 100, {transaction_type:'transfer'}), tx('old', 100, {transaction_date:'2026-08-01T12:00:00Z'}), tx('euro', 100, {currency:'EUR'})], [], [], range)
  assert.equal(report.total, 10)
  assert.equal(report.transactionCount, 1)
  assert.equal(report.excludedCurrencies, 1)
})
test('uses Bucharest calendar dates including midnight boundaries and DST', () => {
  assert.equal(bucharestDay(new Date('2026-09-16T21:09:00Z')), '2026-09-17')
  assert.equal(bucharestDay(new Date('2026-03-28T22:30:00Z')), '2026-03-29')
  assert.equal(bucharestDay(new Date('2026-10-25T22:30:00Z')), '2026-10-26')
  const report = buildExpenseReport([tx('local', 12, {transaction_date:'2026-08-31T21:15:00Z'})], [], [], range)
  assert.equal(report.total, 12)
})
test('calculates calendar periods and preserves custom boundaries', () => {
  assert.deepEqual(reportRange('Săptămână', '2026-01-01', range), {from:'2025-12-29',to:'2026-01-04'})
  assert.deepEqual(reportRange('Lună', '2024-02-10', range), {from:'2024-02-01',to:'2024-02-29'})
  assert.deepEqual(reportRange('An', '2026-09-17', range), {from:'2026-01-01',to:'2026-12-31'})
  assert.deepEqual(reportRange('Custom', '2026-09-17', range), range)
})
test('returns an empty report for an empty period', () => {
  assert.deepEqual(buildExpenseReport([], [root, car], [], range), {categories:[],total:0,transactionCount:0,excludedCurrencies:0})
})
test('rejects overallocated splits and a cyclic hierarchy instead of showing false totals', () => {
  assert.throws(() => buildExpenseReport([tx('one',10)], [root], [split('a','one',root.id,11)], range), /depășesc/)
  assert.throws(() => buildExpenseReport([tx('one',10)], [{...root,parent_id:car.id},car], [split('a','one',car.id,10)], range), /buclă/)
})

const { buildExpenseTrend } = reportModule.exports
const target = {categoryId:root.id}
const trend = (transactions, splits, period, selectedRange = range, selectedTarget = target) => buildExpenseTrend(transactions,[root,car,fuel,train],splits,selectedRange,period,selectedTarget)

test('year trend includes all 12 months, zero months and descendants, and reconciles to category total', () => {
  const transactions=[tx('may',10.11,{transaction_date:'2026-05-17T12:00:00Z'}),tx('september',20.22),tx('old',100,{transaction_date:'2025-09-17T12:00:00Z'})]
  const splits=[split('a','may',fuel.id,10.11),split('b','september',root.id,20.22),split('c','old',root.id,100)]
  const yearRange={from:'2026-01-01',to:'2026-12-31'}
  const result=trend(transactions,splits,'An',yearRange)
  assert.equal(result.unit,'month');assert.equal(result.points.length,12)
  assert.equal(result.points[0].key,'2026-01');assert.equal(result.points[11].key,'2026-12')
  assert.equal(result.points[4].amount,10.11);assert.equal(result.points[8].amount,20.22);assert.equal(result.points[0].amount,0)
  assert.equal(result.total,30.33)
  assert.equal(result.total,buildExpenseReport(transactions,[root,car,fuel,train],splits,yearRange).categories[0].amount)
})
test('subcategory trend includes only its branch and grandchildren', () => {
  const transactions=[tx('one',120)]
  const splits=[split('a','one',fuel.id,60),split('b','one',car.id,40),split('c','one',train.id,20)]
  const result=trend(transactions,splits,'Lună',range,{categoryId:root.id,subcategoryId:car.id})
  assert.equal(result.total,100);assert.equal(result.points.length,30);assert.equal(result.points[16].amount,100)
})
test('direct parent and uncategorized trends match their synthetic report rows', () => {
  const transactions=[tx('one',120)]
  const splits=[split('a','one',fuel.id,60),split('b','one',root.id,40)]
  assert.equal(trend(transactions,splits,'Lună',range,{categoryId:root.id,subcategoryId:`${root.id}-direct`}).total,40)
  assert.equal(trend(transactions,splits,'Lună',range,{categoryId:'__uncategorized',subcategoryId:'__uncategorized-direct'}).total,20)
})
test('month trend includes every day of a leap month with Bucharest midnight boundaries', () => {
  const result=trend([tx('leap',12,{transaction_date:'2024-02-28T22:15:00Z'})],[split('a','leap',root.id,12)],'Lună',{from:'2024-02-01',to:'2024-02-29'})
  assert.equal(result.points.length,29);assert.equal(result.points[28].key,'2024-02-29');assert.equal(result.points[28].amount,12)
})
test('day trend shows 24 local hours and excludes adjacent local days', () => {
  const transactions=[tx('midnight',12,{transaction_date:'2026-09-16T21:15:00Z'}),tx('afternoon',10),tx('nextday',99,{transaction_date:'2026-09-17T21:15:00Z'})]
  const result=trend(transactions,transactions.map(t=>split(t.id,t.id,root.id,t.amount)),'Zi',{from:'2026-09-17',to:'2026-09-17'})
  assert.equal(result.unit,'hour');assert.equal(result.points.length,24);assert.equal(result.points[0].amount,12);assert.equal(result.points[15].amount,10);assert.equal(result.total,22)
})
test('week trend includes every day across the year boundary', () => {
  const result=trend([],[],'Săptămână',{from:'2025-12-29',to:'2026-01-04'})
  assert.equal(result.points.length,7);assert.equal(result.points[0].key,'2025-12-29');assert.equal(result.points[6].key,'2026-01-04');assert.equal(result.total,0)
})
test('long custom trend groups partial months while excluding transactions outside selected dates', () => {
  const customRange={from:'2026-04-20',to:'2026-07-03'}
  const transactions=[tx('outside',99,{transaction_date:'2026-04-01T12:00:00Z'}),tx('inside',10,{transaction_date:'2026-04-21T12:00:00Z'})]
  const result=trend(transactions,transactions.map(t=>split(t.id,t.id,root.id,t.amount)),'Custom',customRange)
  assert.equal(result.unit,'month');assert.equal(result.points.length,4);assert.equal(result.points[0].key,'2026-04');assert.equal(result.total,10)
  assert.equal(trend([],[],'Custom',{from:'2026-09-01',to:'2026-09-03'}).points.length,3)
})
test('zero-spend subcategory keeps the full time axis and invalid ranges fail clearly', () => {
  const result=trend([tx('one',10)],[split('a','one',fuel.id,10)],'Lună',range,{categoryId:root.id,subcategoryId:train.id})
  assert.equal(result.points.length,30);assert.ok(result.points.every(point=>point.amount===0))
  assert.throws(()=>trend([],[],'Custom',{from:'2026-09-30',to:'2026-09-01'}),/nu este validă/)
})

test('report legend and donut share distinct colors even when all children inherit the parent color',()=>{const category={id:'root',name:'Insurance',amount:100,color:'#a889f4',subcategories:[{id:'b',name:'Health',amount:35,color:'#a889f4'},{id:'a',name:'RCA',amount:65,color:'#a889f4'},{id:'c',name:'CASCO',amount:0,color:'#a889f4'}]};const distribution=subcategoryDistribution(category);assert.equal(new Set(distribution.map(row=>row.color)).size,3);assert.equal(distribution.reduce((sum,row)=>sum+row.percent,0),100);const reordered=subcategoryDistribution({...category,subcategories:[...category.subcategories].reverse()});for(const row of distribution)assert.equal(row.color,reordered.find(item=>item.id===row.id).color);assert.ok(category.subcategories.every(row=>row.color===category.color));const gradient=reportModule.exports.distributionGradient(distribution);for(const row of distribution)assert.ok(gradient.includes(row.color))})
