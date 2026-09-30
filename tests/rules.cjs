const {test,before,after,beforeEach}=require('node:test');
const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,writeBatch,updateDoc}=require('firebase/firestore');
let env;
const profile=(role,email)=>({role,email,active:true,companyId:role==='client'?'airali':'__ALL__',companyName:role==='client'?'Airali':'All Companies'});
const record={doNumber:'DO1',poNumber:'PO1',customer:'Airali',companyId:'airali',shipmentDate:'2026-10-01',vehicleNumber:'VAN',transportType:'Van',expectedQty:2,actualQty:'',arrivalTime:'',startTime:'',completionTime:'',updatedAt:'2026-09-30T01:00:00Z',guardianRequestId:'test-request',guardianDoKey:'airali|do1'};
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
 const booking={...record,source:'client-booking',bookedBy:'client@example.test',bookingSlotStart:'08:00',bookingSlotEnd:'08:30'};
 const claim={companyId:'airali',receivingId:'r1',guardianRequestId:'test-request'};
 let b=writeBatch(db);b.set(doc(db,'receivings/r1'),booking);b.set(doc(db,'guardian_do_keys/'+record.guardianDoKey),claim);await assertFails(b.commit());
 b=writeBatch(db);b.set(doc(db,'receivings/r1'),booking);b.set(doc(db,'guardian_do_keys/'+record.guardianDoKey),claim);b.set(doc(db,'booking_slots/2026-10-01_0800'),{date:'2026-10-01',slotStart:'08:00',slotEnd:'08:30',booked:true,receivingId:'r1',guardianRequestId:'test-request'});await assertSucceeds(b.commit());
 const invalid={...booking,doNumber:'DO2',guardianDoKey:'airali|do2',bookingSlotStart:'13:00',bookingSlotEnd:'13:30'};
 b=writeBatch(db);b.set(doc(db,'receivings/r2'),invalid);b.set(doc(db,'guardian_do_keys/airali|do2'),{...claim,receivingId:'r2'});b.set(doc(db,'booking_slots/2026-10-01_1300'),{date:'2026-10-01',slotStart:'13:00',slotEnd:'13:30',booked:true,receivingId:'r2',guardianRequestId:'test-request'});await assertFails(b.commit());
 await env.withSecurityRulesDisabled(async ctx=>{if((await getDoc(doc(ctx.firestore(),'receivings/r2'))).exists())throw Error('Rejected booking partially persisted');});
});
