const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const compiled=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../lib/auto-data.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}})
const mod={exports:{}}
new Function('exports','require','module',compiled.outputText)(mod.exports,require,mod)
const {loadAutoData,vehicleDocuments,recordCost,photos,documentStatus}=mod.exports
function client(user={id:'owner'},fail=false){
 const requests=[]
 return {requests,auth:{getUser:async()=>({data:{user},error:null})},from(table){const filters=[];const query={select(){return query},eq(...filter){filters.push(filter);return query},order(){return query},async range(from,to){requests.push({table,filters,from,to});return {data:table==='vehicles'?Array.from({length:501},(_,id)=>({id})).slice(from,to+1):[],error:fail?{message:'access denied'}:null}}};return query}}
}
test('authenticated owner filters and all pages are loaded',async()=>{const db=client();const data=await loadAutoData(db);assert.equal(data.vehicles.length,501);assert.equal(db.requests.length,3);for(const query of db.requests)assert.deepEqual(query.filters,[['user_id','owner']])})
test('no queries without a session',async()=>{const db=client(null);await assert.rejects(loadAutoData(db),/Conectează/);assert.equal(db.requests.length,0)})
test('RLS errors are propagated',async()=>{await assert.rejects(loadAutoData(client(undefined,true)),/access denied/)})
test('documents require an explicit vehicle id, never a matching plate',()=>{const docs=[{id:'linked',extra:{vehicle_id:'v'}},{id:'plate',extra:{registration_number:'CJ85KSA'}},{id:'other',extra:{vehicle_id:'other'}}];assert.deepEqual(vehicleDocuments('v',docs).map(d=>d.id),['linked'])})
test('costs require finite amounts and explicit currency',()=>{assert.deepEqual(recordCost({extra:{cost:'955',currency:'RON'}}),{amount:955,currency:'RON'});for(const extra of [{cost:1},{cost:' ',currency:'RON'},{cost:Infinity,currency:'RON'},{cost:-1,currency:'RON'},{cost:1,currency:'ron'}])assert.equal(recordCost({extra}),null)})
test('photos validate storage references and prioritize the main photo',()=>{assert.deepEqual(photos({extra:{photos:[null,{path:'bad'},{bucket:'private',path:'second'},{bucket:'private',path:'main',primary:true}]}}).map(p=>p.path),['main','second'])})
test('expiry statuses cover expired, soon and valid documents',()=>{assert.equal(documentStatus(null,'2026-09-17'),'Fără dată expirare');assert.equal(documentStatus('2026-09-16','2026-09-17'),'Expirat');assert.equal(documentStatus('2026-09-17','2026-09-17'),'Expiră curând');assert.equal(documentStatus('2027-09-17','2026-09-17'),'Valid')})
