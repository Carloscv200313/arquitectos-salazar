const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const baseline=require('./fixtures/financial-baseline.json');const run=require('./helpers/financial-runner.cjs');
const traceBaseline=require('./fixtures/trace-24-baseline.json');const {createHash}=require('node:crypto');
const createLoader=require('./helpers/load-ts.cjs');const {fixture,fixtureManyWorks,database}=require('./helpers/financial-fixture.cjs');
const root=path.resolve(__dirname,'..');
for(const operation of Object.keys(baseline))test(`regresión financiera: ${operation}`,async()=>{
 const current=await run(root,operation);
 assert.deepEqual(current.result,baseline[operation].result);
 console.log(JSON.stringify({operation,before:baseline[operation].metrics,after:current.metrics}));
 if(['pedidos','deudas','deudas-pantalla','detalle','dashboard','balance'].includes(operation))assert.ok(current.metrics.queries<baseline[operation].metrics.queries);
});
test('24 obras y 12 pedidos por obra: deudas idénticas sin consultas por pedido',async()=>{
 const current=await run(root,'deudas',12,40,24);
 const digest=createHash('sha256').update(JSON.stringify(current.result)).digest('hex');
 assert.equal(digest,traceBaseline.deudas.digest);
 assert.ok(current.metrics.queries<traceBaseline.deudas.queries);
 assert.ok(current.metrics.tables.work_movements<=6);
 assert.ok(current.metrics.tables.works<=2);
 console.log(JSON.stringify({scenario:'deudas-24-obras',before:{queries:traceBaseline.deudas.queries,bytes:traceBaseline.deudas.bytes,tables:traceBaseline.deudas.tables},after:current.metrics}));
});
test('listado de 24 obras conserva saldos de pedidos y reduce datos descargados',async()=>{
 const current=await run(root,'pedidos-list',12,40,24);
 assert.equal(createHash('sha256').update(JSON.stringify(current.result)).digest('hex'),traceBaseline['pedidos-list'].digest);
 assert.ok(current.metrics.bytes<traceBaseline['pedidos-list'].bytes);
 assert.equal(current.metrics.tables.work_orders,1);
 console.log(JSON.stringify({scenario:'pedidos-list-24-obras',before:traceBaseline['pedidos-list'],after:current.metrics}));
});
test('dashboard reutiliza movimientos de 24 obras y conserva importes y fechas',async()=>{
 const regular=await run(root,'dashboard',12,40,24);
 const optimized=await run(root,'dashboard-bundle',12,40,24);
 assert.equal(createHash('sha256').update(JSON.stringify(regular.result)).digest('hex'),traceBaseline.dashboard.digest);
 for(const key of ['ps','ws','os','ut','sal','bal'])assert.deepEqual(optimized.result[key],regular.result[key]);
 assert.deepEqual(optimized.result.pm.map(movement=>{const row={...movement};delete row.projectName;delete row.clientName;return row;}),regular.result.pm);
 const slim=rows=>rows.map(row=>({id:row.id,date:row.movement_date,type:row.movement_type,amount:row.amount})).sort((a,b)=>a.id.localeCompare(b.id));
 assert.deepEqual(slim(optimized.result.wm),slim(regular.result.wm));
 const overview=createLoader(root)('lib/overview').buildOverviewSnapshot;
 const snapshot=(value)=>{const v=value.result;const movements=[...v.pm.map(m=>({date:m.payment_date,type:m.movement_type,amount:m.amount})),...v.wm.map(m=>({date:m.movement_date,type:m.movement_type,amount:m.amount}))];const orders=v.os.reduce((sum,w)=>({ordersAmount:sum.ordersAmount+w.ordersAmount,ordersPaid:sum.ordersPaid+w.ordersPaid,ordersPending:sum.ordersPending+w.ordersPending,pendingOrdersCount:sum.pendingOrdersCount+w.pendingOrdersCount}),{ordersAmount:0,ordersPaid:0,ordersPending:0,pendingOrdersCount:0});return overview({projects:v.ps,works:v.ws,movements,utilityReport:v.ut,orders,salaryPaid:v.sal.totals.totalPaid,generalBalance:v.bal.total});};
 assert.deepEqual(snapshot(optimized),snapshot(regular));
 assert.ok(optimized.metrics.queries<traceBaseline.dashboard.queries);
 assert.ok(optimized.metrics.tables.work_movements<regular.metrics.tables.work_movements);
 console.log(JSON.stringify({scenario:'dashboard-24-obras',before:{queries:traceBaseline.dashboard.queries,bytes:traceBaseline.dashboard.bytes,tables:traceBaseline.dashboard.tables},after:optimized.metrics}));
});
test('250 pedidos no repiten movimientos de su obra y conservan sus saldos',async()=>{
 const current=await run(root,'pedidos',250,1205);
 assert.equal(current.result.length,250);
 assert.equal(current.metrics.tables.work_movements,3);
 assert.equal(current.metrics.tables.works,1);
 assert.equal(current.metrics.tables.work_order_payments,3);
 assert.equal(current.result[1].pending,55.05);
});
test('comprobar una obra desde formularios públicos no descarga movimientos',async()=>{
 const db=database(fixture());
 const load=createLoader(root,{react:{cache:fn=>fn},'@/lib/supabase/admin':{...db,isAdminConfigured:()=>true},'@/features/auth/get-user':{getCurrentUserId:async()=>null}});
 const works=load('lib/data/works');
 assert.equal(await works.activeWorkExists('w1'),true);
 assert.equal(await works.getWorkName('w1'),'Obra sintética');
 assert.equal(db.metrics.tables.works,2);
 assert.equal(db.metrics.tables.work_movements??0,0);
});
test('validar saldo antes de abonar conserva el importe sin descargar movimientos de la obra',async()=>{
 const data=fixture(12,40);
 const oldDb=database(data);
 const oldLoad=createLoader(root,{react:{cache:fn=>fn},'@/lib/supabase/admin':{...oldDb,isAdminConfigured:()=>true},'@/features/auth/get-user':{getCurrentUserId:async()=>null}});
 const oldOrder=await oldLoad('lib/data/orders').getWorkOrder('o1');
 const newDb=database(data);
 const newLoad=createLoader(root,{react:{cache:fn=>fn},'@/lib/supabase/admin':{...newDb,isAdminConfigured:()=>true},'@/features/auth/get-user':{getCurrentUserId:async()=>null}});
 const state=await newLoad('lib/data/orders').getWorkOrderPaymentState('o1');
 assert.deepEqual(state,{id:oldOrder.id,work_id:oldOrder.work_id,material:oldOrder.material,amount:oldOrder.amount,pending:oldOrder.pending});
 assert.equal(newDb.metrics.tables.work_movements??0,0);
 assert.ok(newDb.metrics.queries<oldDb.metrics.queries);
 console.log(JSON.stringify({scenario:'payment-state',before:oldDb.metrics,after:newDb.metrics}));
});
test('dashboard agrupa movimientos de 24 proyectos sin cambiar el orden ni los importes',async()=>{
 const data=fixture();
 for(let i=2;i<=24;i++){
  const projectId=`p${i}`;
  data.projects.push({...data.projects[0],id:projectId,name:`Proyecto sintético ${i}`});
  data.project_payments.push(...data.project_payments.slice(0,2).map(row=>({...row,id:`${row.id}-${projectId}`,project_id:projectId})));
 }
 const db=database(data);
 const load=createLoader(root,{react:{cache:fn=>fn},'@/lib/supabase/admin':{...db,isAdminConfigured:()=>true},'@/features/auth/get-user':{getCurrentUserId:async()=>null}});
 const projects=load('lib/data/projects');
 const records=await projects.listProjects();
 const before=(await Promise.all(records.map(async project=>(await projects.listMovements(project.id)).map(m=>({...m,projectName:project.name,clientName:project.client.name}))))).flat();
 const beforeQueries=db.metrics.tables.project_payments;
 const after=await projects.listDashboardProjectMovements(records);
 const afterQueries=db.metrics.tables.project_payments-beforeQueries;
 assert.deepEqual(after,before);
 assert.equal(beforeQueries,25);
 assert.equal(afterQueries,1);
 console.log(JSON.stringify({scenario:'dashboard-project-movements',before:{projectPaymentsQueries:24},after:{projectPaymentsQueries:afterQueries}}));
});
test('8.170 movimientos: utilidad y saldos comparten lectura sin cambiar el dashboard',async()=>{
 const current=await run(root,'dashboard-bundle',12,430,19);
 current.result.wm=current.result.wm.map(m=>({id:m.id,work_id:m.work_id,movement_date:m.movement_date,movement_type:m.movement_type,amount:m.amount}));
 assert.equal(createHash('sha256').update(JSON.stringify(current.result)).digest('hex'),'b4a89ec573088c4cbef56592bdc7ad688074a53a5d787c9857553bc372d3efe5');
 assert.ok(current.metrics.queries<72);
 assert.ok(current.metrics.tables.work_movements<34);
 assert.ok(current.metrics.bytes<4_799_941);
 console.log(JSON.stringify({scenario:'dashboard-8170-movements',before:{queries:72,workMovementQueries:34,bytes:4_799_941},after:current.metrics}));
});
test('utilidad de obras usa egresos de Cuenta de oficina por mes en ambos reportes',async()=>{
 const data=fixture(2,45);
 data.work_movements.push({...data.work_movements[0],id:'office-negative',category:'CUENTA DE OFICINA',movement_type:'expense',amount:-17.25,movement_date:'2026-10-01'});
 data.work_movements.push({...data.work_movements[0],id:'office-income',category:'Cuenta de oficina',movement_type:'income',amount:999,movement_date:'2026-10-01'});
 const db=database(data);
 const load=createLoader(root,{react:{cache:fn=>fn},'@/lib/supabase/admin':{...db,isAdminConfigured:()=>true},'@/features/auth/get-user':{getCurrentUserId:async()=>null}});
 const works=load('lib/data/works');
 const actual=await works.getWorksAdministrationUtilityReport();
 const amounts=new Map();
 for(const row of data.work_movements.filter(row=>row.status===1&&row.movement_type==='expense'&&row.category?.trim().toLowerCase()==='cuenta de oficina')){
  const month=row.movement_date.slice(0,7);
  amounts.set(month,Math.round(((amounts.get(month)??0)+Math.abs(row.amount))*100)/100);
 }
 const expected=[...amounts].sort(([a],[b])=>a.localeCompare(b)).map(([month,amount])=>({month,amount}));
 assert.deepEqual(actual,expected);
 assert.equal(db.metrics.tables.work_movements,2);
 assert.deepEqual(await works.getWorkAdministrationUtilities('w1'),expected);
});
test('30 llamadas a obras en un render comparten movimientos; 30 navegaciones los vuelven a consultar',async()=>{
 const rows=fixtureManyWorks(19,2,40);
 const oneDb=database(rows);
 const memo=fn=>{const values=new Map();return(...args)=>{const key=JSON.stringify(args);if(!values.has(key))values.set(key,fn(...args));return values.get(key);};};
 const mocks={'react':{cache:memo},'@/lib/supabase/admin':{...oneDb,isAdminConfigured:()=>true},'@/features/auth/get-user':{getCurrentUserId:async()=>null}};
 const works=createLoader(root,mocks)('lib/data/works');
 await Promise.all(Array.from({length:30},()=>works.listWorks()));
 assert.equal(oneDb.metrics.tables.work_movements,2);
 const repeatedDb=database(rows);
 for(let i=0;i<30;i++){
  const separate=createLoader(root,{'react':{cache:memo},'@/lib/supabase/admin':{...repeatedDb,isAdminConfigured:()=>true},'@/features/auth/get-user':{getCurrentUserId:async()=>null}})('lib/data/works');
  await separate.listWorks();
 }
 assert.equal(repeatedDb.metrics.tables.work_movements,60);
});
test('abono público valida el mismo saldo con columnas mínimas',async()=>{
 const data=fixture(12,40);
 const oldDb=database(data);
 const oldLoad=createLoader(root,{react:{cache:fn=>fn},'@/lib/supabase/admin':{...oldDb,isAdminConfigured:()=>true},'@/features/auth/get-user':{getCurrentUserId:async()=>null}});
 const expected=(await oldLoad('lib/data/projects').getProject('p1')).finance.pending;
 const newDb=database(data);
 const newLoad=createLoader(root,{react:{cache:fn=>fn},'@/lib/supabase/admin':{...newDb,isAdminConfigured:()=>true},'@/features/auth/get-user':{getCurrentUserId:async()=>null}});
 const actual=await newLoad('lib/data/projects').getPublicProjectPending('p1');
 const validLookup={queries:newDb.metrics.queries,bytes:newDb.metrics.bytes,tables:{...newDb.metrics.tables}};
 assert.equal(actual,expected);
 assert.equal(await newLoad('lib/data/projects').getPublicProjectPending('missing'),null);
 assert.equal(validLookup.queries,2);
 assert.ok(validLookup.bytes<oldDb.metrics.bytes);
 console.log(JSON.stringify({scenario:'public-project-pending',before:oldDb.metrics,after:validLookup}));
});
