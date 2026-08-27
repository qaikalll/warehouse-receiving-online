
(() => {
  'use strict';
  const firebaseConfig = {
    apiKey: "AIzaSyAGDRTLXWaCWZpNdqA8KIBoUYJWBEq8qFM",
    authDomain: "warehouse-receiving-online.firebaseapp.com",
    projectId: "warehouse-receiving-online",
    storageBucket: "warehouse-receiving-online.firebasestorage.app",
    messagingSenderId: "655223366420",
    appId: "1:655223366420:web:7437455a7908e31e521801",
    measurementId: "G-FV5D6TBVR1"
  };
  const firebaseApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{});
  const RECEIVING_KEY = 'wrs_receiving_records_v1';
  const DISCREPANCY_KEY = 'wrs_discrepancy_records_v1';
  const ACTIVE_COMPANY_KEY = 'wrs_active_company_v1';
  const ACCOUNTS_KEY = 'wrs_login_accounts_v1';
  const COMPANIES_KEY = 'wrs_companies_v1';
  const SESSION_KEY = 'wrs_login_session_v1';
  const TUTORIAL_KEY = 'wrs_tutorial_preferences_v2';
  const THEME_KEY = 'wrs_theme_mode_v1';
  const ALL_COMPANIES = '__ALL__';
  const DEFAULT_COMPANIES = ["Airali", "UCMAS", "Alard", "Zucca", "Audrey", "BUM", "AvantHealth", "BeastKingdom", "Commbax", "CoyaCozy", "Beoka", "DiademSports", "GalaxySports", "Warrix001-B2C", "Warrix002-B2B", "VictorSports", "Mills", "DouDouTrading", "EarthHome", "EarthNMe", "HarmanKardon", "Marna/Mare", "MYNT", "OGAWA", "Jacko", "Kimma", "LaMaison", "Lert", "Darizi", "Miseoul-KMT", "MonoDigital", "Morveen", "Quka", "Peacock", "Roofless", "SammoorBeauty", "Skinville", "Yondson", "Trainix", "KSM", "MJM", "RevEdition (HOKA)", "SerbaWangi", "NexGen", "ECCIATO", "Golden Choice", "Tong Kee", "MUSE", "PIXX", "Showtv"];
  let COMPANIES = [...DEFAULT_COMPANIES];
  let onlineCompanies = [];
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

  let activeCompany = localStorage.getItem(ACTIVE_COMPANY_KEY) || ALL_COMPANIES;
  if (activeCompany !== ALL_COMPANIES && !COMPANIES.includes(activeCompany)) activeCompany = ALL_COMPANIES;
  let receivingRecords = [];
  let discrepancyRecords = [];
  let selectedPhotoData = '';
  let timerInterval = null;
  let currentUser = null;
  let accounts = [];
  let unsubscribeReceiving = null;
  let unsubscribeDiscrepancy = null;
  let unsubscribeAccounts = null;
  let unsubscribeCompanies = null;
  let tutorialIndex = -1;
  let tutorialPositionTimer = null;
  let tutorialAutoScrollTimer = null;
  let tutorialScrollToken = 0;
  let tutorialMode = 'general';
  let tutorialLanguage = 'en';
  let bookingSlotUnsubscribe = null;
  let bookingSlotsForDate = new Set();
  const LOGIN_LANGUAGE_KEY = 'wrs_login_language_v1';
  let loginLanguage = localStorage.getItem(LOGIN_LANGUAGE_KEY) || 'en';
  let currentTheme = localStorage.getItem(THEME_KEY)==='dark' ? 'dark' : 'light';

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const localDateISO = (date=new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const todayISO = () => localDateISO();
  const nowISO = () => new Date().toISOString();
  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('en-GB') : '-';
  const fmtDateTime = iso => iso ? new Date(iso).toLocaleString('en-GB', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '-';
  const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '-';

  function updateThemeToggleUI(){
    const btn=$('themeToggleBtn'); if(!btn) return;
    const dark=currentTheme==='dark';
    const icon=btn.querySelector('.theme-toggle-icon');
    const label=btn.querySelector('.theme-toggle-label');
    if(icon) icon.textContent = dark ? '☀' : '🌙';
    if(label) label.textContent = dark ? 'Light Mode' : 'Night Mode';
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to night mode');
    btn.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to night mode');
    btn.dataset.theme=currentTheme;
  }
  function applyTheme(theme,announce=false){
    currentTheme = theme==='dark' ? 'dark' : 'light';
    document.body.classList.toggle('theme-dark', currentTheme==='dark');
    document.body.classList.toggle('theme-light', currentTheme!=='dark');
    localStorage.setItem(THEME_KEY,currentTheme);
    updateThemeToggleUI();
    if(announce) toast(currentTheme==='dark' ? 'Night mode enabled.' : 'Light mode enabled.','success');
  }
  function toggleTheme(){ applyTheme(currentTheme==='dark' ? 'light' : 'dark', true); }


  function authErrorMessage(error){
    const map={
      'auth/invalid-credential':'Login ID/email or password is incorrect.',
      'auth/wrong-password':'Login ID/email or password is incorrect.',
      'auth/user-not-found':'Login ID/email or password is incorrect.',
      'auth/user-disabled':'This account has been disabled.',
      'auth/too-many-requests':'Too many attempts. Please try again later.',
      'auth/email-already-in-use':'This email is already registered.',
      'auth/invalid-email':'Please enter a valid email address.',
      'auth/weak-password':'Password must contain at least 6 characters.',
      'permission-denied':'Your Firebase account does not have permission for this action.'
    };
    return map[error?.code] || error?.message || 'Something went wrong.';
  }
  function normalizeDocument(snapshot){const data=snapshot.data();return {...data,id:data.id||snapshot.id,firestoreId:snapshot.id};}
  function companyNameFromId(id){
    const found=COMPANIES.find(c=>companyIdFor(c)===id);
    return found||String(id||'').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())||'Unassigned';
  }
  function mergeCompanyNames(extra=[]){
    const names=[...DEFAULT_COMPANIES,...onlineCompanies,...extra,
      ...accounts.filter(a=>a.role==='client').map(a=>a.companyName),
      ...receivingRecords.map(r=>r.customer),...discrepancyRecords.map(d=>d.customer)]
      .map(v=>String(v||'').trim()).filter(Boolean);
    const unique=[]; names.forEach(n=>{if(!unique.some(x=>x.toLowerCase()===n.toLowerCase()))unique.push(n)});
    COMPANIES=unique.sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
    if(activeCompany!==ALL_COMPANIES&&!COMPANIES.includes(activeCompany)) activeCompany=currentUser?.role==='client'?currentUser.company:ALL_COMPANIES;
    renderCompanyOptions(activeCompany);
  }
  function stopSubscriptions(){
    [unsubscribeReceiving,unsubscribeDiscrepancy,unsubscribeAccounts,unsubscribeCompanies,bookingSlotUnsubscribe].forEach(fn=>{try{fn?.()}catch(e){}});
    unsubscribeReceiving=unsubscribeDiscrepancy=unsubscribeAccounts=unsubscribeCompanies=bookingSlotUnsubscribe=null;
  }
  function renderAll(){mergeCompanyNames();updateWorkspaceUI();renderReceivingTable();renderDiscrepancyTable();renderDashboard();refreshDatalists();}
  function subscribeOnlineData(){
    stopSubscriptions();
    const client=currentUser?.role==='client';
    const recBase=db.collection('receivings'),discBase=db.collection('discrepancies');
    const recQ=client?recBase.where('companyId','==',currentUser.companyId):recBase;
    const discQ=client?discBase.where('companyId','==',currentUser.companyId):discBase;
    unsubscribeReceiving=recQ.onSnapshot(snap=>{receivingRecords=snap.docs.map(normalizeDocument).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));renderAll();},e=>toast('Receiving sync error: '+authErrorMessage(e),'warning'));
    unsubscribeDiscrepancy=discQ.onSnapshot(snap=>{discrepancyRecords=snap.docs.map(normalizeDocument).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));renderAll();},e=>toast('Discrepancy sync error: '+authErrorMessage(e),'warning'));
    if(isAdmin()) unsubscribeAccounts=db.collection('users').onSnapshot(snap=>{accounts=snap.docs.map(d=>({uid:d.id,...d.data()})).filter(a=>a.type!=='company');mergeCompanyNames();renderAccounts();},e=>toast('Account list error: '+authErrorMessage(e),'warning'));
    unsubscribeCompanies=db.collection('companies').onSnapshot(snap=>{onlineCompanies=snap.docs.map(d=>d.data().name||d.id).filter(Boolean);mergeCompanyNames();updateWorkspaceUI();refreshDatalists();},()=>{});
  }
  async function createOnlineAccount(email,password,displayName,role,companyName){
    let secondary=null;
    try{
      secondary=firebase.initializeApp(firebaseConfig,'accountCreator-'+Date.now()+'-'+Math.random().toString(36).slice(2));
      const secondaryAuth=secondary.auth();
      const cred=await secondaryAuth.createUserWithEmailAndPassword(email,password);
      const companyId=role==='client'?companyIdFor(companyName):'ALL';
      await db.collection('users').doc(cred.user.uid).set({email,displayName,role,companyId,companyName:role==='client'?companyName:'All Companies',active:true,createdAt:nowISO(),createdBy:currentUser?.email||''});
      await secondaryAuth.signOut();
      return cred.user.uid;
    }finally{if(secondary)await secondary.delete().catch(()=>{});}
  }
  async function clearWorkspaceData(name){
    const rec=receivingRecords.filter(r=>r.customer===name),disc=discrepancyRecords.filter(d=>d.customer===name);
    await Promise.all([...rec.map(r=>db.collection('receivings').doc(r.id).delete()),...disc.map(d=>db.collection('discrepancies').doc(d.id).delete())]);
  }
  async function clearAllData(){
    await Promise.all([...receivingRecords.map(r=>db.collection('receivings').doc(r.id).delete()),...discrepancyRecords.map(d=>db.collection('discrepancies').doc(d.id).delete())]);
  }
  async function compressImage(file){
    if(!file.type.startsWith('image/'))throw new Error('Please select an image file.');
    const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
    const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=dataUrl});
    const max=1000,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    const out=canvas.toDataURL('image/jpeg',.62);
    if(out.length>650000)throw new Error('Image is still too large. Please use a smaller photo.');
    return out;
  }

  function loadCompanies(){
    try{
      const saved=JSON.parse(localStorage.getItem(COMPANIES_KEY));
      if(Array.isArray(saved)&&saved.length){
        const cleaned=[];
        saved.forEach(name=>{
          const value=String(name||'').trim().replace(/\s+/g,' ');
          if(value&&!cleaned.some(x=>x.toLowerCase()===value.toLowerCase())) cleaned.push(value);
        });
        if(cleaned.length) return cleaned;
      }
    }catch(e){}
    localStorage.setItem(COMPANIES_KEY,JSON.stringify(DEFAULT_COMPANIES));
    return [...DEFAULT_COMPANIES];
  }
  function saveCompanies(){ localStorage.setItem(COMPANIES_KEY,JSON.stringify(COMPANIES)); }
  function loginSlug(value){ return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'').trim(); }
  function companyDefaultPassword(value){ return String(value||'Company').replace(/[^a-z0-9]/gi,'') + '@2026'; }
  function defaultAccounts(){
    return [
      {username:'admin',password:'Admin@2026',role:'admin',company:ALL_COMPANIES,active:true},
      {username:'staff',password:'Warehouse@2026',role:'staff',company:ALL_COMPANIES,active:true},
      ...COMPANIES.map(company=>({username:loginSlug(company),password:companyDefaultPassword(company),role:'client',company,active:true}))
    ];
  }
  function loadAccounts(){
    try{
      const saved=JSON.parse(localStorage.getItem(ACCOUNTS_KEY));
      if(Array.isArray(saved)&&saved.length) return saved;
    }catch(e){}
    const seeded=defaultAccounts(); localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(seeded)); return seeded;
  }
  function saveAccounts(){ localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(accounts)); }
  function isEditor(){ return currentUser && (currentUser.role==='staff'||currentUser.role==='admin'); }
  function isAdmin(){ return currentUser && currentUser.role==='admin'; }
  function requireEditor(){ if(isEditor()) return true; toast('Client access is view-only.','warning'); return false; }
  const LEGACY_ADMIN_EMAIL='ednvines@gmail.com';
  const LAST_LOGIN_HINT_KEY='wrs_last_login_hint_v2';
  function resolveLoginEmail(value){
    const raw=String(value||'').trim().toLowerCase();
    if(raw.includes('@'))return raw;
    const slug=loginSlug(raw);
    if(slug==='admin')return LEGACY_ADMIN_EMAIL;
    if(slug==='staff')return 'staff@warehouse-client.com';
    return `${slug}@warehouse-client.com`;
  }
  function inferLegacyProfile(firebaseUser,loginHint=''){
    const email=String(firebaseUser?.email||'').trim().toLowerCase();
    const raw=String(loginHint||email.split('@')[0]||'').trim();
    const slug=loginSlug(raw||email.split('@')[0]);
    if(slug==='admin'||email===LEGACY_ADMIN_EMAIL){
      return {email,displayName:'Warehouse Admin',role:'admin',companyId:ALL_COMPANIES,companyName:'All Companies',active:true};
    }
    if(slug==='staff'||email==='staff@warehouse-client.com'){
      return {email,displayName:'Warehouse Staff',role:'staff',companyId:ALL_COMPANIES,companyName:'All Companies',active:true};
    }
    const company=COMPANIES.find(name=>loginSlug(name)===slug)||raw||email.split('@')[0];
    return {email,displayName:company,role:'client',companyId:companyIdFor(company),companyName:company,active:true};
  }
  async function findUserProfile(firebaseUser,loginHint=''){
    const email=String(firebaseUser.email||'').trim().toLowerCase();
    const candidates=[];
    try{candidates.push(await db.collection('users').doc(firebaseUser.uid).get());}catch(e){}
    if(email){
      try{candidates.push(await db.collection('users').doc(email).get());}catch(e){}
      try{const q=await db.collection('users').where('email','==',email).limit(1).get();if(!q.empty)candidates.push(q.docs[0]);}catch(e){}
      try{const q=await db.collection('accounts').where('email','==',email).limit(1).get();if(!q.empty)candidates.push(q.docs[0]);}catch(e){}
    }
    const snap=candidates.find(item=>item&&item.exists);
    if(snap)return {id:snap.id,...snap.data()};
    const repaired=inferLegacyProfile(firebaseUser,loginHint);
    try{await db.collection('users').doc(firebaseUser.uid).set({...repaired,uid:firebaseUser.uid,updatedAt:nowISO(),repairedByApp:true},{merge:true});}
    catch(e){console.warn('Profile repair skipped:',e?.code||e?.message||e);}
    return repaired;
  }
  async function openUserSession(firebaseUser,showMessage=true,loginHint=''){
    const profile=await findUserProfile(firebaseUser,loginHint);
    if(profile.active===false){await auth.signOut();throw new Error('This account is disabled.');}
    const role=String(profile.role||profile.userRole||'client').toLowerCase();
    const companyId=profile.companyId||profile.company||profile.companyName||(role==='client'?loginSlug(loginHint):ALL_COMPANIES);
    const company=role==='client'?(profile.companyName||profile.company||companyNameFromId(companyId)):ALL_COMPANIES;
    currentUser={uid:firebaseUser.uid,email:firebaseUser.email,username:loginHint||firebaseUser.email,role,companyId,company,companyName:company,displayName:profile.displayName||profile.name||firebaseUser.email};
    document.body.classList.remove('logged-out','role-client','role-staff','role-admin');
    document.body.classList.add('role-'+currentUser.role);
    $('signedInUser').textContent=`${currentUser.displayName} · ${currentUser.role.toUpperCase()}`;
    if(currentUser.role==='client')activeCompany=currentUser.company;else if(activeCompany!==ALL_COMPANIES&&!COMPANIES.includes(activeCompany))activeCompany=ALL_COMPANIES;
    localStorage.setItem(ACTIVE_COMPANY_KEY,activeCompany);
    applyTheme(currentTheme,false);mergeCompanyNames(currentUser.role==='client'?[currentUser.company]:[]);resetReceivingForm();resetDiscrepancyForm();subscribeOnlineData();resetBookingForm();
    if(showMessage)toast(`Signed in as ${currentUser.displayName}.`,'success');
    if(showMessage&&!tutorialIsCompleted())setTimeout(()=>startTutorial(),650);
  }
  async function logout(){
    closeTutorial(false);stopSubscriptions();stopTimer();currentUser=null;
    try{await auth.signOut();}catch(e){}
    document.body.className='logged-out';applyTheme(currentTheme,false);updateThemeToggleUI();$('loginForm').reset();$('loginError').classList.remove('show');
  }
  function renderAccounts(){
    if(!isAdmin())return;
    const q=$('accountSearch').value.trim().toLowerCase();
    const rows=accounts.filter(a=>!q||[a.email,a.displayName,a.role,a.companyName,a.companyId].join(' ').toLowerCase().includes(q));
    $('accountTableBody').innerHTML=rows.length?rows.map(a=>`<tr><td><strong>${esc(a.email||"-")}</strong></td><td>Firebase Auth</td><td>${esc(a.role||"-")}</td><td>${esc(a.role==="client"?(a.companyName||companyNameFromId(a.companyId)):"All Companies")}</td><td>${a.active?"Active":"Disabled"}</td><td><div class="account-tools"><button class="btn btn-sm btn-outline" data-account-action="copy" data-uid="${a.uid}">Copy</button><button class="btn btn-sm btn-secondary" data-account-action="reset" data-uid="${a.uid}">Reset Password</button>${a.uid!==currentUser.uid?`<button class="btn btn-sm ${a.active?"btn-danger":"btn-success"}" data-account-action="toggle" data-uid="${a.uid}">${a.active?"Disable":"Enable"}</button>`:""}</div></td></tr>`).join(''):'<tr><td colspan="6">No accounts found.</td></tr>';
  }
  function renderCompanyOptions(selectedCompany=activeCompany){
    const workspace=$('companyWorkspace');
    if(workspace){
      workspace.innerHTML=`<option value="${ALL_COMPANIES}">All Companies</option>`+COMPANIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
      workspace.value=(selectedCompany===ALL_COMPANIES||COMPANIES.includes(selectedCompany))?selectedCompany:ALL_COMPANIES;
    }
    const accountCompany=$('newAccountCompany');
    if(accountCompany){
      const previous=accountCompany.value;
      accountCompany.innerHTML=`<option value="${ALL_COMPANIES}">All Companies</option>`+COMPANIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
      accountCompany.value=COMPANIES.includes(previous)?previous:(COMPANIES[0]||ALL_COMPANIES);
    }
  }
  function nextCompanyEmail(company){
    const base=loginSlug(company)||'client';
    let number=1,candidate=base+'@warehouse-client.com';
    const used=new Set(accounts.map(a=>String(a.email||'').toLowerCase()));
    while(used.has(candidate.toLowerCase()))candidate=base+(++number)+'@warehouse-client.com';
    return candidate;
  }
  function openAddCompanyPanel(){
    if(!isAdmin()){toast('Admin access required to add a company.','warning');return;}
    $('addCompanyPanel').classList.add('show');
    $('companyAddError').classList.remove('show');
    $('companyLoginResult').classList.remove('show');
    $('companyLoginResult').innerHTML='';
    $('newCompanyName').value='';
    setTimeout(()=>$('newCompanyName').focus(),40);
  }
  function closeAddCompanyPanel(clearResult=true){
    $('addCompanyPanel').classList.remove('show');
    $('companyAddError').classList.remove('show');
    $('newCompanyName').value='';
    if(clearResult){$('companyLoginResult').classList.remove('show');$('companyLoginResult').innerHTML='';}
  }
  async function addNewCompany(){
    if(!isAdmin()){toast('Admin access required to add a company.','warning');return;}
    const name=$('newCompanyName').value.trim().replace(/\s+/g,' '),error=$('companyAddError');error.classList.remove('show');
    if(!name){error.textContent='Please enter the new company name.';error.classList.add('show');return;}
    if(name.length>80){error.textContent='Company name must be 80 characters or fewer.';error.classList.add('show');return;}
    if(name===ALL_COMPANIES||COMPANIES.some(c=>c.toLowerCase()===name.toLowerCase())){error.textContent='This company already exists in the list.';error.classList.add('show');return;}
    const email=nextCompanyEmail(name),password=companyDefaultPassword(name);
    try{
      await db.collection('companies').doc(companyIdFor(name)).set({name,companyId:companyIdFor(name),active:true,createdAt:nowISO(),createdBy:currentUser.email},{merge:true});
      await createOnlineAccount(email,password,name+' Client','client',name);
      onlineCompanies.push(name);mergeCompanyNames([name]);setActiveCompany(name);
      $('companyLoginResult').innerHTML=`<strong>Company added successfully.</strong><br>Firebase client login was created.<code>Email: ${esc(email)}<br>Password: ${esc(password)}</code><button class="copy-company-login" id="copyNewCompanyLoginBtn" type="button">Copy Login Details</button>`;
      $('companyLoginResult').classList.add('show');$('newCompanyName').value='';
      $('copyNewCompanyLoginBtn').addEventListener('click',()=>{const text=`Warehouse Receiving Sheet\nCompany: ${name}\nEmail: ${email}\nPassword: ${password}`;navigator.clipboard?.writeText(text).then(()=>toast('New company login copied.','success')).catch(()=>prompt('Copy login details:',text));});
      toast(`${name} added and connected to Firebase.`,'success');
    }catch(e){error.textContent=authErrorMessage(e);error.classList.add('show');}
  }
  function updateNewAccountCompany(){
    const client=$('newAccountRole').value==='client';
    $('newAccountCompany').disabled=!client;
    if(!client) $('newAccountCompany').value=ALL_COMPANIES;
    else if($('newAccountCompany').value===ALL_COMPANIES) $('newAccountCompany').value=COMPANIES[0];
  }
  function openNewAccountForm(){
    $('newAccountForm').reset();
    renderCompanyOptions(activeCompany);
    $('newAccountRole').value='client'; $('newAccountCompany').value=COMPANIES[0]||ALL_COMPANIES; updateNewAccountCompany(); hideError('newAccountError');
    $('accountCreateCard').classList.add('show'); $('newAccountUsername').focus();
  }
  function closeNewAccountForm(){ $('accountCreateCard').classList.remove('show'); hideError('newAccountError'); }
  async function createAccount(){
    const email=$('newAccountUsername').value.trim().toLowerCase(),password=$('newAccountPassword').value,role=$('newAccountRole').value;
    const company=role==='client'?$('newAccountCompany').value:ALL_COMPANIES;
    if(!email){showError('newAccountError','Please enter an email address.');return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showError('newAccountError','Please enter a valid email address.');return;}
    if(password.length<6){showError('newAccountError','Password must contain at least 6 characters.');return;}
    if(role==='client'&&!COMPANIES.includes(company)){showError('newAccountError','Please select a company.');return;}
    try{await createOnlineAccount(email,password,email.split('@')[0],role,company);const details=`Warehouse Receiving Sheet\nEmail: ${email}\nTemporary Password: ${password}\nCompany: ${role==="client"?company:"All Companies"}\nRole: ${role}`;navigator.clipboard?.writeText(details).catch(()=>{});closeNewAccountForm();toast('Firebase login created. Details copied to clipboard.');}
    catch(e){showError('newAccountError',authErrorMessage(e));}
  }
  function readStorage(key){
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
  }
  function companyIdFor(name){ return String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'unassigned'; }
  function workspaceName(){ return activeCompany===ALL_COMPANIES ? 'All Companies' : activeCompany; }
  function isAllCompanies(){ return activeCompany===ALL_COMPANIES; }
  function belongsToWorkspace(record){
    if(currentUser?.role==='client') return record.customer===currentUser.company;
    return isAllCompanies() || record.customer===activeCompany;
  }
  function workspaceReceivingRecords(){ return receivingRecords.filter(belongsToWorkspace); }
  function workspaceDiscrepancyRecords(){ return discrepancyRecords.filter(belongsToWorkspace); }
  function safeFilePart(value){ return String(value||'all-companies').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'all-companies'; }
  function saveAll(){/* Firebase onSnapshot keeps local views in sync. */}
  function newRecordId(){return 'RCV-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,5).toUpperCase();}
  function newDiscrepancyId(){return 'DR-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,5).toUpperCase();}
  function num(v){ return Number(v || 0); }
  function variance(expected, actual){ return num(actual) - num(expected); }
  function durationMs(record){
    if (!record.arrivalTime) return 0;
    const end = record.completionTime ? new Date(record.completionTime) : new Date();
    return Math.max(0, end - new Date(record.arrivalTime));
  }
  function formatDuration(ms){
    if (!ms) return '-';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  }
  function baseStatus(record){
    if (record.completionTime) return durationMs(record) > FOUR_HOURS_MS ? 'Exceeded 4 Hours' : 'Completed';
    if (record.startTime) return 'Receiving';
    if (record.arrivalTime) return 'Arrived';
    if (record.source==='client-booking' || record.bookingSlot) return 'Scheduled Inbound';
    return 'Pending';
  }
  function hasDiscrepancy(record){ return !!record.completionTime && record.actualQty!=='' && record.actualQty!=null && variance(record.expectedQty, record.actualQty) !== 0; }
  function statusClass(status){
    return ({'Scheduled Inbound':'status-scheduled','Pending':'status-pending','Arrived':'status-arrived','Receiving':'status-receiving','Completed':'status-completed','Exceeded 4 Hours':'status-exceeded','Discrepancy':'status-discrepancy','Resolved':'status-completed','Unresolved':'status-discrepancy'})[status] || 'status-pending';
  }
  function statusBadge(status){ return `<span class="status-badge ${statusClass(status)}">${esc(status)}</span>`; }
  function metricIcon(name){
    const paths={
      package:'<path d="m4 8 8-4 8 4v9l-8 4-8-4V8Zm0 0 8 4 8-4m-8 4v9M8 6l8 4"/>',
      pending:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      truck:'<path d="M3 6h11v10H3V6Zm11 4h4l3 3v3h-7v-6ZM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>',
      receiving:'<path d="M4 7h11l-2.5-2.5M20 17H9l2.5 2.5M17 4l3 3-3 3M7 14l-3 3 3 3"/>',
      completed:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
      target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
      exceeded:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>',
      discrepancy:'<path d="M5 3h10l4 4v14H5V3Zm10 0v5h5M12 11v4m0 3h.01"/>',
      unresolved:'<path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-3Zm0 5v5m0 3h.01"/>',
      duration:'<circle cx="12" cy="13" r="8"/><path d="M9 2h6M12 5v2m0 6 3-2"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.package}</svg>`;
  }
  function actionIcon(name){
    const paths={
      view:'<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/>',
      edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"/><path d="m14.8 5.2 4 4"/>',
      print:'<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/><path d="M18 12h.01"/>',
      download:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
      resolve:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 8.5"/>',
      delete:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 15H6L5 6"/><path d="M10 11v5m4-5v5"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.view}</svg>`;
  }
  function actionButton(action,id,label,icon){
    return `<button class="icon-btn action-${icon}" data-action="${action}" data-id="${esc(id)}" title="${esc(label)}" aria-label="${esc(label)}">${actionIcon(icon)}</button>`;
  }
  function toast(message, type='success'){
    const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message;
    $('toastContainer').appendChild(el); setTimeout(() => el.remove(), 3200);
  }
  function showError(id, message){ const el=$(id); el.textContent=message; el.classList.add('show'); }
  function hideError(id){ $(id).classList.remove('show'); }
  function updateCurrentDateTime(){ $('currentDateTime').value = new Date().toLocaleString('en-GB'); }

  const BOOKING_TIME_SLOTS = (()=>{
    const slots=[];
    for(let mins=8*60;mins<18*60+30;mins+=30){
      const startH=Math.floor(mins/60),startM=mins%60,end=mins+30,endH=Math.floor(end/60),endM=end%60;
      const start=`${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')}`;
      const finish=`${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;
      slots.push({start,end:finish,label:`${start} – ${finish}`,breakTime:mins>=13*60&&mins<14*60});
    }
    return slots;
  })();
  function tomorrowISO(){const d=new Date();d.setDate(d.getDate()+1);return localDateISO(d);}
  function bookingCompany(){return currentUser?.role==='client'?currentUser.company:(isAllCompanies()?'':activeCompany);}
  function bookingSlotDocId(date,start){return `${date}_${String(start).replace(':','')}`;}
  function selectedBookingSlot(){
    const start=$('bookingSlotStart')?.value||'';
    return BOOKING_TIME_SLOTS.find(slot=>slot.start===start)||null;
  }
  function updateBookingSummary(){
    const date=$('bookingDate')?.value||'',slot=selectedBookingSlot();
    const company=bookingCompany();
    if($('bookingCompanyName'))$('bookingCompanyName').value=company;
    if($('bookingSelectedSlot'))$('bookingSelectedSlot').textContent=slot?`Selected: ${slot.label}`:'No time selected';
    if($('bookingSubmitSummary'))$('bookingSubmitSummary').textContent=date&&slot?`${company||'Select company'} · ${date} · ${slot.label}`:'Select a date and available time slot above.';
  }
  function renderBookingSlots(){
    const grid=$('bookingSlotGrid');if(!grid)return;
    const selected=$('bookingSlotStart')?.value||'';
    grid.innerHTML=BOOKING_TIME_SLOTS.map(slot=>{
      const full=bookingSlotsForDate.has(slot.start),disabled=slot.breakTime||full;
      const cls=slot.breakTime?'break':full?'full':selected===slot.start?'selected':'available';
      const state=slot.breakTime?'BREAK':full?'FULL':'AVAILABLE';
      return `<button class="booking-slot ${cls}" type="button" data-booking-slot="${slot.start}" ${disabled?'disabled':''}><strong>${esc(slot.label)}</strong><span>${state}</span></button>`;
    }).join('');
    const available=BOOKING_TIME_SLOTS.filter(slot=>!slot.breakTime&&!bookingSlotsForDate.has(slot.start)).length;
    if($('bookingAvailabilityNote'))$('bookingAvailabilityNote').textContent=`${available} slot${available===1?'':'s'} available for ${$('bookingDate').value}. Booked times cannot be selected.`;
    updateBookingSummary();
  }
  function loadBookingAvailability(force=false){
  const defaultDate=isAdmin()?todayISO():tomorrowISO();
  const date=$('bookingDate')?.value||defaultDate;
  if(!$('bookingDate'))return;

  if(isAdmin()){
    $('bookingDate').removeAttribute('min');
  }else{
    $('bookingDate').min=tomorrowISO();
  }
    if(!$('bookingDate').value)$('bookingDate').value=date;
    if(bookingSlotUnsubscribe){try{bookingSlotUnsubscribe()}catch(e){}bookingSlotUnsubscribe=null;}
    bookingSlotsForDate=new Set();renderBookingSlots();
    if(!currentUser)return;
    if($('bookingAvailabilityNote'))$('bookingAvailabilityNote').textContent='Loading live availability…';
    bookingSlotUnsubscribe=db.collection('booking_slots').where('date','==',date).onSnapshot(snap=>{
      bookingSlotsForDate=new Set(snap.docs.filter(d=>d.data().booked!==false).map(d=>d.data().slotStart));
      const selected=$('bookingSlotStart').value;
      if(selected&&bookingSlotsForDate.has(selected)){$('bookingSlotStart').value='';$('bookingSlotEnd').value='';}
      renderBookingSlots();
    },err=>{
      bookingSlotsForDate=new Set();renderBookingSlots();
      if($('bookingAvailabilityNote'))$('bookingAvailabilityNote').textContent='Could not load live availability: '+authErrorMessage(err);
    });
  }
  function resetBookingForm(){
    const form=$('bookingForm');if(!form)return;
    form.reset();hideError('bookingError');
    const defaultDate=isAdmin()?todayISO():tomorrowISO();if(isAdmin())$('bookingDate').removeAttribute('min');else $('bookingDate').min=tomorrowISO();$('bookingDate').value=defaultDate;$('bookingSlotStart').value='';$('bookingSlotEnd').value='';
    $('bookingCompanyName').value=bookingCompany();
    loadBookingAvailability(true);updateBookingSummary();
  }
  async function submitShipmentBooking(){
    hideError('bookingError');
    const company=bookingCompany(),date=$('bookingDate').value,slot=selectedBookingSlot();
    const doNumber=$('bookingDONumber').value.trim(),poNumber=$('bookingPONumber').value.trim(),vehicleNumber=$('bookingVehicleNumber').value.trim(),transportType=$('bookingTransportType').value,expectedRaw=$('bookingExpectedQty').value,remarks=$('bookingRemarks').value.trim();
    const missing=[];
    if(!company)missing.push('Company');if(!date)missing.push('Delivery Date');if(!slot)missing.push('Time Slot');if(!doNumber)missing.push('DO Number');if(!poNumber)missing.push('PO Number');if(!vehicleNumber)missing.push('Vehicle Number');if(!transportType)missing.push('Transport Type');if(expectedRaw==='')missing.push('Expected Quantity');
    if(missing.length){showError('bookingError','Please complete: '+missing.join(', '));return;}
    if(date<tomorrowISO()){showError('bookingError','Booking must be submitted at least 1 day before delivery.');return;}
    if(slot.breakTime){showError('bookingError','1:00–2:00 PM is warehouse break time. Please choose another slot.');return;}
    const duplicate=receivingRecords.some(r=>r.customer===company&&String(r.doNumber||'').toLowerCase()===doNumber.toLowerCase());
    if(duplicate){showError('bookingError','This DO Number already exists for your company.');return;}
    const recordId=newRecordId(),created=nowISO();
    const record={id:recordId,doNumber,poNumber,customer:company,companyId:companyIdFor(company),shipmentDate:date,vehicleNumber,transportType,expectedQty:num(expectedRaw),actualQty:'',staffName:'',remarks,arrivalTime:'',startTime:'',completionTime:'',createdAt:created,updatedAt:created,updatedBy:currentUser?.email||'',source:'client-booking',bookingSlot:slot.label,bookingSlotStart:slot.start,bookingSlotEnd:slot.end,bookingCreatedAt:created,bookedBy:currentUser?.email||'',bookingStatus:'Scheduled Inbound'};
    const slotRef=db.collection('booking_slots').doc(bookingSlotDocId(date,slot.start)),recRef=db.collection('receivings').doc(recordId);
    const btn=$('submitBookingBtn');btn.disabled=true;btn.textContent='Saving booking…';
    try{
      await db.runTransaction(async tx=>{
        const existing=await tx.get(slotRef);
        if(existing.exists&&existing.data().booked!==false)throw new Error('SLOT_ALREADY_BOOKED');
        tx.set(slotRef,{date,slotStart:slot.start,slotEnd:slot.end,slotLabel:slot.label,booked:true,receivingId:recordId,createdAt:created,updatedAt:created});
        tx.set(recRef,record);
      });
      toast(`Booking confirmed: ${date} ${slot.label}. Added to Receiving Sheet as Scheduled Inbound.`,'success');
      resetBookingForm();
    }catch(err){
      if(String(err?.message||'').includes('SLOT_ALREADY_BOOKED')){showError('bookingError','This time slot was just booked by another customer. Please select another available time.');loadBookingAvailability(true);}
      else showError('bookingError',authErrorMessage(err));
    }finally{btn.disabled=false;btn.textContent='📅 Confirm Booking';}
  }
  function setMenuOpen(open){
    $('sidebar').classList.toggle('open',open);
    $('menuBackdrop').classList.toggle('show',open);
    document.body.classList.toggle('menu-open',open);
    $('mobileMenu').setAttribute('aria-expanded',String(open));
  }

  const TUTORIAL_UI = {
    ms:{back:'Kembali',skip:'Langkau',never:'Jangan papar automatik',next:'Seterusnya →',finish:'Selesai ✓',completed:'Panduan selesai. Anda boleh membukanya semula pada bila-bila masa.',disabled:'Tutorial automatik telah dimatikan.'},
    en:{back:'Back',skip:'Skip',never:"Don't show automatically",next:'Next →',finish:'Finish ✓',completed:'Guide completed. You can replay it anytime.',disabled:'Automatic tutorial has been turned off.'},
    my:{back:'နောက်သို့',skip:'ကျော်မည်',never:'အလိုအလျောက် မပြတော့ပါ',next:'ရှေ့သို့ →',finish:'ပြီးပါပြီ ✓',completed:'လမ်းညွှန် ပြီးပါပြီ။ အချိန်မရွေး ပြန်ဖွင့်နိုင်ပါသည်။',disabled:'အလိုအလျောက် လမ်းညွှန်ကို ပိတ်ထားပါပြီ။'},
    zh:{back:'返回',skip:'跳过',never:'不再自动显示',next:'下一步 →',finish:'完成 ✓',completed:'操作指南已完成，您可以随时重新打开。',disabled:'自动教程已关闭。'}
  };
  const TUTORIAL_MODE_NAMES = {
    general:'General App Guide',
    booking:'Shipment Booking Guide',
    receiving:'Receiving Guide',
    discrepancy:'Discrepancy Guide'
  };
  const TUTORIAL_TEXT = {
    ms:{
      general:[
        ['Selamat datang, {user}!','Saya Qaiyum, panduan receiving anda. Saya akan tunjukkan aliran utama aplikasi ini dengan ringkas.'],
        ['Menu utama anda','Gunakan butang tiga garisan ini untuk bergerak antara Dashboard, Shipment Booking, Receiving Sheet dan Discrepancy Report.'],
        ['Paparan Dashboard','Dashboard menunjukkan status shipment secara langsung termasuk Scheduled Inbound, Arrived, Receiving, Completed, discrepancy dan sasaran empat jam.'],
        ['Semak operasi dengan cepat','Kad KPI berubah mengikut company workspace. Gunakan filter untuk cari tarikh, status, DO atau PO dengan cepat.'],
        ['Rancang shipment','Buka Shipment Booking untuk pilih tarikh dan slot masa sebelum penghantaran ke warehouse.'],
        ['Semak slot sebelum booking','Setiap slot 30 minit hanya untuk seorang customer. FULL tidak boleh dipilih dan 1:00–2:00 PM ialah waktu rehat.'],
        ['Pantau proses receiving','Buka Receiving Sheet untuk lihat shipment yang telah ditempah dan rekod proses dari Arrived sehingga Complete.'],
        ['Lengkapkan setiap milestone','Timestamp direkod secara automatik supaya tempoh receiving dan sasaran empat jam boleh dipantau.'],
        ['Urus discrepancy','Gunakan modul ini untuk barang rosak, kurang, lebih atau salah. Kes kekal berkaitan dengan DO dan PO.'],
        ['Anda sudah bersedia','Itu ialah gambaran keseluruhan aplikasi. Setiap modul juga mempunyai butang Guide sendiri.']
      ],
      booking:[
        ['Panduan Shipment Booking','Panduan ini menunjukkan cara menempah slot inbound terus dalam aplikasi.'],
        ['Ikut peraturan booking','Buat booking sekurang-kurangnya 1 hari lebih awal. Waktu 1:00–2:00 PM tidak boleh ditempah kerana waktu rehat warehouse.'],
        ['Pilih tarikh penghantaran','Pilih tarikh dahulu. Sistem akan memuatkan availability untuk tarikh itu sahaja.'],
        ['Pilih slot 30 minit','AVAILABLE boleh dipilih. FULL bermaksud slot sudah diambil customer lain dan tidak boleh ditekan.'],
        ['Isi maklumat shipment','Isi DO Number, PO Number, vehicle, transport type dan expected CTN/pallet quantity. Company diisi mengikut account anda.'],
        ['Semak pilihan booking','Pastikan tarikh dan masa yang dipilih betul sebelum submit.'],
        ['Sahkan booking','Tekan Confirm Booking sekali. Sistem akan mengunci slot tersebut supaya customer lain tidak boleh menempah masa yang sama.'],
        ['Booking masuk ke Receiving Sheet','Selepas berjaya, shipment terus muncul dalam Receiving Sheet dengan status Scheduled Inbound.']
      ],
      receiving:[
        ['Panduan Receiving','Shipment yang dibuat melalui booking sudah mempunyai DO, PO, tarikh, vehicle dan expected quantity.'],
        ['Cari shipment yang dijadualkan','Cari rekod berstatus Scheduled Inbound menggunakan DO, PO, tarikh atau booking slot.'],
        ['Maklumat sudah disediakan','Staff tidak perlu menaip semula maklumat booking. Buka rekod yang betul dan semak butiran shipment.'],
        ['Tekan Arrived','Apabila shipment sampai dan diterima warehouse, tekan Arrived. Masa ketibaan dan timer empat jam direkod automatik.'],
        ['Mulakan Receiving','Apabila checking dan counting bermula, tekan Start Receiving dengan segera.'],
        ['Actual quantity','Jika kuantiti sebenar berbeza, masukkan Actual Received Qty sebelum Complete. Jika kosong, sistem menggunakan Expected Qty untuk aliran normal.'],
        ['Tekan Complete','Apabila receiving benar-benar selesai, tekan Complete. Completion time dan total duration disimpan automatik.'],
        ['Laporkan masalah jika perlu','Jika terdapat kerosakan atau quantity tidak sama, buka Discrepancy Report untuk rekod tindakan.'],
        ['Cari rekod receiving','Semua rekod disimpan di Receiving Records dan boleh dicari mengikut DO, PO, tarikh atau status.'],
        ['Betulkan rekod jika perlu','Staff/admin boleh tekan Edit untuk membetulkan butiran yang salah.'],
        ['Simpan pembetulan','Tekan Save Record selepas semakan. Rekod yang sama akan dikemas kini tanpa membuang timestamp sedia ada.']
      ],
      receivingClient:[
        ['Panduan Status Receiving','Halaman ini menunjukkan progress receiving untuk shipment company anda.'],
        ['Shipment booking anda','Booking yang berjaya terus muncul sebagai Scheduled Inbound sebelum shipment sampai.'],
        ['Cari shipment','Gunakan Date, DO Number, PO Number atau Status untuk mencari rekod.'],
        ['Semak progress','Scheduled Inbound = telah ditempah, Arrived = sudah sampai, Receiving = sedang diperiksa, Completed = selesai.'],
        ['Semak timeline dan quantity','Lihat Expected, Actual, Variance, Arrival, Start, Completion dan Total Duration.'],
        ['Buka butiran lengkap','Tekan ikon mata di Actions untuk melihat semua butiran shipment dan remarks.']
      ],
      discrepancy:[
        ['Panduan Discrepancy','Gunakan halaman ini apabila barang rosak, hilang, kurang, lebih, salah, rejected atau packaging rosak.'],
        ['Masukkan rujukan kes','Isi Report Date, DO Number, PO Number, company, SKU dan product name supaya kes mudah dikesan.'],
        ['Rekod perbezaan quantity','Isi Expected Quantity dan Actual Quantity. Variance dikira automatik.'],
        ['Terangkan isu dan tindakan','Pilih Issue Type, Item Condition dan Action Taken, kemudian isi person in charge.'],
        ['Lampirkan bukti gambar','Upload gambar yang jelas untuk barang rosak atau salah.'],
        ['Simpan discrepancy','Semak butiran dan tekan Save Discrepancy. Kes akan muncul dalam table di bawah.'],
        ['Cari kes yang disimpan','Semua kes boleh dicari dalam Discrepancy Cases bersama DO, PO, SKU, issue, action, PIC dan status.'],
        ['Edit kes yang salah','Tekan Edit pada kes yang betul dan kemas kini maklumat yang perlu.'],
        ['Ganti gambar jika perlu','Semasa edit, pilih gambar baharu untuk menggantikan bukti lama.'],
        ['Simpan pembetulan','Tekan Save Discrepancy semula. Rekod yang sama akan dikemas kini.'],
        ['Follow up sehingga selesai','Tukar status kepada Resolved selepas tindakan yang dipersetujui selesai.']
      ],
      discrepancyClient:[
        ['Panduan Status Discrepancy','Halaman ini menunjukkan kes discrepancy untuk company anda.'],
        ['Di mana kes dipaparkan','Scroll ke Discrepancy Cases. Client hanya boleh melihat kes untuk company sendiri.'],
        ['Cari kes berkaitan','Padankan DO Number, PO Number, SKU atau product dan scroll table jika perlu.'],
        ['Semak maklumat masalah','Lihat Expected, Actual, Variance, Issue, Condition, Action Taken dan PIC.'],
        ['Pantau keputusan','Unresolved bermaksud masih perlu follow up; Resolved bermaksud tindakan telah selesai.'],
        ['Buka laporan lengkap','Tekan ikon mata di Actions untuk melihat butiran penuh, remarks dan gambar bukti.']
      ]
    },
    en:{
      general:[
        ['Welcome, {user}!','I am Qaiyum, your receiving guide. I will show you the complete warehouse flow in under two minutes.'],
        ['Your command menu','Use this three-line button whenever you need to move between the main modules. The menu stays hidden to keep the workspace clean.'],
        ['Dashboard overview','Dashboard gives you the live receiving picture: pending, arrived, currently receiving, completed, discrepancies and the four-hour target.'],
        ['Read the operation at a glance','These KPI cards update from the selected company workspace. Use the filters above them to find a date, status, DO or PO quickly.'],
        ['Plan a shipment','Open Shipment Booking to check availability and submit a booking without leaving the app.'],
        ['Check before booking','Each 30-minute slot can only be booked once. AVAILABLE can be selected, FULL is disabled for that date, and 1:00–2:00 PM is warehouse break time.'],
        ['Record the receiving flow','Open Receiving Sheet to record the shipment from arrival until completion.'],
        ['Complete each milestone','The timestamps calculate automatically and show whether the shipment was completed within the four-hour target.'],
        ['Handle discrepancies','Use this module for damaged, missing, excess or wrong items. Every case stays linked to its DO and PO for follow-up.'],
        ['You are ready','That is the full app overview. Each operation page now has its own detailed Guide button.']
      ],
      booking:[
        ['Shipment Booking Guide','This guide covers only the booking page. Start here before planning an inbound delivery.'],
        ['Follow the booking rules','Submit at least one day before delivery. Do not choose 1:00–2:00 PM because that is the warehouse break.'],
        ['Read the calendar colours','AVAILABLE is open. BOOKED can still accept another request. BUSY is full, and BREAK cannot be selected.'],
        ['Choose a suitable slot','Find your planned date and time in the availability calendar. If it is BUSY, choose another date or time before continuing.'],
        ['Open the booking form','Scroll to Step 2 below the calendar. The booking form opens inside this page, so there is no need to leave the app.'],
        ['Complete all required details','Enter the company, delivery date and time, shipment or transport details, and vehicle number. For Lalamove, enter the plate number or write Lalamove.'],
        ['Reach the end of the form','Scroll inside the Google Form until the final question. Make sure every question marked with a red asterisk (*) has been answered.'],
        ['Press Submit to finish','At the bottom of the form, press the purple Submit button once. Wait for the confirmation that your response was recorded; the booking then updates the availability calendar automatically.']
      ],
      receiving:[
        ['Receiving Guide','This guide covers only the Receiving Sheet and the correct order for recording an inbound shipment.'],
        ['Enter the shipment reference','Fill in the DO Number and PO Number from the delivery document or request. Confirm the selected company workspace is correct.'],
        ['Complete arrival details','Enter shipment date, vehicle or Lalamove details, transport type, receiving staff, and the expected CTN or pallet quantity.'],
        ['Record Arrived immediately','When the vehicle reaches the warehouse and the shipment is accepted, click Arrived. This locks the arrival timestamp and starts the four-hour target.'],
        ['Start the receiving process','Click Start Receiving as soon as checking and counting begins—not after the work is already finished.'],
        ['Enter actual quantity','After counting, enter Actual Received Qty. The system compares it with Expected Qty and calculates the variance automatically.'],
        ['Complete the shipment','When receiving is genuinely finished, click Complete. The completion time and total duration are saved automatically.'],
        ['Save or report a problem','Press Save Record. If quantity does not match or items are damaged or wrong, select Create Discrepancy Report and continue in that module.'],
        ['Find the saved receiving record','After saving, scroll below the form and filters to Receiving Records. The completed or current record appears here for staff and the assigned customer.'],
        ['Edit a wrong receiving record','Find the correct DO or PO, scroll to Actions and press Edit. The saved record opens in the form above; correct the wrong DO, PO, quantity, vehicle, staff or remarks.'],
        ['Save the correction','After checking the edited fields, press Save Record again. The same Receiving Records row is updated and its existing timestamps remain attached to that record.']
      ],
      receivingClient:[
        ['Receiving Status Guide','This page is read-only for clients and shows receiving progress for the selected company.'],
        ['Where receiving records appear','Scroll below the filters to Receiving Records. Every shipment saved by the warehouse for your assigned company appears in this table.'],
        ['Find your shipment','Use Date, DO Number, PO Number or Status to filter the list. Only records for your assigned company are shown.'],
        ['Check whether it has arrived','Scheduled Inbound means the shipment is booked but has not arrived. Arrived means it has reached the warehouse, Receiving means checking is in progress, and Completed means receiving is finished.'],
        ['Read the timeline and quantity','In the shipment row, review Expected, Actual, Variance, Arrival, Start, Completion and Total Duration. Scroll the table sideways when needed.'],
        ['Open the complete record','Go to Actions and press the eye button. The detail window shows the vehicle, quantities, variance, every timestamp, duration, current status and warehouse remarks.']
      ],
      discrepancy:[
        ['Discrepancy Guide','Use this page only when an item is damaged, missing, short, excess, wrong, rejected or has packaging damage.'],
        ['Enter case references','Fill Report Date, DO Number, PO Number, company, SKU and product name so the case can be traced correctly.'],
        ['Record the quantity difference','Enter Expected Quantity and Actual Quantity. The system calculates the variance automatically.'],
        ['Describe the issue and action','Choose Issue Type, Item Condition and Action Taken, then enter the person in charge.'],
        ['Attach photo evidence','Upload a clear photo of the damaged or incorrect item. Keep the image below 1.5 MB in this version.'],
        ['Save the discrepancy','Add useful remarks, review the details, then click Save Discrepancy. The new case appears in the table below.'],
        ['Find the saved discrepancy case','Scroll below the form to Discrepancy Cases. Every saved case appears here with its DO, PO, SKU, issue, action, PIC and status.'],
        ['Edit a wrong discrepancy case','Find the case, scroll to Actions and press Edit. The case opens in the form above so you can correct the DO, PO, SKU, quantity, issue, action, PIC or remarks.'],
        ['Replace a wrong photo','While editing, choose a new image under Photo Upload. The newly selected photo replaces the existing evidence when you save.'],
        ['Save the correction','Review the edited case and press Save Discrepancy again. The same Discrepancy Cases row is updated instead of creating a duplicate.'],
        ['Follow up until resolved','Use the table actions to view, print or mark the case as resolved after the agreed action is completed.']
      ],
      discrepancyClient:[
        ['Discrepancy Status Guide','This page shows discrepancy cases for your company, including damaged, missing, excess or wrong items.'],
        ['Where discrepancy cases appear','Scroll to the Discrepancy Cases table below. Cases saved by the warehouse for your assigned company appear here; client access is view-only.'],
        ['Find the matching case','Match the DO Number, PO Number, SKU or product in the table. Scroll the table sideways to see every column.'],
        ['Review the issue','Check Expected, Actual, Variance, Issue, Condition, Action Taken and PIC to understand what happened and what the warehouse is doing.'],
        ['Track the resolution','Unresolved means follow-up is still required. Resolved means the warehouse has completed the agreed action.'],
        ['Open the complete report','Go to Actions and press the eye button. The detail window shows the full case, remarks and any attached photo evidence.']
      ]
    },
    my:{
      general:[
        ['မင်္ဂလာပါ {user}!','ကျွန်တော် Qaiyum ပါ။ Warehouse app တစ်ခုလုံးကို အချိန်တိုအတွင်း လမ်းညွှန်ပေးပါမည်။'],
        ['ပင်မ Menu','စာမျက်နှာများ ပြောင်းရန် ဘယ်ဘက်အပေါ်ရှိ မျဉ်းသုံးကြောင်းခလုတ်ကို နှိပ်ပါ။'],
        ['Dashboard အကျဉ်းချုပ်','Pending၊ Arrived၊ Receiving၊ Completed၊ Discrepancy နှင့် ၄ နာရီ target ကို ဒီနေရာတွင် ကြည့်နိုင်ပါသည်။'],
        ['လုပ်ငန်းအခြေအနေကို ကြည့်ပါ','Company workspace အလိုက် KPI များ ပြောင်းလဲပါသည်။ Date၊ Status၊ DO သို့မဟုတ် PO ဖြင့် ရှာနိုင်ပါသည်။'],
        ['Shipment Booking','Warehouse သို့ ပစ္စည်းပို့မည့်ရက်နှင့် အချိန်ကို ကြိုတင်စီစဉ်ရန် Shipment Booking ကို ဖွင့်ပါ။'],
        ['Booking မလုပ်မီ စစ်ဆေးပါ','AVAILABLE သည် လွတ်သည်၊ BOOKED ကို ထပ်တင်နိုင်သည်၊ BUSY သည် ပြည့်သည်။ ၁:၀၀–၂:၀၀ PM မရွေးပါနှင့်။'],
        ['Receiving စာရင်း','ပစ္စည်းရောက်ချိန်မှ ပြီးဆုံးချိန်အထိ Receiving Sheet တွင် မှတ်တမ်းတင်ပါ။'],
        ['အဆင့်တိုင်း ပြီးစီးပါ','Timestamp များ အလိုအလျောက်သိမ်းပြီး ၄ နာရီအတွင်း ပြီးမပြီးကို ပြပါသည်။'],
        ['Discrepancy မှတ်တမ်း','ပျက်စီး၊ လျော့၊ ပို၊ မှားသောပစ္စည်းများကို DO/PO နှင့် ချိတ်ဆက်မှတ်တမ်းတင်ပါ။'],
        ['အသုံးပြုရန် အသင့်ဖြစ်ပါပြီ','App အကျဉ်းချုပ် ပြီးပါပြီ။ စာမျက်နှာတိုင်းတွင် သီးသန့် Guide ခလုတ် ရှိပါသည်။']
      ],
      booking:[
        ['Shipment Booking လမ်းညွှန်','ဒီလမ်းညွှန်သည် Booking စာမျက်နှာအတွက်သာ ဖြစ်ပါသည်။ Inbound delivery မစီစဉ်မီ ဒီနေရာမှ စတင်ပါ။'],
        ['Booking စည်းမျဉ်းများ','ပစ္စည်းပို့မည့်ရက်မတိုင်မီ အနည်းဆုံး ၁ ရက်ကြိုတင်တင်ပါ။ ၁:၀၀–၂:၀၀ PM သည် နားချိန်ဖြစ်၍ မရွေးပါနှင့်။'],
        ['Calendar အရောင်များ','AVAILABLE = လွတ်၊ BOOKED = ထပ်တင်နိုင်၊ BUSY = ပြည့်၊ BREAK = မရွေးနိုင်ပါ။'],
        ['သင့်တော်သော Slot ရွေးပါ','Calendar တွင် ပို့မည့်ရက်နှင့်အချိန်ကို စစ်ပါ။ BUSY ဖြစ်ပါက အခြားရက် သို့မဟုတ် အချိန်ကို ရွေးပါ။'],
        ['Booking Form ကို ဖွင့်ပါ','Calendar အောက်ရှိ Step 2 သို့ ဆင်းပါ။ App ထဲမှာပင် Form ဖြည့်နိုင်ပါသည်။'],
        ['လိုအပ်သောအချက်အလက် ဖြည့်ပါ','Company၊ ရက်၊ အချိန်၊ shipment/transport နှင့် ကားနံပါတ် ဖြည့်ပါ။ Lalamove ဖြစ်ပါက plate number သို့မဟုတ် Lalamove ဟုရေးပါ။'],
        ['Form အောက်ဆုံးသို့ ဆင်းပါ','Google Form အတွင်း နောက်ဆုံးမေးခွန်းအထိ ဆင်းပါ။ အနီရောင်ကြယ် (*) ပါသော မေးခွန်းအားလုံး ဖြည့်ပြီးကြောင်း စစ်ပါ။'],
        ['Submit နှိပ်ပြီး အပြီးသတ်ပါ','Form အောက်ဆုံးရှိ ခရမ်းရောင် Submit ခလုတ်ကို တစ်ကြိမ်နှိပ်ပါ။ Response သိမ်းပြီးကြောင်း confirmation ပေါ်လာသည်အထိ စောင့်ပါ။ Calendar သည် အလိုအလျောက် update ဖြစ်ပါမည်။']
      ],
      receiving:[
        ['Receiving လမ်းညွှန်','ဒီလမ်းညွှန်သည် Receiving Sheet နှင့် inbound shipment မှတ်တမ်းတင်သည့် အစဉ်အတိုင်းကိုသာ ရှင်းပြပါမည်။'],
        ['Shipment reference ဖြည့်ပါ','Delivery document သို့မဟုတ် request မှ DO Number နှင့် PO Number ဖြည့်ပါ။ Company workspace မှန်ကြောင်း စစ်ပါ။'],
        ['Arrival အချက်အလက် ဖြည့်ပါ','Shipment date၊ ကား/Lalamove၊ transport type၊ staff name နှင့် expected CTN/pallet qty ကို ဖြည့်ပါ။'],
        ['Arrived ကို ချက်ချင်းနှိပ်ပါ','ကား warehouse ရောက်ပြီး ပစ္စည်းလက်ခံသောအခါ Arrived ကိုနှိပ်ပါ။ Arrival time နှင့် ၄ နာရီ target စတင်ပါမည်။'],
        ['Receiving စတင်ပါ','ပစ္စည်းစစ်ခြင်းနှင့် ရေတွက်ခြင်း စတင်သည်နှင့် Start Receiving ကိုနှိပ်ပါ။ ပြီးမှ မနှိပ်ပါနှင့်။'],
        ['Actual Quantity ဖြည့်ပါ','ရေတွက်ပြီး Actual Received Qty ဖြည့်ပါ။ Expected Qty နှင့် ကွာခြားချက်ကို system က အလိုအလျောက်တွက်ပါမည်။'],
        ['Complete လုပ်ပါ','Receiving တကယ်ပြီးဆုံးသောအခါ Complete ကိုနှိပ်ပါ။ Completion time နှင့် duration ကို အလိုအလျောက်သိမ်းပါမည်။'],
        ['Save သို့မဟုတ် Report လုပ်ပါ','Save Record ကို နှိပ်ပါ။ Qty မကိုက်၊ ပျက်စီး သို့မဟုတ် မှားပါက Create Discrepancy Report ကို ရွေးပါ။'],
        ['Save ထားသော Receiving Record ကို ရှာပါ','Save ပြီးနောက် form နှင့် filter အောက်ရှိ Receiving Records သို့ ဆင်းပါ။ Staff နှင့် သက်ဆိုင်ရာ customer အတွက် record ကို ဒီ table တွင် ကြည့်နိုင်ပါသည်။'],
        ['Receiving Record မှားပါက Edit လုပ်ပါ','DO သို့မဟုတ် PO ဖြင့် record ကိုရှာ၊ Actions သို့ ဘေးတိုက်ရွှေ့ပြီး Edit ကိုနှိပ်ပါ။ အပေါ် form တွင် record ပွင့်လာလျှင် DO၊ PO၊ qty၊ vehicle၊ staff သို့မဟုတ် remarks ကို ပြင်ပါ။'],
        ['ပြင်ထားသော Record ကို Save လုပ်ပါ','အချက်အလက်များ စစ်ပြီး Save Record ကို ထပ်နှိပ်ပါ။ Receiving Records ရှိ မူလ row ကို update လုပ်ပြီး timestamp များကို ထိန်းထားပါမည်။']
      ],
      receivingClient:[
        ['Receiving Status လမ်းညွှန်','Client များအတွက် ဒီစာမျက်နှာသည် ကြည့်ရှုရန်သာဖြစ်ပြီး company ၏ receiving progress ကို ပြပါသည်။'],
        ['Receiving Record များရှိသောနေရာ','Filter အောက်ရှိ Receiving Records သို့ ဆင်းပါ။ Warehouse မှ save လုပ်ထားသော သင့် company ၏ shipment များအားလုံး ဒီ table တွင် ပေါ်ပါမည်။'],
        ['သင့် Shipment ကို ရှာပါ','Date၊ DO Number၊ PO Number သို့မဟုတ် Status ဖြင့် စစ်ထုတ်ပါ။ သင့် company နှင့်သက်ဆိုင်သော record များသာ ပြပါမည်။'],
        ['ပစ္စည်းရောက်မရောက် စစ်ပါ','Pending = မရောက်သေး၊ Arrived = warehouse ရောက်ပြီး၊ Receiving = စစ်ဆေးနေ၊ Completed = receiving ပြီးပါပြီ။'],
        ['အချိန်နှင့် Quantity စစ်ပါ','Shipment row တွင် Expected၊ Actual၊ Variance၊ Arrival၊ Start၊ Completion နှင့် Total Duration ကို ကြည့်ပါ။ လိုအပ်ပါက table ကို ဘေးသို့ရွှေ့ပါ။'],
        ['Record အပြည့်အစုံ ဖွင့်ပါ','Actions ရှိ မျက်လုံးခလုတ်ကို နှိပ်ပါ။ Vehicle၊ quantity၊ variance၊ timestamp အားလုံး၊ duration၊ status နှင့် warehouse remarks ကို detail window တွင် ကြည့်နိုင်ပါသည်။']
      ],
      discrepancy:[
        ['Discrepancy လမ်းညွှန်','ပစ္စည်းပျက်စီး၊ ပျောက်၊ လျော့၊ ပို၊ မှား၊ reject သို့မဟုတ် packaging ပျက်စီးမှ ဒီစာမျက်နှာကို သုံးပါ။'],
        ['Case reference ဖြည့်ပါ','Report Date၊ DO၊ PO၊ Company၊ SKU နှင့် Product Name ကို ဖြည့်ပါ။'],
        ['Quantity ကွာခြားချက်','Expected Quantity နှင့် Actual Quantity ကို ဖြည့်ပါ။ Variance ကို system က အလိုအလျောက်တွက်ပါမည်။'],
        ['Issue နှင့် Action ရွေးပါ','Issue Type၊ Item Condition၊ Action Taken ကိုရွေးပြီး Person in Charge ကို ဖြည့်ပါ။'],
        ['ဓာတ်ပုံတင်ပါ','ပျက်စီး သို့မဟုတ် မှားသောပစ္စည်း၏ ရှင်းလင်းသောဓာတ်ပုံတင်ပါ။ ဒီ version တွင် 1.5 MB အောက်ထားပါ။'],
        ['Discrepancy ကို Save လုပ်ပါ','Remarks ဖြည့်၊ အချက်အလက်စစ်ပြီး Save Discrepancy ကိုနှိပ်ပါ။ Case သည် အောက်ရှိ table တွင် ပေါ်လာပါမည်။'],
        ['Save ထားသော Case ကို ရှာပါ','Form အောက်ရှိ Discrepancy Cases သို့ ဆင်းပါ။ Save ထားသော case အားလုံးကို DO၊ PO၊ SKU၊ issue၊ action၊ PIC နှင့် status ဖြင့် ဒီနေရာတွင် ကြည့်နိုင်ပါသည်။'],
        ['Discrepancy မှားပါက Edit လုပ်ပါ','Case ကိုရှာ၊ Actions သို့ ဘေးတိုက်ရွှေ့ပြီး Edit ကိုနှိပ်ပါ။ အပေါ် form တွင် DO၊ PO၊ SKU၊ qty၊ issue၊ action၊ PIC သို့မဟုတ် remarks ကို ပြင်နိုင်ပါသည်။'],
        ['ဓာတ်ပုံမှားပါက အစားထိုးပါ','Edit လုပ်နေစဉ် Photo Upload တွင် ပုံအသစ်ရွေးပါ။ Save လုပ်သောအခါ ပုံအသစ်က မူလ evidence ကို အစားထိုးပါမည်။'],
        ['ပြင်ထားသော Case ကို Save လုပ်ပါ','ပြင်ထားသောအချက်အလက် စစ်ပြီး Save Discrepancy ကို ထပ်နှိပ်ပါ။ Duplicate မဖြစ်ဘဲ မူလ case row ကို update လုပ်ပါမည်။'],
        ['Resolved အထိ Follow up လုပ်ပါ','သတ်မှတ်ထားသော action ပြီးနောက် View၊ Print သို့မဟုတ် Mark Resolved ကို သုံးပါ။']
      ],
      discrepancyClient:[
        ['Discrepancy Status လမ်းညွှန်','ဒီစာမျက်နှာတွင် company ၏ ပျက်စီး၊ ပျောက်၊ ပို သို့မဟုတ် မှားသော case များကို ကြည့်နိုင်ပါသည်။'],
        ['Discrepancy Cases ရှိသောနေရာ','အောက်ရှိ Discrepancy Cases table သို့ ဆင်းပါ။ Warehouse မှ save လုပ်ထားသော သင့် company ၏ case များ ဒီနေရာတွင် ပေါ်ပြီး client သည် ကြည့်ရှုရန်သာ ဖြစ်ပါသည်။'],
        ['သက်ဆိုင်သော Case ကို ရှာပါ','Table တွင် DO Number၊ PO Number၊ SKU သို့မဟုတ် Product ကို ကိုက်ညီအောင် ရှာပါ။ Column အားလုံးကြည့်ရန် table ကို ဘေးသို့ရွှေ့ပါ။'],
        ['Issue အချက်အလက် စစ်ပါ','Expected၊ Actual၊ Variance၊ Issue၊ Condition၊ Action Taken နှင့် PIC ကိုကြည့်ပြီး ဖြစ်ပျက်မှုနှင့် warehouse လုပ်ဆောင်မှုကို စစ်ပါ။'],
        ['Resolution ကို စောင့်ကြည့်ပါ','Unresolved = follow-up လိုသေး၊ Resolved = သဘောတူထားသော action ပြီးဆုံးပါပြီ။'],
        ['Report အပြည့်အစုံ ဖွင့်ပါ','Actions ရှိ မျက်လုံးခလုတ်ကို နှိပ်ပါ။ Case အချက်အလက်အပြည့်၊ remarks နှင့် photo evidence ရှိပါက detail window တွင် ကြည့်နိုင်ပါသည်။']
      ]
    },
    zh:{
      general:[
        ['欢迎，{user}！','我是 Qaiyum，您的收货操作向导。我会用两分钟介绍整个仓库流程。'],
        ['主菜单','点击左上角的三横线按钮，可在各个主要模块之间切换。'],
        ['仪表板概览','这里显示待处理、已到达、收货中、已完成、差异以及四小时目标。'],
        ['快速查看运营状态','KPI 会跟随所选公司更新。您可以按日期、状态、DO 或 PO 搜索。'],
        ['安排送货','打开 Shipment Booking，在应用内查看档期并提交预约。'],
        ['预约前检查','AVAILABLE 表示可用，BOOKED 仍可提交，BUSY 表示已满。请避开下午 1:00–2:00。'],
        ['收货记录','在 Receiving Sheet 中记录货物从到达至完成的全过程。'],
        ['完成每个节点','时间戳会自动保存，并显示是否在四小时目标内完成。'],
        ['处理差异','损坏、缺少、超量或错货都应记录，并关联对应的 DO 和 PO。'],
        ['您已准备就绪','应用概览已完成。每个操作页面都有独立的详细 Guide 按钮。']
      ],
      booking:[
        ['Shipment Booking 指南','本指南只讲解预约页面。安排入库送货前，请从这里开始。'],
        ['遵守预约规则','至少提前一天提交。下午 1:00–2:00 是仓库休息时间，请勿选择。'],
        ['了解日历颜色','AVAILABLE 可预约；BOOKED 仍可提交；BUSY 已满；BREAK 不可选择。'],
        ['选择合适时段','在日历中找到计划日期和时间。如果显示 BUSY，请先更换日期或时段。'],
        ['打开预约表单','向下滚动到日历下方的 Step 2。表单直接在本页填写，无需离开应用。'],
        ['填写所有必填资料','填写公司、送货日期与时间、货运或运输资料以及车牌。Lalamove 可填写车牌或写 Lalamove。'],
        ['滚动到表单底部','在 Google Form 内滚动至最后一个问题，并确认所有带红色星号（*）的必填问题都已回答。'],
        ['点击 Submit 完成','在表单底部点击一次紫色 Submit 按钮。看到回答已记录的确认信息后，预约会自动更新档期日历。']
      ],
      receiving:[
        ['Receiving 指南','本指南只讲解 Receiving Sheet，以及记录入库货物的正确顺序。'],
        ['填写货物编号','根据送货文件或申请填写 DO Number 和 PO Number，并确认公司工作区正确。'],
        ['填写到货资料','填写日期、车辆或 Lalamove、运输方式、收货员工以及预计箱数或托盘数。'],
        ['到货时立即点击 Arrived','车辆到仓并接受货物后，点击 Arrived。系统会锁定到达时间并启动四小时目标。'],
        ['开始收货','开始检查和点数时立即点击 Start Receiving，不要等全部完成后才点击。'],
        ['填写实际数量','点数后填写 Actual Received Qty。系统会与 Expected Qty 比较并自动计算差异。'],
        ['完成收货','实际收货完成后点击 Complete，系统会自动保存完成时间和总时长。'],
        ['保存或报告问题','点击 Save Record。如果数量不符、损坏或错货，请点击 Create Discrepancy Report。'],
        ['查找已保存的收货记录','保存后，向下滚动至表单和筛选器下方的 Receiving Records。员工和对应客户可在此表格查看当前或已完成的记录。'],
        ['编辑错误的收货记录','通过 DO 或 PO 找到记录，横向滚动至 Actions 并点击 Edit。记录会在上方表单打开，可更正 DO、PO、数量、车辆、员工或备注。'],
        ['保存更正内容','检查修改后的资料，再次点击 Save Record。同一条 Receiving Records 记录会被更新，原有时间戳仍保留在该记录中。']
      ],
      receivingClient:[
        ['Receiving 状态指南','客户在此页面仅能查看自己公司的收货进度。'],
        ['收货记录在哪里','滚动至筛选器下方的 Receiving Records。仓库为您所属公司保存的所有货物记录都会显示在此表格。'],
        ['查找您的货物','使用日期、DO Number、PO Number 或 Status 筛选列表。页面只显示您所属公司的记录。'],
        ['确认货物是否到达','Pending 表示尚未到达；Arrived 表示已到仓；Receiving 表示正在点收；Completed 表示收货已完成。'],
        ['查看时间与数量','在货物行中查看 Expected、Actual、Variance、Arrival、Start、Completion 和 Total Duration。需要时横向滚动表格。'],
        ['打开完整记录','在 Actions 栏点击眼睛按钮。详情窗口会显示车辆、数量、差异、所有时间戳、时长、当前状态和仓库备注。']
      ],
      discrepancy:[
        ['Discrepancy 指南','货物损坏、缺少、短少、超量、错货、拒收或包装损坏时使用此页面。'],
        ['填写案件资料','填写 Report Date、DO、PO、公司、SKU 和产品名称，确保可以追踪。'],
        ['记录数量差异','填写 Expected Quantity 和 Actual Quantity，系统会自动计算 Variance。'],
        ['选择问题与处理方式','选择 Issue Type、Item Condition 和 Action Taken，并填写负责人。'],
        ['上传照片证据','上传清晰的损坏或错货照片。本版本请使用小于 1.5 MB 的图片。'],
        ['保存差异报告','填写备注并检查资料，然后点击 Save Discrepancy。案件会出现在下方表格。'],
        ['查找已保存的差异案件','滚动至表单下方的 Discrepancy Cases。所有案件会在此显示 DO、PO、SKU、问题、处理方式、PIC 和状态。'],
        ['编辑错误的差异案件','找到案件，横向滚动至 Actions 并点击 Edit。案件会在上方表单打开，可更正 DO、PO、SKU、数量、问题、处理方式、PIC 或备注。'],
        ['替换错误照片','编辑时在 Photo Upload 选择新图片。保存后，新图片会替换原有的照片证据。'],
        ['保存更正内容','检查修改后的案件，再次点击 Save Discrepancy。系统会更新同一条案件记录，不会建立重复记录。'],
        ['跟进至解决','完成约定处理后，使用表格操作查看、打印或标记为 Resolved。']
      ],
      discrepancyClient:[
        ['Discrepancy 状态指南','此页面显示贵公司的损坏、缺少、超量或错货案件。'],
        ['差异案件在哪里','滚动至下方的 Discrepancy Cases 表格。仓库为您所属公司保存的案件会显示在此处，客户只能查看，不能编辑。'],
        ['查找对应案件','在表格中匹配 DO Number、PO Number、SKU 或产品，并横向滚动以查看全部列。'],
        ['查看问题资料','检查 Expected、Actual、Variance、Issue、Condition、Action Taken 和 PIC，了解发生的问题及仓库处理方式。'],
        ['跟踪处理结果','Unresolved 表示仍需跟进；Resolved 表示仓库已完成约定的处理。'],
        ['打开完整报告','在 Actions 栏点击眼睛按钮。详情窗口会显示完整案件、备注以及已上传的照片证据。']
      ]
    }
  };

  const TUTORIAL_BOOKING_V6 = {
    en:[
      ['Shipment Booking Guide','Reserve an inbound delivery slot directly inside this application.'],
      ['Follow the booking rules','Book at least one day earlier. The 1:00–2:00 PM break cannot be selected.'],
      ['Choose the delivery date','Availability is loaded for the selected date only.'],
      ['Choose a 30-minute slot','AVAILABLE can be selected. FULL is already booked and is disabled for that date.'],
      ['Complete shipment details','Enter DO Number, PO Number, vehicle, transport type and expected CTN/pallet quantity.'],
      ['Review the selected slot','Check the company, date and selected time before submitting.'],
      ['Confirm the booking','Press Confirm Booking once. The slot is locked so another customer cannot take the same time.'],
      ['Automatic Receiving entry','The booking is immediately added to Receiving Sheet as Scheduled Inbound.']
    ],
    my:[
      ['Shipment Booking လမ်းညွှန်','ဒီ app ထဲမှာ inbound delivery အတွက် time slot ကို တိုက်ရိုက် booking လုပ်နိုင်ပါသည်။'],
      ['Booking စည်းမျဉ်းများ','Delivery မတိုင်မီ အနည်းဆုံး ၁ ရက်ကြိုတင် booking လုပ်ပါ။ ၁:၀၀–၂:၀၀ PM သည် warehouse နားချိန်ဖြစ်၍ မရွေးနိုင်ပါ။'],
      ['Delivery date ရွေးပါ','ရွေးထားသော ရက်အတွက်သာ available time slot များကို system က ပြပါမည်။'],
      ['မိနစ် ၃၀ slot ရွေးပါ','AVAILABLE ကို ရွေးနိုင်ပါသည်။ FULL သည် အခြား customer booking လုပ်ပြီးဖြစ်၍ ထိုရက်အတွက် နှိပ်၍မရပါ။'],
      ['Shipment အချက်အလက်ဖြည့်ပါ','DO Number, PO Number, vehicle, transport type နှင့် expected CTN/pallet quantity ကို ဖြည့်ပါ။'],
      ['ရွေးထားသော slot ကိုစစ်ပါ','Submit မလုပ်မီ company, date နှင့် time မှန်ကြောင်း စစ်ပါ။'],
      ['Booking အတည်ပြုပါ','Confirm Booking ကို တစ်ကြိမ်နှိပ်ပါ။ အဲဒီ slot ကို lock လုပ်ပြီး အခြား customer မယူနိုင်တော့ပါ။'],
      ['Receiving Sheet သို့ အလိုအလျောက်ဝင်မည်','Booking အောင်မြင်သည်နှင့် Receiving Sheet တွင် Scheduled Inbound အဖြစ် ချက်ချင်းပေါ်လာပါမည်။']
    ],
    zh:[
      ['Shipment Booking 指南','直接在应用内预订入库送货时间。'],
      ['预约规则','至少提前一天预约。下午 1:00–2:00 为仓库休息时间，不能选择。'],
      ['选择送货日期','系统只显示所选日期的实时可用时段。'],
      ['选择 30 分钟时段','AVAILABLE 可以选择；FULL 表示该日期此时段已被其他客户预订，无法点击。'],
      ['填写货物资料','填写 DO Number、PO Number、车辆、运输方式及预计 CTN/托盘数量。'],
      ['检查预约资料','提交前确认公司、日期和所选时间正确。'],
      ['确认预约','点击一次 Confirm Booking。系统会锁定该时段，其他客户不能再选择相同时间。'],
      ['自动加入 Receiving Sheet','预约成功后，货物会立即以 Scheduled Inbound 状态出现在 Receiving Sheet。']
    ]
  };

  const TUTORIAL_SPECIAL_TEXT = {
    ms:{themeToggle:['Mod Tema','Tekan butang bulan atau matahari di bahagian atas untuk bertukar antara Light Mode dan Night Mode. Pilihan disimpan pada peranti ini.']},
    en:{themeToggle:['Theme Mode','Press this moon or sun button on the top bar to switch between Light Mode and Night Mode. Your selected mode stays saved on this device.']},
    my:{themeToggle:['Night Mode / Light Mode','အပေါ်ဘက်ရှိ လ သို့မဟုတ် နေ ပုံစံ button ကိုနှိပ်ပြီး Light Mode နှင့် Night Mode အကြား ပြောင်းနိုင်ပါသည်။ ရွေးထားသော mode ကို ဒီ device မှာ သိမ်းထားပါမည်။']},
    zh:{themeToggle:['深色 / 浅色模式','点击顶部这个月亮或太阳按钮，即可在 Light Mode 与 Night Mode 之间切换。系统会在此设备保存您的模式选择。']}
  };

  function tutorialPreferences(){
    try{return JSON.parse(localStorage.getItem(TUTORIAL_KEY))||{};}catch(e){return {};}
  }
  function tutorialIsCompleted(){return !!(currentUser&&tutorialPreferences()[currentUser.username]);}
  function rememberTutorialCompletion(){
    if(!currentUser)return;const prefs=tutorialPreferences();prefs[currentUser.username]=true;localStorage.setItem(TUTORIAL_KEY,JSON.stringify(prefs));
  }
  function tutorialTextGroup(){
    if(tutorialMode==='receiving'&&currentUser?.role==='client')return 'receivingClient';
    if(tutorialMode==='discrepancy'&&currentUser?.role==='client')return 'discrepancyClient';
    return tutorialMode;
  }
  function tutorialBlueprint(){
    const groups={
      general:[
        {target:'.brand',section:'dashboard'},{target:'#mobileMenu',section:'dashboard'},{target:'button[data-section="dashboard"]',section:'dashboard',menu:true},{target:'.stats-grid',section:'dashboard'},{target:'button[data-section="booking"]',section:'dashboard',menu:true},{target:'.booking-rules',section:'booking'},{target:'button[data-section="receiving"]',section:'booking',menu:true},{target:currentUser?.role==='client'?'#receivingSection .section-head':'#receivingSection .form-card',section:'receiving'},{target:'button[data-section="discrepancy"]',section:'receiving',menu:true},{target:'#tutorialHelpBtn',section:'dashboard'},{target:'#themeToggleBtn',section:'dashboard',tutorialKey:'themeToggle'}
      ],
      booking:[
        {target:'#bookingSection .section-head',section:'booking'},{target:'.booking-rules',section:'booking'},{target:'#bookingDate',section:'booking'},{target:'#bookingSlotGrid',section:'booking'},{target:'#bookingFormCard .booking-embed-head',section:'booking'},{target:'#bookingDONumber',section:'booking'},{target:'#submitBookingBtn',section:'booking'},{target:'#bookingSubmitSummary',section:'booking'},{target:'#themeToggleBtn',section:'booking',tutorialKey:'themeToggle'}
      ],
      receiving:[
        {target:'#receivingSection .section-head',section:'receiving'},{target:'#doNumber',section:'receiving'},{target:'#expectedQty',section:'receiving'},{target:'#arrivedBtn',section:'receiving'},{target:'#startBtn',section:'receiving'},{target:'#actualQty',section:'receiving'},{target:'#completeBtn',section:'receiving'},{target:'#receivingSection .form-actions',section:'receiving'},{target:'#receivingEditorHint',section:'receiving'},{target:'[data-action="edit-rec"]',section:'receiving'},{target:'#receivingSection .form-actions',section:'receiving'},{target:'#themeToggleBtn',section:'receiving',tutorialKey:'themeToggle'}
      ],
      receivingClient:[
        {target:'#receivingSection .section-head',section:'receiving'},{target:'#receivingSection .table-card',section:'receiving'},{target:'#receivingSection .filter-card',section:'receiving'},{target:'#receivingSection .table-card',section:'receiving'},{target:'#receivingSection .table-wrap',section:'receiving'},{target:'#receivingClientDetailHint',section:'receiving'},{target:'#themeToggleBtn',section:'receiving',tutorialKey:'themeToggle'}
      ],
      discrepancy:[
        {target:'#discrepancySection .section-head',section:'discrepancy'},{target:'#discDONumber',section:'discrepancy'},{target:'#discExpectedQty',section:'discrepancy'},{target:'#issueType',section:'discrepancy'},{target:'#photoUpload',section:'discrepancy'},{target:'#discrepancyForm .form-actions',section:'discrepancy'},{target:'#discrepancyEditorHint',section:'discrepancy'},{target:'[data-action="edit-disc"]',section:'discrepancy'},{target:'#photoUpload',section:'discrepancy'},{target:'#discrepancyForm .form-actions',section:'discrepancy'},{target:'#discrepancySection .table-card',section:'discrepancy'},{target:'#themeToggleBtn',section:'discrepancy',tutorialKey:'themeToggle'}
      ],
      discrepancyClient:[
        {target:'#discrepancySection .section-head',section:'discrepancy'},{target:'#discrepancySection .table-card',section:'discrepancy'},{target:'#discrepancySection .table-card',section:'discrepancy'},{target:'#discrepancySection .table-wrap',section:'discrepancy'},{target:'#discrepancySection .table-card',section:'discrepancy'},{target:'#discrepancyClientDetailHint',section:'discrepancy'},{target:'#themeToggleBtn',section:'discrepancy',tutorialKey:'themeToggle'}
      ]
    };
    return groups[tutorialTextGroup()]||groups.general;
  }
  function tutorialSteps(){
    const group=tutorialTextGroup(),blueprint=tutorialBlueprint();
    const languagePack=TUTORIAL_TEXT[tutorialLanguage]||TUTORIAL_TEXT.en;
    const textPack=group==='booking'?(TUTORIAL_BOOKING_V6[tutorialLanguage]||TUTORIAL_BOOKING_V6.en):(languagePack[group]||TUTORIAL_TEXT.en[group]||TUTORIAL_TEXT.en.general);
    const specialPack=(TUTORIAL_SPECIAL_TEXT[tutorialLanguage]||TUTORIAL_SPECIAL_TEXT.en);
    return blueprint.map((step,index)=>{
      const pair=step.tutorialKey ? (specialPack[step.tutorialKey]||TUTORIAL_SPECIAL_TEXT.en[step.tutorialKey]) : (textPack[index]||TUTORIAL_TEXT.en.general[0]);
      return Object.assign({},step,{title:String(pair[0]).replace('{user}',currentUser?.username||'team'),copy:String(pair[1]).replace('{user}',currentUser?.username||'team')});
    });
  }
  function tutorialTarget(step){
    const target=document.querySelector(step.target);
    if(target&&target.getClientRects().length)return target;
    return document.querySelector('#'+step.section+'Section .section-head')||$('mobileMenu');
  }
  function positionTutorialGuide(){
    const guide=document.querySelector('.tutorial-guide-wrap');
    const layer=$('tutorialLayer');
    if(!guide||!layer)return;
    if(innerWidth>680){
      ['top','bottom','right','width','height','opacity'].forEach(name=>guide.style.removeProperty(name));
      return;
    }
    const languagePick=layer.classList.contains('language-pick');
    const panel=languagePick?$('tutorialLanguagePanel'):document.querySelector('.tutorial-dialog');
    const panelRect=panel?.getBoundingClientRect();
    const topbarBottom=document.querySelector('.topbar')?.getBoundingClientRect().bottom||0;
    const panelTop=(panelRect&&panelRect.top>topbarBottom+100)?panelRect.top:innerHeight*.72;
    const gap=8;
    const bottom=Math.max(0,innerHeight-panelTop+gap);
    const availableHeight=Math.max(150,panelTop-topbarBottom-gap);
    const height=Math.max(150,Math.min(300,innerHeight*.31,availableHeight));
    Object.assign(guide.style,{
      top:'auto',
      bottom:Math.round(bottom)+'px',
      right:'-8px',
      width:Math.round(Math.min(180,Math.max(138,innerWidth*.37)))+'px',
      height:Math.round(height)+'px',
      opacity:'1'
    });
  }
  function positionTutorialTarget(){
    if(!$('tutorialLayer').classList.contains('show'))return;
    positionTutorialGuide();
    if($('tutorialLayer').classList.contains('language-pick'))return;
    const steps=tutorialSteps(),step=steps[tutorialIndex],target=tutorialTarget(step);if(!target)return;
    const rect=target.getBoundingClientRect(),pad=8;
    const left=Math.max(7,rect.left-pad),top=Math.max(7,rect.top-pad),right=Math.min(innerWidth-7,rect.right+pad),bottom=Math.min(innerHeight-7,rect.bottom+pad);
    Object.assign($('tutorialSpotlight').style,{left:left+'px',top:top+'px',width:Math.max(34,right-left)+'px',height:Math.max(34,bottom-top)+'px'});
  }

  function tutorialSafeViewport(){
    const topbar=document.querySelector('.topbar');
    const dialog=document.querySelector('.tutorial-dialog');
    const top=(topbar?.getBoundingClientRect().bottom||0)+18;
    let bottom=innerHeight-18;
    if(dialog&&getComputedStyle(dialog).display!=='none'){
      const dialogRect=dialog.getBoundingClientRect();
      if(dialogRect.top>top+150)bottom=Math.min(bottom,dialogRect.top-18);
    }
    if(bottom<top+140)bottom=innerHeight-18;
    return {top,bottom,height:Math.max(140,bottom-top)};
  }

  function centerTargetInsideScrollableParents(target,behavior){
    let parent=target.parentElement;
    const targetRect=target.getBoundingClientRect();
    while(parent&&parent!==document.body){
      const style=getComputedStyle(parent);
      if((/auto|scroll/.test(style.overflowX)||/auto|scroll/.test(style.overflowY))&&(parent.scrollWidth>parent.clientWidth+2||parent.scrollHeight>parent.clientHeight+2)){
        const parentRect=parent.getBoundingClientRect();
        const options={behavior};
        if(parent.scrollWidth>parent.clientWidth+2){
          options.left=parent.scrollLeft+(targetRect.left-parentRect.left)-Math.max(0,(parent.clientWidth-targetRect.width)/2);
        }
        if(parent!==document.scrollingElement&&parent.scrollHeight>parent.clientHeight+2){
          options.top=parent.scrollTop+(targetRect.top-parentRect.top)-Math.max(0,(parent.clientHeight-targetRect.height)/2);
        }
        parent.scrollTo(options);
      }
      parent=parent.parentElement;
    }
  }

  function tutorialTargetIsVisible(target){
    if(!target)return false;
    const rect=target.getBoundingClientRect(),safe=tutorialSafeViewport();
    if(target.closest('.sidebar'))return rect.top>=7&&rect.bottom<=innerHeight-7&&rect.right>0;
    const visibleTop=Math.max(rect.top,safe.top),visibleBottom=Math.min(rect.bottom,safe.bottom);
    const visibleHeight=Math.max(0,visibleBottom-visibleTop);
    return visibleHeight>=Math.min(70,Math.max(28,rect.height*.35));
  }

  function autoScrollTutorialTarget(step,token,forceInstant=false){
    if(token!==tutorialScrollToken||!$('tutorialLayer').classList.contains('show')||$('tutorialLayer').classList.contains('language-pick'))return;
    const target=tutorialTarget(step);if(!target)return;
    const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior=(forceInstant||reduceMotion)?'auto':'smooth';

    if(target.closest('.sidebar')){
      target.scrollIntoView({behavior,block:'center',inline:'nearest'});
    }else{
      const rect=target.getBoundingClientRect();
      const safe=tutorialSafeViewport();
      const documentTop=scrollY+rect.top;
      const desiredTop=rect.height>=safe.height-20?safe.top:safe.top+Math.max(0,(safe.height-Math.min(rect.height,safe.height))/2);
      const maxScroll=Math.max(0,document.documentElement.scrollHeight-innerHeight);
      const destination=Math.max(0,Math.min(maxScroll,documentTop-desiredTop));
      window.scrollTo({top:destination,behavior});
      centerTargetInsideScrollableParents(target,behavior);
    }

    requestAnimationFrame(positionTutorialTarget);
    clearTimeout(tutorialPositionTimer);
    tutorialPositionTimer=setTimeout(positionTutorialTarget,behavior==='smooth'?420:60);

    if(!forceInstant){
      clearTimeout(tutorialAutoScrollTimer);
      tutorialAutoScrollTimer=setTimeout(()=>{
        if(token!==tutorialScrollToken)return;
        const latest=tutorialTarget(step);
        if(!tutorialTargetIsVisible(latest))autoScrollTutorialTarget(step,token,true);
        else positionTutorialTarget();
      },760);
    }
  }

  function scheduleTutorialAutoScroll(step){
    const token=++tutorialScrollToken;
    clearTimeout(tutorialAutoScrollTimer);
    clearTimeout(tutorialPositionTimer);
    const delay=step.menu?360:120;
    tutorialAutoScrollTimer=setTimeout(()=>autoScrollTutorialTarget(step,token,false),delay);
  }
  function applyTutorialLanguageUI(){
    const ui=TUTORIAL_UI[tutorialLanguage]||TUTORIAL_UI.en;
    $('tutorialBackBtn').textContent=ui.back;$('tutorialSkipBtn').textContent=ui.skip;$('tutorialNeverBtn').textContent=ui.never;
    $('tutorialNeverBtn').style.display=tutorialMode==='general'?'':'none';
    $('tutorialGuideName').textContent='Qaiyum Guide · '+TUTORIAL_MODE_NAMES[tutorialMode].replace(' Guide','');
  }
  function renderTutorialStep(){
    const steps=tutorialSteps(),step=steps[tutorialIndex];if(!step)return;
    showSection(step.section||'dashboard');
    if(step.menu)setMenuOpen(true);
    applyTutorialLanguageUI();
    const ui=TUTORIAL_UI[tutorialLanguage]||TUTORIAL_UI.en;
    $('tutorialTitle').textContent=step.title;$('tutorialCopy').textContent=step.copy;
    $('tutorialStepCount').textContent=(tutorialIndex+1)+' / '+steps.length;
    $('tutorialBackBtn').disabled=tutorialIndex===0;
    $('tutorialNextBtn').textContent=tutorialIndex===steps.length-1?ui.finish:ui.next;
    $('tutorialProgress').innerHTML=steps.map((_,i)=>'<span class="'+(i<=tutorialIndex?'done':'')+'"></span>').join('');
    scheduleTutorialAutoScroll(step);
  }
  function showTutorialLanguagePicker(mode){
    tutorialMode=['general','booking','receiving','discrepancy'].includes(mode)?mode:'general';tutorialIndex=-1;
    $('languageGuideName').textContent=TUTORIAL_MODE_NAMES[tutorialMode];
    const myanmarBtn=document.querySelector('[data-tutorial-language="my"]');
    if(myanmarBtn) myanmarBtn.style.display=currentUser?.role==='staff'?'':'none';
    $('tutorialLayer').classList.add('show','language-pick');$('tutorialLayer').setAttribute('aria-hidden','false');setMenuOpen(false);requestAnimationFrame(positionTutorialGuide);
  }
  function beginTutorial(language){
    if(language==='my'&&currentUser?.role!=='staff') language='en';
    tutorialLanguage=['ms','en','my','zh'].includes(language)?language:'en';tutorialIndex=0;
    $('tutorialLayer').classList.remove('language-pick');renderTutorialStep();
  }
  function startTutorial(force=false,mode='general'){
    if(!currentUser||document.body.classList.contains('logged-out')||(mode==='general'&&!force&&tutorialIsCompleted()))return;
    showTutorialLanguagePicker(mode);
  }
  function closeTutorial(complete=false){
    tutorialScrollToken++;clearTimeout(tutorialAutoScrollTimer);clearTimeout(tutorialPositionTimer);if(complete&&tutorialMode==='general')rememberTutorialCompletion();tutorialIndex=-1;
    $('tutorialLayer')?.classList.remove('show','language-pick');$('tutorialLayer')?.setAttribute('aria-hidden','true');setMenuOpen(false);
  }
  function moveTutorial(direction){
    const steps=tutorialSteps(),last=steps.length-1,ui=TUTORIAL_UI[tutorialLanguage]||TUTORIAL_UI.en;
    if(direction>0&&tutorialIndex===last){closeTutorial(tutorialMode==='general');toast(ui.completed,'success');return;}
    tutorialIndex=Math.max(0,Math.min(last,tutorialIndex+direction));renderTutorialStep();
  }
  function showSection(name){
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.section===name));
    $(`${name}Section`).classList.add('active');
    setMenuOpen(false);
    if(name==='dashboard') renderDashboard();
    if(name==='booking') loadBookingAvailability(true);
    if(name==='receiving') renderReceivingTable();
    if(name==='discrepancy') renderDiscrepancyTable();
  }

  function getReceivingFormRecord(){
    const editId = $('receivingEditId').value;
    const old = editId ? receivingRecords.find(r=>r.id===editId) : null;
    return {
      id: $('recordId').value,
      doNumber: $('doNumber').value.trim(), poNumber: $('poNumber').value.trim(), customer: $('customerName').value.trim(), companyId: companyIdFor($('customerName').value.trim()),
      shipmentDate: $('shipmentDate').value, vehicleNumber: $('vehicleNumber').value.trim(), transportType: $('transportType').value,
      expectedQty: num($('expectedQty').value), actualQty: $('actualQty').value==='' ? '' : num($('actualQty').value),
      staffName: $('staffName').value.trim(), remarks: $('receivingRemarks').value.trim(),
      arrivalTime: old?.arrivalTime || $('receivingForm').dataset.arrivalTime || '',
      startTime: old?.startTime || $('receivingForm').dataset.startTime || '',
      completionTime: old?.completionTime || $('receivingForm').dataset.completionTime || '',
      createdAt: old?.createdAt || nowISO(), updatedAt: nowISO(), updatedBy: currentUser?.email||''
    };
  }

  function validateReceiving(record, forStatus=false){
    const missing=[];
    if(!record.doNumber) missing.push('DO Number'); if(!record.poNumber) missing.push('PO Number'); if(!record.customer) missing.push('Customer Name');
    if(!record.shipmentDate) missing.push('Shipment Date'); if(!record.vehicleNumber) missing.push('Vehicle Number'); if(!record.transportType) missing.push('Transport Type');
    if(!record.staffName) missing.push('Receiving Staff Name');
    if($('expectedQty').value==='') missing.push('Expected Quantity');
    if(missing.length){ showError('receivingError','Please complete: '+missing.join(', ')); return false; }
    const duplicate = receivingRecords.some(r => r.customer===record.customer && r.doNumber.toLowerCase()===record.doNumber.toLowerCase() && r.id!==record.id);
    if(duplicate){ showError('receivingError','Duplicate DO Number found for this company. Please check the DO Number.'); return false; }
    if(forStatus && record.completionTime){ showError('receivingError','This record is already completed.'); return false; }
    hideError('receivingError'); return true;
  }

  async function saveReceivingRecord(record,quiet=false){
    try{await db.collection('receivings').doc(record.id).set({...record,updatedServerAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});if(!quiet)toast($('receivingEditId').value?'Receiving record updated.':'Receiving record saved.');return true;}
    catch(e){showError('receivingError',authErrorMessage(e));return false;}
  }
  function resetReceivingForm(){
    $('receivingForm').reset(); $('receivingEditId').value=''; $('recordId').value=newRecordId(); $('shipmentDate').value=todayISO(); $('variance').value='0';
    $('customerName').value=isAllCompanies()?'':activeCompany;
    $('receivingForm').dataset.arrivalTime=''; $('receivingForm').dataset.startTime=''; $('receivingForm').dataset.completionTime=''; if($('receivingBookingSlot'))$('receivingBookingSlot').value='';
    $('formStatusBadge').className='status-badge status-pending'; $('formStatusBadge').textContent='Pending';
    $('timestampInfo').textContent=''; $('varianceWarning').classList.remove('show'); $('createDiscrepancyBtn').style.display='none'; hideError('receivingError');
    stopTimer(); $('liveTimer').textContent='4-hour timer: Not started'; $('liveTimer').classList.remove('warning');
    applyWorkspaceFormState(); updateStatusButtons(); updateCurrentDateTime();
  }

  function populateReceivingForm(record){
    if(activeCompany!==record.customer) setActiveCompany(record.customer, false);
    showSection('receiving');
    $('receivingEditId').value=record.id; $('recordId').value=record.id; $('doNumber').value=record.doNumber; $('poNumber').value=record.poNumber;
    $('customerName').value=record.customer; $('shipmentDate').value=record.shipmentDate; if($('receivingBookingSlot'))$('receivingBookingSlot').value=record.bookingSlot||''; $('vehicleNumber').value=record.vehicleNumber; $('transportType').value=record.transportType;
    $('expectedQty').value=record.expectedQty; $('actualQty').value=record.actualQty; $('staffName').value=record.staffName; $('receivingRemarks').value=record.remarks || '';
    $('receivingForm').dataset.arrivalTime=record.arrivalTime||''; $('receivingForm').dataset.startTime=record.startTime||''; $('receivingForm').dataset.completionTime=record.completionTime||'';
    updateReceivingVariance(); updateFormStatus(record); updateTimestampInfo(record); updateStatusButtons(); startLiveTimerFor(record);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function updateReceivingVariance(){
    const v=variance($('expectedQty').value,$('actualQty').value); $('variance').value=(v>0?'+':'')+v;
    const active=$('actualQty').value!=='' && v!==0;
    $('varianceWarning').classList.toggle('show',active); $('createDiscrepancyBtn').style.display=active?'inline-flex':'none';
  }
  function updateFormStatus(record=getReceivingFormRecord()){
    const status=baseStatus(record); $('formStatusBadge').textContent=status; $('formStatusBadge').className='status-badge '+statusClass(status);
  }
  function updateTimestampInfo(record=getReceivingFormRecord()){
    const parts=[]; if(record.arrivalTime) parts.push('Arrived: '+fmtDateTime(record.arrivalTime)); if(record.startTime) parts.push('Started: '+fmtDateTime(record.startTime)); if(record.completionTime) parts.push('Completed: '+fmtDateTime(record.completionTime));
    $('timestampInfo').textContent=parts.join(' | ');
  }
  function updateStatusButtons(){
    const r=getReceivingFormRecord(), noCompany=isAllCompanies(); $('arrivedBtn').disabled=noCompany||!!r.arrivalTime; $('startBtn').disabled=noCompany||!r.arrivalTime || !!r.startTime; $('completeBtn').disabled=noCompany||!r.startTime || !!r.completionTime;
    [$('arrivedBtn'),$('startBtn'),$('completeBtn')].forEach(b=>b.style.opacity=b.disabled?'.55':'1');
  }
  function startLiveTimerFor(record){
    stopTimer();
    if(!record.arrivalTime || record.completionTime){
      $('liveTimer').textContent=record.completionTime?`Total duration: ${formatDuration(durationMs(record))}`:'4-hour timer: Not started';
      $('liveTimer').classList.toggle('warning',record.completionTime && durationMs(record)>FOUR_HOURS_MS); return;
    }
    const tick=()=>{
      const elapsed=durationMs(record); const remain=FOUR_HOURS_MS-elapsed;
      if(remain>=0){$('liveTimer').textContent=`Time left: ${formatClock(remain)}`;$('liveTimer').classList.remove('warning');}
      else{$('liveTimer').textContent=`Exceeded by: ${formatClock(Math.abs(remain))}`;$('liveTimer').classList.add('warning');}
    };
    tick(); timerInterval=setInterval(tick,1000);
  }
  function formatClock(ms){
    const s=Math.floor(ms/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }
  function stopTimer(){ if(timerInterval){clearInterval(timerInterval);timerInterval=null;} }

  async function handleStatusAction(action){
    let record=getReceivingFormRecord();
    if(!record.staffName){record.staffName=currentUser?.displayName||currentUser?.email||'Warehouse Staff';$('staffName').value=record.staffName;}
    if(action==='complete'&&$('actualQty').value===''){$('actualQty').value=String(record.expectedQty);record.actualQty=record.expectedQty;updateReceivingVariance();}
    if(!validateReceiving(record,true))return;
    if(action==='arrived'){if(record.arrivalTime){toast('Arrival time is locked and cannot be changed.','warning');return;}record.arrivalTime=nowISO();$('receivingForm').dataset.arrivalTime=record.arrivalTime;}
    if(action==='start'){if(!record.arrivalTime){showError('receivingError','Click Arrived before Start Receiving.');return;}if(record.startTime){toast('Receiving start time is already recorded.','warning');return;}record.startTime=nowISO();$('receivingForm').dataset.startTime=record.startTime;}
    if(action==='complete'){if(!record.startTime){showError('receivingError','Click Start Receiving before Complete.');return;}if(record.completionTime){toast('Completion time is already recorded.','warning');return;}if($('actualQty').value===''){showError('receivingError','Enter Actual Received Quantity before completing.');return;}record.actualQty=num($('actualQty').value);record.completionTime=nowISO();$('receivingForm').dataset.completionTime=record.completionTime;}
    record.updatedAt=nowISO();record.updatedBy=currentUser?.email||'';if(!(await saveReceivingRecord(record,true)))return;
    updateFormStatus(record);updateTimestampInfo(record);updateStatusButtons();startLiveTimerFor(record);
    const status=baseStatus(record);toast(action==='arrived'?'Arrival time recorded.':action==='start'?'Receiving started.':status==='Exceeded 4 Hours'?'Completed, but exceeded 4 hours.':'Receiving completed.',status==='Exceeded 4 Hours'?'warning':'success');
    if(status==='Exceeded 4 Hours')showError('receivingError','Warning: Receiving process exceeded the four-hour target.');else hideError('receivingError');
  }
  async function handleRecordMilestone(record,action){
    if(!requireEditor())return;
    const patch={updatedAt:nowISO(),updatedBy:currentUser?.email||'',staffName:record.staffName||currentUser?.displayName||currentUser?.email||'Warehouse Staff'};
    if(action==='arrived'){if(record.arrivalTime)return;patch.arrivalTime=nowISO();}
    if(action==='start'){if(!record.arrivalTime){toast('Mark Arrived first.','warning');return;}if(record.startTime)return;patch.startTime=nowISO();}
    if(action==='complete'){if(!record.startTime){toast('Start Receiving first.','warning');return;}if(record.completionTime)return;patch.completionTime=nowISO();if(record.actualQty===''||record.actualQty==null)patch.actualQty=num(record.expectedQty);}
    try{await db.collection('receivings').doc(record.id).set(patch,{merge:true});toast(action==='arrived'?'Shipment marked Arrived.':action==='start'?'Receiving started.':'Receiving completed.','success');}
    catch(err){toast(authErrorMessage(err),'warning');}
  }

  function filteredReceiving(useDashboard=false){
    const p=useDashboard?'dashFilter':'recFilter';
    const date=$(p+'Date')?.value||'', customer=($(p+'Customer')?.value||'').toLowerCase(), status=$(p+'Status')?.value||'', doNum=($(p+'DO')?.value||'').toLowerCase(), po=($(p+'PO')?.value||'').toLowerCase();
    return receivingRecords.filter(r=>{
      if(!belongsToWorkspace(r)) return false;
      const bs=baseStatus(r); const disc=hasDiscrepancy(r);
      return (!date||r.shipmentDate===date)&&(!customer||r.customer.toLowerCase().includes(customer))&&(!doNum||r.doNumber.toLowerCase().includes(doNum))&&(!po||r.poNumber.toLowerCase().includes(po))&&(!status||(status==='Discrepancy'?disc:bs===status));
    });
  }

  function renderReceivingTable(){
    const rows=filteredReceiving(false); $('receivingCount').textContent=`${rows.length} record${rows.length===1?'':'s'}`;
    $('receivingTableBody').innerHTML=rows.length?rows.map(r=>{
      const v=variance(r.expectedQty,r.actualQty), bs=baseStatus(r);
      const milestone=isEditor()?(bs==='Scheduled Inbound'||bs==='Pending'?`<button class="icon-btn milestone-btn" data-action="arrive-rec" data-id="${esc(r.id)}" title="Mark Arrived" aria-label="Mark Arrived">🚚</button>`:bs==='Arrived'?`<button class="icon-btn milestone-btn" data-action="start-rec" data-id="${esc(r.id)}" title="Start Receiving" aria-label="Start Receiving">▶</button>`:bs==='Receiving'?`<button class="icon-btn milestone-btn" data-action="complete-rec" data-id="${esc(r.id)}" title="Complete Receiving" aria-label="Complete Receiving">✓</button>`:''):'';
      const actual=(r.actualQty===''||r.actualQty==null)?'-':r.actualQty;
      const varianceText=(r.actualQty===''||r.actualQty==null)?'-':`${v>0?'+':''}${v}`;
      return `<tr><td>${esc(r.id)}</td><td>${esc(r.shipmentDate)}</td><td>${esc(r.bookingSlot||'-')}</td><td><strong>${esc(r.doNumber)}</strong></td><td>${esc(r.poNumber)}</td><td>${esc(r.customer)}</td><td>${esc(r.vehicleNumber)}</td><td>${r.expectedQty}</td><td>${actual}</td><td style="font-weight:800;color:${r.completionTime&&v!==0?'var(--dark-red)':'inherit'}">${varianceText}</td><td>${esc(fmtTime(r.arrivalTime))}</td><td>${esc(fmtTime(r.startTime))}</td><td>${esc(fmtTime(r.completionTime))}</td><td>${esc(r.completionTime?formatDuration(durationMs(r)):'-')}</td><td>${statusBadge(bs)} ${hasDiscrepancy(r)?statusBadge('Discrepancy'):''}</td><td><div class="action-group">${milestone}${actionButton('view-rec',r.id,'View receiving details','view')}${actionButton('edit-rec',r.id,'Edit receiving record','edit')}${actionButton('print-rec',r.id,'Print receiving record','print')}${actionButton('export-rec',r.id,'Download receiving record','download')}${actionButton('delete-rec',r.id,'Delete receiving record','delete')}</div></td></tr>`;
    }).join(''):`<tr class="empty-row"><td colspan="16">No receiving records found.</td></tr>`;
  }

  async function deleteReceiving(id){
    const r=receivingRecords.find(x=>x.id===id);if(!r)return;if(!confirm(`Delete receiving record ${r.doNumber}? This cannot be undone.`))return;
    try{const linked=discrepancyRecords.filter(d=>d.linkedReceivingId===id);await Promise.all([db.collection('receivings').doc(id).delete(),...linked.map(d=>db.collection('discrepancies').doc(d.id).delete())]);resetReceivingForm();toast('Receiving record deleted.','warning');}
    catch(e){toast(authErrorMessage(e),'warning');}
  }
  function createDiscrepancyFromReceiving(record){
    showSection('discrepancy'); resetDiscrepancyForm();
    $('linkedReceivingId').value=record.id; $('reportDate').value=record.shipmentDate||todayISO(); $('discDONumber').value=record.doNumber; $('discPONumber').value=record.poNumber; $('discCustomer').value=record.customer;
    $('discExpectedQty').value=record.expectedQty; $('discActualQty').value=record.actualQty; $('personInCharge').value=record.staffName; updateDiscrepancyVariance();
    window.scrollTo({top:0,behavior:'smooth'}); toast('Shipment details copied into discrepancy report.');
  }

  function getDiscrepancyFormRecord(){
    const editId=$('discrepancyEditId').value; const old=editId?discrepancyRecords.find(d=>d.id===editId):null;
    return {id:editId||newDiscrepancyId(),linkedReceivingId:$('linkedReceivingId').value||old?.linkedReceivingId||'',reportDate:$('reportDate').value,doNumber:$('discDONumber').value.trim(),poNumber:$('discPONumber').value.trim(),customer:$('discCustomer').value.trim(),companyId:companyIdFor($('discCustomer').value.trim()),sku:$('sku').value.trim(),productName:$('productName').value.trim(),expectedQty:num($('discExpectedQty').value),actualQty:num($('discActualQty').value),issueType:$('issueType').value,itemCondition:$('itemCondition').value,actionTaken:$('actionTaken').value,pic:$('personInCharge').value.trim(),remarks:$('discRemarks').value.trim(),photo:selectedPhotoData||old?.photo||'',resolved:old?.resolved||false,createdAt:old?.createdAt||nowISO(),updatedAt:nowISO(),updatedBy:currentUser?.email||''};
  }
  function validateDiscrepancy(d){
    const missing=[]; const req=[['reportDate','Report Date'],['doNumber','DO Number'],['poNumber','PO Number'],['customer','Customer Name'],['sku','SKU'],['productName','Product Name'],['issueType','Issue Type'],['itemCondition','Item Condition'],['actionTaken','Action Taken'],['pic','Person in Charge']];
    req.forEach(([k,n])=>{if(!d[k])missing.push(n)}); if($('discExpectedQty').value==='')missing.push('Expected Quantity'); if($('discActualQty').value==='')missing.push('Actual Quantity');
    if(missing.length){showError('discrepancyError','Please complete: '+missing.join(', '));return false;} hideError('discrepancyError');return true;
  }
  function updateDiscrepancyVariance(){const v=variance($('discExpectedQty').value,$('discActualQty').value);$('discVariance').value=(v>0?'+':'')+v;}
  function resetDiscrepancyForm(){
    $('discrepancyForm').reset();$('discrepancyEditId').value='';$('linkedReceivingId').value='';$('reportDate').value=todayISO();$('discCustomer').value=isAllCompanies()?'':activeCompany;$('discVariance').value='0';selectedPhotoData='';$('photoStatus').textContent='';hideError('discrepancyError');$('discFormBadge').textContent='Unresolved';$('discFormBadge').className='status-badge status-discrepancy';applyWorkspaceFormState();
  }
  async function saveDiscrepancy(d){
    const editing=!!$('discrepancyEditId').value;
    try{await db.collection('discrepancies').doc(d.id).set({...d,updatedServerAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});resetDiscrepancyForm();toast(editing?'Discrepancy report updated.':'Discrepancy report saved.');return true;}
    catch(e){showError('discrepancyError',authErrorMessage(e));return false;}
  }
  function populateDiscrepancyForm(d){
    if(activeCompany!==d.customer) setActiveCompany(d.customer, false);
    showSection('discrepancy');$('discrepancyEditId').value=d.id;$('linkedReceivingId').value=d.linkedReceivingId||'';$('reportDate').value=d.reportDate;$('discDONumber').value=d.doNumber;$('discPONumber').value=d.poNumber;$('discCustomer').value=d.customer;$('sku').value=d.sku;$('productName').value=d.productName;$('discExpectedQty').value=d.expectedQty;$('discActualQty').value=d.actualQty;$('issueType').value=d.issueType;$('itemCondition').value=d.itemCondition;$('actionTaken').value=d.actionTaken;$('personInCharge').value=d.pic;$('discRemarks').value=d.remarks||'';selectedPhotoData=d.photo||'';$('photoStatus').textContent=d.photo?'Existing photo attached.':'';$('discFormBadge').textContent=d.resolved?'Resolved':'Unresolved';$('discFormBadge').className='status-badge '+statusClass(d.resolved?'Resolved':'Unresolved');updateDiscrepancyVariance();window.scrollTo({top:0,behavior:'smooth'});
  }
  function renderDiscrepancyTable(){
    const rows=workspaceDiscrepancyRecords();
    $('discrepancyCount').textContent=`${rows.length} case${rows.length===1?'':'s'}`;
    $('discrepancyTableBody').innerHTML=rows.length?rows.map(d=>{const v=variance(d.expectedQty,d.actualQty);return `<tr><td>${esc(d.reportDate)}</td><td><strong>${esc(d.doNumber)}</strong></td><td>${esc(d.poNumber)}</td><td>${esc(d.customer)}</td><td>${esc(d.sku)}</td><td>${esc(d.productName)}</td><td>${d.expectedQty}</td><td>${d.actualQty}</td><td style="font-weight:800;color:var(--dark-red)">${v>0?'+':''}${v}</td><td>${esc(d.issueType)}</td><td>${esc(d.itemCondition)}</td><td>${esc(d.actionTaken)}</td><td>${esc(d.pic)}</td><td>${statusBadge(d.resolved?'Resolved':'Unresolved')}</td><td><div class="action-group">${actionButton('view-disc',d.id,'View discrepancy details','view')}${actionButton('edit-disc',d.id,'Edit discrepancy case','edit')}${actionButton('resolve-disc',d.id,d.resolved?'Mark as unresolved':'Mark as resolved','resolve')}${actionButton('print-disc',d.id,'Print discrepancy report','print')}${actionButton('delete-disc',d.id,'Delete discrepancy case','delete')}</div></td></tr>`}).join(''):`<tr class="empty-row"><td colspan="15">No discrepancy reports found.</td></tr>`;
  }
  async function deleteDiscrepancy(id){const d=discrepancyRecords.find(x=>x.id===id);if(!d)return;if(!confirm(`Delete discrepancy report for ${d.doNumber}?`))return;try{await db.collection('discrepancies').doc(id).delete();toast('Discrepancy report deleted.','warning');}catch(e){toast(authErrorMessage(e),'warning');}}
  async function toggleResolved(id){const d=discrepancyRecords.find(x=>x.id===id);if(!d)return;try{await db.collection('discrepancies').doc(id).update({resolved:!d.resolved,updatedAt:nowISO(),updatedBy:currentUser?.email||''});toast(!d.resolved?'Case marked as resolved.':'Case marked as unresolved.');}catch(e){toast(authErrorMessage(e),'warning');}}
  function renderDashboard(){
    const rows=filteredReceiving(true); const today=todayISO(); const todayRows=rows.filter(r=>r.shipmentDate===today);
    const pending=rows.filter(r=>baseStatus(r)==='Pending').length, arrived=rows.filter(r=>baseStatus(r)==='Arrived').length, receiving=rows.filter(r=>baseStatus(r)==='Receiving').length,
      completed=rows.filter(r=>['Completed','Exceeded 4 Hours'].includes(baseStatus(r))).length, within=rows.filter(r=>baseStatus(r)==='Completed').length, exceeded=rows.filter(r=>baseStatus(r)==='Exceeded 4 Hours').length;
    const completedRows=rows.filter(r=>r.completionTime); const avg=completedRows.length?completedRows.reduce((a,r)=>a+durationMs(r),0)/completedRows.length:0;
    const relatedDOs=new Set(rows.map(r=>r.doNumber.toLowerCase())); const filterActive=['dashFilterDate','dashFilterCustomer','dashFilterStatus','dashFilterDO','dashFilterPO'].some(id=>$(id).value); const workspaceDisc=workspaceDiscrepancyRecords(); const disc=filterActive?workspaceDisc.filter(d=>relatedDOs.has(d.doNumber.toLowerCase())):workspaceDisc; const unresolved=disc.filter(d=>!d.resolved).length;
    const stats=[['Total Shipments Today',todayRows.length,'package','blue','Today only'],['Pending Shipments',pending,'pending','orange','Not arrived'],['Arrived Shipments',arrived,'truck','blue','Waiting to receive'],['Currently Receiving',receiving,'receiving','blue','In progress'],['Completed Shipments',completed,'completed','green','All completed'],['Within 4 Hours',within,'target','green','Target achieved'],['Exceeded 4 Hours',exceeded,'exceeded','red','Needs review'],['Total Discrepancies',disc.length,'discrepancy','orange','All cases'],['Unresolved Cases',unresolved,'unresolved','red','Action required'],['Average Duration',avg?formatDuration(avg):'-','duration','grey','Completed records']];
    $('statsGrid').innerHTML=stats.map(([l,v,i,t,n])=>`<div class="card stat-card"><div class="stat-icon tone-${t}">${metricIcon(i)}</div><div class="stat-label">${l}</div><div class="stat-value">${v}</div><div class="stat-note">${n}</div></div>`).join('');
    $('todaySummary').innerHTML=[['Total Expected Qty',todayRows.reduce((a,r)=>a+num(r.expectedQty),0)],['Total Actual Qty',todayRows.reduce((a,r)=>a+num(r.actualQty),0)],['Today Variance',todayRows.reduce((a,r)=>a+variance(r.expectedQty,r.actualQty),0)],['Completion Rate',todayRows.length?Math.round(todayRows.filter(r=>r.completionTime).length/todayRows.length*100)+'%':'0%'],['Open Discrepancies',workspaceDiscrepancyRecords().filter(d=>d.reportDate===today&&!d.resolved).length]].map(([l,v])=>`<div class="summary-item"><span>${l}</span><strong>${v}</strong></div>`).join('');
    drawChart();
  }

  function drawChart(){
    const canvas=$('dailyChart'), ctx=canvas.getContext('2d'); const dpr=window.devicePixelRatio||1; const rect=canvas.getBoundingClientRect();
    canvas.width=Math.max(600,rect.width*dpr); canvas.height=300*dpr; ctx.scale(dpr,dpr); const W=canvas.width/dpr,H=canvas.height/dpr;
    ctx.clearRect(0,0,W,H); const days=[]; for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d)}
    const vals=days.map(d=>workspaceReceivingRecords().filter(r=>r.shipmentDate===localDateISO(d)).length); const max=Math.max(1,...vals); const pad={l:38,r:18,t:20,b:42}, cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
    ctx.strokeStyle='#dbe3ef';ctx.lineWidth=1;ctx.font='12px Segoe UI';ctx.fillStyle='#6c7a90';
    for(let i=0;i<=4;i++){const y=pad.t+ch*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();ctx.fillText(String(Math.round(max*(1-i/4))),7,y+4)}
    const barW=Math.min(52,cw/days.length*.55); days.forEach((d,i)=>{const x=pad.l+cw*(i+.5)/days.length-barW/2;const bh=vals[i]/max*(ch-10);const y=pad.t+ch-bh;const grad=ctx.createLinearGradient(0,y,0,pad.t+ch);grad.addColorStop(0,'#0b63ce');grad.addColorStop(1,'#8fc3ff');ctx.fillStyle=grad;ctx.fillRect(x,y,barW,bh);ctx.fillStyle='#172033';ctx.textAlign='center';ctx.font='700 12px Segoe UI';ctx.fillText(String(vals[i]),x+barW/2,y-6);ctx.fillStyle='#6c7a90';ctx.font='11px Segoe UI';ctx.fillText(d.toLocaleDateString('en-GB',{weekday:'short'}),x+barW/2,H-24);ctx.fillText(d.getDate()+'/'+(d.getMonth()+1),x+barW/2,H-10)});ctx.textAlign='left';
  }

  function detailHTML(obj,type){
    const fields=type==='receiving'?[['Record ID',obj.id],['Shipment Date',obj.shipmentDate],['Booking Slot',obj.bookingSlot||'-'],['DO Number',obj.doNumber],['PO Number',obj.poNumber],['Customer',obj.customer],['Vehicle Number',obj.vehicleNumber],['Transport Type',obj.transportType],['Expected Qty',obj.expectedQty],['Actual Qty',obj.actualQty],['Variance',variance(obj.expectedQty,obj.actualQty)],['Staff',obj.staffName],['Arrival Time',fmtDateTime(obj.arrivalTime)],['Start Time',fmtDateTime(obj.startTime)],['Completion Time',fmtDateTime(obj.completionTime)],['Total Duration',obj.completionTime?formatDuration(durationMs(obj)):'-'],['Status',baseStatus(obj)],['Remarks',obj.remarks||'-']]:[['Report ID',obj.id],['Report Date',obj.reportDate],['DO Number',obj.doNumber],['PO Number',obj.poNumber],['Customer',obj.customer],['SKU',obj.sku],['Product Name',obj.productName],['Expected Qty',obj.expectedQty],['Actual Qty',obj.actualQty],['Variance',variance(obj.expectedQty,obj.actualQty)],['Issue Type',obj.issueType],['Item Condition',obj.itemCondition],['Action Taken',obj.actionTaken],['Person in Charge',obj.pic],['Status',obj.resolved?'Resolved':'Unresolved'],['Remarks',obj.remarks||'-']];
    return `<div class="detail-grid">${fields.map(([k,v])=>`<div class="detail-item"><small>${esc(k)}</small><div>${esc(v)}</div></div>`).join('')}</div>${type==='discrepancy'&&obj.photo?`<div style="margin-top:15px"><small style="font-weight:800">Photo</small><br><img class="photo-preview" src="${obj.photo}" alt="Discrepancy photo"></div>`:''}`;
  }
  function openDetail(obj,type){$('modalTitle').textContent=type==='receiving'?'Receiving Record Details':'Discrepancy Report Details';$('modalBody').innerHTML=detailHTML(obj,type);$('detailModal').classList.add('show');}
  function printRecord(obj,type){
    const win=window.open('','_blank','width=900,height=700'); if(!win){toast('Pop-up blocked. Allow pop-ups to print.','error');return;}
    win.document.write(`<html><head><title>${type==='receiving'?'Receiving Record':'Discrepancy Report'}</title><style>body{font-family:Arial;padding:28px;color:#172033}h1{color:#0b63ce;border-bottom:2px solid #0b63ce;padding-bottom:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.item{border:1px solid #ddd;padding:10px;border-radius:6px}.item small{display:block;color:#666;font-weight:bold;margin-bottom:5px}img{max-width:100%;max-height:350px;margin-top:15px}</style></head><body><h1>${type==='receiving'?'Warehouse Receiving Record':'Warehouse Discrepancy Report'}</h1><div class="grid">${detailHTML(obj,type).replace('detail-grid','grid').replaceAll('detail-item','item')}</div><script>window.onload=()=>window.print()<\/script></body></html>`); win.document.close();
  }
  function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
  function downloadCSV(filename,headers,rows){const csv=[headers.join(','),...rows.map(r=>r.map(csvEscape).join(','))].join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href);}
  function exportReceiving(records=receivingRecords){downloadCSV(`warehouse_receiving_${safeFilePart(workspaceName())}.csv`,['Record ID','Shipment Date','Booking Slot','DO Number','PO Number','Customer','Vehicle Number','Transport Type','Expected Qty','Actual Qty','Variance','Staff','Arrival Time','Receiving Start Time','Completion Time','Total Duration','Status','Remarks'],records.map(r=>[r.id,r.shipmentDate,r.bookingSlot||'',r.doNumber,r.poNumber,r.customer,r.vehicleNumber,r.transportType,r.expectedQty,r.actualQty,variance(r.expectedQty,r.actualQty),r.staffName,fmtDateTime(r.arrivalTime),fmtDateTime(r.startTime),fmtDateTime(r.completionTime),r.completionTime?formatDuration(durationMs(r)):'',baseStatus(r),r.remarks]));}
  async function exportDiscrepancies() {
  const rows = workspaceDiscrepancyRecords();

  if (typeof ExcelJS === 'undefined') {
    toast('Excel export library is not loaded. Please refresh the page.', 'warning');
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Discrepancy Report');

  worksheet.columns = [
    { header: 'Report ID', key: 'id', width: 20 },
    { header: 'Report Date', key: 'reportDate', width: 14 },
    { header: 'DO Number', key: 'doNumber', width: 18 },
    { header: 'PO Number', key: 'poNumber', width: 18 },
    { header: 'Customer', key: 'customer', width: 20 },
    { header: 'SKU', key: 'sku', width: 18 },
    { header: 'Product Name', key: 'productName', width: 24 },
    { header: 'Expected Qty', key: 'expectedQty', width: 14 },
    { header: 'Actual Qty', key: 'actualQty', width: 14 },
    { header: 'Variance', key: 'variance', width: 12 },
    { header: 'Issue Type', key: 'issueType', width: 20 },
    { header: 'Item Condition', key: 'itemCondition', width: 18 },
    { header: 'Action Taken', key: 'actionTaken', width: 22 },
    { header: 'PIC', key: 'pic', width: 18 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Remarks', key: 'remarks', width: 30 },
    { header: 'Photo', key: 'photo', width: 18 }
  ];

  const headerRow = worksheet.getRow(1);

  headerRow.font = {
    bold: true
  };

  headerRow.alignment = {
    vertical: 'middle',
    horizontal: 'center'
  };

  headerRow.height = 24;

  rows.forEach(d => {
    const row = worksheet.addRow({
      id: d.id,
      reportDate: d.reportDate,
      doNumber: d.doNumber,
      poNumber: d.poNumber,
      customer: d.customer,
      sku: d.sku,
      productName: d.productName,
      expectedQty: d.expectedQty,
      actualQty: d.actualQty,
      variance: variance(d.expectedQty, d.actualQty),
      issueType: d.issueType,
      itemCondition: d.itemCondition,
      actionTaken: d.actionTaken,
      pic: d.pic,
      status: d.resolved ? 'Resolved' : 'Unresolved',
      remarks: d.remarks || '',
      photo: ''
    });

    if (d.photo && d.photo.startsWith('data:image/')) {
      try {
        const match = d.photo.match(
          /^data:image\/(png|jpe?g);base64,(.+)$/i
        );

        if (match) {
          const extension =
            match[1].toLowerCase() === 'png'
              ? 'png'
              : 'jpeg';

          const imageId = workbook.addImage({
            base64: d.photo,
            extension: extension
          });

          worksheet.addImage(imageId, {
            tl: {
              col: 16.15,
              row: row.number - 1 + 0.12
            },
            ext: {
              width: 100,
              height: 75
            }
          });

          row.height = 62;
        }
      } catch (error) {
        console.warn('Photo export failed:', error);
      }
    }

    row.alignment = {
      vertical: 'middle'
    };
  });

  worksheet.views = [
    {
      state: 'frozen',
      ySplit: 1
    }
  ];

  const buffer = await workbook.xlsx.writeBuffer();

  const blob = new Blob(
    [buffer],
    {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');

  a.href = url;

  a.download =
    `warehouse_discrepancy_${safeFilePart(workspaceName())}.xlsx`;

  document.body.appendChild(a);

  a.click();

  a.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
  function refreshDatalists(){
    $('customerList').innerHTML=COMPANIES.map(x=>`<option value="${esc(x)}">`).join('');
    const staff=[...new Set(receivingRecords.map(r=>r.staffName).filter(Boolean))].sort();$('staffList').innerHTML=staff.map(x=>`<option value="${esc(x)}">`).join('');
  }

  function applyWorkspaceFormState(){
    const noCompany=isAllCompanies();
    $('receivingCompanyWarning').classList.toggle('show',noCompany);
    $('discrepancyCompanyWarning').classList.toggle('show',noCompany);
    $('receivingForm').querySelector('button[type="submit"]').disabled=noCompany;
    $('discrepancyForm').querySelector('button[type="submit"]').disabled=noCompany;
    if($('bookingCompanyWarning'))$('bookingCompanyWarning').classList.toggle('show',noCompany&&currentUser?.role!=='client');
    if($('bookingCompanyName'))$('bookingCompanyName').value=bookingCompany();
    if($('submitBookingBtn'))$('submitBookingBtn').disabled=noCompany&&currentUser?.role!=='client';
    if(noCompany){$('customerName').value='';$('discCustomer').value='';$('createDiscrepancyBtn').style.display='none';}
    else{
      if(!$('receivingEditId').value)$('customerName').value=activeCompany;
      if(!$('discrepancyEditId').value)$('discCustomer').value=activeCompany;
    }
  }
  function updateWorkspaceUI(){
    renderCompanyOptions(activeCompany);
    const name=workspaceName();
    $('companyWorkspace').value=activeCompany;
    $('companyWorkspace').disabled=currentUser?.role==='client';
    $('currentCompanyLabel').textContent=name;
    $('workspaceBannerName').textContent=name;
    $('receivingWorkspaceLabel').textContent=name;
    $('discrepancyWorkspaceLabel').textContent=name;
    $('workspaceModeText').textContent=isAllCompanies()?'Combined management view. Select one company before entering a new record.':`Only ${name} records are shown.`;
    $('clearWorkspaceBtn').textContent=isAllCompanies()?'Select Company to Clear':`Clear ${name} Data`;
    $('dashFilterCustomer').disabled=!isAllCompanies();
    $('recFilterCustomer').disabled=!isAllCompanies();
    if(!isAllCompanies()){$('dashFilterCustomer').value='';$('recFilterCustomer').value='';}
    applyWorkspaceFormState();
  }
  function setActiveCompany(company, resetForms=true){
    if(currentUser?.role==='client') company=currentUser.company;
    if(company!==ALL_COMPANIES && !COMPANIES.includes(company)) return;
    activeCompany=company; localStorage.setItem(ACTIVE_COMPANY_KEY,activeCompany);
    updateWorkspaceUI();
    if(resetForms){resetReceivingForm();resetDiscrepancyForm();}
    renderReceivingTable();renderDiscrepancyTable();renderDashboard();
    toast(isAllCompanies()?'Showing all companies. Select one company to add new data.':`${activeCompany} workspace selected.`,'success');
  }

  $('companyWorkspace').addEventListener('change',e=>setActiveCompany(e.target.value));
  $('addCompanyBtn').addEventListener('click',openAddCompanyPanel);
  $('saveNewCompanyBtn').addEventListener('click',addNewCompany);
  $('cancelNewCompanyBtn').addEventListener('click',()=>closeAddCompanyPanel());
  $('newCompanyName').addEventListener('keydown',async e=>{if(e.key==='Enter'){e.preventDefault();await addNewCompany()}if(e.key==='Escape')closeAddCompanyPanel()});
  document.querySelectorAll('.nav-btn[data-section]').forEach(b=>b.addEventListener('click',()=>showSection(b.dataset.section)));
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>showSection(b.dataset.go)));
  $('mobileMenu').addEventListener('click',()=>setMenuOpen(!$('sidebar').classList.contains('open')));
  $('themeToggleBtn').addEventListener('click',toggleTheme);
  $('tutorialHelpBtn').addEventListener('click',()=>startTutorial(true,'general'));
  $('bookingGuideBtn').addEventListener('click',()=>startTutorial(true,'booking'));
  $('receivingGuideBtn').addEventListener('click',()=>startTutorial(true,'receiving'));
  $('discrepancyGuideBtn').addEventListener('click',()=>startTutorial(true,'discrepancy'));
  document.querySelectorAll('[data-tutorial-language]').forEach(button=>button.addEventListener('click',()=>beginTutorial(button.dataset.tutorialLanguage)));
  $('tutorialLanguageLater').addEventListener('click',()=>closeTutorial(false));
  $('tutorialBackBtn').addEventListener('click',()=>moveTutorial(-1));
  $('tutorialNextBtn').addEventListener('click',()=>moveTutorial(1));
  $('tutorialSkipBtn').addEventListener('click',()=>closeTutorial(false));
  $('tutorialNeverBtn').addEventListener('click',()=>{const message=(TUTORIAL_UI[tutorialLanguage]||TUTORIAL_UI.en).disabled;closeTutorial(true);toast(message,'success')});
  $('sidebarCloseBtn').addEventListener('click',()=>setMenuOpen(false));
  $('menuBackdrop').addEventListener('click',()=>setMenuOpen(false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenuOpen(false)});
  $('refreshCalendarBtn').addEventListener('click',()=>{loadBookingAvailability(true);toast('Live booking availability refreshed.')});
  $('resetBookingFormBtn').addEventListener('click',()=>{resetBookingForm();toast('Booking form reset.','warning')});
  $('bookingDate').addEventListener('change',()=>{$('bookingSlotStart').value='';$('bookingSlotEnd').value='';loadBookingAvailability(true)});
  $('bookingSlotGrid').addEventListener('click',e=>{const b=e.target.closest('[data-booking-slot]');if(!b||b.disabled)return;const slot=BOOKING_TIME_SLOTS.find(x=>x.start===b.dataset.bookingSlot);if(!slot)return;$('bookingSlotStart').value=slot.start;$('bookingSlotEnd').value=slot.end;renderBookingSlots();});
  $('bookingForm').addEventListener('submit',async e=>{e.preventDefault();await submitShipmentBooking()});
  $('closeModal').addEventListener('click',()=>$('detailModal').classList.remove('show'));
  $('detailModal').addEventListener('click',e=>{if(e.target===$('detailModal'))$('detailModal').classList.remove('show')});
  $('expectedQty').addEventListener('input',updateReceivingVariance);$('actualQty').addEventListener('input',updateReceivingVariance);
  $('discExpectedQty').addEventListener('input',updateDiscrepancyVariance);$('discActualQty').addEventListener('input',updateDiscrepancyVariance);
  $('arrivedBtn').addEventListener('click',async()=>{if(requireEditor())await handleStatusAction('arrived')});$('startBtn').addEventListener('click',async()=>{if(requireEditor())await handleStatusAction('start')});$('completeBtn').addEventListener('click',async()=>{if(requireEditor())await handleStatusAction('complete')});

  $('receivingForm').addEventListener('submit',async e=>{e.preventDefault();if(!requireEditor())return;const r=getReceivingFormRecord();if(!validateReceiving(r))return;if(await saveReceivingRecord(r))resetReceivingForm();});
  $('discrepancyForm').addEventListener('submit',async e=>{e.preventDefault();if(!requireEditor())return;const d=getDiscrepancyFormRecord();if(!validateDiscrepancy(d))return;await saveDiscrepancy(d);});
  $('resetReceivingBtn').addEventListener('click',resetReceivingForm);$('resetDiscrepancyBtn').addEventListener('click',resetDiscrepancyForm);
  $('newReceivingBtn').addEventListener('click',()=>{
  if(!requireEditor()) return;

  if(isAllCompanies()){
    toast('Select a company workspace first.','warning');
    return;
  }

  resetReceivingForm();

  if($('receivingBookingSlot')){
    $('receivingBookingSlot').value='';
  }

  $('doNumber')?.focus();

  toast('New manual receiving ready.','success');
});
  $('createDiscrepancyBtn').addEventListener('click',async()=>{if(!requireEditor())return;const r=getReceivingFormRecord();if(!validateReceiving(r))return;if(await saveReceivingRecord(r,true))createDiscrepancyFromReceiving(r)});
  $('exportReceivingBtn').addEventListener('click',()=>exportReceiving(filteredReceiving(false)));$('exportDiscrepancyBtn').addEventListener('click',exportDiscrepancies);
  $('refreshDashboardBtn').addEventListener('click',renderDashboard);
  $('clearWorkspaceBtn').addEventListener('click',async()=>{
    if(!requireEditor())return;if(isAllCompanies()){toast('Select one company before clearing company data.','warning');return;}const name=activeCompany;
    if(!confirm(`Clear ALL receiving and discrepancy data for ${name}?`))return;if(!confirm('Final warning: this cannot be undone.'))return;
    try{await clearWorkspaceData(name);resetReceivingForm();resetDiscrepancyForm();toast(`${name} online data cleared.`,'warning');}catch(e){toast(authErrorMessage(e),'warning');}
  });
  $('clearAllBtn').addEventListener('click',async()=>{
    if(!isAdmin()){toast('Admin access required.','warning');return;}if(!confirm('Clear ALL receiving and discrepancy data for ALL companies?'))return;if(!confirm('Final warning: this cannot be undone.'))return;
    try{await clearAllData();resetReceivingForm();resetDiscrepancyForm();toast('All online warehouse data cleared.','warning');}catch(e){toast(authErrorMessage(e),'warning');}
  });

  ['recFilterDate','recFilterCustomer','recFilterStatus','recFilterDO','recFilterPO'].forEach(id=>$(id).addEventListener('input',renderReceivingTable));
  ['dashFilterDate','dashFilterCustomer','dashFilterStatus','dashFilterDO','dashFilterPO'].forEach(id=>$(id).addEventListener('input',renderDashboard));
  $('resetReceivingFilters').addEventListener('click',()=>{['recFilterDate','recFilterCustomer','recFilterStatus','recFilterDO','recFilterPO'].forEach(id=>$(id).value='');renderReceivingTable()});
  $('resetDashboardFilters').addEventListener('click',()=>{['dashFilterDate','dashFilterCustomer','dashFilterStatus','dashFilterDO','dashFilterPO'].forEach(id=>$(id).value='');renderDashboard()});

  $('receivingTableBody').addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;const r=receivingRecords.find(x=>x.id===b.dataset.id);if(!r)return;const a=b.dataset.action;if(a==='view-rec')openDetail(r,'receiving');if(a==='arrive-rec')await handleRecordMilestone(r,'arrived');if(a==='start-rec')await handleRecordMilestone(r,'start');if(a==='complete-rec')await handleRecordMilestone(r,'complete');if(a==='edit-rec'&&requireEditor())populateReceivingForm(r);if(a==='delete-rec'&&requireEditor())await deleteReceiving(r.id);if(a==='print-rec')printRecord(r,'receiving');if(a==='export-rec')exportReceiving([r]);});
  $('discrepancyTableBody').addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;const d=discrepancyRecords.find(x=>x.id===b.dataset.id);if(!d)return;const a=b.dataset.action;if(a==='view-disc')openDetail(d,'discrepancy');if(a==='edit-disc'&&requireEditor())populateDiscrepancyForm(d);if(a==='delete-disc'&&requireEditor())await deleteDiscrepancy(d.id);if(a==='resolve-disc'&&requireEditor())await toggleResolved(d.id);if(a==='print-disc')printRecord(d,'discrepancy');});
  $('photoUpload').addEventListener('change',async e=>{const file=e.target.files[0];if(!file){selectedPhotoData='';$('photoStatus').textContent='';return;}try{$('photoStatus').textContent='Compressing photo...';selectedPhotoData=await compressImage(file);$('photoStatus').textContent='Photo ready to save online.';hideError('discrepancyError');}catch(err){e.target.value='';selectedPhotoData='';showError('discrepancyError',err.message);$('photoStatus').textContent='';}});
  window.addEventListener('resize',()=>{if($('dashboardSection').classList.contains('active'))drawChart()});
  window.addEventListener('resize',positionTutorialTarget);
  window.addEventListener('scroll',positionTutorialTarget,{passive:true});
  document.addEventListener('keydown',e=>{if(!$('tutorialLayer').classList.contains('show'))return;if(e.key==='Escape')closeTutorial(false);if($('tutorialLayer').classList.contains('language-pick'))return;if(e.key==='ArrowRight')moveTutorial(1);if(e.key==='ArrowLeft')moveTutorial(-1)});
  setInterval(updateCurrentDateTime,1000);


  const LOGIN_I18N={
    en:{subtitle:'Sign in to open your secure online company workspace.',idLabel:'Login ID or Email',idPlaceholder:'Example: admin, airali or email',password:'Password',passwordPlaceholder:'Enter password',submit:'🔐 Sign In',help:'<strong>First admin login:</strong> admin / Admin@2026<br/><span style="opacity:.82">Client may use company Login ID (example: airali) or the Firebase email given by admin.</span>',missing:'Enter your Login ID/email and password.'},
    ms:{subtitle:'Log masuk untuk membuka ruang kerja syarikat anda dengan selamat.',idLabel:'ID Log Masuk atau E-mel',idPlaceholder:'Contoh: admin, airali atau e-mel',password:'Kata Laluan',passwordPlaceholder:'Masukkan kata laluan',submit:'🔐 Log Masuk',help:'<strong>Log masuk admin pertama:</strong> admin / Admin@2026<br/><span style="opacity:.82">Client boleh menggunakan Login ID syarikat (contoh: airali) atau e-mel Firebase yang diberikan oleh admin.</span>',missing:'Masukkan ID log masuk/e-mel dan kata laluan.'},
    zh:{subtitle:'登录以打开您公司的安全在线工作区。',idLabel:'登录 ID 或电子邮件',idPlaceholder:'例如：admin、airali 或电子邮件',password:'密码',passwordPlaceholder:'输入密码',submit:'🔐 登录',help:'<strong>首次管理员登录：</strong> admin / Admin@2026<br/><span style="opacity:.82">客户可使用公司 Login ID（例如 airali）或管理员提供的 Firebase 电子邮件。</span>',missing:'请输入登录 ID/电子邮件和密码。'}
  };
  function applyLoginLanguage(language){
    loginLanguage=['ms','en','zh'].includes(language)?language:'en';localStorage.setItem(LOGIN_LANGUAGE_KEY,loginLanguage);
    const t=LOGIN_I18N[loginLanguage];$('loginSubtitle').textContent=t.subtitle;$('loginIdLabel').textContent=t.idLabel;$('loginId').placeholder=t.idPlaceholder;$('loginPasswordLabel').textContent=t.password;$('loginPassword').placeholder=t.passwordPlaceholder;$('loginSubmitBtn').textContent=t.submit;$('loginHelp').innerHTML=t.help;
    document.querySelectorAll('[data-login-language]').forEach(b=>b.classList.toggle('active',b.dataset.loginLanguage===loginLanguage));
  }
  document.querySelectorAll('[data-login-language]').forEach(b=>b.addEventListener('click',()=>applyLoginLanguage(b.dataset.loginLanguage)));
  applyLoginLanguage(loginLanguage);

  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();hideError('loginError');
    const loginHint=$('loginId').value.trim().toLowerCase(),password=$('loginPassword').value;
    if(!loginHint||!password){showError('loginError',(LOGIN_I18N[loginLanguage]||LOGIN_I18N.en).missing);return;}
    const email=resolveLoginEmail(loginHint);
    localStorage.setItem(LAST_LOGIN_HINT_KEY,loginHint);
    try{
      const cred=await auth.signInWithEmailAndPassword(email,password);
      await openUserSession(cred.user,true,loginHint);
    }catch(err){
      const code=String(err?.code||'');
      const slug=loginSlug(loginHint);
      const company=COMPANIES.find(c=>loginSlug(c)===slug)||loginHint;
      const defaultClientPassword=companyDefaultPassword(company);
      const canBootstrap=(slug==='staff'&&password==='Warehouse@2026')||(slug!=='admin'&&!loginHint.includes('@')&&password===defaultClientPassword);
      if(canBootstrap&&(code.includes('user-not-found')||code.includes('invalid-credential'))){
        try{
          const cred=await auth.createUserWithEmailAndPassword(email,password);
          await openUserSession(cred.user,true,loginHint);
          toast('Online login created and ready.','success');
          return;
        }catch(createErr){err=createErr;}
      }
      let message=authErrorMessage(err);
      if(slug==='admin')message+=' Admin login: admin / Admin@2026.';
      showError('loginError',message);
    }
  });
  $('logoutBtn').addEventListener('click',async()=>{if(confirm('Logout from this application?'))await logout()});
  $('manageAccountsBtn').addEventListener('click',()=>{if(!isAdmin())return;setMenuOpen(false);closeNewAccountForm();renderAccounts();$('accountsModal').classList.add('show')});
  $('closeAccountsModal').addEventListener('click',()=>$('accountsModal').classList.remove('show'));
  $('accountsModal').addEventListener('click',e=>{if(e.target===$('accountsModal'))$('accountsModal').classList.remove('show')});
  $('addAccountBtn').addEventListener('click',openNewAccountForm);$('cancelNewAccountBtn').addEventListener('click',closeNewAccountForm);$('newAccountRole').addEventListener('change',updateNewAccountCompany);
  $('newAccountForm').addEventListener('submit',async e=>{e.preventDefault();if(isAdmin())await createAccount()});
  $('accountSearch').addEventListener('input',renderAccounts);
  $('accountTableBody').addEventListener('click',async e=>{const b=e.target.closest('[data-account-action]');if(!b||!isAdmin())return;const acc=accounts.find(a=>a.uid===b.dataset.uid);if(!acc)return;
    if(b.dataset.accountAction==='copy'){const text=`Warehouse Receiving Sheet\nEmail: ${acc.email}\nCompany: ${acc.role==="client"?(acc.companyName||companyNameFromId(acc.companyId)):"All Companies"}\nRole: ${acc.role}`;navigator.clipboard?.writeText(text).then(()=>toast('Login information copied.')).catch(()=>prompt('Copy:',text));}
    if(b.dataset.accountAction==='reset'){try{await auth.sendPasswordResetEmail(acc.email);toast('Password reset email sent.');}catch(err){toast(authErrorMessage(err),'warning');}}
    if(b.dataset.accountAction==='toggle'){try{await db.collection('users').doc(acc.uid).update({active:!acc.active,updatedAt:nowISO(),updatedBy:currentUser.email});}catch(err){toast(authErrorMessage(err),'warning');}}
  });

  applyTheme(currentTheme,false);mergeCompanyNames();updateWorkspaceUI();resetReceivingForm();resetDiscrepancyForm();resetBookingForm();renderReceivingTable();renderDiscrepancyTable();renderDashboard();refreshDatalists();
  auth.onAuthStateChanged(async user=>{
    if(!user){stopSubscriptions();currentUser=null;document.body.className='logged-out';applyTheme(currentTheme,false);return;}
    if(currentUser?.uid===user.uid)return;
    try{await openUserSession(user,false,localStorage.getItem(LAST_LOGIN_HINT_KEY)||user.email||'');}catch(err){showError('loginError',err.message);document.body.className='logged-out';applyTheme(currentTheme,false);}
  });

})();
