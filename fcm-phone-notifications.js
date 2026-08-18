(function(){
  'use strict';

  const SDK_VERSION='12.16.0';
  const VAPID_KEY='BNKnkzejs16j77C44Mgt9R3ifmJC_MKeiLi-Qt4xrY6xLl3OZkcUHeDaoUca_khXZPqB0gi79TH69XskLBB3y4c';
  const TOKEN_KEY='wrs_fcm_token_v2';
  const OLD_TOKEN_KEY='wrs_fcm_token_v1';
  const PUSH_APP_NAME='wrs-push-v12';
  const AUTO_PUSH_WORKER_URL='https://warehouse-booking-push.ednvines.workers.dev/notify-booking';

  const FIREBASE_CONFIG={
    apiKey:'AIzaSyAGDRTLXWaCWZpNdqA8KIBoUYJWBEq8qFM',
    authDomain:'warehouse-receiving-online.firebaseapp.com',
    projectId:'warehouse-receiving-online',
    storageBucket:'warehouse-receiving-online.firebasestorage.app',
    messagingSenderId:'655223366420',
    appId:'1:655223366420:web:7437455a7908e31e521801',
    measurementId:'G-FV5D6TBVR1'
  };

  const BTN_ID='bookingPhonePushBtn';
  const RESET_ID='bookingPhonePushResetBtn';
  const LOCAL_ID='bookingPhonePushLocalTestBtn';
  const COPY_ID='bookingPhonePushCopyBtn';

  let currentUser=null;
  let currentToken='';
  let messaging=null;
  let messagingApi=null;
  let autoPushWatching=false;

  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function toast(title,body){
    const stack=document.getElementById('bookingToastStack');
    if(stack){
      const div=document.createElement('div');
      div.className='booking-live-toast';
      div.innerHTML='<span class="dot"></span><div><strong></strong><span></span></div><button type="button">OK</button>';
      div.querySelector('strong').textContent=title;
      div.querySelector('span').textContent=body||'';
      div.querySelector('button').addEventListener('click',()=>div.remove());
      stack.appendChild(div);
      setTimeout(()=>div.remove(),10000);
      return;
    }
    alert(title+(body?'\n\n'+body:''));
  }

  async function ensureMessaging(){
    if(messaging && messagingApi) return messaging;

    const appUrl=`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`;
    const msgUrl=`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-messaging.js`;

    const [appApi,msgApi]=await Promise.all([
      import(appUrl),
      import(msgUrl)
    ]);

    const supported=await msgApi.isSupported();
    if(!supported) throw new Error('Firebase web push is not supported on this browser/device.');

    let pushApp=appApi.getApps().find(app=>app.name===PUSH_APP_NAME);
    if(!pushApp) pushApp=appApi.initializeApp(FIREBASE_CONFIG,PUSH_APP_NAME);

    messaging=msgApi.getMessaging(pushApp);
    messagingApi=msgApi;
    return messaging;
  }

  async function getProfileData(user){
    const profile={displayName:user?.displayName||'',role:'',companyId:'',companyName:'',active:true};
    try{
      const db=firebase.firestore();
      const direct=await db.collection('users').doc(user.uid).get();
      if(direct.exists){
        const data=direct.data()||{};
        profile.displayName=data.displayName||data.name||profile.displayName;
        profile.role=data.role||profile.role;
        profile.companyId=data.companyId||profile.companyId;
        profile.companyName=data.companyName||profile.companyName;
        if(typeof data.active==='boolean')profile.active=data.active;
      }
      if(user.email && (!profile.role || !profile.displayName)){
        const q=await db.collection('users').where('email','==',user.email).limit(5).get();
        q.docs.forEach(doc=>{
          const data=doc.data()||{};
          if(!profile.displayName)profile.displayName=data.displayName||data.name||'';
          if(!profile.role)profile.role=data.role||'';
          if(!profile.companyId)profile.companyId=data.companyId||'';
          if(!profile.companyName)profile.companyName=data.companyName||'';
          if(typeof data.active==='boolean')profile.active=data.active;
        });
      }
    }catch(e){}

    const email=String(user?.email||'').toLowerCase();
    if(!profile.role && email==='ednvines@gmail.com')profile.role='admin';
    if(!profile.role && email==='staff@warehouse-client.com')profile.role='staff';
    if(!profile.displayName)profile.displayName=String(user?.email||'User').split('@')[0];
    return profile;
  }

  async function getProfileName(user){
    const profile=await getProfileData(user);
    return profile.displayName||'User';
  }

  async function saveToken(user,token,name){
    try{
      const db=firebase.firestore();
      const FieldValue=firebase.firestore.FieldValue;
      const profile=await getProfileData(user);
      const payload={
        email:user.email||'',
        displayName:name||profile.displayName||user.displayName||'',
        pushNotificationsEnabled:true,
        fcmTokens:FieldValue.arrayUnion(token),
        fcmSdk:SDK_VERSION,
        pushTransport:'fcm-web-v12-native-sw',
        lastPushRegisteredAt:new Date().toISOString()
      };
      if(profile.role)payload.role=profile.role;
      if(profile.companyId)payload.companyId=profile.companyId;
      if(profile.companyName)payload.companyName=profile.companyName;
      if(typeof profile.active==='boolean')payload.active=profile.active;
      await db.collection('users').doc(user.uid).set(payload,{merge:true});
      return true;
    }catch(e){
      console.warn('Push token created but Firestore save was blocked.',e);
      return false;
    }
  }

  async function syncSavedTokenProfile(user){
    const token=localStorage.getItem(TOKEN_KEY)||'';
    if(!user||!token)return;
    try{
      const name=await getProfileName(user);
      await saveToken(user,token,name);
    }catch(e){
      console.warn('Existing push token profile sync skipped.',e);
    }
  }

  async function getReadyRegistration(){
    if(!('serviceWorker' in navigator))throw new Error('Service worker is not supported on this phone.');
    const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
    await reg.update().catch(()=>{});
    await navigator.serviceWorker.ready;
    return reg;
  }

  async function ensurePermission(){
    if(!('Notification' in window))throw new Error('Notifications are not supported on this phone.');
    if(isIOS&&!standalone()){
      throw new Error('On iPhone, open Warehouse Receiving from the Home Screen icon first.');
    }
    const permission=Notification.permission==='granted'
      ? 'granted'
      : await Notification.requestPermission();
    if(permission!=='granted')throw new Error('Notification permission is not allowed.');
  }

  async function localNativeTest(){
    try{
      await ensurePermission();
      const reg=await getReadyRegistration();
      const name=currentUser?await getProfileName(currentUser):'User';
      await reg.showNotification(`Hi ${name}, local test works ✅`,{
        body:'Native service-worker notification is working.',
        icon:'./apple-touch-icon.png',
        badge:'./apple-touch-icon.png',
        tag:'wrs-local-native-test-'+Date.now()
      });
      toast('Local test sent','The phone notification system is working.');
    }catch(err){
      console.error(err);
      toast('Local Test Failed',err?.message||String(err));
    }
  }

  async function registerPush({reset=false}={}){
    const btn=document.getElementById(reset?RESET_ID:BTN_ID);
    if(btn)btn.disabled=true;

    try{
      if(!currentUser)throw new Error('Please login first.');
      await ensurePermission();
      await ensureMessaging();
      const reg=await getReadyRegistration();

      if(reset){
        try{ await messagingApi.deleteToken(messaging); }catch(e){ console.warn('deleteToken warning',e); }
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(OLD_TOKEN_KEY);
        currentToken='';
        await sleep(1200);
      }

      const token=await messagingApi.getToken(messaging,{
        vapidKey:VAPID_KEY,
        serviceWorkerRegistration:reg
      });

      if(!token)throw new Error('Firebase did not return a registration token.');

      currentToken=token;
      localStorage.setItem(TOKEN_KEY,token);
      localStorage.removeItem(OLD_TOKEN_KEY);

      const name=await getProfileName(currentUser);
      const saved=await saveToken(currentUser,token,name);

      updateButtons();
      toast(
        reset?'Fresh FCM v12 Token Created':'Phone Push Registered',
        `Hi ${name}. Firebase Messaging ${SDK_VERSION} is registered.${saved?'':' Account token save was blocked, but console testing can continue.'}`
      );
    }catch(err){
      console.error(err);
      toast(reset?'Reset Phone Push Failed':'Phone Push Setup Failed',err?.message||String(err));
    }finally{
      if(btn)btn.disabled=false;
    }
  }

  async function copyToken(){
    const token=currentToken||localStorage.getItem(TOKEN_KEY)||'';
    if(!token){
      toast('No Fresh Token','Press Reset iPhone Push first.');
      return;
    }
    try{
      await navigator.clipboard.writeText(token);
      toast('Fresh FCM v12 Token Copied','Paste this token into Firebase Console → Send test message.');
    }catch(e){
      prompt('Copy this FCM test token:',token);
    }
  }

  function updateButtons(){
    const btn=document.getElementById(BTN_ID);
    const reset=document.getElementById(RESET_ID);
    const copy=document.getElementById(COPY_ID);
    if(!btn)return;

    const saved=localStorage.getItem(TOKEN_KEY)||'';
    if(Notification.permission==='granted'&&saved){
      btn.textContent='Phone Push On (v12)';
      if(reset)reset.style.display='';
      if(copy)copy.style.display='';
    }else{
      btn.textContent='Enable Phone Push v12';
      if(reset)reset.style.display='';
      if(copy)copy.style.display='none';
    }
  }

  function makeBtn(id,label,handler){
    const b=document.createElement('button');
    b.className='booking-mini-btn';
    b.id=id;
    b.type='button';
    b.textContent=label;
    b.addEventListener('click',handler);
    return b;
  }

  function mountButtons(){
    const actions=document.querySelector('.booking-notification-head-actions');
    if(!actions||document.getElementById(BTN_ID))return false;

    const local=makeBtn(LOCAL_ID,'Test Phone Alert',localNativeTest);
    const enable=makeBtn(BTN_ID,'Enable Phone Push v12',()=>registerPush({reset:false}));
    const reset=makeBtn(RESET_ID,'Reset iPhone Push',()=>registerPush({reset:true}));
    const copy=makeBtn(COPY_ID,'Copy Fresh Token',copyToken);

    copy.style.display='none';

    actions.insertBefore(local,actions.firstChild);
    actions.insertBefore(enable,local.nextSibling);
    actions.insertBefore(reset,enable.nextSibling);
    actions.insertBefore(copy,reset.nextSibling);

    updateButtons();
    return true;
  }

  async function notifyWorkerForBooking(bookingId,user){
    if(!bookingId||!user)return false;
    const idToken=await user.getIdToken();
    const res=await fetch(AUTO_PUSH_WORKER_URL,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${idToken}`
      },
      body:JSON.stringify({bookingId})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok && !data.duplicate){
      throw new Error(data.message||data.error||`Push Worker returned ${res.status}`);
    }
    console.info('Automatic booking push result',data);
    return true;
  }

  async function findAndNotifyFreshBooking(clickedAt,user){
    if(autoPushWatching||!user?.email)return;
    autoPushWatching=true;
    try{
      const db=firebase.firestore();
      const profile=await getProfileData(user);
      const companyId=String(profile.companyId||'').trim();

      if(!companyId){
        console.error('Automatic booking push: client companyId is missing.');
        return;
      }

      for(let attempt=0;attempt<20;attempt++){
        await sleep(attempt===0?900:700);

        // IMPORTANT:
        // Client Firestore access in the main app is scoped by companyId.
        // Use the same allowed query here, then filter bookedBy locally.
        const snap=await db.collection('receivings')
          .where('companyId','==',companyId)
          .get();

        const callerEmail=String(user.email||'').toLowerCase();
        const candidates=snap.docs.map(doc=>({id:doc.id,...(doc.data()||{})}))
          .filter(r=>r.source==='client-booking')
          .filter(r=>String(r.bookedBy||'').toLowerCase()===callerEmail)
          .filter(r=>{
            const t=Date.parse(r.bookingCreatedAt||r.createdAt||'');
            return Number.isFinite(t)&&t>=clickedAt-3000;
          })
          .sort((a,b)=>Date.parse(b.bookingCreatedAt||b.createdAt||0)-Date.parse(a.bookingCreatedAt||a.createdAt||0));

        if(candidates.length){
          const fresh=candidates[0];
          try{
            await notifyWorkerForBooking(fresh.id,user);
          }catch(err){
            console.error('Automatic booking push failed',err);
          }
          return;
        }
      }
      console.warn('Automatic booking push: no fresh booking found after submit click.');
    }catch(err){
      console.error('Automatic booking push watcher failed',err);
    }finally{
      autoPushWatching=false;
    }
  }

  function mountAutoBookingTrigger(){
    const btn=document.getElementById('submitBookingBtn');
    if(!btn||btn.dataset.autoPushBound==='1')return false;
    btn.dataset.autoPushBound='1';
    btn.addEventListener('click',()=>{
      const user=firebase.auth().currentUser;
      if(!user)return;
      const clickedAt=Date.now();
      setTimeout(()=>findAndNotifyFreshBooking(clickedAt,user),0);
    });
    return true;
  }

  function watchUI(){
    mountButtons();
    mountAutoBookingTrigger();
    const observer=new MutationObserver(()=>{
      mountButtons();
      mountAutoBookingTrigger();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  function boot(){
    if(!window.firebase||!firebase.auth){
      setTimeout(boot,180);
      return;
    }

    firebase.auth().onAuthStateChanged(user=>{
      currentUser=user||null;
      currentToken=localStorage.getItem(TOKEN_KEY)||'';
      updateButtons();
      if(currentUser&&currentToken){
        syncSavedTokenProfile(currentUser);
      }
    });

    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded',watchUI,{once:true});
    }else{
      watchUI();
    }
  }

  boot();
})();
