const {test,before,after,beforeEach}=require('node:test');const assert=require('node:assert/strict');
const {initializeApp,deleteApp}=require('firebase-admin/app');const {getFirestore}=require('firebase-admin/firestore');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');const {createService,digest}=require('../server/core.cjs');const {planMigration,applyMigration,rollbackMigration}=require('../server/migration.cjs');const {monitor}=require('../server/monitor.cjs');
const projectId='demo-receiving-guardian-server';let app,db,env,service;
const auth={uid:'admin',token:{email:'admin@example.test'}};
const profile={role:'admin',email:auth.token.email,active:true,companyId:'__ALL__',companyName:'All Companies'};
const receiving={id:'r1',doNumber:'DO1',poNumber:'PO1',customer:'Airali',companyId:'airali',shipmentDate:'2026-10-01',vehicleNumber:'VAN',transportType:'Van',expectedQty:2,actualQty:'',arrivalTime:'',startTime:'',completionTime:'',updatedAt:'2026-09-30T01:00:00.000Z'};
const discrepancy={id:'d1',linkedReceivingId:'r1',doNumber:'DO1',poNumber:'PO1',customer:'Airali',companyId:'airali',reportDate:'2026-10-01',sku:'SKU',productName:'Item',expectedQty:2,actualQty:1,issueType:'Damaged',itemCondition:'Damaged',actionTaken:'Return',pic:'Staff',photo:'',resolved:false};
const del=(id='delete1')=>({operationId:id,receiving:[{id:'r1',updatedAt:receiving.updatedAt}],discrepancies:[]});
const save=(id='save1')=>({operationId:id,id:'d1',base:null,data:discrepancy});
before(async()=>{if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator required');app=initializeApp({projectId},'server-tests');db=getFirestore(app);env=await initializeTestEnvironment({projectId,firestore:{rules:'rules_version = "2"; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read,write: if false; } } }'}});});
after(async()=>{await env?.cleanup();await deleteApp(app);});
beforeEach(async()=>{await env.clearFirestore();await db.doc('users/admin').set(profile);await db.doc('receivings/r1').set(receiving);service=createService(db);});
test('server requires authoritative active editor access, not a claimed role',async()=>{await assert.rejects(service.deleteRecords({uid:'client',token:{email:'client@test',role:'admin'}},del()));assert.equal((await db.doc('receivings/r1').get()).exists,true);});
test('discrepancy save fences the parent and replay cannot duplicate it',async()=>{const result=await service.saveDiscrepancy(auth,save());await service.saveDiscrepancy(auth,save());assert.equal(result.verified,true);assert.equal((await db.doc('receivings/r1').get()).data().guardianLinkVersion,1);assert.equal((await db.collection('discrepancies').get()).size,1);});
test('concurrent deletion versus linked creation cannot leave an orphan',async()=>{
 let signal,release;const read=new Promise(r=>signal=r),hold=new Promise(r=>release=r);let paused=false;
 const blocking=createService(db,{afterRead:async action=>{if(action==='delete-records'&&!paused){paused=true;signal();await hold;}}});
 const deletion=blocking.deleteRecords(auth,del());await read;const creation=service.saveDiscrepancy(auth,save()).then(v=>({ok:true,v}),e=>({ok:false,e}));release();await deletion;const result=await creation;assert.equal(result.ok,false);assert.equal((await db.doc('discrepancies/d1').get()).exists,false);
});
test('creation winning the race is included in the deletion archive',async()=>{await service.saveDiscrepancy(auth,save());const r=await service.deleteRecords(auth,del());assert.ok(r.deleted.includes('discrepancies/d1'));assert.equal((await db.doc('discrepancies/d1').get()).exists,false);const again=await service.deleteRecords(auth,del());assert.deepEqual(again,r);});
test('failed backup write rolls back deletion and the operation receipt',async()=>{await db.doc('guardian_backups/delete1').set({existing:true});await assert.rejects(service.deleteRecords(auth,del()));assert.equal((await db.doc('receivings/r1').get()).exists,true);assert.equal((await db.doc('guardian_operations/delete1').get()).exists,false);});
test('restore is atomic, preserves business fields, and does not overwrite live data',async()=>{
 await service.saveDiscrepancy(auth,save());await service.deleteRecords(auth,del());await db.doc('receivings/r1').set({...receiving,remarks:'New live record'});
 await assert.rejects(service.restoreDeletion(auth,{operationId:'restore1',backupId:'delete1'}));assert.equal((await db.doc('discrepancies/d1').get()).exists,false);assert.equal((await db.doc('receivings/r1').get()).data().remarks,'New live record');
 await db.doc('receivings/r1').delete();await service.restoreDeletion(auth,{operationId:'restore1',backupId:'delete1'});assert.equal((await db.doc('discrepancies/d1').get()).data().sku,'SKU');assert.equal((await db.doc('receivings/r1').get()).data().doNumber,'DO1');assert.notEqual((await db.doc('receivings/r1').get()).data().updatedAt,receiving.updatedAt);
});
test('slot and DO claims are released together and restored together',async()=>{await db.doc('booking_slots/s1').set({receivingId:'r1'});await db.doc('guardian_do_keys/airali|do1').set({receivingId:'r1'});await service.deleteRecords(auth,del());assert.equal((await db.doc('booking_slots/s1').get()).exists,false);await service.restoreDeletion(auth,{operationId:'restore1',backupId:'delete1'});assert.equal((await db.doc('booking_slots/s1').get()).exists,true);});
test('migration dry run finds duplicate DO and never guesses missing roles',()=>{const p=planMigration({'receivings/r1':receiving,'receivings/r2':{...receiving,id:'r2'},'users/x':{email:'x@test'}});assert.equal(p.issues.length,2);assert.equal(p.changes.some(x=>x.path.startsWith('users/')),false);});
test('migration apply/replay/rollback verified in emulator without role changes',async()=>{const before={'users/admin':profile,'receivings/r1':receiving},plan=planMigration(before);await applyMigration(db,plan,'migration1');await applyMigration(db,plan,'migration1');assert.equal((await db.doc('guardian_do_keys/airali|do1').get()).exists,true);await rollbackMigration(db,'migration1');assert.deepEqual((await db.doc('receivings/r1').get()).data(),receiving);assert.deepEqual((await db.doc('users/admin').get()).data(),profile);});
test('migration rollback refuses to overwrite a subsequent edit',async()=>{const plan=planMigration({'receivings/r1':receiving});await applyMigration(db,plan,'migration1');await db.doc('receivings/r1').update({remarks:'New work'});await assert.rejects(rollbackMigration(db,'migration1'),/overwrite/);assert.equal((await db.doc('receivings/r1').get()).data().remarks,'New work');});
test('unattended checks mark recovery only after a fresh successful probe',async()=>{
 await db.doc('guardian_config/role_baseline').set({accounts:[{uid:'admin',role:'admin',active:true,companyId:'__ALL__'}]});const authService={getUser:async()=>({disabled:false})};
 const failed=await monitor(db,authService,{probe:async module=>{if(module==='Booking')throw Object.assign(Error('offline'),{code:'unavailable'});}});assert.equal(failed.healthy,false);
 const path='guardian_server_incidents/'+digest({module:'Booking'});assert.equal((await db.doc(path).get()).data().result,'UNRESOLVED');
 const good=await monitor(db,authService);assert.equal(good.healthy,true);assert.equal((await db.doc(path).get()).data().result,'RECOVERED');
 await db.doc('users/admin').update({role:'client'});const drift=await monitor(db,authService);assert.equal(drift.checks.Permissions.state,'ERROR');assert.equal((await db.doc('users/admin').get()).data().role,'client');
});
test('missing monitoring baseline cannot be reported healthy',async()=>{const result=await monitor(db,{getUser:async()=>({disabled:false})});assert.equal(result.healthy,false);assert.equal(result.checks.Permissions.state,'UNVERIFIED');});

