/* Receiving App Guardian. Deterministic recovery only; Firestore rules remain the security boundary. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReceivingGuardian = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const roles = new Set(['admin', 'staff', 'client']);
  const temporary = new Set(['unavailable', 'deadline-exceeded', 'aborted', 'resource-exhausted', 'auth/network-request-failed']);
  function fault(code, message) { return Object.assign(new Error(message), {code}); }
  function profile(data, user) {
    if (!data || !roles.has(data.role) || data.active === false) throw fault('guardian/profile-invalid', 'Account access could not be verified. Ask an admin to check the account profile.');
    if (String(data.email || '').toLowerCase() !== String(user.email || '').toLowerCase()) throw fault('guardian/profile-mismatch', 'Account identity does not match its saved profile.');
    if (data.role === 'client' && (!data.companyId || data.companyId === '__ALL__' || !data.companyName)) throw fault('guardian/company-invalid', 'The account needs an assigned company.');
    return {...data, uid:user.uid};
  }
  function access(p) { return JSON.stringify([p.uid, p.role, p.companyId, p.companyName, p.active !== false]); }
  function validDate(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v; }
  function claimKey(companyId,doNumber) {const part=v=>String(v).replace(/%/g,'%25').replace(/\//g,'%2F').replace(/\|/g,'%7C');return part(companyId)+'|'+part(String(doNumber).trim().toLowerCase());}
  function quantity(v, blank=false) { return blank && v === '' || typeof v === 'number' && Number.isFinite(v) && v >= 0; }
  function stage(r) { return r.completionTime ? 3 : r.startTime ? 2 : r.arrivalTime ? 1 : 0; }
  function validate(kind, next, previous) {
    if (!next || typeof next !== 'object') throw fault('guardian/invalid-data', 'Invalid record.');
    function check(value){if(value===undefined||typeof value==='number'&&!Number.isFinite(value))throw fault('guardian/invalid-data','Undefined or non-finite values cannot be saved.');if(value&&typeof value==='object')Object.values(value).forEach(check);}
    check(next);
    const required = kind === 'receiving' ? ['doNumber','poNumber','customer','companyId','shipmentDate','vehicleNumber','transportType'] : kind === 'discrepancy' ? ['doNumber','poNumber','customer','companyId','reportDate','sku','productName','issueType','itemCondition','actionTaken','pic'] : [];
    for (const k of required) if (typeof next[k] !== 'string' || !next[k].trim()) throw fault('guardian/invalid-data', 'Missing required field: '+k);
    if (required.length) {
      if (!quantity(next.expectedQty) || !quantity(next.actualQty, kind === 'receiving' && !next.completionTime)) throw fault('guardian/invalid-quantity', 'Quantities must be finite, non-negative numbers.');
      if (!validDate(next.shipmentDate || next.reportDate)) throw fault('guardian/invalid-date', 'Enter a valid date.');
    }
    if (kind === 'receiving') {
      const times = ['arrivalTime','startTime','completionTime'];
      for (let i=0;i<times.length;i++) {
        const v=next[times[i]];
        if (v && (!Number.isFinite(Date.parse(v)) || i>0 && (!next[times[i-1]] || Date.parse(v)<Date.parse(next[times[i-1]])))) throw fault('guardian/status-transition', 'Receiving timestamps must follow Arrived, Start, Complete.');
        if (previous?.[times[i]] && previous[times[i]] !== v) throw fault('guardian/status-transition', 'A recorded milestone cannot be overwritten. Refresh the record.');
      }
      if (stage(next) > stage(previous || {}) + 1) throw fault('guardian/status-transition', 'Complete each receiving milestone in order.');
    }
    if (kind === 'discrepancy' && next.photo && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(next.photo) || next.photo.length>700000)) throw fault('guardian/invalid-photo', 'The evidence photo is invalid or too large.');
    if (kind === 'return' && (!next.tracking || !Array.isArray(next.items) || !next.items.length || next.items.some(i=>!i.sku || !quantity(i.qty) || i.qty<1))) throw fault('guardian/invalid-data', 'Return items need SKU and valid quantity.');
  }
  function create({db,auth,stamp=()=>new Date().toISOString(),sleep=ms=>new Promise(r=>setTimeout(r,ms)),timeoutMs=15000,onIncident=()=>{},onHealth=()=>{}}) {
    const locks=new Map(), incidents=[], health={}, jobs=new Map();
    let identity=null, generation=0;
    const uuid=()=>globalThis.crypto.randomUUID();
    function setHealth(module,state) { health[module]={state,checkedAt:stamp()}; try{onHealth(health);}catch{} }
    function summary(op,data) {
      const state={path:op.ref.path||op.ref.id,exists:!!data};
      for(const k of ['role','active','companyId','roleLocked','updatedAt','guardianRequestId'])if(data&&data[k]!==undefined)state[k]=data[k];
      if(op.kind==='receiving'&&data)state.stage=stage(data);
      return state;
    }
    function report(module,action,error,severity='ERROR',extra={}) {
      // Deliberately exclude request bodies, passwords, tokens, photos and raw API payloads.
      const item={id:'RG-'+uuid(),at:stamp(),uid:identity?.uid||'',role:identity?.role||'',module,action,severity,code:String(error?.code||'unknown').slice(0,120),message:String(error?.message||error||'Unknown error').slice(0,300),result:'UNRESOLVED',guardianAction:'CONTAIN_AND_REPORT',apiResponse:{code:String(error?.code||'unknown')},...extra};
      incidents.unshift(item);if(incidents.length>200)incidents.pop();
      try{onIncident(item);}catch{}
      return item;
    }
    async function retryRead(fn,module='Database') {
      let incident;
      for(let attempt=0;attempt<3;attempt++) {
        try {let readTimer;const value=await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{readTimer=setTimeout(()=>reject(fault('deadline-exceeded','Server read timed out.')),timeoutMs);})]).finally(()=>clearTimeout(readTimer));if(incident){incident.result='RECOVERED';incident.recoveredAt=stamp();try{onIncident(incident);}catch{}}setHealth(module,'HEALTHY');return value;}
        catch(e){if(e.code==='unauthenticated'&&attempt===0&&auth.currentUser){await auth.currentUser.getIdToken(true);continue;}if(!incident)incident=report(module,'read',e);if(!temporary.has(e.code)||attempt===2){setHealth(module,'DEGRADED');throw e;}setHealth(module,'RECOVERING');await sleep(300*2**attempt);}
      }
    }
    async function readProfile(user=auth.currentUser) {
      if(!user)throw fault('unauthenticated','Please sign in again.');
      return retryRead(async()=>{
        const snap=await db.collection('users').doc(user.uid).get({source:'server'});
        if(!snap.exists)throw fault('guardian/profile-missing','No authoritative account profile exists. An admin must assign access; login will not invent a role.');
        if(snap.metadata?.fromCache||snap.metadata?.hasPendingWrites)throw fault('guardian/profile-unconfirmed','Account permissions have not been confirmed by the server.');
        return profile(snap.data(),user);
      },'Authentication');
    }
    function setIdentity(value) {generation++;identity=value?{...value}:null;jobs.clear();if(!value){incidents.length=0;Object.keys(health).forEach(k=>delete health[k]);}}
    async function assertAccess(editor=true) {
      const expected=identity, epoch=generation;
      const p=await readProfile();
      if(epoch!==generation || !expected || access(expected)!==access(p)) {setHealth('Permissions','CRITICAL');throw fault('guardian/access-changed','Account permissions changed. Reconfirm your session before continuing. Your form is retained.');}
      if(editor&&!['admin','staff'].includes(p.role))throw fault('permission-denied','Staff or admin access is required.');
      return p;
    }
    async function run(key,fn) {
      if(locks.has(key))throw fault('guardian/busy','This action is still being verified. Keep this page open.');
      let timeoutIncident;
      const work=Promise.resolve().then(fn).then(value=>{if(timeoutIncident){timeoutIncident.result='RECOVERED';timeoutIncident.recoveredAt=stamp();try{onIncident(timeoutIncident);}catch{}}return value;});
      locks.set(key,work);let timer;
      work.finally(()=>{if(locks.get(key)===work)locks.delete(key);}).catch(()=>{});
      try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{const e=fault('guardian/outcome-unknown','The server has not confirmed the result yet. Your input is retained; do not create a replacement record.');timeoutIncident=report(key.split(':')[0],'timeout',e);setHealth(key.split(':')[0],'RECOVERING');reject(e);},timeoutMs);})]);}
      finally{clearTimeout(timer);}
    }
    // A retry reuses the original immutable operation while its outcome is unverified.
    async function commit(key,operations,{editor=true,admin=false}={}) {
      const epoch=generation;
      return run(key,async()=>{
        let job=jobs.get(key);
        if(job && job.uncertain) operations=job.operations;
        else {job={id:uuid(),operations:operations.map(o=>{if(o.data)validate('structure',o.data);return {...o,data:o.data?JSON.parse(JSON.stringify(o.data)):null};}),uncertain:true};jobs.set(key,job);operations=job.operations;}
        let incident;
        const evidence=()=>({requestId:job.id,previousState:job.previousState||[],attemptedState:operations.slice(0,100).map(op=>({...summary(op,op.data),operation:op.remove?'DELETE':'WRITE'}))});
        try {
          const actor=await assertAccess(editor);
          if(admin&&actor.role!=='admin')throw fault('permission-denied','Admin access required.');
          const actorRef=db.collection('users').doc(actor.uid);
          const transact=()=>db.runTransaction(async tx=>{
            const actorSnap=await tx.get(actorRef);
            const fresh=profile(actorSnap.data(),auth.currentUser||{});
            if(epoch!==generation||access(fresh)!==access(actor))throw fault('guardian/access-changed','Permissions changed during the operation.');
            const snapshots=[];for(const op of operations){snapshots.push(await tx.get(op.ref));if(op.parent){const parent=await tx.get(op.parent);if(!parent.exists||parent.data().companyId!==op.data.companyId)throw fault('guardian/invalid-link','The linked receiving record is missing or belongs to another company.');}}
            job.previousState=snapshots.slice(0,100).map((s,i)=>summary(operations[i],s.exists?s.data():null));
            if(epoch!==generation||auth.currentUser?.uid!==actor.uid)throw fault('guardian/session-changed','Session changed during the operation.');
            if(snapshots.every((s,i)=>operations[i].remove?!s.exists:s.exists&&s.data().guardianRequestId===job.id))return;
            for(let i=0;i<operations.length;i++) {
              const op=operations[i],s=snapshots[i],old=s.exists?s.data():null;
              if(op.create&&old)throw fault('guardian/conflict','This record or booking slot already exists. Refresh before retrying.');
              if(op.base !== undefined && (old?.updatedAt||null)!==op.base)throw fault('guardian/conflict','Another user changed this record. Your input is retained; reopen the latest saved record before applying your changes.');
              if(op.requireExists&&!old)throw fault('guardian/not-found','The saved record no longer exists.');
              if(op.claim && old && old.receivingId!==op.data.receivingId)throw fault('guardian/duplicate','This DO Number already belongs to another receiving record.');
              if(op.slot && old?.booked!==false && old)throw fault('guardian/slot-booked','This time slot is already booked.');
              if(op.owner && old && old.receivingId!==op.owner)throw fault('guardian/conflict','A duplicate reservation belongs to another record.');
              if(op.remove){tx.delete(op.ref);continue;}
              const next={...old,...op.data,guardianRequestId:job.id};
              validate(op.kind,next,old);
              tx.set(op.ref,{...op.data,guardianRequestId:job.id},{merge:true});
            }
          });
          for(let attempt=0;;attempt++){try{await transact();break;}catch(e){if(!temporary.has(e.code)||attempt===2)throw e;if(!incident)incident=report(key.split(':')[0],'retry',e,'WARNING',{...evidence(),guardianAction:'RETRY_SAME_REQUEST'});setHealth(key.split(':')[0],'RECOVERING');await sleep(300*2**attempt);}}
          // A backend commit alone is not the success UI: verify each result from the server.
          await retryRead(async()=>{
            for(const op of operations){const s=await op.ref.get({source:'server'});if(op.remove?s.exists:!s.exists||s.metadata?.hasPendingWrites||s.metadata?.fromCache||s.data().guardianRequestId!==job.id)throw fault('guardian/verification-failed','Saved result could not be verified. Your input is retained.');}
          });
          if(epoch!==generation)throw fault('guardian/session-changed','Session changed while saving. Sign in to check the saved result.');
          if(incident){incident.result='RECOVERED';incident.recoveredAt=stamp();try{onIncident(incident);}catch{}}
          job.uncertain=false;jobs.delete(key);setHealth(key.split(':')[0],'HEALTHY');
          return {requestId:job.id};
        } catch(e) {
          incident=report(key.split(':')[0],'commit',e,/permission|profile|access/.test(e.code)?'CRITICAL':'ERROR',evidence());
          if(!temporary.has(e.code)&&!['guardian/verification-failed','guardian/session-changed'].includes(e.code)){job.uncertain=false;jobs.delete(key);}
          setHealth(key.split(':')[0],'DEGRADED');throw e;
        }
      });
    }
    function isolate(module,fn) {try{return fn();}catch(e){report(module,'render',e);setHealth(module,'DEGRADED');}}
    return {readProfile,setIdentity,assertAccess,commit,run,retryRead,report,setHealth,isolate,incidents,health,locks,get identity(){return identity;}};
  }
  return {create,profile,access,validate,validDate,quantity,stage,fault,claimKey};
});
