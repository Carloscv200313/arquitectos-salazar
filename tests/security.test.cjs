const test = require('node:test');
const assert = require('node:assert/strict');
const createLoader = require('./helpers/load-ts.cjs');
const root = require('node:path').resolve(__dirname, '..');
const load = createLoader(root);

test('sesión: firma, expiración, manipulación y formato estricto', async () => {
  process.env.AUTH_SECRET = 'synthetic-test-secret-only-not-a-real-credential';
  const { signSession, verifySession } = load('lib/auth/session');
  const user = { sub: 'synthetic-user', email: 'fixture@example.invalid', role: null, exp: Math.floor(Date.now()/1000)+60 };
  const token = await signSession(user);
  assert.deepEqual(await verifySession(token), user);
  assert.equal(await verifySession(token+'.extra'), null);
  assert.equal(await verifySession(token.slice(0,-3)+'abc'), null);
  assert.equal(await verifySession(await signSession({...user, exp:1})),null);
  delete process.env.AUTH_SECRET;
  await assert.rejects(signSession(user));
});

test('producción falla sin configuración y rechaza secreto predeterminado', () => {
  const { validateProductionConfig } = load('lib/supabase/config-validation');
  assert.throws(()=>validateProductionConfig({NODE_ENV:'production'}));
  assert.doesNotThrow(()=>validateProductionConfig({NODE_ENV:'test'}));
});

test('inicio de sesión rechaza cuenta inactiva antes de crear cookie',async()=>{
 let updated=0,cookiesSet=0;
 const isolated=createLoader(root,{
  '@/lib/security/rate-limit':{limitPublicRequest:async()=>{}},
  '@/lib/supabase/admin':{isAdminConfigured:()=>true,createAdminClient:()=>({rpc:async()=>({data:{id:'synthetic',email:'test@example.invalid',status:0},error:null}),from:()=>({update(){updated++;return this;},eq(){return this;}})})},
  'next/headers':{cookies:async()=>({set(){cookiesSet++;}})},
  '@/lib/auth/session':{SESSION_COOKIE:'as_session',SESSION_MAX_AGE:3600,signSession:async()=> 'synthetic-cookie'},
 });
 const result=await isolated('features/auth/actions').signInAction({email:'test@example.invalid',password:'synthetic-password'});
 assert.equal(result.ok,false);assert.equal(updated,0);assert.equal(cookiesSet,0);
});

test('cierre de sesión elimina cookie y redirige al inicio',async()=>{
 const deleted=[];
 const isolated=createLoader(root,{'next/headers':{cookies:async()=>({delete:name=>deleted.push(name)})},'next/navigation':{redirect:path=>{throw Object.assign(new Error('redirect'),{path});}}});
 await assert.rejects(isolated('features/auth/actions').signOutAction(),error=>error.path==='/login');
 assert.deepEqual(deleted,['as_session']);
});

test('tokens: otro documento, otro propósito, caducidad y alteración se rechazan', () => {
  process.env.AUTH_SECRET='synthetic-test-secret-only-not-a-real-credential';
  const {issueDocumentToken,verifyDocumentToken}=load('lib/security/document-token');
  const token=issueDocumentToken('receipt:obra:one',60,100000);
  assert.equal(verifyDocumentToken(token,'receipt:obra:one',110000),true);
  assert.equal(verifyDocumentToken(token,'receipt:obra:two',110000),false);
  assert.equal(verifyDocumentToken(token,'salary:one',110000),false);
  assert.equal(verifyDocumentToken(token,'receipt:obra:one',160000),false);
  assert.equal(verifyDocumentToken(token+'.extra','receipt:obra:one',110000),false);
});

for (const state of [null, {id:'u',roleName:'Operativo',permissions:[]}, {id:'u',roleName:'Operativo',permissions:['users.edit']}]) {
 test(`administración rechaza identidad ${JSON.stringify(state?.permissions ?? null)}`, async()=>{
  const isolated=createLoader(root,{'@/features/auth/get-user':{getCurrentAppUser:async()=>state}});
  await assert.rejects(isolated('lib/auth/authorize').requireAdministrator());
 });
}

