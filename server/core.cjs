'use strict';
const crypto=require('node:crypto');
const G=require('../guardian.js');
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object'){if(value.toDate)return value.toDate().toISOString();return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));}return value;}
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id);
const refId=id=>{if(typeof id!=='string'||!id||id.includes('/')||id.length>1400)fail('invalid-argument','Invalid record identifier.');return id;};
function createService(db,{now=()=>new Date().toISOString(),afterRead=async()=>{}}={}){
 async function actor(tx,auth,admin=false){
  if(!auth?.uid||!auth.token?.email)fail('unauthenticated','Sign in again.');
  const snap=await tx.get(db.doc('users/'+refId(auth.uid))),p=snap.exists?snap.data():null;
  if(!p||p.active!==true||typeof p.email!=='string'||p.email.toLowerCase()!==auth.token.email.toLowerCase()||!['admin','staff'].includes(p.role)||admin&&p.role!=='admin')fail('permission-denied','Current database permissions do not authorize this operation.');
  return {...p,uid:auth.uid};
 }
 async function perform(auth,input,action,handler,admin=false){
  if(!validId(input?.operationId))fail('invalid-argument','A stable operation ID is required.');
  const receiptRef=db.doc('guardian_operations/'+input.operationId),hash=digest({action,input});
  const result=await db.runTransaction(async tx=>{
   const p=await actor(tx,auth,admin),receipt=await tx.get(receiptRef);
   if(receipt.exists){const d=receipt.data();if(d.actorUid!==p.uid||d.requestHash!==hash)fail('already-exists','Operation ID was already used for a different request.');return d.result;}
   const result=await handler(tx,p);
   tx.create(receiptRef,{actorUid:p.uid,role:p.role,action,requestHash:hash,at:now(),result});return result;
  });
  if(action==='save-discrepancy'){const snap=await db.doc('discrepancies/'+input.id).get();if(!snap.exists||snap.data().guardianRequestId!==input.operationId)fail('failed-precondition','The saved record subsequently changed or was deleted. Reopen the current state.');}
  if(action==='delete-records'){for(const path of result.deleted)if((await db.doc(path).get()).exists)fail('failed-precondition','The record was restored after deletion. Reopen the current state.');}
  if(action==='restore-deletion'){for(const path of result.restored){const snap=await db.doc(path).get();if(!snap.exists||snap.data().guardianRequestId!==input.operationId)fail('failed-precondition','A restored record subsequently changed or was deleted. Reopen the current state.');}}
  const confirmed=await receiptRef.get();if(!confirmed.exists||confirmed.data().requestHash!==hash)fail('unavailable','Operation receipt could not be verified.');
  return {...result,operationId:input.operationId,verified:true};
 }
 function archive(tx,operationId,p,snaps,action){
  if(snaps.length>100)fail('resource-exhausted','Deletion exceeds the atomic recovery limit; no records were changed.');
  const root=db.doc('guardian_backups/'+operationId);
  tx.create(root,{actorUid:p.uid,at:now(),action,paths:snaps.map(s=>s.ref.path),restored:false});
  for(const s of snaps)tx.create(root.collection('documents').doc(Buffer.from(s.ref.path).toString('base64url')),{path:s.ref.path,data:s.data(),hash:digest(s.data())});
 }
 async function saveDiscrepancy(auth,input){return perform(auth,input,'save-discrepancy',async(tx,p)=>{
  const ref=db.doc('discrepancies/'+refId(input.id)),snap=await tx.get(ref),old=snap.exists?snap.data():null;
  if((await tx.get(db.doc('guardian_tombstones/discrepancies__'+input.id))).exists)fail('failed-precondition','This discrepancy was deleted. It cannot be recreated by a stale request.');
  if((old?.updatedAt||null)!==(input.base||null))fail('failed-precondition','The discrepancy changed. Reopen the current record.');
  const allowed=['id','linkedReceivingId','reportDate','doNumber','poNumber','customer','companyId','sku','productName','expectedQty','actualQty','issueType','itemCondition','actionTaken','pic','remarks','photo','resolved','createdAt','updatedAt','updatedBy'];
  if(!input.data||Object.keys(input.data).some(k=>!allowed.includes(k)))fail('invalid-argument','Unsupported discrepancy fields.');
  const next={...old,...input.data,id:input.id,guardianRequestId:input.operationId,updatedAt:now(),updatedBy:p.email};
  try{G.validate('discrepancy',next,old);}catch(e){fail('invalid-argument',e.message);}if(typeof next.resolved!=='boolean')fail('invalid-argument','Resolved must be a boolean.');
  const parents=new Map();for(const id of new Set([old?.linkedReceivingId,next.linkedReceivingId].filter(Boolean))){const r=db.doc('receivings/'+refId(id)),s=await tx.get(r);if(!s.exists)fail('failed-precondition','The linked receiving no longer exists.');if(id===next.linkedReceivingId&&s.data().companyId!==next.companyId)fail('failed-precondition','The linked receiving belongs to another company.');parents.set(id,s);}
  await afterRead('save-discrepancy');
  for(const s of parents.values())tx.update(s.ref,{guardianLinkVersion:(s.data().guardianLinkVersion||0)+1});
  tx.set(ref,next);return {id:input.id,updatedAt:next.updatedAt};
 });}
 async function deleteRecords(auth,input){return perform(auth,input,'delete-records',async(tx,p)=>{
  const rec=input.receiving||[],disc=input.discrepancies||[];
  if(!Array.isArray(rec)||!Array.isArray(disc)||!rec.length&&!disc.length||rec.length+disc.length>50)fail('invalid-argument','Select between 1 and 50 records.');
  if(input.scope==='all'&&p.role!=='admin')fail('permission-denied','Admin access required.');
  const targets=new Map(),parents=new Map();
  for(const [collection,list] of [['receivings',rec],['discrepancies',disc]])for(const item of list){const s=await tx.get(db.doc(collection+'/'+refId(item.id)));if(!s.exists)fail('not-found','A selected record no longer exists.');if((s.data().updatedAt||null)!==(item.updatedAt||null))fail('failed-precondition','A selected record changed. Refresh before deleting.');targets.set(s.ref.path,s);}
  for(const item of rec){
   const parent=targets.get('receivings/'+item.id),r=parent.data();
   const children=await tx.get(db.collection('discrepancies').where('linkedReceivingId','==',item.id));for(const s of children.docs)targets.set(s.ref.path,s);
   const slots=await tx.get(db.collection('booking_slots').where('receivingId','==',item.id));for(const s of slots.docs)targets.set(s.ref.path,s);
   const claim=await tx.get(db.doc('guardian_do_keys/'+G.claimKey(r.companyId,r.doNumber)));
   if(claim.exists){if(claim.data().receivingId!==item.id)fail('failed-precondition','DO reservation ownership is inconsistent.');targets.set(claim.ref.path,claim);}
  }
  for(const s of targets.values())if(s.ref.parent.id==='discrepancies'&&s.data().linkedReceivingId){const id=s.data().linkedReceivingId;if(!targets.has('receivings/'+id)&&!parents.has(id)){const parent=await tx.get(db.doc('receivings/'+refId(id)));if(!parent.exists)fail('failed-precondition','A linked parent is missing; repair is required.');parents.set(id,parent);}}
  await afterRead('delete-records');
  archive(tx,input.operationId,p,[...targets.values()],'delete-records');
  for(const s of parents.values())tx.update(s.ref,{guardianLinkVersion:(s.data().guardianLinkVersion||0)+1});
  for(const s of targets.values()){tx.delete(s.ref);if(['receivings','discrepancies'].includes(s.ref.parent.id))tx.set(db.doc('guardian_tombstones/'+s.ref.path.replace('/','__')),{operationId:input.operationId,deletedAt:now()});}
  return {deleted:[...targets.keys()],backupId:input.operationId};
 });}
 async function restoreDeletion(auth,input){return perform(auth,input,'restore-deletion',async(tx,p)=>{
  if(!validId(input.backupId))fail('invalid-argument','Invalid backup ID.');
  const root=db.doc('guardian_backups/'+input.backupId),backup=await tx.get(root);
  if(!backup.exists||backup.data().action!=='delete-records'||backup.data().restored)fail('failed-precondition','Backup is missing or already restored.');
  const docs=await tx.get(root.collection('documents')),paths=new Set(backup.data().paths);
  if(docs.size!==paths.size||paths.size>100)fail('failed-precondition','Incomplete or oversized backup.');
  const parents=new Map();
  for(const s of docs.docs){const d=s.data();if(!paths.has(d.path)||! /^(receivings|discrepancies|booking_slots|guardian_do_keys)\/[^/]+$/.test(d.path)||digest(d.data)!==d.hash)fail('failed-precondition','Backup integrity check failed.');if((await tx.get(db.doc(d.path))).exists)fail('already-exists','Restore would overwrite live data. Nothing was restored.');if(d.path.startsWith('discrepancies/')&&d.data.linkedReceivingId&&!paths.has('receivings/'+d.data.linkedReceivingId)){const parent=await tx.get(db.doc('receivings/'+refId(d.data.linkedReceivingId)));if(!parent.exists||parent.data().companyId!==d.data.companyId)fail('failed-precondition','Cannot restore a discrepancy without its parent.');parents.set(parent.id,parent);}}
  for(const s of parents.values())tx.update(s.ref,{guardianLinkVersion:(s.data().guardianLinkVersion||0)+1});
  for(const s of docs.docs){const d=s.data();tx.create(db.doc(d.path),{...d.data,updatedAt:now(),guardianRequestId:input.operationId});if(/^(receivings|discrepancies)\//.test(d.path))tx.delete(db.doc('guardian_tombstones/'+d.path.replace('/','__')));}
  tx.update(root,{restored:true,restoredAt:now(),restoredBy:p.uid,restoreOperationId:input.operationId});return {restored:[...paths],backupId:input.backupId};
 },true);}
 return {saveDiscrepancy,deleteRecords,restoreDeletion};
}
module.exports={createService,digest,canonical};
