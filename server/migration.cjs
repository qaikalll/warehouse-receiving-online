'use strict';
const G=require('../guardian.js');const {digest}=require('./core.cjs');
const fail=message=>{throw new Error(message);};
// Pure, offline planner. Never infer or mutate roles, companies, or activation.
function planMigration(documents){
 const changes=[],issues=[],reservations=new Map();
 for(const [path,data] of Object.entries(documents)){
  if(path.startsWith('users/')){try{if(data.active!==true&&data.active!==false)throw Error('Explicit activation is missing');if(typeof data.email!=='string'||!data.email.trim())throw Error('Canonical profile email is missing');G.profile({...data,active:true},{uid:path.slice(6),email:data.email});}catch(e){issues.push({path,reason:e.message});}}
  if(!path.startsWith('receivings/'))continue;
  try{G.validate('receiving',data,data);}catch(e){issues.push({path,reason:e.message});continue;}
  const id=path.slice(11),key=G.claimKey(data.companyId,data.doNumber),claimPath='guardian_do_keys/'+key;
  if(reservations.has(key)&&reservations.get(key)!==id){issues.push({path,reason:'Duplicate DO requires human reconciliation'});continue;}reservations.set(key,id);
  const claim=documents[claimPath];if(claim&&claim.receivingId!==id){issues.push({path,reason:'Reservation belongs to another record'});continue;}
  const next={...data,guardianDoKey:key,guardianLinkVersion:data.guardianLinkVersion||0};
  if(digest(data)!==digest(next))changes.push({path,before:data,after:next});
  if(!claim)changes.push({path:claimPath,before:null,after:{receivingId:id,companyId:data.companyId,doNumber:data.doNumber.trim().toLowerCase(),guardianRequestId:'guardian-migration'}});
 }
 for(const [path,data] of Object.entries(documents)){
  if(path.startsWith('discrepancies/')&&data.linkedReceivingId){const parent=documents['receivings/'+data.linkedReceivingId];if(!parent||parent.companyId!==data.companyId)issues.push({path,reason:'Missing or mismatched linked receiving'});}
  if(path.startsWith('receivings/')&&data.bookingSlotStart){const slot=documents['booking_slots/'+data.shipmentDate+'_'+data.bookingSlotStart.replace(':','')];if(!slot||slot.receivingId!==path.slice(11))issues.push({path,reason:'Missing or mismatched booking slot'});}
 }
 const plan={version:1,sourceDigest:digest(documents),changes,issues};return {...plan,planDigest:digest(plan)};
}
function requireEmulator(db){if(!process.env.FIRESTORE_EMULATOR_HOST||!String(db.projectId).startsWith('demo-'))fail('Migration apply/rollback is restricted to a demo project emulator. Production is never a test target.');}
async function applyMigration(db,plan,id){
 requireEmulator(db);const {planDigest,...body}=plan;if(digest(body)!==planDigest||plan.issues.length)fail('Plan is invalid or contains unresolved issues.');
 if(!/^[A-Za-z0-9_-]+$/.test(id)||plan.changes.length>100)fail('A bounded, reviewed migration ID and plan are required.');
 const receipt=db.doc('guardian_migrations/'+id);
 await db.runTransaction(async tx=>{
  const done=await tx.get(receipt);if(done.exists){if(done.data().planDigest!==planDigest)fail('Migration ID mismatch');return;}
  for(const c of plan.changes){if(!/^(receivings|guardian_do_keys)\/[^/]+$/.test(c.path))fail('Forbidden migration path');const snap=await tx.get(db.doc(c.path));if(digest(snap.exists?snap.data():null)!==digest(c.before))fail('Source changed after dry run. Replan.');}
  for(const c of plan.changes){tx.create(receipt.collection('before').doc(Buffer.from(c.path).toString('base64url')),{path:c.path,before:c.before,afterHash:digest(c.after)});tx.set(db.doc(c.path),c.after);}
  tx.create(receipt,{planDigest,appliedAt:new Date().toISOString(),count:plan.changes.length,rolledBack:false});
 });
}
async function rollbackMigration(db,id){
 requireEmulator(db);if(!/^[A-Za-z0-9_-]+$/.test(id))fail('Invalid migration ID');const root=db.doc('guardian_migrations/'+id);
 await db.runTransaction(async tx=>{const receipt=await tx.get(root);if(!receipt.exists)fail('Migration receipt missing');if(receipt.data().rolledBack)return;const snaps=await tx.get(root.collection('before'));if(snaps.size!==receipt.data().count)fail('Incomplete recovery snapshot');
  for(const s of snaps.docs){const d=s.data(),current=await tx.get(db.doc(d.path));if(!current.exists||digest(current.data())!==d.afterHash)fail('Data changed since migration. Rollback would overwrite current work.');}
  for(const s of snaps.docs){const d=s.data();if(d.before===null)tx.delete(db.doc(d.path));else tx.set(db.doc(d.path),d.before);}
  tx.update(root,{rolledBack:true,rolledBackAt:new Date().toISOString()});
 });
}
module.exports={planMigration,applyMigration,rollbackMigration};
