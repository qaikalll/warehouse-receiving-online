'use strict';
const {digest}=require('./core.cjs');
// Read-only probes of business data. Only Guardian telemetry is written.
async function monitor(db,auth,{now=()=>new Date(),probe=async()=>{}}={}){
 const checks={};
 async function check(name,fn){try{await probe(name);await fn();checks[name]={state:'HEALTHY'};}catch(e){checks[name]={state:'ERROR',code:String(e.code||'unknown'),message:String(e.message||e).slice(0,300)};}}
 for(const [module,col] of [['Database','companies'],['Receiving','receivings'],['Booking','booking_slots'],['Discrepancy','discrepancies']])await check(module,()=>db.collection(col).limit(1).get());
 const baseline=await db.doc('guardian_config/role_baseline').get();
 if(!baseline.exists||!Array.isArray(baseline.data().accounts)||!baseline.data().accounts.length){checks.Permissions={state:'UNVERIFIED',code:'baseline-missing',message:'An approved role baseline is required.'};checks.Authentication={state:'UNVERIFIED',code:'baseline-missing',message:'No approved accounts available for authentication probe.'};}
 else{
  const accounts=baseline.data().accounts;
  await check('Permissions',async()=>{for(const expected of accounts){const snap=await db.doc('users/'+expected.uid).get(),p=snap.exists?snap.data():null;if(!p||p.role!==expected.role||p.active!==expected.active||p.companyId!==expected.companyId)throw Object.assign(Error('Approved permissions changed for '+expected.uid),{code:'permission-drift'});}});
  await check('Authentication',async()=>{for(const expected of accounts){const user=await auth.getUser(expected.uid);if(user.disabled===expected.active)throw Object.assign(Error('Auth activation differs from approved profile for '+expected.uid),{code:'auth-profile-mismatch'});}});
 }
 await check('Critical incidents',async()=>{
  const incidents=await db.collection('guardian_incidents').where('severity','==','CRITICAL').limit(100).get();
  if(incidents.size===100)throw Object.assign(Error('Incident review requires pagination; health is unverified.'),{code:'review-required'});
  if(incidents.docs.some(s=>s.data().result==='UNRESOLVED'))throw Object.assign(Error('Unresolved critical client incidents require investigation.'),{code:'unresolved-critical'});
 });
 await check('Repeated API failures',async()=>{
  const since=new Date(now().getTime()-15*60000).toISOString();
  const incidents=await db.collection('guardian_incidents').where('at','>=',since).limit(100).get();
  const failures=incidents.docs.filter(s=>/unavailable|deadline|permission|unauth|duplicate|verification|sync|internal/.test(String(s.data().code))&&s.data().result==='UNRESOLVED');
  if(failures.length>=3||incidents.size===100)throw Object.assign(Error('Repeated failures or incomplete incident window require investigation.'),{code:'repeated-failures'});
 });
 const at=now().toISOString();
 for(const [module,result] of Object.entries(checks)){
  const ref=db.doc('guardian_server_incidents/'+digest({module}));
  await db.runTransaction(async tx=>{const old=await tx.get(ref);
   if(result.state!=='HEALTHY')tx.set(ref,{module,...result,severity:module==='Permissions'?'CRITICAL':'ERROR',result:'UNRESOLVED',guardianAction:'CONTAIN_AND_REPORT',firstSeen:old.data()?.firstSeen||at,lastSeen:at}, {merge:true});
   else if(old.exists&&old.data().result==='UNRESOLVED')tx.update(ref,{state:'HEALTHY',result:'RECOVERED',verifiedAt:at,guardianAction:'RECHECK_VERIFIED'});
  });
 }
 const result={checkedAt:at,checks,healthy:Object.values(checks).every(c=>c.state==='HEALTHY'),scope:'Service reachability and approved account invariants; not a full database scan.'};
 await db.doc('guardian_health/current').set(result);return result;
}
module.exports={monitor};
