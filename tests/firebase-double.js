// Deterministic local browser test double. No network or production credentials.
(()=>{
 const records=new Map(JSON.parse(sessionStorage.getItem('mock-records')||'[]')),listeners=new Set(),authListeners=new Set();let failNext=false,hold=false,held=[],readFail=false;
 const users={
  'admin@example.test':{uid:'admin',email:'admin@example.test',role:'admin',active:true,companyId:'__ALL__',companyName:'All Companies',displayName:'Admin'},
  'client@example.test':{uid:'client',email:'client@example.test',role:'client',active:true,companyId:'airali',companyName:'Airali',displayName:'Client'},
  'staff@example.test':{uid:'staff',email:'staff@example.test',role:'staff',active:true,companyId:'__ALL__',companyName:'All Companies',displayName:'Staff'}
 };Object.values(users).forEach(u=>{if(!records.has('users/'+u.uid))records.set('users/'+u.uid,{...u});});
 const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
 function snapshot(path){return {id:path.split('/').pop(),exists:records.has(path),data:()=>clone(records.get(path)),metadata:{fromCache:false,hasPendingWrites:false}};}
 function notify(){sessionStorage.setItem('mock-records',JSON.stringify([...records]));setTimeout(()=>{for(const fn of [...listeners])fn();},0);}
 function reference(path){return {path,id:path.split('/').pop(),get:async()=>{if(readFail)throw Object.assign(Error('Network unavailable'),{code:'unavailable'});return snapshot(path);},set:async(d)=>{records.set(path,{...records.get(path),...clone(d)});notify();},update:async(d)=>{if(!records.has(path))throw Error('not found');records.set(path,{...records.get(path),...clone(d)});notify();},delete:async()=>{records.delete(path);notify();},onSnapshot:(...args)=>{const fn=args.find(x=>typeof x==='function'),run=()=>fn(snapshot(path));listeners.add(run);setTimeout(run,0);return()=>listeners.delete(run);}};}
 function query(col,filters=[],max=Infinity){const get=()=>{const docs=[...records.keys()].filter(p=>p.startsWith(col+'/')&&!p.slice(col.length+1).includes('/')).map(snapshot).filter(s=>filters.every(([k,op,v])=>op==='=='?s.data()[k]===v:true)).slice(0,max);return {docs,empty:!docs.length,metadata:{fromCache:false,hasPendingWrites:false},docChanges:()=>docs.map(doc=>({type:'added',doc}))};};return {doc:id=>reference(col+'/'+(id||crypto.randomUUID())),where:(k,op,v)=>query(col,[...filters,[k,op,v]],max),orderBy:()=>query(col,filters,max),limit:n=>query(col,filters,n),get:async()=>get(),onSnapshot:(...args)=>{const fn=args.find(x=>typeof x==='function'),run=()=>fn(get());listeners.add(run);setTimeout(run,0);return()=>listeners.delete(run);}};}
 const db={collection:query,runTransaction:async fn=>{if(hold)await new Promise(r=>held.push(r));const writes=[];await fn({get:async ref=>snapshot(ref.path),set:(ref,d)=>writes.push([ref.path,{...records.get(ref.path),...clone(d)}]),delete:ref=>writes.push([ref.path,null])});if(failNext){failNext=false;throw Object.assign(Error('Database write rejected'),{code:'permission-denied'});}writes.forEach(([p,d])=>d===null?records.delete(p):records.set(p,d));notify();}};
 const storedUser=users[sessionStorage.getItem('mock-user')];
 const remoteReceipts=new Map();
 const functionsFn=()=>({httpsCallable:name=>async payload=>{
  if(remoteReceipts.has(payload.operationId))return {data:remoteReceipts.get(payload.operationId)};
  let result={verified:true,operationId:payload.operationId};
  if(name==='guardianSaveDiscrepancy'){
   const ref=reference('discrepancies/'+payload.id),at=new Date().toISOString();
   await db.runTransaction(async tx=>{const old=await tx.get(ref);if((old.data()?.updatedAt||null)!==(payload.base||null))throw Object.assign(Error('Record changed'),{code:'functions/failed-precondition'});tx.set(ref,{...payload.data,guardianRequestId:payload.operationId,updatedAt:at});});result={...result,id:payload.id,updatedAt:at};
  }else if(name==='guardianDeleteRecords'){
   const paths=new Set((payload.discrepancies||[]).map(d=>'discrepancies/'+d.id));
   for(const r of payload.receiving||[]){paths.add('receivings/'+r.id);for(const [path,data] of records)if(data.linkedReceivingId===r.id||data.receivingId===r.id)paths.add(path);}
   await db.runTransaction(async tx=>{for(const path of paths)tx.delete(reference(path));});result={...result,deleted:[...paths],backupId:payload.operationId};
  }else throw Error('Unsupported test callable: '+name);
  remoteReceipts.set(payload.operationId,result);return {data:result};
 }});
 const auth={currentUser:storedUser?{uid:storedUser.uid,email:storedUser.email,getIdToken:async()=> 'fixture-token'}:null,setPersistence:async()=>{},onAuthStateChanged:fn=>{authListeners.add(fn);setTimeout(()=>fn(auth.currentUser),0);return()=>authListeners.delete(fn);},signInWithEmailAndPassword:async email=>{const p=users[email];if(!p)throw Error('Unknown fixture');sessionStorage.setItem('mock-user',email);auth.currentUser={uid:p.uid,email:p.email,getIdToken:async()=> 'fixture-token'};for(const fn of authListeners)fn(auth.currentUser);return {user:auth.currentUser};},signOut:async()=>{sessionStorage.removeItem('mock-user');auth.currentUser=null;for(const fn of authListeners)fn(null);},sendPasswordResetEmail:async()=>{}};
 const authFn=()=>auth;authFn.Auth={Persistence:{LOCAL:'local'}};
 const firestore=()=>db;firestore.FieldValue={serverTimestamp:()=> 'fixture-server-time',arrayUnion:v=>[v]};
 window.firebase={apps:[{}],app:()=>({functions:functionsFn}),initializeApp:()=>({auth:authFn,delete:async()=>{}}),auth:authFn,firestore};
 window.__mock={records,notify,fail:()=>failNext=true,hold:()=>hold=true,release:()=>{hold=false;held.splice(0).forEach(r=>r());},offline:v=>readFail=v,users};
 localStorage.setItem('wrs_tutorial_preferences_v2',JSON.stringify({'admin@example.test':true,'client@example.test':true,'staff@example.test':true}));
})();
