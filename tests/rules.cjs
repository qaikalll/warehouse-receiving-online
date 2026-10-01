const {test,before,after,beforeEach}=require('node:test');
const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,writeBatch,updateDoc,deleteDoc,runTransaction}=require('firebase/firestore');
let env;
const profile=(role,email)=>({role,email,active:true,companyId:role==='client'?'airali':'__ALL__',companyName:role==='client'?'Airali':'All Companies'});
const futureDate=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
const record={doNumber:'DO1',poNumber:'PO1',customer:'Airali',companyId:'airali',shipmentDate:futureDate,vehicleNumber:'VAN',transportType:'Van',expectedQty:2,actualQty:'',arrivalTime:'',startTime:'',completionTime:'',updatedAt:'2026-09-30T01:00:00.000Z',updatedBy:'admin@example.test',guardianActorUid:'admin',guardianRequestId:'test-request',guardianDoKey:'airali|do1'};
function client(uid){return env.authenticatedContext(uid,{email:uid+'@example.test'}).firestore();}
async function seed(path,data){await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),path),data));}
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-receiving-guardian',firestore:{rules:fs.readFileSync('firebase/firestore.candidate.rules','utf8')}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{await env.clearFirestore();for(const role of ['admin','staff','client'])await seed('users/'+role,profile(role,role+'@example.test'));});
test('client cannot promote itself or change company; admin cannot silently demote itself',async()=>{
 await assertFails(updateDoc(doc(client('client'),'users/client'),{role:'admin'}));
 await assertFails(updateDoc(doc(client('client'),'users/client'),{companyId:'other'}));
 await assertFails(updateDoc(doc(client('admin'),'users/admin'),{role:'client'}));
});
test('role update requires atomic immutable audit',async()=>{
 const db=client('admin');await assertFails(updateDoc(doc(db,'users/staff'),{role:'admin'}));
 const b=writeBatch(db);b.update(doc(db,'users/staff'),{role:'admin',roleAuditId:'audit1',guardianRequestId:'role1'});
 b.set(doc(db,'guardian_role_audit/audit1'),{targetUid:'staff',actorUid:'admin',previousRole:'staff',newRole:'admin',guardianRequestId:'role1'});
 await assertSucceeds(b.commit());await assertFails(updateDoc(doc(db,'guardian_role_audit/audit1'),{newRole:'client'}));
});
test('push token update does not authorize access-field mutation',async()=>{
 const db=client('client');await assertSucceeds(updateDoc(doc(db,'users/client'),{fcmTokens:['test']}));
 await assertFails(updateDoc(doc(db,'users/client'),{fcmTokens:['test'],role:'admin'}));
});
test('receiving and duplicate reservation must commit together',async()=>{
 const db=client('admin');await assertFails(setDoc(doc(db,'receivings/r1'),record));
 const b=writeBatch(db);b.set(doc(db,'receivings/r1'),record);b.set(doc(db,'guardian_do_keys/'+record.guardianDoKey),{companyId:'airali',receivingId:'r1',guardianRequestId:'test-request'});await assertSucceeds(b.commit());
 const duplicate=writeBatch(db);duplicate.set(doc(db,'receivings/r2'),record);duplicate.set(doc(db,'guardian_do_keys/'+record.guardianDoKey),{companyId:'airali',receivingId:'r2',guardianRequestId:'duplicate'});await assertFails(duplicate.commit());
});
test('invalid quantities, skipped milestones, and client edits are rejected',async()=>{
 await seed('receivings/r1',record);await seed('guardian_do_keys/'+record.guardianDoKey,{companyId:'airali',receivingId:'r1'});
 for(const patch of [{expectedQty:-1},{startTime:'2026-09-30T02:00:00Z'},{arrivalTime:'2026-09-30T02:00:00Z',startTime:'2026-09-30T02:00:00Z'}])await assertFails(updateDoc(doc(client('admin'),'receivings/r1'),patch));
 await assertFails(updateDoc(doc(client('client'),'receivings/r1'),{expectedQty:10}));
});
test('client data reads are restricted by company',async()=>{
 await seed('receivings/r1',record);await seed('receivings/r2',{...record,companyId:'other'});
 await assertSucceeds(getDoc(doc(client('client'),'receivings/r1')));await assertFails(getDoc(doc(client('client'),'receivings/r2')));
});

test('a forged alternative DO claim cannot bypass duplicate protection',async()=>{
 const db=client('admin');const b=writeBatch(db);b.set(doc(db,'receivings/r1'),{...record,guardianDoKey:'arbitrary'});b.set(doc(db,'guardian_do_keys/arbitrary'),{companyId:'airali',receivingId:'r1',guardianRequestId:'test-request'});await assertFails(b.commit());
});

