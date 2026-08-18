(function(){
  'use strict';

  const VAPID_KEY='BNKnkzejs16j77C44Mgt9R3ifmJC_MKeiLi-Qt4xrY6xLl3OZkcUHeDaoUca_khXZPqB0gi79TH69XskLBB3y4c';
  const TOKEN_KEY='wrs_fcm_token_v1';
  const BTN_ID='bookingPhonePushBtn';
  const COPY_ID='bookingPhonePushCopyBtn';

  let currentUser=null;
  let currentToken='';
  let messaging=null;

  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;

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
      setTimeout(()=>div.remove(),9000);
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
      if(!supported)throw new Error('Firebase phone push is not supported on this browser/device.');
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

  function updateButtons(){
    const btn=document.getElementById(BTN_ID);
    const copy=document.getElementById(COPY_ID);
    if(!btn)return;

    const saved=localStorage.getItem(TOKEN_KEY)||'';
    if(Notification.permission==='granted'&&saved){
      btn.textContent='Phone Push On';
      btn.dataset.enabled='1';
      if(copy)copy.style.display='';
    }else{
      btn.textContent='Enable Phone Push';
      btn.dataset.enabled='0';
      if(copy)copy.style.display='none';
    }
  }

  async function enablePhonePush(){
    const btn=document.getElementById(BTN_ID);
    if(btn)btn.disabled=true;

    try{
      if(!currentUser)throw new Error('Please login first.');
      if(!('Notification'in window))throw new Error('This browser does not support notifications.');
      if(!('serviceWorker'in navigator))throw new Error('This browser does not support service workers.');

      if(isIOS&&!standalone()){
        throw new Error('On iPhone, open Warehouse Receiving from the Home Screen icon first. Then enable phone push from inside the installed app.');
      }

      const permission=Notification.permission==='granted'
        ? 'granted'
        : await Notification.requestPermission();

      if(permission!=='granted')throw new Error('Notification permission was not allowed.');

      await ensureMessaging();

      const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
      await reg.update().catch(()=>{});
      const readyReg=await navigator.serviceWorker.ready;

      const token=await messaging.getToken({
        vapidKey:VAPID_KEY,
        serviceWorkerRegistration:readyReg
      });

      if(!token)throw new Error('Firebase did not return a phone registration token.');

      currentToken=token;
      localStorage.setItem(TOKEN_KEY,token);

      const name=await getProfileName(currentUser);
      const saved=await saveToken(currentUser,token,name);

      updateButtons();
      toast(
        'Phone Push Enabled',
        `Hi ${name}. This phone is registered for push notifications.${saved?'':' The phone token is ready, but saving it to the account was blocked.'}`
      );
    }catch(err){
      console.error(err);
      toast('Phone Push Setup Failed',err?.message||String(err));
    }finally{
      if(btn)btn.disabled=false;
    }
  }

  async function copyToken(){
    const token=currentToken||localStorage.getItem(TOKEN_KEY)||'';
    if(!token){
      toast('No FCM Token','Enable Phone Push first.');
      return;
    }
    try{
      await navigator.clipboard.writeText(token);
      toast('FCM Test Token Copied','Next we can paste this token into Firebase Console to send a test notification.');
    }catch(e){
      prompt('Copy this FCM test token:',token);
    }
  }

  function mountButton(){
    const actions=document.querySelector('.booking-notification-head-actions');
    if(!actions||document.getElementById(BTN_ID))return false;

    const btn=document.createElement('button');
    btn.className='booking-mini-btn';
    btn.id=BTN_ID;
    btn.type='button';
    btn.textContent='Enable Phone Push';
    btn.addEventListener('click',enablePhonePush);

    const copy=document.createElement('button');
    copy.className='booking-mini-btn';
    copy.id=COPY_ID;
    copy.type='button';
    copy.textContent='Copy Test Token';
    copy.style.display='none';
    copy.addEventListener('click',copyToken);

    actions.insertBefore(btn,actions.firstChild);
    actions.insertBefore(copy,actions.firstChild.nextSibling);
    updateButtons();
    return true;
  }

  function watchUI(){
    mountButton();
    const observer=new MutationObserver(()=>mountButton());
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
