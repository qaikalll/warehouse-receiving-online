const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const fcm=fs.readFileSync('fcm-phone-notifications.js','utf8'),app=fs.readFileSync('app.js','utf8');
test('push-token registration cannot overwrite role, company, or activation from a stale profile',async()=>{
 const source=fcm.slice(fcm.indexOf('  async function saveToken('),fcm.indexOf('  async function syncSavedTokenProfile('));let payload;
 const sandbox={SDK_VERSION:'test',console,getProfileData:async()=>({role:'client',companyId:'wrong-company',companyName:'Wrong',active:false}),firebase:{firestore:Object.assign(()=>({collection:()=>({doc:()=>({update:async d=>{payload=d;}})})}),{FieldValue:{arrayUnion:v=>[v]}})}};
 vm.runInNewContext(source+';globalThis.saveToken=saveToken',sandbox);
 assert.equal(await sandbox.saveToken({uid:'admin',email:'admin@test'},'test-token','Admin'),true);
 for(const field of ['role','companyId','companyName','active','roleLocked'])assert.equal(Object.hasOwn(payload,field),false);
 assert.deepEqual(Array.from(payload.fcmTokens),['test-token']);
});
test('login only reads the canonical server profile; no legacy role mutation functions remain',()=>{
 assert.match(app,/async function findUserProfile\(firebaseUser\)\{\s*return guardian.readProfile\(firebaseUser\);/);
 assert.doesNotMatch(app,/function (inferLegacyProfile|saveCanonicalProfile|reconcileProtectedAccountRoles)/);
});
test('role selector uses querySelector; no silent fallback caused by an ID lookup of a CSS selector',()=>{assert.match(app,/const select=document.querySelector\(`\.account-role-select/);assert.doesNotMatch(app,/const select=\$\(`\.account-role-select/);});
test('receiving timestamps are assigned to the form only after verified commit',()=>{
 const status=app.slice(app.indexOf('  async function handleStatusAction('),app.indexOf('  async function handleRecordMilestone('));
 assert.doesNotMatch(status,/dataset\.(arrivalTime|startTime|completionTime)\s*=/);
 const save=app.slice(app.indexOf('  async function saveReceivingRecord('),app.indexOf('  function resetReceivingForm('));
 assert.ok(save.indexOf('await guardian.commit')<save.indexOf("dataset[k]=record[k]"));
});
test('new discrepancy ID is retained across retries and clear data no longer fires parallel independent deletes',()=>{assert.match(app,/discrepancyDraftId \|\|= newDiscrepancyId\(\)/);assert.doesNotMatch(app,/Promise\.all\(\[.*\.delete\(\)/);});
test('Guardian loads before app and active dependencies resolve to existing sources',()=>{const html=fs.readFileSync('index.html','utf8');assert.ok(html.indexOf('./guardian.js')<html.indexOf('./app.js'));for(const match of html.matchAll(/<script[^>]+src="\.\/([^"?]+)[^"]*"/g))assert.equal(fs.existsSync(match[1]),true,match[1]);});

test('Return module cache URL matches the page after Guardian changes',()=>{const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');const src=html.match(/return-module.js\?v=[^"<]+/)[0];assert.ok(sw.includes(src));});
test('receiving date edits move legacy booking slots with complete values and reject invalid slots',async()=>{
 const start=app.indexOf('  async function receivingWriteOperations('),end=app.indexOf('  async function saveReceivingRecord(');
 const ref=id=>({path:'booking_slots/'+id});let old={id:'r1',shipmentDate:'2026-10-01',bookingSlotStart:'08:00',bookingSlotEnd:'08:30'};
 const sandbox={guardian:{retryRead:f=>f()},db:{collection:()=>({where:()=>({get:async()=>({docs:[]})}),doc:ref})},receivingEditBase:'base',receivingRecords:[old],receivingClaim:r=>({ref:{path:'claim/'+r.id},data:{}}),BOOKING_TIME_SLOTS:[{start:'08:00',end:'08:30',label:'08:00 – 08:30',breakTime:false}],bookingSlotDocId:(d,s)=>d+'_'+s.replace(':','')};
 vm.runInNewContext(app.slice(start,end)+';globalThis.ops=receivingWriteOperations',sandbox);
 const record={id:'r1',shipmentDate:'2026-10-02',doNumber:'DO',companyId:'airali',updatedAt:'now'};const ops=await sandbox.ops(record);
 assert.equal(ops[2].remove,true);assert.equal(ops[2].ref.path,'booking_slots/2026-10-01_0800');assert.equal(ops[3].ref.path,'booking_slots/2026-10-02_0800');assert.equal(Object.values(ops[3].data).includes(undefined),false);
 old.bookingSlotEnd='invalid';await assert.rejects(sandbox.ops(record),/invalid/);
});