test('client booking requires a valid reciprocal slot and invalid slot rolls back all writes',async()=>{
 const db=client('client');
 const booking={...record,source:'client-booking',bookedBy:'client@example.test',updatedBy:'client@example.test',guardianActorUid:'client',bookingSlotStart:'08:00',bookingSlotEnd:'08:30'};
 const claim={companyId:'airali',receivingId:'r1',guardianRequestId:'test-request'};
 let b=writeBatch(db);b.set(doc(db,'receivings/r1'),booking);b.set(doc(db,'guardian_do_keys/'+record.guardianDoKey),claim);await assertFails(b.commit());
 b=writeBatch(db);b.set(doc(db,'receivings/r1'),booking);b.set(doc(db,'guardian_do_keys/'+record.guardianDoKey),claim);b.set(doc(db,'booking_slots/'+futureDate+'_0800'),{date:futureDate,slotStart:'08:00',slotEnd:'08:30',booked:true,receivingId:'r1',guardianRequestId:'test-request'});await assertSucceeds(b.commit());
 const invalid={...booking,doNumber:'DO2',guardianDoKey:'airali|do2',bookingSlotStart:'13:00',bookingSlotEnd:'13:30'};
 b=writeBatch(db);b.set(doc(db,'receivings/r2'),invalid);b.set(doc(db,'guardian_do_keys/airali|do2'),{...claim,receivingId:'r2'});b.set(doc(db,'booking_slots/'+futureDate+'_1300'),{date:futureDate,slotStart:'13:00',slotEnd:'13:30',booked:true,receivingId:'r2',guardianRequestId:'test-request'});await assertFails(b.commit());
 await env.withSecurityRulesDisabled(async ctx=>{if((await getDoc(doc(ctx.firestore(),'receivings/r2'))).exists())throw Error('Rejected booking partially persisted');});
});

