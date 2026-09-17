const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const ts = require('typescript')
const source = readFileSync(join(__dirname, '../lib/mylife-data.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } })
const dataModule = { exports: {} }
new Function('exports', 'require', 'module', compiled.outputText)(dataModule.exports, require, dataModule)
const { loadMyLifeData } = dataModule.exports

function clientFixture({ user = { id:'user-one' }, documentError = null } = {}) {
  const requests = []
  const transactions = Array.from({length:1001}, (_,id) => ({id:String(id)}))
  const tables = { finance_accounts:[{id:'account'}], finance_transactions:transactions, finance_categories:[], finance_transaction_splits:[], documents:[] }
  return {
    requests,
    rpc: async()=>({data:0,error:null}),
    auth: { getUser: async () => ({data:{user}, error:null}) },
    from(table) {
      const filters = []
      const query = {
        select() { return query },
        eq(field,value) { filters.push([field,value]); return query },
        in(field,value) { filters.push([field,value]); return query },
        order() { return query },
        limit() { return query },
        or() { return query },
        async maybeSingle() {
          requests.push({table,filters})
          return {data:table === 'people' ? {id:'person',display_name:'Mircea'} : {household_id:'household'},error:null}
        },
        async range(from,to) {
          requests.push({table,filters,from,to})
          return {data:tables[table].slice(from,to+1), error:table === 'documents' ? documentError : null}
        },
      }
      return query
    },
  }
}
test('loads all transactions beyond the API page limit and resolves the authenticated profile', async () => {
  const client = clientFixture()
  const data = await loadMyLifeData(client)
  assert.equal(data.transactions.length,1001)
  assert.equal(new Set(data.transactions.map(row=>row.id)).size,1001)
  assert.equal(data.profile.displayName,'Mircea')
  assert.equal(data.profile.householdId,'household')
  assert.equal(data.source,'live')
  assert.ok(client.requests.find(request=>request.table==='people').filters.some(([field,value])=>field==='auth_user_id'&&value==='user-one'))
})
test('does not query private tables without a valid authenticated user', async () => {
  const client = clientFixture({user:null})
  await assert.rejects(loadMyLifeData(client), /Sesiunea Supabase/)
  assert.equal(client.requests.length,0)
})
test('surfaces a denied data query instead of returning false empty results', async () => {
  const client = clientFixture({documentError:{message:'permission denied'}})
  await assert.rejects(loadMyLifeData(client), /permission denied/)
})

test('loads posted transactions and matching splits', async () => {
  const client = clientFixture()
  await loadMyLifeData(client)
  for (const [table, field] of [['finance_transactions', 'status'], ['finance_transaction_splits', 'finance_transactions.status']]) {
    const request = client.requests.find(request => request.table === table)
    assert.equal(request.filters.find(([name]) => name === field)[1], 'posted')
  }
})
