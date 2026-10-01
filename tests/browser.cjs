const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {createRequire}=require('node:module');
const runtimeRequire=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright','package.json')):require;
const {chromium}=runtimeRequire('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.GUARDIAN_CHROMIUM_PATH?{executablePath:process.env.GUARDIAN_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}: {})});const context=await browser.newContext();
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.hostname!=='guardian.test')return route.fulfill({body:'',contentType:'application/javascript'});
  const filename=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(filename.includes('..'))return route.abort();
  if(filename==='guardian-config.js')return route.fulfill({body:'window.RECEIVING_GUARDIAN_CONFIG={functionsRegion:"test"}',contentType:'application/javascript'});
  if(filename==='mock.js')return route.fulfill({body:fs.readFileSync('tests/firebase-double.js','utf8'),contentType:'application/javascript'});
  if(!fs.existsSync(filename))return route.fulfill({status:404,body:''});
  let body=fs.readFileSync(filename);
  if(filename==='index.html')body=body.toString().replace('<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>','<script src="/mock.js"></script>');
  return route.fulfill({body,contentType:filename.endsWith('.js')?'application/javascript':filename.endsWith('.css')?'text/css':'text/html'});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 async function signIn(email){await page.fill('#loginId',email);await page.fill('#loginPassword','fixture-password');await page.click('#loginSubmitBtn');await page.waitForFunction(()=>!document.body.classList.contains('logged-out'));}
 async function menu(){if(!await page.locator('#sidebar').evaluate(el=>el.classList.contains('open')))await page.click('#mobileMenu');}
 async function section(name){await menu();await page.click(`[data-section="${name}"]`);if(await page.locator('#menuBackdrop').evaluate(el=>el.classList.contains('show')))await page.click('#menuBackdrop');}
 async function fillReceiving(doNumber){for(const [id,value] of Object.entries({doNumber,poNumber:'PO-TEST',expectedQty:'12',staffName:'Test Staff',vehicleNumber:'TEST123'}))await page.fill('#'+id,value);await page.selectOption('#transportType','Lorry');}
 try{
 await page.goto('https://guardian.test/');await signIn('admin@example.test');
 await page.waitForSelector('#guardianButton',{state:'attached'});
 assert.equal(await page.locator('#signedInUser').innerText(),'Admin · ADMIN');
 console.log('PASS: admin login, Guardian panel, original dashboard render');
 await page.reload();await page.waitForSelector('#guardianButton',{state:'attached'});assert.equal(await page.evaluate(()=>__mock.records.get('users/admin').role),'admin');
 await page.click('#logoutBtn');await page.waitForFunction(()=>document.body.classList.contains('logged-out'));await signIn('admin@example.test');console.log('PASS: refresh and relogin preserve authoritative Admin role');
 await page.selectOption('#companyWorkspace','Airali');await section('receiving');await fillReceiving('DO-FAIL');
 await page.evaluate(()=>__mock.fail());await page.click('#arrivedBtn');await page.waitForSelector('#receivingError.show');
 assert.equal(await page.inputValue('#doNumber'),'DO-FAIL');assert.equal(await page.locator('#receivingForm').getAttribute('data-arrival-time'),'');assert.equal(await page.locator('#startBtn').isDisabled(),true);
 assert.match(await page.locator('#receivingError').innerText(),/rejected|permission/i);
 await page.waitForFunction(()=>[...__mock.records].some(([k,v])=>k.startsWith('guardian_incidents/')&&v.code==='permission-denied'));
 console.log('PASS: failed database write preserves input, logs incident, and does not advance milestone');
 await menu();await page.click('#guardianButton');await page.click('#guardianHistoryButton');await page.waitForFunction(()=>document.querySelector('#guardianHistory').textContent.includes('permission-denied'));await page.click('#guardianCheck');await page.waitForFunction(()=>window.wrsGuardian.health.API?.state==='HEALTHY');await page.click('#guardianClose');console.log('PASS: Admin health checks and persisted incident history');
 await page.click('#arrivedBtn');await page.waitForFunction(()=>!!document.querySelector('#receivingForm').dataset.arrivalTime);
 await page.click('#startBtn');await page.waitForFunction(()=>!!document.querySelector('#receivingForm').dataset.startTime);
 await page.click('#completeBtn');await page.waitForFunction(()=>!!document.querySelector('#receivingForm').dataset.completionTime);
 assert.equal(await page.evaluate(()=>[...__mock.records.keys()].filter(x=>x.startsWith('receivings/')).length),1);
 console.log('PASS: Arrived → Start → Complete saves one receiving record');
 await page.fill('#receivingRemarks','Verified edit');await page.click('#receivingForm button[type=submit]');await page.waitForFunction(()=>[...__mock.records].some(([k,v])=>k.startsWith('receivings/')&&v.remarks==='Verified edit'));console.log('PASS: edit preserves completed milestones');
 await page.click('#resetReceivingBtn');await fillReceiving('DO-DOUBLE');await page.evaluate(()=>__mock.hold());
 await page.evaluate(()=>{const f=document.querySelector('#receivingForm');f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
 await page.waitForFunction(()=>document.querySelector('#receivingError').textContent.includes('still being verified'));
 await page.evaluate(()=>__mock.release());await page.waitForFunction(()=>document.querySelector('#doNumber').value==='');
 assert.equal(await page.evaluate(()=>[...__mock.records].filter(([k,v])=>k.startsWith('receivings/')&&v.doNumber==='DO-DOUBLE').length),1);
 console.log('PASS: double submit produces exactly one record');
 await menu();await page.click('#manageAccountsBtn');
 await page.selectOption('.account-role-select[data-uid="staff"]','admin');await page.click('[data-account-action="save-role"][data-uid="staff"]');
 await page.waitForFunction(()=>__mock.records.get('users/staff').role==='admin');
 assert.equal(await page.evaluate(()=>[...__mock.records.keys()].filter(k=>k.startsWith('guardian_role_audit/')).length),1);
 await page.click('#closeAccountsModal');console.log('PASS: Save Role reads selected role and commits audit atomically');
 await section('discrepancy');for(const [id,value] of Object.entries({discDONumber:'DO-DISC',discPONumber:'PO',sku:'SKU',productName:'Item',discExpectedQty:'5',discActualQty:'4',personInCharge:'Tester'}))await page.fill('#'+id,value);
 await page.selectOption('#issueType',{label:'Damaged Item'});await page.selectOption('#itemCondition','Damaged');await page.selectOption('#actionTaken','Return to Sender');
 await page.click('#discrepancyForm button[type="submit"]');await page.waitForFunction(()=>[...__mock.records.keys()].some(k=>k.startsWith('discrepancies/')));console.log('PASS: discrepancy form saves');
 await section('return');await page.click('#rtNew');await page.fill('#rTracking','TRACK-TEST');await page.fill('#rItems .sku','SKU-RETURN');await page.fill('#rItems .qty','2');await page.click('#rDraft');await page.waitForFunction(()=>[...__mock.records.keys()].some(k=>k.startsWith('returns/')));console.log('PASS: existing Return module saves through Guardian');
 await section('receiving');await fillReceiving('DO-DRAFT');
 await page.evaluate(()=>{const u=__mock.records.get('users/admin');__mock.records.set('users/admin',{...u,role:'client',companyId:'airali',companyName:'Airali'});__mock.notify();});
 await page.waitForFunction(()=>document.body.classList.contains('logged-out'));
 assert.equal(await page.locator('#guardianButton').count(),0);assert.equal(await page.locator('#receivingTableBody').innerText(),'');assert.equal(await page.locator('#statsGrid').innerText(),'');assert.equal(await page.locator('#rtA').innerText(),'0');
 console.log('PASS: changed permissions isolate session and clear previously visible data');
 await signIn('client@example.test');assert.equal(await page.locator('#guardianButton').count(),0);assert.equal(await page.locator('#companyWorkspace').isDisabled(),true);
 await section('booking');for(const [id,value] of Object.entries({bookingDONumber:'DO-BOOK',bookingPONumber:'PO-BOOK',bookingVehicleNumber:'VAN',bookingExpectedQty:'3'}))await page.fill('#'+id,value);await page.selectOption('#bookingTransportType','Van');
 await page.locator('[data-booking-slot]:not([disabled])').first().click();await page.click('#submitBookingBtn');
 await page.waitForFunction(()=>[...__mock.records.values()].some(r=>r.doNumber==='DO-BOOK'));
 assert.equal(await page.evaluate(()=>[...__mock.records.keys()].filter(k=>k.startsWith('booking_slots/')).length),1);
 console.log('PASS: client booking reserves slot and creates scheduled receiving');
 assert.deepEqual(errors,[]);console.log('PASS: no uncaught browser exceptions across tested flows');
 }catch(e){console.error('Browser failure context:',await page.evaluate(()=>({errors:[...document.querySelectorAll('.error-box,.form-error')].map(x=>x.textContent),receivingError:document.querySelector('#receivingError')?.textContent,incidents:window.wrsGuardian?.incidents,uncaught:[]})));console.error('Uncaught:',errors);throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
