(function(){
  'use strict';

  const FEATURE_ID='wrs-admin-booking-center-v1';
  const START_KEY='wrs_booking_notify_start_v1';
  const READ_KEY='wrs_booking_read_ids_v1';
  const LEGACY_ADMIN_EMAIL='ednvines@gmail.com';

  const state={
    user:null,
    admin:false,
    bookings:[],
    unread:new Set(),
    read:new Set(),
    firstSnapshot:true,
    unsubscribe:null,
    panelOpen:false,
    filters:{range:'all',status:'',company:'',search:''}
  };

  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const localDateISO=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const todayISO=()=>localDateISO();
  const tomorrowISO=()=>{const d=new Date();d.setDate(d.getDate()+1);return localDateISO(d)};
  const parseMs=value=>{const n=Date.parse(value||'');return Number.isFinite(n)?n:0};

  function loadRead(){
    try{const raw=JSON.parse(localStorage.getItem(READ_KEY)||'[]');if(Array.isArray(raw))state.read=new Set(raw.map(String));}catch(e){}
  }
  function saveRead(){
    try{localStorage.setItem(READ_KEY,JSON.stringify(Array.from(state.read).slice(-800)));}catch(e){}
  }
  function featureStart(){
    let n=Number(localStorage.getItem(START_KEY)||0);
    if(!n){n=Date.now();localStorage.setItem(START_KEY,String(n));}
    return n;
  }

  function injectStyles(){
    if($(FEATURE_ID+'-style'))return;
    const style=document.createElement('style');
    style.id=FEATURE_ID+'-style';
    style.textContent=`
      .booking-admin-nav{position:relative}
      .booking-admin-nav .booking-nav-count{margin-left:auto;min-width:22px;height:22px;padding:0 6px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:#d92d20;color:#fff;font-size:11px;font-weight:900;box-shadow:0 6px 18px rgba(217,45,32,.25)}
      .booking-notification-btn{position:relative;width:42px;height:42px;border-radius:12px;border:1px solid var(--border,#d8deea);background:var(--card,#fff);color:var(--text,#17264a);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 18px rgba(23,38,74,.08)}
      .booking-notification-btn:hover{transform:translateY(-1px)}
      .booking-notification-btn svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
      .booking-notification-badge{position:absolute;right:-4px;top:-5px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#d92d20;color:#fff;font-size:10px;font-weight:900;display:none;align-items:center;justify-content:center;border:2px solid var(--card,#fff)}
      .booking-notification-badge.show{display:flex}
      .booking-notification-btn.has-unread{animation:bookingBellPulse 2.2s ease-in-out infinite}
      @keyframes bookingBellPulse{0%,72%,100%{box-shadow:0 6px 18px rgba(23,38,74,.08)}82%{box-shadow:0 0 0 8px rgba(217,45,32,.10),0 6px 18px rgba(23,38,74,.12)}}
      .booking-notification-panel{position:fixed;z-index:2600;top:74px;right:18px;width:min(430px,calc(100vw - 24px));max-height:min(690px,calc(100vh - 96px));display:none;flex-direction:column;background:var(--card,#fff);border:1px solid var(--border,#dbe2ef);border-radius:20px;box-shadow:0 24px 70px rgba(15,23,42,.22);overflow:hidden}
      .booking-notification-panel.show{display:flex}
      .booking-notification-head{padding:18px 18px 14px;display:flex;align-items:flex-start;gap:12px;border-bottom:1px solid var(--border,#e5e9f2)}
      .booking-notification-head h3{margin:0 0 3px;font-size:18px}.booking-notification-head p{margin:0;color:var(--muted,#6b7280);font-size:12px}
      .booking-notification-head-actions{margin-left:auto;display:flex;gap:7px}.booking-mini-btn{border:1px solid var(--border,#d8deea);background:transparent;color:inherit;border-radius:9px;padding:7px 9px;font-size:11px;font-weight:800;cursor:pointer}
      .booking-notification-list{padding:10px;overflow:auto}.booking-notification-item{display:grid;grid-template-columns:11px 1fr auto;gap:10px;padding:12px;border-radius:14px;cursor:pointer;border:1px solid transparent}.booking-notification-item:hover{background:rgba(76,111,255,.06);border-color:rgba(76,111,255,.10)}
      .booking-notification-dot{width:9px;height:9px;border-radius:50%;background:#d92d20;margin-top:6px;box-shadow:0 0 0 4px rgba(217,45,32,.10)}.booking-notification-item.read .booking-notification-dot{background:#c9d1df;box-shadow:none}
      .booking-notification-main strong{display:block;font-size:13px;margin-bottom:3px}.booking-notification-main span{display:block;font-size:12px;color:var(--muted,#6b7280);line-height:1.45}.booking-notification-time{font-size:10px;color:var(--muted,#6b7280);white-space:nowrap}.booking-empty{padding:30px 18px;text-align:center;color:var(--muted,#6b7280);font-size:13px}
      #bookingAdminSection{display:none}#bookingAdminSection.active{display:block}
      .booking-admin-hero{position:relative;overflow:hidden;padding:22px;border-radius:22px;background:linear-gradient(135deg,rgba(30,64,175,.96),rgba(13,148,136,.90));color:#fff;box-shadow:0 18px 46px rgba(30,64,175,.18);margin-bottom:18px}.booking-admin-hero:after{content:'';position:absolute;right:-80px;top:-100px;width:270px;height:270px;border-radius:50%;background:rgba(255,255,255,.10)}
      .booking-admin-hero-inner{position:relative;z-index:1;display:flex;justify-content:space-between;gap:18px;align-items:center}.booking-admin-kicker{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;opacity:.78;margin-bottom:6px}.booking-admin-hero h2{margin:0 0 7px;font-size:28px}.booking-admin-hero p{margin:0;opacity:.88;max-width:680px;line-height:1.55}
      .booking-live-pill{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border-radius:999px;background:rgba(255,255,255,.15);font-size:12px;font-weight:900;white-space:nowrap}.booking-live-pill:before{content:'';width:8px;height:8px;border-radius:50%;background:#8cffc1;box-shadow:0 0 0 5px rgba(140,255,193,.13)}
      .booking-admin-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}.booking-admin-stat{padding:16px;border:1px solid var(--border,#e2e8f0);border-radius:16px;background:var(--card,#fff);box-shadow:0 8px 24px rgba(23,38,74,.05)}.booking-admin-stat span{display:block;color:var(--muted,#6b7280);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.booking-admin-stat strong{display:block;font-size:28px;margin-top:6px}.booking-admin-stat small{display:block;color:var(--muted,#6b7280);margin-top:3px;font-size:11px}
      .booking-admin-toolbar{display:grid;grid-template-columns:minmax(220px,1.6fr) repeat(3,minmax(145px,.6fr)) auto;gap:10px;align-items:end;padding:15px;border:1px solid var(--border,#e2e8f0);border-radius:16px;background:var(--card,#fff);margin-bottom:14px}.booking-admin-toolbar label{display:block;font-size:11px;font-weight:800;color:var(--muted,#6b7280);margin-bottom:5px}.booking-admin-toolbar input,.booking-admin-toolbar select{width:100%;min-height:40px;border:1px solid var(--border,#d9e0ec);border-radius:10px;padding:9px 11px;background:var(--input-bg,#fff);color:inherit}
      .booking-admin-table-card{border:1px solid var(--border,#e2e8f0);border-radius:18px;background:var(--card,#fff);overflow:hidden;box-shadow:0 10px 28px rgba(23,38,74,.05)}.booking-admin-table-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 17px;border-bottom:1px solid var(--border,#e8edf5)}.booking-admin-table-head strong{font-size:14px}.booking-admin-table-head span{font-size:12px;color:var(--muted,#6b7280)}
      .booking-admin-list{display:flex;flex-direction:column}.booking-row{display:grid;grid-template-columns:minmax(170px,1.2fr) minmax(130px,.9fr) minmax(160px,1fr) minmax(150px,.9fr) minmax(115px,.7fr) auto;gap:12px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border,#edf1f6)}.booking-row:last-child{border-bottom:0}.booking-row:hover{background:rgba(76,111,255,.035)}.booking-row.is-unread{box-shadow:inset 4px 0 #d92d20}
      .booking-company strong{display:block;font-size:13px}.booking-company span,.booking-cell-sub{display:block;font-size:11px;color:var(--muted,#6b7280);margin-top:3px}.booking-do{font-weight:900;font-size:13px}.booking-date strong{display:block;font-size:13px}.booking-slot{display:inline-flex;margin-top:4px;padding:4px 7px;border-radius:8px;background:rgba(30,64,175,.08);color:#1e40af;font-size:11px;font-weight:800}
      .booking-status{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:900;white-space:nowrap}.booking-status.scheduled{background:#eff6ff;color:#1d4ed8}.booking-status.arrived{background:#fff7ed;color:#c2410c}.booking-status.receiving{background:#fef3c7;color:#92400e}.booking-status.completed{background:#ecfdf5;color:#047857}.booking-status.exceeded{background:#fef2f2;color:#b91c1c}.booking-open-btn{border:0;border-radius:10px;background:#17264a;color:#fff;padding:9px 11px;font-weight:800;font-size:11px;cursor:pointer;white-space:nowrap}
      .booking-admin-empty{padding:48px 18px;text-align:center;color:var(--muted,#6b7280)}
      .booking-toast-stack{position:fixed;z-index:3200;right:18px;top:86px;display:flex;flex-direction:column;gap:10px;width:min(390px,calc(100vw - 24px));pointer-events:none}.booking-live-toast{pointer-events:auto;background:#fff;color:#17264a;border:1px solid #dfe5ef;border-radius:16px;box-shadow:0 20px 50px rgba(15,23,42,.22);padding:14px 14px 14px 16px;display:grid;grid-template-columns:10px 1fr auto;gap:11px;align-items:start;animation:bookingToastIn .28s ease-out}.booking-live-toast .dot{width:9px;height:9px;border-radius:50%;background:#d92d20;margin-top:5px}.booking-live-toast strong{display:block;font-size:13px}.booking-live-toast span{display:block;font-size:12px;color:#667085;margin-top:3px;line-height:1.4}.booking-live-toast button{border:0;background:#eef2ff;color:#1e40af;border-radius:8px;padding:7px 9px;font-size:11px;font-weight:900;cursor:pointer}@keyframes bookingToastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
      .theme-dark .booking-live-toast{background:#17213a;color:#eef4ff;border-color:#2f3c5f}.theme-dark .booking-live-toast span{color:#aab7d2}.theme-dark .booking-slot{color:#93b4ff;background:rgba(147,180,255,.11)}
      @media(max-width:1050px){.booking-admin-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.booking-admin-toolbar{grid-template-columns:repeat(2,minmax(0,1fr))}.booking-row{grid-template-columns:1.1fr .8fr 1fr .8fr auto}.booking-row .booking-vehicle{display:none}}
      @media(max-width:700px){.booking-admin-hero-inner{align-items:flex-start;flex-direction:column}.booking-admin-hero h2{font-size:23px}.booking-admin-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.booking-admin-toolbar{grid-template-columns:1fr}.booking-row{grid-template-columns:1fr auto;gap:8px}.booking-row>div{grid-column:1}.booking-row .booking-status-wrap,.booking-row .booking-action{grid-column:2}.booking-row .booking-vehicle{display:block}.booking-notification-panel{top:66px;right:12px}}
    `;
    document.head.appendChild(style);
  }

  function statusOf(r){
    if(r.completionTime){
      const start=parseMs(r.arrivalTime||r.startTime),end=parseMs(r.completionTime);
      if(start&&end&&end-start>4*60*60*1000)return 'Exceeded 4 Hours';
      return 'Completed';
    }
    if(r.startTime)return 'Receiving';
    if(r.arrivalTime)return 'Arrived';
    return 'Scheduled Inbound';
  }
  function statusClass(status){return status==='Scheduled Inbound'?'scheduled':status==='Arrived'?'arrived':status==='Receiving'?'receiving':status==='Completed'?'completed':'exceeded'}
  function relativeTime(iso){
    const ms=Date.now()-parseMs(iso);if(!Number.isFinite(ms)||ms<0)return 'just now';
    const m=Math.floor(ms/60000);if(m<1)return 'just now';if(m<60)return `${m}m ago`;
    const h=Math.floor(m/60);if(h<24)return `${h}h ago`;return `${Math.floor(h/24)}d ago`;
  }
  function bookingTime(r){return r.bookingCreatedAt||r.createdAt||r.updatedAt||''}
  function isBooking(r){return r&&r.source==='client-booking'}

  async function resolveAdmin(user){
    if(!user)return false;
    const email=String(user.email||'').toLowerCase();
    if(email===LEGACY_ADMIN_EMAIL)return true;
    try{
      const db=firebase.firestore();
      const direct=await db.collection('users').doc(user.uid).get();
      if(direct.exists&&String(direct.data().role||'').toLowerCase()==='admin')return true;
      if(email){
        const q=await db.collection('users').where('email','==',email).limit(1).get();
        if(!q.empty&&String(q.docs[0].data().role||'').toLowerCase()==='admin')return true;
      }
    }catch(e){}
    return false;
  }

  function mount(){
    injectStyles();
    if(!$('bookingToastStack')){const x=document.createElement('div');x.id='bookingToastStack';x.className='booking-toast-stack';document.body.appendChild(x)}
    mountBell();mountPanel();mountNavAndSection();updateNotificationUI();renderCenter();
  }
  function unmount(){
    ['bookingNotificationBtn','bookingNotificationPanel','bookingAdminNav','bookingAdminSection','bookingToastStack'].forEach(id=>$(id)?.remove());
    state.unsubscribe?.();state.unsubscribe=null;state.bookings=[];state.unread.clear();
  }

  function mountBell(){
    if($('bookingNotificationBtn'))return;
    const top=document.querySelector('.top-actions');if(!top)return;
    const btn=document.createElement('button');btn.id='bookingNotificationBtn';btn.className='booking-notification-btn';btn.type='button';btn.title='Booking notifications';btn.setAttribute('aria-label','Open booking notifications');
    btn.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg><span class="booking-notification-badge" id="bookingNotificationBadge">0</span>';
    const guide=$('tutorialHelpBtn');top.insertBefore(btn,guide||top.firstChild);
    btn.addEventListener('click',e=>{e.stopPropagation();togglePanel()});
  }
  function mountPanel(){
    if($('bookingNotificationPanel'))return;
    const panel=document.createElement('aside');panel.id='bookingNotificationPanel';panel.className='booking-notification-panel';
    panel.innerHTML=`<div class="booking-notification-head"><div><h3>Booking Notifications</h3><p>New customer shipment bookings appear here live.</p></div><div class="booking-notification-head-actions"><button class="booking-mini-btn" id="bookingEnableNotifBtn" type="button">Enable Alerts</button><button class="booking-mini-btn" id="bookingMarkAllBtn" type="button">Mark read</button></div></div><div class="booking-notification-list" id="bookingNotificationList"></div>`;
    document.body.appendChild(panel);
    $('bookingMarkAllBtn').addEventListener('click',markAllRead);
    $('bookingEnableNotifBtn').addEventListener('click',requestBrowserNotifications);
    panel.addEventListener('click',e=>{const item=e.target.closest('[data-booking-notif-id]');if(item){markRead(item.dataset.bookingNotifId);openCenter(item.dataset.bookingNotifId)}});
    document.addEventListener('click',e=>{if(state.panelOpen&&!panel.contains(e.target)&&!$('bookingNotificationBtn')?.contains(e.target))closePanel()});
  }
  function mountNavAndSection(){
    if(!$('bookingAdminNav')){
      const bookingNav=document.querySelector('.nav-btn[data-section="booking"]');
      if(bookingNav){
        const btn=document.createElement('button');btn.id='bookingAdminNav';btn.className='nav-btn booking-admin-nav';btn.type='button';
        btn.innerHTML='<span class="nav-icon"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16v14H4zM7 9h10M7 13h6"></path></svg></span><span>Booking Control</span><span class="booking-nav-count" id="bookingNavCount" style="display:none">0</span>';
        bookingNav.insertAdjacentElement('afterend',btn);
        btn.addEventListener('click',()=>openCenter());
      }
    }
    if(!$('bookingAdminSection')){
      const main=document.querySelector('main.main');if(!main)return;
      const section=document.createElement('section');section.id='bookingAdminSection';section.className='section';
      section.innerHTML=`
        <div class="booking-admin-hero"><div class="booking-admin-hero-inner"><div><div class="booking-admin-kicker">Admin Operations</div><h2>Booking Control Center</h2><p>See every customer booking in one place, track the arrival pipeline, and jump straight into Receiving when action is needed.</p></div><div class="booking-live-pill">LIVE FIRESTORE SYNC</div></div></div>
        <div class="booking-admin-stats">
          <div class="booking-admin-stat"><span>Today</span><strong id="bookingStatToday">0</strong><small>delivery slots today</small></div>
          <div class="booking-admin-stat"><span>Tomorrow</span><strong id="bookingStatTomorrow">0</strong><small>planned for tomorrow</small></div>
          <div class="booking-admin-stat"><span>Awaiting Arrival</span><strong id="bookingStatAwaiting">0</strong><small>scheduled inbound</small></div>
          <div class="booking-admin-stat"><span>Unread Alerts</span><strong id="bookingStatUnread">0</strong><small>new booking notifications</small></div>
        </div>
        <div class="booking-admin-toolbar">
          <div><label>Search booking</label><input id="bookingAdminSearch" placeholder="Company, DO, PO, vehicle or slot"></div>
          <div><label>Delivery range</label><select id="bookingAdminRange"><option value="all">All bookings</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="upcoming">Upcoming</option></select></div>
          <div><label>Status</label><select id="bookingAdminStatus"><option value="">All status</option><option>Scheduled Inbound</option><option>Arrived</option><option>Receiving</option><option>Completed</option><option>Exceeded 4 Hours</option></select></div>
          <div><label>Company</label><select id="bookingAdminCompany"><option value="">All companies</option></select></div>
          <button class="btn btn-outline" id="bookingAdminRefresh" type="button">↻ Live Refresh</button>
        </div>
               <div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn btn-primary" id="bookingAdminNewBooking" type="button">＋ Admin Booking</button></div><div class="booking-admin-table-card"><div class="booking-admin-table-head"><strong>Customer Booking Pipeline</strong><span id="bookingAdminResultCount">0 bookings</span></div><div class="booking-admin-list" id="bookingAdminList"></div></div>`;
      main.appendChild(section);
      $('bookingAdminSearch').addEventListener('input',e=>{state.filters.search=e.target.value;renderCenter()});
      $('bookingAdminRange').addEventListener('change',e=>{state.filters.range=e.target.value;renderCenter()});
      $('bookingAdminStatus').addEventListener('change',e=>{state.filters.status=e.target.value;renderCenter()});
      $('bookingAdminCompany').addEventListener('change',e=>{state.filters.company=e.target.value;renderCenter()});
      $('bookingAdminRefresh').addEventListener('click',()=>{renderCenter();showLiveToast(null,'Booking list refreshed','Live data is already synced from Firestore.')});$('bookingAdminNewBooking').addEventListener('click',()=>{if(!state.admin)return;document.querySelector('.nav-btn[data-section="booking"]')?.click();});
      $('bookingAdminList').addEventListener('click',e=>{const b=e.target.closest('[data-open-receiving]');if(b){markRead(b.dataset.openReceiving);openReceiving(b.dataset.openReceiving)}});
    }
  }

  function openCenter(focusId=''){
    closePanel();
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    $('bookingAdminSection')?.classList.add('active');$('bookingAdminNav')?.classList.add('active');
    $('menuBackdrop')?.classList.remove('show');$('sidebar')?.classList.remove('open');document.body.classList.remove('menu-open');
    if(focusId)markRead(focusId);
    renderCenter();window.scrollTo({top:0,behavior:'smooth'});
  }
  function openReceiving(id){
    const r=state.bookings.find(x=>String(x.id)===String(id));if(!r)return;
    document.querySelector('.nav-btn[data-section="receiving"]')?.click();
    setTimeout(()=>{
      const doF=$('recFilterDO'),dateF=$('recFilterDate'),custF=$('recFilterCustomer');
      if(doF){doF.value=r.doNumber||'';doF.dispatchEvent(new Event('input',{bubbles:true}))}
      if(dateF){dateF.value=r.shipmentDate||'';dateF.dispatchEvent(new Event('change',{bubbles:true}))}
      if(custF){custF.value=r.customer||'';custF.dispatchEvent(new Event('input',{bubbles:true}))}
    },80);
  }

  function togglePanel(){state.panelOpen?closePanel():openPanel()}
  function openPanel(){state.panelOpen=true;$('bookingNotificationPanel')?.classList.add('show');renderNotifications()}
  function closePanel(){state.panelOpen=false;$('bookingNotificationPanel')?.classList.remove('show')}
  function markRead(id){if(!id)return;state.read.add(String(id));state.unread.delete(String(id));saveRead();updateNotificationUI();renderCenter();renderNotifications()}
  function markAllRead(){state.bookings.forEach(r=>state.read.add(String(r.id)));state.unread.clear();saveRead();updateNotificationUI();renderCenter();renderNotifications()}
  function rebuildUnread(){const start=featureStart();state.unread.clear();state.bookings.forEach(r=>{const id=String(r.id);if(parseMs(bookingTime(r))>=start&&!state.read.has(id))state.unread.add(id)})}

  function updateNotificationUI(){
    const n=state.unread.size,badge=$('bookingNotificationBadge'),btn=$('bookingNotificationBtn'),nav=$('bookingNavCount');
    if(badge){badge.textContent=n>99?'99+':String(n);badge.classList.toggle('show',n>0)}btn?.classList.toggle('has-unread',n>0);
    if(nav){nav.textContent=n>99?'99+':String(n);nav.style.display=n?'inline-flex':'none'}if($('bookingStatUnread'))$('bookingStatUnread').textContent=String(n);
    const en=$('bookingEnableNotifBtn');if(en&&'Notification'in window)en.textContent=Notification.permission==='granted'?'Alerts On':Notification.permission==='denied'?'Alerts Blocked':'Enable Alerts';
  }

  function renderNotifications(){
    const list=$('bookingNotificationList');if(!list)return;
    const rows=[...state.bookings].sort((a,b)=>parseMs(bookingTime(b))-parseMs(bookingTime(a))).slice(0,25);
    if(!rows.length){list.innerHTML='<div class="booking-empty">No customer booking notifications yet.</div>';return}
    list.innerHTML=rows.map(r=>{const unread=state.unread.has(String(r.id));return `<div class="booking-notification-item ${unread?'':'read'}" data-booking-notif-id="${esc(r.id)}"><span class="booking-notification-dot"></span><div class="booking-notification-main"><strong>${esc(r.customer||'Customer')} booked ${esc(r.bookingSlot||'a delivery slot')}</strong><span>${esc(r.shipmentDate||'-')} · DO ${esc(r.doNumber||'-')} · ${esc(statusOf(r))}</span></div><span class="booking-notification-time">${esc(relativeTime(bookingTime(r)))}</span></div>`}).join('');
  }

  function filteredBookings(){
    const q=state.filters.search.trim().toLowerCase(),today=todayISO(),tomorrow=tomorrowISO();
    return state.bookings.filter(r=>{
      const status=statusOf(r),date=String(r.shipmentDate||'');
      if(state.filters.range==='today'&&date!==today)return false;if(state.filters.range==='tomorrow'&&date!==tomorrow)return false;if(state.filters.range==='upcoming'&&date<today)return false;
      if(state.filters.status&&status!==state.filters.status)return false;if(state.filters.company&&String(r.customer||'')!==state.filters.company)return false;
      if(q&&!`${r.customer||''} ${r.doNumber||''} ${r.poNumber||''} ${r.vehicleNumber||''} ${r.bookingSlot||''} ${r.shipmentDate||''}`.toLowerCase().includes(q))return false;return true;
    }).sort((a,b)=>`${a.shipmentDate||''} ${a.bookingSlotStart||''}`.localeCompare(`${b.shipmentDate||''} ${b.bookingSlotStart||''}`)||parseMs(bookingTime(b))-parseMs(bookingTime(a)));
  }

  function renderCenter(){
    if(!$('bookingAdminSection'))return;
    const today=todayISO(),tomorrow=tomorrowISO();
    $('bookingStatToday').textContent=state.bookings.filter(r=>r.shipmentDate===today).length;$('bookingStatTomorrow').textContent=state.bookings.filter(r=>r.shipmentDate===tomorrow).length;$('bookingStatAwaiting').textContent=state.bookings.filter(r=>statusOf(r)==='Scheduled Inbound').length;$('bookingStatUnread').textContent=state.unread.size;
    const companies=[...new Set(state.bookings.map(r=>String(r.customer||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const company=$('bookingAdminCompany');if(company){const val=company.value;company.innerHTML='<option value="">All companies</option>'+companies.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');if(companies.includes(val))company.value=val}
    const rows=filteredBookings(),list=$('bookingAdminList');$('bookingAdminResultCount').textContent=`${rows.length} booking${rows.length===1?'':'s'}`;
    if(!rows.length){list.innerHTML='<div class="booking-admin-empty"><strong>No bookings match these filters.</strong><br><span>New customer bookings will appear here automatically.</span></div>';return}
    list.innerHTML=rows.map(r=>{const st=statusOf(r),unread=state.unread.has(String(r.id));return `<article class="booking-row ${unread?'is-unread':''}"><div class="booking-company"><strong>${esc(r.customer||'-')}</strong><span>${esc(relativeTime(bookingTime(r)))}${unread?' · NEW':''}</span></div><div><span class="booking-do">${esc(r.doNumber||'-')}</span><span class="booking-cell-sub">PO ${esc(r.poNumber||'-')}</span></div><div class="booking-date"><strong>${esc(r.shipmentDate||'-')}</strong><span class="booking-slot">${esc(r.bookingSlot||'-')}</span></div><div class="booking-vehicle"><strong>${esc(r.vehicleNumber||'-')}</strong><span class="booking-cell-sub">${esc(r.transportType||'-')} · Qty ${esc(r.expectedQty??'-')}</span></div><div class="booking-status-wrap"><span class="booking-status ${statusClass(st)}">${esc(st)}</span></div><div class="booking-action"><button class="booking-open-btn" data-open-receiving="${esc(r.id)}" type="button">Open Receiving →</button></div></article>`}).join('');
  }

  function showLiveToast(r,titleOverride='',bodyOverride=''){
    const stack=$('bookingToastStack');if(!stack)return;
    const title=titleOverride||(r?`New booking · ${r.customer||'Customer'}`:'Booking update'),body=bodyOverride||(r?`${r.shipmentDate||'-'} · ${r.bookingSlot||'-'} · DO ${r.doNumber||'-'}`:'');
    const div=document.createElement('div');div.className='booking-live-toast';div.innerHTML=`<span class="dot"></span><div><strong>${esc(title)}</strong><span>${esc(body)}</span></div><button type="button">View</button>`;stack.appendChild(div);
    div.querySelector('button').addEventListener('click',()=>{if(r)markRead(r.id);openCenter(r?.id||'');div.remove()});setTimeout(()=>div.remove(),9000);
  }
  async function requestBrowserNotifications(){
    if(!('Notification'in window)){showLiveToast(null,'Notifications unavailable','This browser does not support system notifications.');return}
    try{const permission=await Notification.requestPermission();updateNotificationUI();showLiveToast(null,permission==='granted'?'Booking alerts enabled':'Notification permission not enabled',permission==='granted'?'New bookings can now appear as browser/PWA alerts while the app is running.':'You can still use the in-app bell and unread Booking Control list.')}catch(e){}
  }
  function browserNotify(r){
    if(!('Notification'in window)||Notification.permission!=='granted')return;
    try{const n=new Notification('New Customer Booking',{body:`${r.customer||'Customer'} · ${r.shipmentDate||'-'} · ${r.bookingSlot||'-'}\nDO ${r.doNumber||'-'}`,icon:'./icon.svg',badge:'./icon.svg',tag:'booking-'+r.id,renotify:true});n.onclick=()=>{window.focus();markRead(r.id);openCenter(r.id);n.close()}}catch(e){}
  }
  function handleNewBooking(r){const id=String(r.id);if(state.read.has(id))return;state.unread.add(id);updateNotificationUI();renderCenter();renderNotifications();showLiveToast(r);browserNotify(r)}

  function subscribe(){
    state.unsubscribe?.();state.unsubscribe=null;state.firstSnapshot=true;
    const db=firebase.firestore();
    state.unsubscribe=db.collection('receivings').onSnapshot(snap=>{
      const all=snap.docs.map(d=>({id:d.data().id||d.id,...d.data()})).filter(isBooking);state.bookings=all;rebuildUnread();
      if(state.firstSnapshot){state.firstSnapshot=false;renderCenter();renderNotifications();updateNotificationUI();if(state.unread.size){showLiveToast(null,`${state.unread.size} new booking${state.unread.size===1?'':'s'}`,'Open Booking Control to review customer bookings received since this feature was enabled.')}return}
      snap.docChanges().forEach(change=>{if(change.type==='added'){const data={id:change.doc.data().id||change.doc.id,...change.doc.data()};if(isBooking(data))handleNewBooking(data)}});renderCenter();renderNotifications();updateNotificationUI();
    },err=>showLiveToast(null,'Booking sync unavailable',err?.message||'Could not load booking notifications.'));
  }

  async function onAuth(user){
    state.user=user;const admin=await resolveAdmin(user);if(user!==state.user)return;
    if(!admin){state.admin=false;unmount();return}state.admin=true;loadRead();featureStart();mount();subscribe();
  }
  function boot(){if(!window.firebase||!firebase.auth||!firebase.firestore){setTimeout(boot,180);return}firebase.auth().onAuthStateChanged(onAuth)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