test('unauthenticated requests cannot read or write protected collections',async()=>{
 const db=env.unauthenticatedContext().firestore();await assertFails(getDoc(doc(db,'users/admin')));await assertFails(setDoc(doc(db,'receivings/unauthorized'),record));
});
test('Admin Receiving create/update/complete follows valid milestones',async()=>{
 const db=client('admin');const b=writeBatch(db);b.set(doc(db,'receivings/r1'),record);b.set(doc(db,'guardian_do_keys/'+record.guardianDoKey),{companyId:'airali',receivingId:'r1',guardianRequestId:'test-request'});await assertSucceeds(b.commit());
 await assertSucceeds(getDoc(doc(db,'receivings/r1')));await assertSucceeds(updateDoc(doc(db,'receivings/r1'),{arrivalTime:'2026-09-30T01:00:00.000Z'}));await assertSucceeds(updateDoc(doc(db,'receivings/r1'),{startTime:'2026-09-30T02:00:00.000Z'}));await assertSucceeds(updateDoc(doc(db,'receivings/r1'),{completionTime:'2026-09-30T03:00:00.000Z',actualQty:2}));
 await assertFails(updateDoc(doc(db,'receivings/r1'),{startTime:'2026-09-30T02:01:00.000Z'}));
});
test('malformed calendar dates, times, quantity and forged actors fail server validation',async()=>{
 await seed('receivings/r1',record);await seed('guardian_do_keys/'+record.guardianDoKey,{companyId:'airali',receivingId:'r1'});const ref=doc(client('admin'),'receivings/r1');
 for(const patch of [{shipmentDate:'2026-02-30'},{shipmentDate:null},{arrivalTime:'not-a-time'},{arrivalTime:'2026-10-01T25:00:00.000Z'},{expectedQty:NaN},{expectedQty:Infinity},{doNumber:''},{poNumber:null},{updatedBy:'client@example.test'},{guardianActorUid:'someone-else'},{guardianLinkVersion:100},{staffName:{corrupt:true}},{remarks:null},{arbitraryControl:true}])await assertFails(updateDoc(ref,patch));
});
test('clients cannot bypass the trusted deletion or discrepancy fence',async()=>{
 await seed('receivings/r1',record);await assertFails(deleteDoc(doc(client('admin'),'receivings/r1')));await assertFails(setDoc(doc(client('admin'),'discrepancies/d1'),{linkedReceivingId:'r1'}));
 await assertFails(setDoc(doc(client('admin'),'guardian_tombstones/receivings__r1'),{operationId:'fake'}));
});
test('tombstones reject stale recreation even with a newly forged reservation',async()=>{
 await seed('guardian_tombstones/receivings__r1',{operationId:'deleted'});const db=client('admin'),b=writeBatch(db);b.set(doc(db,'receivings/r1'),record);b.set(doc(db,'guardian_do_keys/'+record.guardianDoKey),{companyId:'airali',receivingId:'r1',guardianRequestId:'test-request'});await assertFails(b.commit());
});
test('client booking for today violates the Malaysian one-day notice rule',async()=>{
 const date=new Date(Date.now()+8*3600000).toISOString().slice(0,10),db=client('client'),b=writeBatch(db);
 const r={...record,shipmentDate:date,source:'client-booking',bookedBy:'client@example.test',updatedBy:'client@example.test',guardianActorUid:'client',bookingSlotStart:'08:00',bookingSlotEnd:'08:30'};
 b.set(doc(db,'receivings/r1'),r);b.set(doc(db,'guardian_do_keys/'+r.guardianDoKey),{companyId:'airali',receivingId:'r1',guardianRequestId:'test-request'});b.set(doc(db,'booking_slots/'+date+'_0800'),{date,slotStart:'08:00',slotEnd:'08:30',booked:true,receivingId:'r1',guardianRequestId:'test-request'});await assertFails(b.commit());
});
test('two concurrent Guardian writers cannot overwrite each other',async()=>{
 const G=require('../guardian.js');const {getDocFromServer}=require('firebase/firestore');const raw=client('admin');
 await seed('receivings/r1',record);await seed('guardian_do_keys/'+record.guardianDoKey,{companyId:'airali',receivingId:'r1'});
 const wrap=r=>({_ref:r,path:r.path,id:r.id,get:()=>getDocFromServer(r).then(s=>({exists:s.exists(),data:()=>s.data(),metadata:s.metadata}))});
 const adapter={collection:c=>({doc:id=>wrap(doc(raw,c+'/'+id))}),runTransaction:fn=>runTransaction(raw,tx=>fn({get:r=>tx.get(r._ref).then(s=>({exists:s.exists(),data:()=>s.data(),metadata:s.metadata})),set:(r,d,o)=>tx.set(r._ref,d,o),delete:r=>tx.delete(r._ref)}))};
 const auth={currentUser:{uid:'admin',email:'admin@example.test'}},identity={...profile('admin','admin@example.test'),uid:'admin'};
 const a=G.create({db:adapter,auth,sleep:async()=>{}}),b=G.create({db:adapter,auth,sleep:async()=>{}});a.setIdentity(identity);b.setIdentity(identity);
 const op=remarks=>[{ref:adapter.collection('receivings').doc('r1'),kind:'receiving',base:record.updatedAt,data:{...record,remarks,updatedAt:new Date().toISOString()}}];
 const results=await Promise.allSettled([a.commit('Receiving:r1',op('A')),b.commit('Receiving:r1',op('B'))]);
 require('node:assert/strict').equal(results.filter(r=>r.status==='fulfilled').length,1);
});
test('rescheduling moves the reciprocal slot atomically and occupied destinations preserve the original',async()=>{
 const db=client('admin'),nextDate=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 const oldPath='booking_slots/'+futureDate+'_0800',newPath='booking_slots/'+nextDate+'_0800';
 const booked={...record,bookingSlotStart:'08:00',bookingSlotEnd:'08:30'};
 const slot={date:futureDate,slotStart:'08:00',slotEnd:'08:30',booked:true,receivingId:'r1',guardianRequestId:'test-request'};
 await seed('receivings/r1',booked);await seed(oldPath,slot);await seed('guardian_do_keys/'+record.guardianDoKey,{companyId:'airali',receivingId:'r1'});
 const move=()=>{const b=writeBatch(db);b.update(doc(db,'receivings/r1'),{shipmentDate:nextDate});b.delete(doc(db,oldPath));b.set(doc(db,newPath),{...slot,date:nextDate});return b.commit();};
 await seed(newPath,{...slot,date:nextDate,receivingId:'other'});await assertFails(move());
 require('node:assert/strict').equal((await getDoc(doc(db,'receivings/r1'))).data().shipmentDate,futureDate);
 await env.withSecurityRulesDisabled(ctx=>deleteDoc(doc(ctx.firestore(),newPath)));await assertSucceeds(move());
 require('node:assert/strict').equal((await getDoc(doc(db,oldPath))).exists(),false);
 require('node:assert/strict').equal((await getDoc(doc(db,newPath))).data().receivingId,'r1');
});
