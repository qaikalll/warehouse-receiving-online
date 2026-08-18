(function(){
  'use strict';

  const FEATURE_ID='wrs-receiving-tv-board-v1';
  const TV_QUERY_KEY='tv';
  const TV_QUERY_VALUE='receiving';

  const state={
    bookings:[],
    unsubscribe:null,
    clockTimer:null,
    wakeLock:null,
    mounted:false,
    open:false
  };

  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const localDateISO=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const todayISO=()=>localDateISO();
  const parseMs=value=>{const n=Date.parse(value||'');return Number.isFinite(n)?n:0};

  function isBooking(r){return r&&r.source==='client-booking'}
  function statusOf(r){
    if(r.completionTime)return 'Completed';
    if(r.startTime)return 'Receiving';
    if(r.arrivalTime)return 'Arrived';
    return 'OTW';
  }
  function laneOf(r){
    const s=statusOf(r);
    if(s==='Completed')return 'completed';
    if(s==='Receiving'||s==='Arrived')return 'receiving';
    return 'otw';
  }
  function slotStart(r){return String(r.bookingSlotStart||'').trim()}
  function sortKey(r){return `${r.shipmentDate||''} ${slotStart(r)||'99:99'} ${r.bookingSlot||''}`}
  function compareBySlot(a,b){return sortKey(a).localeCompare(sortKey(b))||parseMs(a.bookingCreatedAt||a.createdAt)-parseMs(b.bookingCreatedAt||b.createdAt)}
  function qtyText(r){
    const q=r.expectedQty;
    if(q===undefined||q===null||q==='')return 'Qty -';
    return `Qty ${q}`;
  }
  function timeToMinutes(value){
    const m=String(value||'').match(/^(\d{1,2}):(\d{2})$/);
    if(!m)return null;
    return Number(m[1])*60+Number(m[2]);
  }
  function nowMinutes(){const d=new Date();return d.getHours()*60+d.getMinutes()}

  function injectStyles(){
    if($(FEATURE_ID+'-style'))return;
    const style=document.createElement('style');
    style.id=FEATURE_ID+'-style';
    style.textContent=`
      .wrs-tv-open{border:1px solid rgba(255,255,255,.42);background:rgba(255,255,255,.16);color:#fff;border-radius:12px;padding:10px 14px;font-weight:900;font-size:12px;cursor:pointer;white-space:nowrap;backdrop-filter:blur(8px)}
      .wrs-tv-open:hover{background:rgba(255,255,255,.24)}
      .wrs-tv-hero-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}
      #wrsReceivingTvBoard{position:fixed;inset:0;z-index:99999;display:none;background:#0a1020;color:#f7f9ff;font-family:Inter,Arial,sans-serif;overflow:hidden}
      #wrsReceivingTvBoard.show{display:flex;flex-direction:column}
      .wrs-tv-top{display:grid;grid-template-columns:minmax(340px,1.4fr) minmax(360px,1fr) auto;gap:18px;align-items:center;padding:22px 28px 18px;border-bottom:1px solid rgba(255,255,255,.10);background:linear-gradient(135deg,#111b35,#0c1730 55%,#102b34)}
      .wrs-tv-title small{display:block;font-size:13px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;opacity:.68;margin-bottom:5px}.wrs-tv-title h1{font-size:34px;line-height:1.05;margin:0 0 8px;font-weight:950}.wrs-tv-title .date{font-size:16px;opacity:.82}
      .wrs-tv-next{border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.07);border-radius:18px;padding:14px 17px;min-height:76px}.wrs-tv-next-label{font-size:11px;font-weight:950;letter-spacing:.12em;text-transform:uppercase;opacity:.62;margin-bottom:6px}.wrs-tv-next-main{font-size:20px;font-weight:950;line-height:1.2}.wrs-tv-next-sub{font-size:13px;opacity:.76;margin-top:4px}
      .wrs-tv-clock{text-align:right;min-width:180px}.wrs-tv-clock-time{font-size:36px;font-weight:950;letter-spacing:.02em}.wrs-tv-clock-date{font-size:12px;opacity:.66;margin-top:3px}.wrs-tv-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:9px}.wrs-tv-btn{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#fff;border-radius:10px;padding:8px 10px;font-size:11px;font-weight:900;cursor:pointer}.wrs-tv-btn:hover{background:rgba(255,255,255,.13)}
      .wrs-tv-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:14px 28px 0}.wrs-tv-summary-card{border:1px solid rgba(255,255,255,.10);border-radius:14px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.045)}.wrs-tv-summary-card span{font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;opacity:.72}.wrs-tv-summary-card strong{font-size:26px}
      .wrs-tv-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;padding:16px 28px 24px;min-height:0;flex:1}
      .wrs-tv-lane{min-height:0;border:1px solid rgba(255,255,255,.10);border-radius:20px;background:rgba(255,255,255,.035);display:flex;flex-direction:column;overflow:hidden}
      .wrs-tv-lane-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.09)}.wrs-tv-lane-head strong{font-size:18px;letter-spacing:.04em}.wrs-tv-lane-head span{min-width:34px;height:28px;padding:0 9px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,.11);font-weight:950}
      .wrs-tv-lane.otw .wrs-tv-lane-head{background:rgba(59,130,246,.14)}.wrs-tv-lane.receiving .wrs-tv-lane-head{background:rgba(245,158,11,.14)}.wrs-tv-lane.completed .wrs-tv-lane-head{background:rgba(16,185,129,.14)}
      .wrs-tv-list{padding:12px;display:flex;flex-direction:column;gap:10px;overflow:auto;min-height:0;scrollbar-width:thin}
      .wrs-tv-card{position:relative;border:1px solid rgba(255,255,255,.10);background:#111a2f;border-radius:16px;padding:14px 15px 13px;box-shadow:0 12px 30px rgba(0,0,0,.16)}.wrs-tv-card.next{outline:2px solid rgba(96,165,250,.75);box-shadow:0 0 0 5px rgba(96,165,250,.10),0 12px 30px rgba(0,0,0,.18)}
      .wrs-tv-card-top{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}.wrs-tv-time{font-size:18px;font-weight:950;line-height:1.1}.wrs-tv-status{font-size:10px;font-weight:950;letter-spacing:.07em;text-transform:uppercase;border-radius:999px;padding:6px 8px;white-space:nowrap}.wrs-tv-status.otw{background:rgba(59,130,246,.16);color:#93c5fd}.wrs-tv-status.arrived{background:rgba(249,115,22,.16);color:#fdba74}.wrs-tv-status.receiving{background:rgba(245,158,11,.16);color:#fde68a}.wrs-tv-status.completed{background:rgba(16,185,129,.16);color:#6ee7b7}
      .wrs-tv-company{font-size:22px;line-height:1.05;font-weight:950;margin-top:9px;overflow-wrap:anywhere}.wrs-tv-do{font-size:14px;font-weight:850;margin-top:7px;opacity:.94}.wrs-tv-meta{display:grid;grid-template-columns:1fr 1fr;gap:7px 10px;margin-top:10px}.wrs-tv-meta span{font-size:12px;opacity:.72;overflow-wrap:anywhere}.wrs-tv-meta b{font-weight:900;color:#fff;opacity:1}.wrs-tv-note{margin-top:9px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);font-size:11px;opacity:.66;line-height:1.35}
      .wrs-tv-empty{padding:34px 18px;text-align:center;opacity:.46;font-size:14px;font-weight:800}
      .wrs-tv-live-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#34d399;box-shadow:0 0 0 5px rgba(52,211,153,.10);margin-right:8px}
      @media(max-width:1100px){.wrs-tv-top{grid-template-columns:1fr auto}.wrs-tv-next{grid-column:1/-1}.wrs-tv-columns{gap:10px;padding-left:14px;padding-right:14px}.wrs-tv-summary{padding-left:14px;padding-right:14px}.wrs-tv-company{font-size:18px}.wrs-tv-time{font-size:16px}}
      @media(max-width:800px){#wrsReceivingTvBoard{overflow:auto}.wrs-tv-top{grid-template-columns:1fr;padding:18px}.wrs-tv-clock{text-align:left}.wrs-tv-actions{justify-content:flex-start}.wrs-tv-summary{grid-template-columns:1fr;padding:12px 18px 0}.wrs-tv-columns{grid-template-columns:1fr;padding:12px 18px 22px;overflow:visible}.wrs-tv-lane{min-height:300px}.wrs-tv-title h1{font-size:28px}}
    `;
    document.head.appendChild(style);
  }

  function mountBoard(){
    if($('wrsReceivingTvBoard'))return;
    const board=document.createElement('div');
    board.id='wrsReceivingTvBoard';
    board.setAttribute('aria-label','Receiving Live Board');
    board.innerHTML=`
      <div class="wrs-tv-top">
        <div class="wrs-tv-title">
          <small><span class="wrs-tv-live-dot"></span>Live Firestore Sync</small>
          <h1>Receiving Live Board</h1>
          <div class="date" id="wrsTvTodayLabel">Today</div>
        </div>
        <div class="wrs-tv-next">
          <div class="wrs-tv-next-label">Next Arrival</div>
          <div class="wrs-tv-next-main" id="wrsTvNextMain">No upcoming booking</div>
          <div class="wrs-tv-next-sub" id="wrsTvNextSub">Waiting for today's booking schedule.</div>
        </div>
        <div class="wrs-tv-clock">
          <div class="wrs-tv-clock-time" id="wrsTvClock">--:--</div>
          <div class="wrs-tv-clock-date" id="wrsTvClockDate">--</div>
          <div class="wrs-tv-actions">
            <button class="wrs-tv-btn" id="wrsTvFullscreenBtn" type="button">Fullscreen</button>
            <button class="wrs-tv-btn" id="wrsTvCloseBtn" type="button">Exit TV</button>
          </div>
        </div>
      </div>
      <div class="wrs-tv-summary">
        <div class="wrs-tv-summary-card"><span>OTW / Scheduled</span><strong id="wrsTvCountOtw">0</strong></div>
        <div class="wrs-tv-summary-card"><span>Receiving</span><strong id="wrsTvCountReceiving">0</strong></div>
        <div class="wrs-tv-summary-card"><span>Completed</span><strong id="wrsTvCountCompleted">0</strong></div>
      </div>
      <div class="wrs-tv-columns">
        <section class="wrs-tv-lane otw"><div class="wrs-tv-lane-head"><strong>OTW / SCHEDULED</strong><span id="wrsTvLaneCountOtw">0</span></div><div class="wrs-tv-list" id="wrsTvListOtw"></div></section>
        <section class="wrs-tv-lane receiving"><div class="wrs-tv-lane-head"><strong>RECEIVING</strong><span id="wrsTvLaneCountReceiving">0</span></div><div class="wrs-tv-list" id="wrsTvListReceiving"></div></section>
        <section class="wrs-tv-lane completed"><div class="wrs-tv-lane-head"><strong>COMPLETED</strong><span id="wrsTvLaneCountCompleted">0</span></div><div class="wrs-tv-list" id="wrsTvListCompleted"></div></section>
      </div>`;
    document.body.appendChild(board);
    $('wrsTvCloseBtn').addEventListener('click',closeBoard);
    $('wrsTvFullscreenBtn').addEventListener('click',requestFullscreen);
  }

  function mountOpenButton(){
    const section=$('bookingAdminSection');
    if(!section)return false;
    if($('wrsTvOpenBtn'))return true;
    const heroInner=section.querySelector('.booking-admin-hero-inner');
    if(!heroInner)return false;
    let actions=heroInner.querySelector('.wrs-tv-hero-actions');
    if(!actions){
      actions=document.createElement('div');
      actions.className='wrs-tv-hero-actions';
      const livePill=heroInner.querySelector('.booking-live-pill');
      if(livePill)actions.appendChild(livePill);
      heroInner.appendChild(actions);
    }
    const btn=document.createElement('button');
    btn.id='wrsTvOpenBtn';
    btn.className='wrs-tv-open';
    btn.type='button';
    btn.textContent='📺 TV DISPLAY';
    btn.addEventListener('click',()=>openBoard(true));
    actions.appendChild(btn);
    return true;
  }

  async function requestFullscreen(){
    try{
      if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
    }catch(e){}
  }

  async function acquireWakeLock(){
    try{
      if('wakeLock' in navigator)state.wakeLock=await navigator.wakeLock.request('screen');
    }catch(e){}
  }
  async function releaseWakeLock(){
    try{await state.wakeLock?.release()}catch(e){}
    state.wakeLock=null;
  }

  function setTvQuery(enabled){
    try{
      const url=new URL(location.href);
      if(enabled)url.searchParams.set(TV_QUERY_KEY,TV_QUERY_VALUE);else url.searchParams.delete(TV_QUERY_KEY);
      history.replaceState({},document.title,url.pathname+(url.search||'')+(url.hash||''));
    }catch(e){}
  }
  function shouldAutoOpen(){
    try{return new URL(location.href).searchParams.get(TV_QUERY_KEY)===TV_QUERY_VALUE}catch(e){return false}
  }

  function openBoard(userGesture=false){
    mountBoard();
    state.open=true;
    $('wrsReceivingTvBoard').classList.add('show');
    document.body.style.overflow='hidden';
    setTvQuery(true);
    render();
    updateClock();
    if(userGesture){requestFullscreen();acquireWakeLock()}
  }
  function closeBoard(){
    state.open=false;
    $('wrsReceivingTvBoard')?.classList.remove('show');
    document.body.style.overflow='';
    setTvQuery(false);
    releaseWakeLock();
    try{if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen()}catch(e){}
  }

  function cardHtml(r,nextId){
    const status=statusOf(r),lane=laneOf(r),isNext=String(r.id)===String(nextId);
    const statusClass=status.toLowerCase();
    const time=r.bookingSlot||r.bookingSlotStart||'-';
    const transport=r.transportType||'-';
    const vehicle=r.vehicleNumber||'-';
    const po=r.poNumber||'-';
    const note=String(r.remarks||'').trim();
    return `<article class="wrs-tv-card ${isNext?'next':''}" data-booking-id="${esc(r.id||'')}">
      <div class="wrs-tv-card-top"><div class="wrs-tv-time">${esc(time)}</div><span class="wrs-tv-status ${esc(statusClass)}">${esc(status)}</span></div>
      <div class="wrs-tv-company">${esc(r.customer||'Unknown Company')}</div>
      <div class="wrs-tv-do">DO ${esc(r.doNumber||'-')}</div>
      <div class="wrs-tv-meta">
        <span><b>${esc(qtyText(r))}</b></span><span>PO <b>${esc(po)}</b></span>
        <span>Transport <b>${esc(transport)}</b></span><span>Vehicle <b>${esc(vehicle)}</b></span>
      </div>
      ${note?`<div class="wrs-tv-note">${esc(note)}</div>`:''}
    </article>`;
  }

  function render(){
    if(!$('wrsReceivingTvBoard'))return;
    const today=todayISO();
    const bookings=state.bookings.filter(r=>r.shipmentDate===today).sort(compareBySlot);
    const otw=bookings.filter(r=>laneOf(r)==='otw');
    const receiving=bookings.filter(r=>laneOf(r)==='receiving');
    const completed=bookings.filter(r=>laneOf(r)==='completed');

    const now=nowMinutes();
    const next=otw.find(r=>{const m=timeToMinutes(slotStart(r));return m!==null&&m>=now})||otw[0]||null;
    const nextId=next?.id||'';

    const dateLabel=new Date().toLocaleDateString('en-MY',{weekday:'long',day:'2-digit',month:'short',year:'numeric'});
    $('wrsTvTodayLabel').textContent=`TODAY · ${dateLabel}`;
    $('wrsTvCountOtw').textContent=String(otw.length);$('wrsTvLaneCountOtw').textContent=String(otw.length);
    $('wrsTvCountReceiving').textContent=String(receiving.length);$('wrsTvLaneCountReceiving').textContent=String(receiving.length);
    $('wrsTvCountCompleted').textContent=String(completed.length);$('wrsTvLaneCountCompleted').textContent=String(completed.length);

    if(next){
      $('wrsTvNextMain').textContent=`${next.customer||'Customer'} · ${next.bookingSlot||next.bookingSlotStart||'-'}`;
      $('wrsTvNextSub').textContent=`DO ${next.doNumber||'-'} · ${qtyText(next)} · ${next.transportType||'-'}`;
    }else{
      $('wrsTvNextMain').textContent='No upcoming booking';
      $('wrsTvNextSub').textContent=bookings.length?'All scheduled arrivals are already in progress or completed.':'No booking scheduled for today.';
    }

    $('wrsTvListOtw').innerHTML=otw.length?otw.map(r=>cardHtml(r,nextId)).join(''):'<div class="wrs-tv-empty">No OTW / scheduled booking.</div>';
    $('wrsTvListReceiving').innerHTML=receiving.length?receiving.map(r=>cardHtml(r,'')).join(''):'<div class="wrs-tv-empty">Nothing is being received right now.</div>';
    $('wrsTvListCompleted').innerHTML=completed.length?completed.map(r=>cardHtml(r,'')).join(''):'<div class="wrs-tv-empty">No completed receiving yet.</div>';
  }

  function updateClock(){
    if(!$('wrsTvClock'))return;
    const now=new Date();
    $('wrsTvClock').textContent=now.toLocaleTimeString('en-MY',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
    $('wrsTvClockDate').textContent=now.toLocaleDateString('en-MY',{day:'2-digit',month:'long',year:'numeric'});
    if(state.open&&now.getSeconds()===0)render();
  }

  function subscribe(){
    if(state.unsubscribe||!window.firebase?.firestore)return;
    const db=firebase.firestore();
    state.unsubscribe=db.collection('receivings').onSnapshot(snap=>{
      state.bookings=snap.docs.map(d=>({id:d.data().id||d.id,...d.data()})).filter(isBooking);
      if(state.open)render();
    },err=>{
      console.warn('Receiving TV Board sync unavailable',err);
    });
  }

  function unmountIfAdminGone(){
    if($('bookingAdminSection'))return;
    if(state.open)closeBoard();
    $('wrsTvOpenBtn')?.remove();
    state.unsubscribe?.();state.unsubscribe=null;state.bookings=[];
    state.mounted=false;
  }

  function mount(){
    if(!$('bookingAdminSection'))return false;
    injectStyles();mountBoard();mountOpenButton();subscribe();
    state.mounted=true;
    if(shouldAutoOpen()&&!state.open)setTimeout(()=>openBoard(false),100);
    return true;
  }

  function boot(){
    state.clockTimer=setInterval(updateClock,1000);
    const observer=new MutationObserver(()=>{
      if($('bookingAdminSection'))mount();else if(state.mounted)unmountIfAdminGone();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    mount();
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.open)acquireWakeLock()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
