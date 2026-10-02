const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),path=require('node:path')
function load(file){const m={exports:{}};new Function('exports','require','module',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/'+file+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m.exports,id=>id.startsWith('./')?load(id.slice(2)):require(id),m);return m.exports}
const {insurancePolicies}=load('insurance-data')

const categories=[
 {id:'insurance',name:'Asigurări',kind:'expense',parent_id:null,is_active:true},
 {id:'health',name:'Sănătate',kind:'expense',parent_id:'insurance',is_active:true},
 {id:'home',name:'Locuință',kind:'expense',parent_id:'insurance',is_active:true},
 {id:'rca',name:'RCA',kind:'expense',parent_id:'insurance',is_active:true},
]
const tx=(id,date,amount,changes={})=>({id,transaction_type:'expense',amount,currency:'RON',transaction_date:date+'T09:00:00Z',merchant:null,description:null,status:'posted',...changes})
const split=(id,transaction_id,category_id,amount)=>({id,transaction_id,category_id,amount})

test('insurance module groups descendants and infers monthly and quarterly payment cadence',()=>{
 const transactions=[
  tx('h1','2026-08-18',506.52,{merchant:'CIGNA'}),tx('h2','2026-09-17',523.07,{merchant:'CIGNA'}),
  tx('home1','2026-06-22',810),tx('home2','2026-09-30',810,{title:'Asigurare Casa'}),
 ]
 const splits=[
  split('s1','h1','health',506.52),split('s2','h2','health',523.07),
  split('s3','home1','insurance',810),split('s4','home2','home',810),
 ]
 const policies=insurancePolicies({categories,transactions,splits,documents:[]},'2026-10-02')
 const health=policies.find(p=>p.kind==='health'),home=policies.find(p=>p.kind==='home')
 assert.equal(health.frequency,'monthly')
 assert.equal(health.nextPayment.date,'2026-10-17')
 assert.equal(health.nextPayment.amount,523.07)
 assert.equal(home.payments.length,2)
 assert.equal(home.frequency,'quarterly')
 assert.equal(home.nextPayment.date,'2026-12-30')
 assert.equal(home.title,'Asigurare Casa')
})

test('insurance module uses policy metadata for expiry and completed installment count',()=>{
 const transactions=[tx('r1','2026-09-16',955,{attachment_document_id:'doc'})]
 const splits=[split('s1','r1','rca',955)]
 const documents=[{id:'doc',document_type:'asigurare_auto_rca',source_filename:'RCA.pdf',issuer:'Groupama',issued_at:'2026-09-11',expires_at:'2027-09-21',extra:{subtype:'RCA','Număr rate':1,'Vehicul':'Audi E-TRON 55','Valabilă de la':'2026-09-22'}}]
 const [policy]=insurancePolicies({categories,transactions,splits,documents},'2026-10-02')
 assert.equal(policy.kind,'rca')
 assert.equal(policy.title,'RCA · Audi E-TRON 55')
 assert.equal(policy.totalInstallments,1)
 assert.equal(policy.remainingInstallments,0)
 assert.equal(policy.expiry,'2027-09-21')
 assert.equal(policy.nextPayment,null)
 assert.equal(policy.status,'active')
})