test('acciones administrativas directas y servicio rechazan antes de escribir',async()=>{
  let writes=0;
  const isolated=createLoader(root,{
   '@/features/auth/get-user':{getCurrentAppUser:async()=>null,getCurrentUserId:async()=>null},
   '@/lib/supabase/admin':{isAdminConfigured:()=>true,createAdminClient:()=>{writes++;throw Error('DB must not be called');}},
   'next/cache':{revalidatePath:()=>{}},
  });
  const actions=isolated('features/users/actions');
  await assert.rejects(actions.deactivateUserAction('synthetic'));
  await assert.rejects(actions.setUserPasswordAction({id:'synthetic',password:'synthetic'}));
  await assert.rejects(actions.saveUserAction({}));
  await assert.rejects(isolated('services/users.service').setUserPassword('synthetic','synthetic'));
  assert.equal(writes,0);
});

test('usuario desactivado no resuelve identidad aunque la cookie esté firmada',async()=>{
  const isolated=createLoader(root,{
   react:{cache:fn=>fn}, 'next/headers':{cookies:async()=>({get:()=>({value:'synthetic'})})},
   '@/lib/auth/session':{SESSION_COOKIE:'as_session',verifySession:async()=>({sub:'disabled'})},
   '@/lib/supabase/admin':{isAdminConfigured:()=>true,createAdminClient:()=>({from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null,error:null})})})},
  });
  assert.equal(await isolated('features/auth/get-user').getCurrentUserId(),null);
  await assert.rejects(isolated('lib/auth/authorize').requireUser());
});

test('un lector no puede emitir un token de firma',async()=>{
 const isolated=createLoader(root,{
  '@/lib/auth/authorize':{requirePermission:async()=>({permissions:['works.view']})},
  './rate-limit':{limitPublicRequest:async()=>{}},
 });
 assert.equal(await isolated('lib/security/documents').authorizeDocument('receipt:obra:x','works.view'),undefined);
});

test('límite acotado rechaza exceso y permite ventana posterior',()=>{
 const isolated=createLoader(root,{'next/headers':{headers:async()=>new Headers()}});
 const {consumeLimit}=isolated('lib/security/rate-limit');
 consumeLimit('fixture',2,100,1000);consumeLimit('fixture',2,200,1000);
 assert.throws(()=>consumeLimit('fixture',2,300,1000));
 assert.doesNotThrow(()=>consumeLimit('fixture',2,1100,1000));
});

test('leer un comprobante salarial no crea filas ni códigos', async () => {
  const {fixture,database}=require('./helpers/financial-fixture.cjs');
  const db=database(fixture());
  const isolated=createLoader(root,{
    react:{cache:fn=>fn}, '@/lib/supabase/admin':{...db,isAdminConfigured:()=>true},
    '@/features/auth/get-user':{getCurrentUserId:async()=>null,getCurrentAppUser:async()=>null},
  });
  const receipt=await isolated('lib/data/finance').getSalaryReceipt('sw','e1','project','sw');
  assert.equal(receipt.code,null);
  assert.equal(receipt.amount,150.25);
  assert.equal(db.metrics.tables.salary_receipts,1);
});

test('notificaciones rechaza acceso sin permiso antes de consultar Supabase', async () => {
  let dbCalls=0;
  class Denied extends Error { constructor(status){super();this.status=status;} }
  const isolated=createLoader(root,{
    '@/lib/auth/authorize':{AccessDeniedError:Denied,requirePermission:async()=>{throw new Denied(403);}},
    '@/lib/security/rate-limit':{RateLimitError:class extends Error {},limitPublicRequest:async()=>{}},
    '@/lib/supabase/transport':{DatabaseRequestError:class extends Error {}},
    '@/lib/supabase/admin':{isAdminConfigured:()=>true,createAdminClient:()=>{dbCalls++;throw Error('unexpected');}},
    'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},
  });
  const result=await isolated('app/api/order-notifications/route').GET({nextUrl:new URL('https://example.invalid/api/order-notifications')});
  assert.equal(result.status,403);
  assert.equal(dbCalls,0);
});

