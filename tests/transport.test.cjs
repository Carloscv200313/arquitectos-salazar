const test=require('node:test');const assert=require('node:assert/strict');const createLoader=require('./helpers/load-ts.cjs');const path=require('node:path');
function transport(){return createLoader(path.resolve(__dirname,'..'),{react:{cache:fn=>{let value;return()=>value??=fn();}}})('lib/supabase/transport');}
test('lectura completa supera 1000 filas y soporta límite del servidor menor al solicitado',async()=>{
 const rows=Array.from({length:1205},(_,id)=>({id,amount:1}));let count=0;
 const {databaseFetch}=transport();const fetcher=databaseFetch('fixture',async input=>{
  count++;const u=new URL(input);const offset=Number(u.searchParams.get('offset'));const take=Math.min(200,Number(u.searchParams.get('limit')));return Response.json(rows.slice(offset,offset+take),{headers:{'content-range':`${offset}-${offset+take-1}/*`}});
 });
 const actual=await (await fetcher('https://fixture.invalid/rest/v1/movements?select=id,amount')).json();
 assert.equal(actual.length,1205);assert.equal(actual.reduce((s,r)=>s+r.amount,0),1205);assert.equal(count,8);
});
test('paginación explícita no descarga todas las filas',async()=>{
 let calls=0;const {databaseFetch}=transport();const get=databaseFetch('fixture',async input=>{calls++;assert.equal(new URL(input).searchParams.get('limit'),'50');return Response.json([{id:1}]);});
 await get('https://fixture.invalid/rest/v1/audit_logs?select=id&limit=50&offset=50');assert.equal(calls,1);
});
test('solicitudes simultáneas se comparten en el render; una escritura invalida',async()=>{
 let reads=0;const {databaseFetch}=transport();const get=databaseFetch('fixture',async(_u,init)=>{if(init.method==='POST')return new Response(null,{status:204});reads++;return Response.json([{id:reads}]);});
 const url='https://fixture.invalid/rest/v1/works?select=id&limit=1';
 const result=await Promise.all([get(url),get(url)]);assert.equal(reads,1);assert.deepEqual(await result[0].json(),await result[1].json());
 await get('https://fixture.invalid/rest/v1/works',{method:'POST',body:'{}'});await get(url);assert.equal(reads,2);
});
test('lecturas idénticas entre módulos comparten transporte, pero cabeceras distintas no',async()=>{
 let calls=0;const {databaseFetch}=transport();
 const wire=async()=>{calls++;return Response.json([{id:calls}]);};
 const orders=databaseFetch('orders',wire);const finance=databaseFetch('finance',wire);
 const url='https://fixture.invalid/rest/v1/work_orders?select=id&limit=1';
 const same=await Promise.all([orders(url,{headers:{Authorization:'Bearer key-a'}}),finance(url,{headers:{Authorization:'Bearer key-a'}})]);
 assert.equal(calls,1);assert.deepEqual(await same[0].json(),await same[1].json());
 await finance(url,{headers:{Authorization:'Bearer key-b'}});assert.equal(calls,2);
});
test('402 no se convierte en datos vacíos y no se reintenta automáticamente',async()=>{
 let calls=0;const {databaseFetch}=transport();const get=databaseFetch('fixture',async()=>{calls++;return Response.json({message:'synthetic-sensitive-body'},{status:402});});
 await assert.rejects(get('https://fixture.invalid/rest/v1/works?limit=1'),e=>e.status===402&&!e.message.includes('synthetic-sensitive-body'));assert.equal(calls,1);
});
test('fallo de segunda página no devuelve un balance parcial',async()=>{
 let calls=0;const {databaseFetch}=transport();const get=databaseFetch('fixture',async()=>++calls===1?Response.json(Array.from({length:500},(_,id)=>({id}))):Response.json({}, {status:500}));
 await assert.rejects(get('https://fixture.invalid/rest/v1/works'));assert.equal(calls,2);
});
test('telemetría no incluye filtros, cabeceras, cuerpos ni credenciales',async()=>{
 const old=process.env.DATA_TELEMETRY;process.env.DATA_TELEMETRY='1';const messages=[];const log=console.info;console.info=(v)=>messages.push(v);
 try {const {databaseFetch}=transport();const get=databaseFetch('fixture',async()=>Response.json([{name:'PRIVATE-NAME'}]));await get('https://fixture.invalid/rest/v1/users?limit=1&email=eq.PRIVATE-EMAIL',{headers:{Authorization:'Bearer PRIVATE-TOKEN'}});assert.equal(messages.length,1);assert.ok(!messages[0].includes('PRIVATE-'));assert.equal(JSON.parse(messages[0]).resource,'users');}
 finally{console.info=log;if(old===undefined)delete process.env.DATA_TELEMETRY;else process.env.DATA_TELEMETRY=old;}
});
test('telemetría opcional agrupa pantalla, tablas, páginas y consultas repetidas sin identidad real',async()=>{
 const previous={telemetry:process.env.DATA_TELEMETRY,secret:process.env.AUTH_SECRET};
 process.env.DATA_TELEMETRY='1';process.env.AUTH_SECRET='synthetic-telemetry-key-only';
 const messages=[];const log=console.info;console.info=value=>messages.push(JSON.parse(value));
 try {
  const load=createLoader(path.resolve(__dirname,'..'),{react:{cache:fn=>{let value;return()=>value??=fn();}}});
  const {traceScreen}=load('lib/supabase/telemetry');
  let physical=0;
  const get=load('lib/supabase/transport').databaseFetch('orders',async()=>{physical++;return Response.json([{id:'PRIVATE-ROW'}]);});
  await traceScreen('orders-detail','PRIVATE-USER',async()=>{
   const url='https://fixture.invalid/rest/v1/work_orders?select=id&work_id=eq.PRIVATE-WORK&limit=1';
   await Promise.all([get(url),get(url)]);
   await get('https://fixture.invalid/rest/v1/work_movements?select=id&work_id=eq.PRIVATE-WORK&limit=1');
  });
  assert.equal(physical,2);
  const summary=messages.find(item=>item.event==='screen_data_metrics');
  assert.equal(summary.screen,'orders-detail');assert.equal(summary.logicalQueries,3);
  assert.equal(summary.duplicateQueries,1);assert.equal(summary.wireRequests,2);
  assert.equal(summary.resources.work_orders.requests,1);
  assert.equal(summary.resources.work_movements.requests,1);
  assert.equal(messages.filter(item=>item.event==='database_request').length,2);
  assert.ok(messages.every(item=>!JSON.stringify(item).includes('PRIVATE-')));
  assert.ok(messages.filter(item=>item.event==='database_request').every(item=>item.traceId===summary.traceId&&item.queryHash));
 } finally {
  console.info=log;
  if(previous.telemetry===undefined)delete process.env.DATA_TELEMETRY;else process.env.DATA_TELEMETRY=previous.telemetry;
  if(previous.secret===undefined)delete process.env.AUTH_SECRET;else process.env.AUTH_SECRET=previous.secret;
 }
});
test('telemetría marca volumen, tamaño, latencia y errores sin emitir consultas',async()=>{
 const old=process.env.DATA_TELEMETRY;process.env.DATA_TELEMETRY='1';
 const messages=[];const log=console.info;console.info=value=>messages.push(JSON.parse(value));
 try {
  const {traceScreen,noteQueryResult}=createLoader(path.resolve(__dirname,'..'))('lib/supabase/telemetry');
  await traceScreen('dashboard',undefined,async()=>{noteQueryResult('work_movements',100,5_000_000,500,30_000);noteQueryResult('work_movements',1,0,500,0);});
  assert.deepEqual(messages[0].alerts,['request_volume','response_size','query_duration']);
  assert.equal(messages[0].resources.work_movements.requests,101);
 } finally{console.info=log;if(old===undefined)delete process.env.DATA_TELEMETRY;else process.env.DATA_TELEMETRY=old;}
});