test('retrying an old save after deletion cannot recreate or claim the deleted record is current',async()=>{await service.saveDiscrepancy(auth,save());await service.deleteRecords(auth,del());await assert.rejects(service.saveDiscrepancy(auth,save()),/deleted/);await assert.rejects(service.saveDiscrepancy(auth,save('new-request')),/deleted/);assert.equal((await db.doc('discrepancies/d1').get()).exists,false);});
test('stale receiving selection cannot delete a concurrent edit',async()=>{await db.doc('receivings/r1').update({updatedAt:'newer',remarks:'Another user saved'});await assert.rejects(service.deleteRecords(auth,del()),/changed/);assert.equal((await db.doc('receivings/r1').get()).data().remarks,'Another user saved');});
test('invalid discrepancy image and missing parent are rejected before commit',async()=>{await assert.rejects(service.saveDiscrepancy(auth,{...save(),data:{...discrepancy,photo:'javascript:alert(1)'}}));await db.doc('receivings/r1').delete();await assert.rejects(service.saveDiscrepancy(auth,save()),/no longer/);assert.equal((await db.doc('discrepancies/d1').get()).exists,false);});
test('restore receipt replay verifies the current state before reporting recovered',async()=>{
 await service.deleteRecords(auth,del());const request={operationId:'restore1',backupId:'delete1'};
 await service.restoreDeletion(auth,request);assert.equal((await service.restoreDeletion(auth,request)).verified,true);
 await db.doc('receivings/r1').delete();await assert.rejects(service.restoreDeletion(auth,request),/subsequently/);
});
test('malformed canonical profiles fail closed and migration planning reports missing email',async()=>{
 await db.doc('users/admin').set({...profile,email:null});await assert.rejects(service.deleteRecords(auth,del()),e=>e.code==='permission-denied');
 assert.match(planMigration({'users/admin':{...profile,email:''}}).issues[0].reason,/email/);
});