test('notificaciones consulta pedidos una vez y conserva los datos visibles', async () => {
  const calls=[];
  const rows={work_orders:[{id:'order-1',work_id:'work-1',supplier:'Proveedor',material:'Material',created_at:'2026-10-21T12:00:00Z'}],works:[{id:'work-1',name:'Obra',client:{name:'Cliente'}}]};
  const client={from(table){calls.push(table);const query={select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},or(){return this;},in(){return this;},then(ok,bad){return Promise.resolve({data:rows[table],error:null}).then(ok,bad);}};return query;}};
  const isolated=createLoader(root,{
    '@/lib/auth/authorize':{AccessDeniedError:class extends Error {},requirePermission:async()=>({id:'synthetic-user'})},
    '@/lib/security/rate-limit':{RateLimitError:class extends Error {},limitPublicRequest:async()=>{}},
    '@/lib/supabase/transport':{DatabaseRequestError:class extends Error {}},
    '@/lib/supabase/admin':{isAdminConfigured:()=>true,createAdminClient:()=>client},
    'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},
  });
  const response=await isolated('app/api/order-notifications/route').GET({nextUrl:new URL('https://example.invalid/api/order-notifications')});
  assert.equal(response.status,200);
  assert.deepEqual(calls,['work_orders','works']);
  assert.equal(response.body.orders[0].workName,'Obra');
  assert.equal(response.body.orders[0].clientName,'Cliente');
});

test('notificaciones devuelve 402 sin reintentar consultas', async () => {
  let calls=0;
  class Restricted extends Error { constructor(){super();this.status=402;} }
  const isolated=createLoader(root,{
    '@/lib/auth/authorize':{AccessDeniedError:class extends Error {},requirePermission:async()=>({id:'synthetic-user'})},
    '@/lib/security/rate-limit':{RateLimitError:class extends Error {},limitPublicRequest:async()=>{}},
    '@/lib/supabase/transport':{DatabaseRequestError:Restricted},
    '@/lib/supabase/admin':{isAdminConfigured:()=>true,createAdminClient:()=>{calls++;throw new Restricted();}},
    'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},
  });
  const response=await isolated('app/api/order-notifications/route').GET({nextUrl:new URL('https://example.invalid/api/order-notifications')});
  assert.equal(response.status,402);
  assert.equal(calls,1);
});

test('cotización y abono invalidan la obra indicada sin releer el pedido completo', async () => {
  const orderId='11111111-1111-4111-8111-111111111111';
  const workId='22222222-2222-4222-8222-222222222222';
  const paths=[];let writes=0;
  const isolated=createLoader(root,{
    '@/lib/auth/authorize':{requirePermission:async()=>({id:'synthetic-user'})},
    '@/features/auth/get-user':{getCurrentUserId:async()=> 'synthetic-user'},
    '@/lib/data/orders':{
      quoteWorkOrder:async()=>{writes++;return workId;},
      registerWorkOrderPayment:async()=>{writes++;return workId;},
    },
    'next/cache':{revalidatePath:path=>paths.push(path)},
  });
  const actions=isolated('app/(dashboard)/pedidos/actions');
  const quote=await actions.quoteWorkOrderAction({orderId,quoteDate:'2026-10-21',category:'Material',amount:75.15,registerAdvance:false});
  const payment=await actions.registerWorkOrderPaymentAction({orderId,paymentDate:'2026-10-21',amount:20.1,paymentMethodId:'33333333-3333-4333-8333-333333333333'});
  assert.equal(quote.ok,true);assert.equal(payment.ok,true);assert.equal(writes,2);
  assert.equal(paths.filter(path=>path===`/pedidos/${workId}`).length,2);
});
