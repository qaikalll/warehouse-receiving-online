(function(){
  'use strict';

  const VAPID_KEY='BNKnkzejs16j77C44Mgt9R3ifmJC_MKeiLi-Qt4xrY6xLl3OZkcUHeDaoUca_khXZPqB0gi79TH69XskLBB3y4c';
  const TOKEN_KEY='wrs_fcm_token_v1';
  const BTN_ID='bookingPhonePushBtn';
  const RESET_ID='bookingPhonePushResetBtn';
  const LOCAL_ID='bookingPhonePushLocalTestBtn';
  const COPY_ID='bookingPhonePushCopyBtn';

  let currentUser=null;
  let currentToken='';
  let messaging=null;

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

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>s.src===src);
      if(existing){
        if(window.firebase?.messaging)return resolve();
        existing.addEventListener('load',resolve,{once:true});
        existing.addEventListener('error',reject,{once:true});
        return;
      }
      const s=document.createElement('script');
      s.src=src;
      s.onload=resolve;
      s.onerror=reject;
      document.head.appendChild(s);
    });
  }

  async function ensureMessaging(){
    if(!window.firebase)throw new Error('Firebase is not ready yet.');
    if(!firebase.messaging){
      await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');
    }
    if(firebase.messaging.isSupported){
      const supported=await firebase.messaging.isSupported();
      if(!supported)throw new Error('Firebase web push is not supported on this browser/device.');
    }
    messaging=firebase.messaging();
    return messaging;
  }

  async function getProfileName(user){
    let name=user?.displayName||'';
    try{
      const db=firebase.firestore();
      const direct=await db.collection('users').doc(user.uid).get();
      if(direct.exists){
        const data=direct.data()||{};
        name=data.displayName||data.name||name;
      }
      if(!name&&user.email){
        const q=await db.collection('users').where('email','==',user.email).limit(1).get();
        if(!q.empty){
          const data=q.docs[0].data()||{};
          name=data.displayName||data.name||name;
        }
      }
    }catch(e){}
    if(!name)name=String(user?.email||'User').split('@')[0];
    return name;
  }

  async function saveToken(user,token,name){
    try{
      const db=firebase.firestore();
      const FieldValue=firebase.firestore.FieldValue;
      await db.collection('users').doc(user.uid).set({
        email:user.email||'',
        displayName:name||user.displayName||'',
        pushNotificationsEnabled:true,
        fcmTokens:FieldValue.arrayUnion(token),
        lastPushRegisteredAt:new Date().toISOString()
      },{merge:true});
      return true;
    }catch(e){
      console.warn('FCM token generated but Firestore save was blocked.',e);
      return false;
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
      const name=currentUser?await getProfileName(currentUser):'Qaiyum';
      await reg.showNotification(`Hi ${name}, local test works ✅`,{
        body:'This test comes directly from the installed Warehouse Receiving app.',
        icon:'./apple-touch-icon.png',
        badge:'./apple-touch-icon.png',
        tag:'wrs-local-native-test-'+Date.now()
      });
      toast('Local test sent','Lock the iPhone and check Notification Center.');
    }catch(err){
      console.error(err);
      toast('Local Test Failed',err?.message||String(err));
    }
  }

  async function enablePhonePush({reset=false}={}){
    const btn=document.getElementById(reset?RESET_ID:BTN_ID);
    if(btn)btn.disabled=true;

    try{
      if(!currentUser)throw new Error('Please login first.');
      await ensurePermission();
      await ensureMessaging();

      const reg=await getReadyRegistration();

      if(reset){
        try{
          await messaging.deleteToken();
        }catch(e){
          console.warn('deleteToken warning',e);
        }
        localStorage.removeItem(TOKEN_KEY);
        currentToken='';
        await sleep(1200);
      }

      const token=await messaging.getToken({
        vapidKey:VAPID_KEY,
        serviceWorkerRegistration:reg
      });

      if(!token)throw new Error('Firebase did not return a registration token.');

      currentToken=token;
      localStorage.setItem(TOKEN_KEY,token);

      const name=await getProfileName(currentUser);
      const saved=await saveToken(currentUser,token,name);

      updateButtons();
      toast(
        reset?'Fresh FCM Token Created':'Phone Push Enabled',
        `Hi ${name}. ${reset?'A fresh iPhone push token was created.':'This phone is registered.'}${saved?'':' Token saving to the account was blocked, but testing can continue.'}`
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
      toast('No FCM Token','Enable or Reset Phone Push first.');
      return;
    }
    try{
      await navigator.clipboard.writeText(token);
      toast('Fresh FCM Token Copied','Paste this token into Firebase Console → Send test message.');
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
      btn.textContent='Phone Push On';
      if(reset)reset.style.display='';
      if(copy)copy.style.display='';
    }else{
      btn.textContent='Enable Phone Push';
      if(reset)reset.style.display='none';
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
    const enable=makeBtn(BTN_ID,'Enable Phone Push',()=>enablePhonePush({reset:false}));
    const reset=makeBtn(RESET_ID,'Reset iPhone Push',()=>enablePhonePush({reset:true}));
    const copy=makeBtn(COPY_ID,'Copy Fresh Token',copyToken);

    reset.style.display='none';
    copy.style.display='none';

    actions.insertBefore(local,actions.firstChild);
    actions.insertBefore(enable,local.nextSibling);
    actions.insertBefore(reset,enable.nextSibling);
    actions.insertBefore(copy,reset.nextSibling);

    updateButtons();
    return true;
  }

  function watchUI(){
    mountButtons();
    const observer=new MutationObserver(()=>mountButtons());
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
    });

    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded',watchUI,{once:true});
    }else{
      watchUI();
    }
  }

  boot();
})();
