const createLoader=require('./load-ts.cjs');
const {fixture,fixtureManyWorks,database}=require('./financial-fixture.cjs');
module.exports=async function run(root,operation,orderCount=12,movementCount=40,workCount=1){
 const db=database(workCount>1?fixtureManyWorks(workCount,orderCount,movementCount):fixture(orderCount,movementCount));
 const memo=fn=>{const values=new Map();return(...args)=>{const key=JSON.stringify(args);if(!values.has(key))values.set(key,fn(...args));return values.get(key);};};
 const load=createLoader(root,{
  react:{cache:memo}, '@/lib/supabase/admin':{...db,isAdminConfigured:()=>true},
  '@/features/auth/get-user':{getCurrentUserId:async()=>null,getCurrentAppUser:async()=>null},
 });
 const finance=load('lib/data/finance');const works=load('lib/data/works');const projects=load('lib/data/projects');const orders=load('lib/data/orders');
 const started=performance.now();let result;
 switch(operation){
  case 'deudas':result=await finance.getDebtReport();break;
  case 'balance':result=await finance.getGeneralBalanceReport();break;
  case 'utilidades':result=await finance.getFinanceUtilityReport();break;
  case 'estados':result=await Promise.all([finance.getWorkFinancialMonthlyReport(),finance.getProjectArchitectCommissionMonthlyReport(),finance.getAdministrativeSalaryMonthlyReport()]);break;
  case 'salarios':result=await finance.getSalaryReport({year:2026,month:10});break;
  case 'pedidos':result=await orders.listWorkOrders('w1');break;
  case 'pedidos-list':result=await orders.listOrderWorks();break;
  case 'detalle':result=await Promise.all([works.getWork('w1'),works.listWorkMovements('w1'),works.getWorkCategorySummary('w1'),works.getWorkAdministrationUtilities('w1')]);break;
  case 'proyectos':result=await projects.listProjects();break;
  case 'deudas-pantalla':result=await Promise.all([finance.getDebtReport(),finance.getProviderDebtDetails(),finance.getManualDebtorDetails()]);break;
  case 'dashboard':{const [ps,ws,os,ut,sal,bal]=await Promise.all([projects.listProjects(),works.listWorks(),orders.listOrderWorks(),finance.getFinanceUtilityReport(),finance.getSalaryReport(),finance.getGeneralBalanceReport()]);const pm=(await Promise.all(ps.map(p=>projects.listMovements(p.id)))).flat();const wm=(await Promise.all(ws.map(w=>works.listWorkMovements(w.id)))).flat();result={ps,ws,os,ut,sal,bal,pm,wm};break;}
  case 'dashboard-bundle':{const [ps,bundle,os,ut,sal,bal]=await Promise.all([projects.listProjects(),works.listDashboardWorksAndMovements(),orders.listOrderWorks(),finance.getFinanceUtilityReport(),finance.getSalaryReport(),finance.getGeneralBalanceReport()]);const pm=await projects.listDashboardProjectMovements(ps);result={ps,ws:bundle.works,os,ut,sal,bal,pm,wm:bundle.movements};break;}
  default:throw Error(operation);
 }
 return {result:JSON.parse(JSON.stringify(result)),metrics:{...db.metrics,durationMs:performance.now()-started}};
};
