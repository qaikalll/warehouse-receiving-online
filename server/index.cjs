'use strict';
const {initializeApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {setGlobalOptions}=require('firebase-functions/v2');
const logger=require('firebase-functions/logger');
const {createService}=require('./core.cjs');
const {monitor}=require('./monitor.cjs');
initializeApp();setGlobalOptions({region:process.env.GUARDIAN_REGION||'us-central1',maxInstances:3});
const db=getFirestore(),service=createService(db);
const wrap=method=>onCall({timeoutSeconds:120},async request=>{
 try{return await service[method](request.auth,request.data);}catch(e){
  const allowed=['unauthenticated','permission-denied','invalid-argument','already-exists','not-found','aborted','failed-precondition','resource-exhausted','unavailable'];
  logger.error('Guardian operation rejected',{method,uid:request.auth?.uid||null,code:e.code||'internal'});
  throw new HttpsError(allowed.includes(e.code)?e.code:'internal',allowed.includes(e.code)?e.message:'Operation could not be confirmed. Keep the current operation ID and retry.');
 }
});
exports.guardianSaveDiscrepancy=wrap('saveDiscrepancy');
exports.guardianDeleteRecords=wrap('deleteRecords');
exports.guardianRestoreDeletion=wrap('restoreDeletion');
exports.guardianMonitor=onSchedule({schedule:'every 5 minutes',timeZone:'Asia/Kuala_Lumpur',timeoutSeconds:120,retryCount:2},async()=>{
 const health=await monitor(db,getAuth());
 logger.info('guardian-monitor-heartbeat',{healthy:health.healthy,checkedAt:health.checkedAt});
 if(!health.healthy)logger.error('Guardian health degraded',{checks:health.checks});
});
