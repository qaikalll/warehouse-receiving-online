(()=>{'use strict';
const V='20260827-return-v1',COL='returns',ALL='__ALL__';let db,auth,rows=[],unsub,edit='';
const $=id=>document.getElementById(id),E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])),CID=n=>String(n||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'unassigned',TODAY=()=>new Date().toISOString().slice(0,10),CLIENT=()=>document.body.classList.contains('role-client'),EDITOR=()=>document.body.classList.contains('role-admin')||document.body.classList.contains('role-staff'),CO=()=>CLIENT()?String($('currentCompanyLabel')?.textContent||'').trim():($('companyWorkspace')?.value||ALL),WHO=()=>String($('signedInUser')?.textContent||auth?.currentUser?.email||'User').trim();
function T(m,w=false){let x=document.createElement('div');x.className='rt-toast'+(w?' warn':'');x.textContent=m;document.body.appendChild(x);setTimeout(()=>x.classList.add('show'),10);setTimeout(()=>x.remove(),2800)}
function UI(){if(!document.querySelector('link[data-return-css]')){let l=document.createElement('link');l.rel='stylesheet';l.href='./return-module.css?v='+V;l.dataset.returnCss=V;document.head.appendChild(l)}if(!document.querySelector('.nav-btn[data-section="return"]')){let d=document.querySelector('.nav-btn[data-section="discrepancy"]'),b=document.createElement('button');b.className='nav-btn';b.type='button';b.dataset.section='return';b.innerHTML='<span class="nav-icon">↩</span>Return Management';d?.after(b);b.onclick=SHOW}if(!$('returnSection')){let s=document.createElement('section');s.id='returnSection';s.className='section has-wave-bg';s.innerHTML=`<div class="section-head"><div><h2>Return Management</h2><p>Record, inspect and track customer returns.</p></div><div class="toolbar"><button class="btn btn-outline" id="rtExport">⬇ Export CSV</button><button class="btn btn-primary" id="rtNew">＋ New Return Case</button></div></div><div class="rt-stats"><div class="card"><span>Total</span><b id="rtA">0</b></div><div class="card"><span>Pending</span><b id="rtB">0</b></div><div class="card"><span>Good</span><b id="rtC">0</b></div><div class="card"><span>Issue / Damaged</span><b id="rtD">0</b></div><div class="card"><span>Completed</span><b id="rtE">0</b></div></div><div class="card filter-card"><div class="rt-filters"><input id="rtSearch" placeholder="Search tracking, order ID, SKU or return ID"><select id="rtPlatform"><option value="">All Platforms</option><option>Shopee</option><option>Lazada</option><option>Website</option><option>Others</option></select><select id="rtStatus"><option value="">All Status</option><option>Pending Inspection</option><option>Pending Client Decision</option><option>Completed</option></select><button class="btn btn-secondary" id="rtReset">Reset</button></div></div><div class="card table-card rt-wrap"><table class="data-table rt-table"><thead><tr><th>Return ID</th><th>Date</th><th>Tracking</th><th>Order ID</th><th>Items</th><th>Qty</th><th>Condition</th><th>Issue</th><th>Platform</th><th>Status</th><th>Action</th></tr></thead><tbody id="rtBody"></tbody></table></div>`;document.querySelector('main.main')?.appendChild(s)}if(!$('rtModal')){let m=document.createElement('div');m.id='rtModal';m.className='rt-modal';m.innerHTML=`<div class="rt-panel"><div class="rt-head"><div><h3 id="rtTitle">New Return Case</h3><small>Create one case per returned parcel.</small></div><button id="rtClose">×</button></div><form id="rtForm"><div class="rt-grid"><label>Date<input id="rDate" type="date"></label><label>Company<input id="rCompany" disabled></label><label>Partner Code<input id="rPartner" placeholder="BRPRVE001"></label><label>Platform<select id="rPlatform"><option>Shopee</option><option>Lazada</option><option>Website</option><option>Others</option></select></label><label class="full">Tracking Number<input id="rTracking" required placeholder="Scan or enter tracking"></label><div id="rDup" class="rt-warning full" hidden></div><label class="full">Marketplace Order ID<div class="rt-inline"><input id="rOrder"><button type="button" id="rCant">Can't Track</button></div></label><label class="full">Client Return ID<input id="rClient" placeholder="ST0885"></label></div><div class="rt-subhead"><b>Item Details</b><button type="button" id="rAdd">＋ Add Item</button></div><div id="rItems"></div><div id="rIssueBox" class="rt-issuebox"><div class="rt-grid"><label>Issue Type<select id="rIssue"><option>Product Damaged</option><option>Box Damaged</option><option>Wrong Item Returned</option><option>Used / Worn</option><option>Missing Packaging</option><option>Other</option></select></label><label>Evidence Photo<input id="rPhoto" type="file" accept="image/*" capture="environment"><small id="rPhotoStatus"></small></label><label class="full">Issue Remark<textarea id="rRemark" rows="2"></textarea></label></div></div><div class="rt-grid"><label>Disposition<select id="rDisposition"><option>Return to Stock</option><option>Quarantine</option><option>Return to Client</option><option>Pending Client Decision</option><option>Dispose</option></select></label><label>Status<select id="rStatus"><option>Pending Inspection</option><option>Pending Client Decision</option><option>Completed</option></select></label></div><div id="rError" class="rt-error" hidden></div><div class="rt-buttons"><button type="button" id="rCancel">Cancel</button><button type="button" id="rDraft">Save Draft</button><button class="primary" type="submit">Complete Return</button></div></form></div>`;document.body.appendChild(m)}BIND();ROLE()}
function SHOW(){document.querySelectorAll('.section').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.nav-btn').forEach(x=>x.classList.toggle('active',x.dataset.section==='return'));$('returnSection')?.classList.add('active');RENDER()}
function ROLE(){if($('rtNew')){$('rtNew').style.display=EDITOR()?'':'none';$('rtNew').disabled=CO()===ALL}}
function ADD(d={}){let c=document.createElement('div');c.className='rt-item';c.innerHTML=`<div><input class="sku" placeholder="SKU / Item" value="${E(d.sku||'')}"><input class="qty" type="number" min="1" value="${Number(d.qty)||1}"></div><div class="rt-cond"><button type="button" class="good ${d.condition==='Damaged'?'':'on'}">Good</button><button type="button" class="bad ${d.condition==='Damaged'?'on':''}">Damaged</button><input class="cond" type="hidden" value="${d.condition==='Damaged'?'Damaged':'Good'}"><button type="button" class="remove">Remove</button></div>`;$('rItems').appendChild(c);let set=v=>{c.querySelector('.cond').value=v;c.querySelector('.good').classList.toggle('on',v==='Good');c.querySelector('.bad').classList.toggle('on',v==='Damaged');ISSUE()};c.querySelector('.good').onclick=()=>set('Good');c.querySelector('.bad').onclick=()=>set('Damaged');c.querySelector('.remove').onclick=()=>{if($('rItems').children.length>1)c.remove();ISSUE()}}
function ISSUE(){$('rIssueBox').classList.toggle('show',[...$('rItems').children].some(c=>c.querySelector('.cond').value==='Damaged'))}
async function COMPRESS(f){let u=await new Promise((r,j)=>{let x=new FileReader;x.onload=()=>r(x.result);x.onerror=j;x.readAsDataURL(f)}),im=await new Promise((r,j)=>{let x=new Image;x.onload=()=>r(x);x.onerror=j;x.src=u}),sc=Math.min(1,700/Math.max(im.width,im.height)),cv=document.createElement('canvas');cv.width=im.width*sc;cv.height=im.height*sc;cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);let o=cv.toDataURL('image/jpeg',.48);if(o.length>220000)throw Error('Photo too large.');return o}
function RESET(r){edit=r?.id||'';$('rtForm').reset();$('rItems').innerHTML='';$('rDate').value=r?.reportDate||TODAY();$('rCompany').value=r?.customer||CO();$('rPartner').value=r?.partnerCode||(/revedition|hoka/i.test(CO())?'BRPRVE001':CO());$('rPlatform').value=r?.platform||'Shopee';$('rTracking').value=r?.tracking||'';$('rOrder').value=r?.orderId||'';$('rClient').value=r?.clientReturnId||'';$('rIssue').value=r?.issueType||'Product Damaged';$('rRemark').value=r?.remark||'';$('rDisposition').value=r?.disposition||'Return to Stock';$('rStatus').value=r?.status||'Pending Inspection';$('rtModal').dataset.photo=r?.photo||'';$('rPhotoStatus').textContent=r?.photo?'Existing photo attached.':'';(r?.items||[{}]).forEach(ADD);ISSUE();$('rError').hidden=true;$('rDup').hidden=true;$('rtTitle').textContent=r?'Edit '+(r.systemReturnId||'Return Case'):'New Return Case'}
function OPEN(r){if(!EDITOR())return T('Client access is view-only.',1);if(CO()===ALL)return T('Select a company workspace first.',1);RESET(r);$('rtModal').classList.add('open')}
function CLOSE(){$('rtModal').classList.remove('open')}
function BAD(c){return`<span class="rt-b ${c==='Damaged'?'bad':'good'}">${c==='Damaged'?'DAMAGED':'GOOD'}</span>`}function STAT(s){let c=s==='Completed'?'done':s==='Pending Client Decision'?'client':'pending';return`<span class="rt-b ${c}">${E((s||'Pending Inspection').toUpperCase())}</span>`}
function LOCAL(){let c=CO();return CLIENT()||c===ALL?rows:rows.filter(r=>r.customer===c)}function FILTER(){let a=LOCAL(),q=$('rtSearch')?.value.toLowerCase().trim()||'',p=$('rtPlatform')?.value||'',s=$('rtStatus')?.value||'';if(q)a=a.filter(r=>(`${r.systemReturnId} ${r.clientReturnId} ${r.tracking} ${r.orderId} ${(r.items||[]).map(i=>i.sku).join(' ')}`).toLowerCase().includes(q));if(p)a=a.filter(r=>r.platform===p);if(s)a=a.filter(r=>r.status===s);return a}
function RENDER(){if(!$('rtBody'))return;ROLE();let a=LOCAL(),f=FILTER();$('rtA').textContent=a.length;$('rtB').textContent=a.filter(r=>r.status==='Pending Inspection').length;$('rtC').textContent=a.filter(r=>r.overallCondition==='Good').length;$('rtD').textContent=a.filter(r=>r.overallCondition==='Damaged').length;$('rtE').textContent=a.filter(r=>r.status==='Completed').length;$('rtBody').innerHTML=f.length?f.map(r=>`<tr><td><b>${E(r.systemReturnId||r.id)}</b>${r.clientReturnId?`<small>${E(r.clientReturnId)}</small>`:''}</td><td>${E(r.reportDate||'')}</td><td>${E(r.tracking||'-')}</td><td>${E(r.orderId||'-')}</td><td>${(r.items||[]).map(i=>E(i.sku)).join('<br>')}</td><td>${r.totalQty||0}</td><td>${BAD(r.overallCondition)}</td><td>${E(r.issueType||'-')}</td><td>${E(r.platform||'-')}</td><td>${STAT(r.status)}</td><td><div class="rt-actions"><button data-a="view" data-id="${r.id}">View</button>${EDITOR()?`<button data-a="edit" data-id="${r.id}">Edit</button><button data-a="del" data-id="${r.id}">Delete</button>`:''}</div></td></tr>`).join(''):'<tr><td colspan="11">No return cases found.</td></tr>';$('rtBody').querySelectorAll('[data-a]').forEach(b=>b.onclick=ACTION)}
function VIEW(r){let it=(r.items||[]).map(i=>`${E(i.sku)} × ${i.qty} — ${E(i.condition)}`).join('<br>');alert(`${r.systemReturnId}\nTracking: ${r.tracking}\nOrder: ${r.orderId||'-'}\nItems:\n${it.replace(/<br>/g,'\n')}\nStatus: ${r.status}`)}
async function ACTION(e){let r=rows.find(x=>x.id===e.currentTarget.dataset.id),a=e.currentTarget.dataset.a;if(a==='view')VIEW(r);if(a==='edit')OPEN(r);if(a==='del'&&EDITOR()&&confirm('Delete this return case?'))await db.collection(COL).doc(r.id).delete()}
function RID(){let d=new Date();return`RTN-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getTime()).slice(-6)}`}
async function SAVE(draft){$('rError').hidden=true;try{let old=edit?rows.find(r=>r.id===edit):null,tr=$('rTracking').value.trim();if(!tr)throw Error('Tracking Number is required.');let items=[...$('rItems').children].map(c=>({sku:c.querySelector('.sku').value.trim(),qty:Number(c.querySelector('.qty').value)||0,condition:c.querySelector('.cond').value}));if(items.some(i=>!i.sku||i.qty<1))throw Error('Every item needs SKU and valid Qty.');let damaged=items.some(i=>i.condition==='Damaged'),photo=$('rtModal').dataset.photo||'';if(damaged&&!photo)throw Error('Evidence photo is required for damaged return.');let at=new Date().toISOString(),p={systemReturnId:old?.systemReturnId||RID(),reportDate:$('rDate').value,customer:$('rCompany').value,companyId:CID($('rCompany').value),partnerCode:$('rPartner').value.trim(),platform:$('rPlatform').value,tracking:tr,trackingNormalized:tr.toUpperCase(),orderId:$('rOrder').value.trim(),clientReturnId:$('rClient').value.trim(),items,totalQty:items.reduce((n,i)=>n+i.qty,0),overallCondition:damaged?'Damaged':'Good',issueType:damaged?$('rIssue').value:'',remark:damaged?$('rRemark').value.trim():'',photo:damaged?photo:'',disposition:$('rDisposition').value,status:draft?'Pending Inspection':$('rStatus').value,createdAt:old?.createdAt||at,createdBy:old?.createdBy||WHO(),updatedAt:at,updatedBy:WHO(),audit:[...(old?.audit||[]),{at,by:WHO(),action:old?'Return updated':'Return created'}],moduleVersion:V};let ref=edit?db.collection(COL).doc(edit):db.collection(COL).doc();await ref.set({...p,updatedServerAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});T(edit?'Return updated.':'Return saved.');CLOSE()}catch(e){$('rError').textContent=e.message;$('rError').hidden=false}}
async function DUP(){let t=$('rTracking').value.trim().toUpperCase(),b=$('rDup');if(t.length<5)return b.hidden=true;try{let s=await db.collection(COL).where('trackingNormalized','==',t).limit(10).get(),d=s.docs.map(x=>({id:x.id,...x.data()})).find(x=>x.customer===$('rCompany').value&&x.id!==edit);b.hidden=!d;if(d)b.textContent='⚠ Possible duplicate: '+(d.systemReturnId||d.id)}catch{b.hidden=true}}
function EXPORT(){let a=FILTER();if(!a.length)return T('No records to export.',1);let o=[['Date','Partner','Marketplace Order ID','Tracking','Item','Qty','Condition','RETURN ID','Platform','System Return ID','Issue Type','Remark','Disposition','Status']];a.forEach(r=>(r.items||[]).forEach(i=>o.push([r.reportDate,r.partnerCode||r.customer,r.orderId,r.tracking,i.sku,i.qty,i.condition,r.clientReturnId,r.platform,r.systemReturnId,r.issueType,r.remark,r.disposition,r.status])));let csv='\ufeff'+o.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n'),u=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),x=document.createElement('a');x.href=u;x.download='Return_Report_'+TODAY()+'.csv';x.click();setTimeout(()=>URL.revokeObjectURL(u),500)}
function BIND(){if($('returnSection')?.dataset.rtb)return;$('returnSection').dataset.rtb=1;$('rtNew').onclick=()=>OPEN();$('rtExport').onclick=EXPORT;$('rtSearch').oninput=RENDER;$('rtPlatform').onchange=$('rtStatus').onchange=RENDER;$('rtReset').onclick=()=>{$('rtSearch').value='';$('rtPlatform').value='';$('rtStatus').value='';RENDER()};$('rtClose').onclick=$('rCancel').onclick=CLOSE;$('rAdd').onclick=()=>ADD();$('rCant').onclick=()=>{$('rOrder').value="CAN'T TRACK"};let tm;$('rTracking').oninput=()=>{clearTimeout(tm);tm=setTimeout(DUP,300)};$('rPhoto').onchange=async e=>{try{$('rPhotoStatus').textContent='Compressing...';$('rtModal').dataset.photo=await COMPRESS(e.target.files[0]);$('rPhotoStatus').textContent='Photo ready.'}catch(x){$('rPhotoStatus').textContent=x.message}};$('rtForm').onsubmit=e=>{e.preventDefault();SAVE(false)};$('rDraft').onclick=()=>SAVE(true);$('companyWorkspace')?.addEventListener('change',()=>setTimeout(RENDER,20))}
function SUB(){if(!auth?.currentUser)return;try{unsub?.()}catch{}let q=db.collection(COL),c=CO();if(CLIENT()&&c&&c!==ALL)q=q.where('companyId','==',CID(c));unsub=q.onSnapshot(s=>{rows=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));RENDER()},e=>{console.error(e);if($('returnSection')?.classList.contains('active'))T('Return sync error.',1)})}
function INIT(){if(window.__GI_RETURN__)return;window.__GI_RETURN__=V;if(!window.firebase?.apps?.length)return;db=firebase.firestore();auth=firebase.auth();UI();auth.onAuthStateChanged(u=>u?setTimeout(SUB,300):(rows=[],RENDER()));new MutationObserver(ROLE).observe(document.body,{attributes:true,attributeFilter:['class']});if(auth.currentUser)setTimeout(SUB,300)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',INIT,{once:true});else INIT();
})();/* ===== RETURN UI POLISH + GUIDE V2 ===== */
(function () {
  function applyReturnPolish() {
    const section = document.getElementById('returnSection');
    if (!section) return false;

    if (!document.getElementById('rtUiPolishV2')) {
      const style = document.createElement('style');
      style.id = 'rtUiPolishV2';
      style.textContent = `
        #returnSection,
        #rtModal {
          font-family: Inter, "Segoe UI", Arial, sans-serif !important;
          font-style: normal !important;
        }

        #returnSection *,
        #rtModal * {
          font-style: normal !important;
        }

        #returnSection .section-head {
          align-items:flex-start !important;
        }

        .rt-stats span {
          color:#9eabc2 !important;
          letter-spacing:.04em;
        }

        .rt-grid label {
          color:#9eabc2 !important;
          font-size:12px !important;
          font-weight:700 !important;
        }

        .rt-grid input,
        .rt-grid select,
        .rt-grid textarea,
        .rt-filters input,
        .rt-filters select {
          background:#102142 !important;
          color:#f1f5ff !important;
          border:1px solid #435b88 !important;
          border-radius:11px !important;
          min-height:48px;
          padding:11px 14px !important;
          font-size:14px !important;
          font-weight:600 !important;
          box-shadow:none !important;
        }

        .rt-grid input::placeholder,
        .rt-grid textarea::placeholder {
          color:#8295b8 !important;
        }

        .rt-grid input:focus,
        .rt-grid select:focus,
        .rt-grid textarea:focus {
          border-color:#7899ea !important;
          box-shadow:0 0 0 3px rgba(89,127,229,.16) !important;
        }

        .rt-item {
          background:rgba(255,255,255,.025) !important;
          border:1px solid #3b527d !important;
          border-radius:13px !important;
          padding:12px !important;
        }

        .rt-cond button,
        #rAdd,
        #rCant,
        .rt-buttons button {
          color:#eef3ff !important;
          background:#14264a !important;
          border:1px solid #647db7 !important;
          font-weight:700 !important;
        }

        .rt-cond .good.on {
          background:#e3f5ea !important;
          color:#14754a !important;
          border-color:#add9bf !important;
        }

        .rt-cond .bad.on {
          background:#ffe7e9 !important;
          color:#b43d47 !important;
          border-color:#efb2b9 !important;
        }

        .rt-buttons .primary {
          color:#fff !important;
          background:linear-gradient(135deg,#416fd3,#8a3fc1) !important;
          border-color:#7895e1 !important;
        }

        #rCancel,
        #rDraft,
        #rCant,
        .rt-cond .remove {
          color:#e8efff !important;
        }

        .rt-subhead b {
          color:#f5f8ff !important;
        }

        .rt-guide-btn {
          border:1px solid #5c74aa;
          background:#172b50;
          color:#eef4ff;
          border-radius:10px;
          padding:11px 15px;
          font-weight:800;
          cursor:pointer;
        }

        .rt-guide-overlay {
          position:fixed;
          inset:0;
          z-index:20000;
          background:rgba(5,13,28,.76);
          display:none;
          align-items:center;
          justify-content:center;
          padding:20px;
        }

        .rt-guide-overlay.show { display:flex; }

        .rt-guide-card {
          width:min(700px,94vw);
          max-height:88vh;
          overflow:auto;
          background:#102142;
          border:1px solid #40547c;
          border-radius:18px;
          box-shadow:0 24px 60px rgba(0,0,0,.35);
        }

        .rt-guide-head {
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          padding:18px 20px;
          border-bottom:1px solid #344a72;
        }

        .rt-guide-head h3 {
          margin:0;
          color:#f7f9ff;
          font-size:22px;
        }

        .rt-guide-head p {
          margin:4px 0 0;
          color:#9eabc2;
          font-size:13px;
        }

        .rt-guide-close {
          width:36px;
          height:36px;
          border-radius:9px;
          border:1px solid #536b9e;
          background:#172b50;
          color:#fff;
          font-size:20px;
          cursor:pointer;
        }

        .rt-guide-body { padding:18px 20px; }

        .rt-guide-step {
          display:grid;
          grid-template-columns:40px 1fr;
          gap:13px;
          padding:12px 0;
          border-bottom:1px solid rgba(255,255,255,.07);
        }

        .rt-guide-step:last-child { border-bottom:0; }

        .rt-guide-num {
          width:40px;
          height:40px;
          border-radius:50%;
          display:grid;
          place-items:center;
          background:linear-gradient(135deg,#426fda,#963fc0);
          color:#fff;
          font-weight:900;
        }

        .rt-guide-step strong {
          color:#f5f8ff;
          display:block;
          margin-bottom:4px;
        }

        .rt-guide-step p {
          color:#a8b5cf;
          margin:0;
          line-height:1.45;
          font-size:13px;
        }
      `;
      document.head.appendChild(style);
    }

    const toolbar = section.querySelector('.section-head .toolbar');

    if (toolbar && !document.getElementById('rtGuideBtn')) {
      const btn = document.createElement('button');
      btn.id = 'rtGuideBtn';
      btn.type = 'button';
      btn.className = 'rt-guide-btn';
      btn.textContent = '✦ Return Guide';
      toolbar.insertBefore(btn, toolbar.firstChild);

      const overlay = document.createElement('div');
      overlay.id = 'rtGuideOverlay';
      overlay.className = 'rt-guide-overlay';
      overlay.innerHTML = `
        <div class="rt-guide-card">
          <div class="rt-guide-head">
            <div>
              <h3>Return Management Guide</h3>
              <p>Quick guide for processing a return case.</p>
            </div>
            <button class="rt-guide-close" type="button">×</button>
          </div>

          <div class="rt-guide-body">
            <div class="rt-guide-step">
              <div class="rt-guide-num">1</div>
              <div><strong>Create Return Case</strong><p>Click + New Return Case when the returned parcel arrives.</p></div>
            </div>

            <div class="rt-guide-step">
              <div class="rt-guide-num">2</div>
              <div><strong>Enter Return Information</strong><p>Fill tracking number, marketplace order ID, platform and client return ID if available.</p></div>
            </div>

            <div class="rt-guide-step">
              <div class="rt-guide-num">3</div>
              <div><strong>Add Item / SKU</strong><p>Enter SKU and quantity. Use + Add Item for multiple items in the same parcel.</p></div>
            </div>

            <div class="rt-guide-step">
              <div class="rt-guide-num">4</div>
              <div><strong>Check Condition</strong><p>Select Good or Damaged. Damaged returns require issue details and photo evidence.</p></div>
            </div>

            <div class="rt-guide-step">
              <div class="rt-guide-num">5</div>
              <div><strong>Select Action</strong><p>Choose the correct disposition such as Return to Stock, Quarantine or Pending Client Decision.</p></div>
            </div>

            <div class="rt-guide-step">
              <div class="rt-guide-num">6</div>
              <div><strong>Save or Complete</strong><p>Save Draft while checking, or Complete Return once all details are confirmed.</p></div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      btn.onclick = () => overlay.classList.add('show');
      overlay.querySelector('.rt-guide-close').onclick = () => overlay.classList.remove('show');
      overlay.onclick = e => {
        if (e.target === overlay) overlay.classList.remove('show');
      };
    }

    return true;
  }

  if (!applyReturnPolish()) {
    const timer = setInterval(() => {
      if (applyReturnPolish()) clearInterval(timer);
    }, 300);

    setTimeout(() => clearInterval(timer), 10000);
  }
})();/* ===== RETURN AUDIT FIX V3 ===== */
(() => {
  function fixReturnUI() {
    const section = document.getElementById('returnSection');

    if (section) {
      section.classList.remove('has-wave-bg');
      section.classList.add('rt-return-flat');
    }

    if (!document.getElementById('rtAuditFixV3')) {
      const style = document.createElement('style');
      style.id = 'rtAuditFixV3';
      style.textContent = `
        #returnSection.rt-return-flat {
          position:relative;
          overflow:hidden;
          padding:16px 16px 24px;
          border-radius:24px;
          background:var(--card, rgba(255,255,255,.035)) !important;
          border:1px solid var(--line, #30466e);
          transform:none !important;
        }

        #returnSection::before,
        #returnSection::after,
        #returnSection .rt-stats .card {
          transform:none !important;
          animation:none !important;
        }

        .rt-guide-card {
          position:relative;
          overflow:hidden;
        }

        .rt-guide-body {
          padding-right:245px !important;
        }

        .rt-guide-figure {
          position:absolute;
          right:12px;
          bottom:0;
          width:225px;
          height:82%;
          display:flex;
          align-items:flex-end;
          justify-content:center;
          pointer-events:none;
        }

        .rt-guide-figure img {
          width:100%;
          max-height:100%;
          object-fit:contain;
          filter:drop-shadow(0 18px 20px rgba(0,0,0,.28));
          animation:rtFigureFloat 3s ease-in-out infinite;
        }

        @keyframes rtFigureFloat {
          0%,100% { transform:translateY(0); }
          50% { transform:translateY(-8px); }
        }

        @media(max-width:700px) {
          .rt-guide-body {
            padding-right:20px !important;
            padding-top:215px !important;
          }

          .rt-guide-figure {
            width:190px;
            height:190px;
            top:62px;
            bottom:auto;
            right:50%;
            transform:translateX(50%);
          }
        }
      `;
      document.head.appendChild(style);
    }

    const overlay = document.getElementById('rtGuideOverlay');
    const card = overlay?.querySelector('.rt-guide-card');
    const originalGuide = document.querySelector('.tutorial-guide');
    const guideSrc = originalGuide?.src || '';

    if (
      card &&
      guideSrc.startsWith('data:image/webp') &&
      !card.querySelector('.rt-guide-figure')
    ) {
      const figure = document.createElement('div');
      figure.className = 'rt-guide-figure';

      const img = document.createElement('img');
      img.src = guideSrc;
      img.alt = 'Qaiyum Guide';

      figure.appendChild(img);
      card.appendChild(figure);
    }

    return !!(
      section &&
      card &&
      card.querySelector('.rt-guide-figure')
    );
  }

  if (!fixReturnUI()) {
    const timer = setInterval(() => {
      if (fixReturnUI()) clearInterval(timer);
    }, 250);

    setTimeout(() => clearInterval(timer), 10000);
  }
})();/* ===== RETURN MODULE FINAL UI + INTERACTIVE TOUR V4 ===== */
(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function setupReturnV4() {
    const section = document.getElementById('returnSection');
    if (!section || document.getElementById('rtFinalV4Style')) return;

    /* REMOVE OLD WRONG PATCH */
    document.getElementById('rtAuditFixV3')?.remove();
    document.getElementById('rtGuideOverlay')?.remove();

    /* RESTORE SAME ANIMATED BACKGROUND AS OTHER MODULES */
    section.classList.remove('rt-return-flat');
    section.classList.add('has-wave-bg');

    /* CLEAN STAT CARDS */
    const statIcons = ['↩', '◷', '✓', '!', '✓'];
    section.querySelectorAll('.rt-stats .card').forEach((card, i) => {
      card.classList.add('rt-stat-clean');

      if (!card.querySelector('.rt-stat-symbol')) {
        const icon = document.createElement('div');
        icon.className = 'rt-stat-symbol';
        icon.textContent = statIcons[i] || '•';
        card.appendChild(icon);
      }
    });

    const style = document.createElement('style');
    style.id = 'rtFinalV4Style';
    style.textContent = `
      /* ---------- RETURN PAGE ---------- */

      #returnSection.has-wave-bg {
        transform:none !important;
      }

      #returnSection .section-head,
      #returnSection .rt-stats,
      #returnSection .filter-card,
      #returnSection .table-card {
        transform:none !important;
      }

      #returnSection .rt-stats {
        display:grid !important;
        grid-template-columns:repeat(5,minmax(0,1fr)) !important;
        gap:13px !important;
        margin-bottom:18px !important;
      }

      #returnSection .rt-stats .rt-stat-clean {
        position:relative !important;
        display:block !important;
        min-height:112px !important;
        padding:18px 18px !important;
        overflow:hidden !important;
        border-radius:14px !important;
        transform:none !important;
        animation:none !important;
      }

      #returnSection .rt-stats .rt-stat-clean::before {
        content:"";
        position:absolute;
        left:0;
        top:0;
        bottom:0;
        width:3px;
        background:linear-gradient(
          180deg,
          var(--blue,#5a3fc0),
          var(--accent,#e3138c)
        );
      }

      #returnSection .rt-stats span {
        display:block !important;
        margin:0 !important;
        padding:0 !important;
        font-size:12px !important;
        line-height:1.2 !important;
        font-weight:800 !important;
        text-transform:uppercase !important;
        letter-spacing:.04em !important;
        color:var(--muted,#6c7a90) !important;
      }

      #returnSection .rt-stats b {
        display:block !important;
        margin:10px 0 0 !important;
        padding:0 !important;
        font-family:Inter,"Segoe UI",Arial,sans-serif !important;
        font-size:31px !important;
        font-weight:900 !important;
        font-style:normal !important;
        line-height:1 !important;
        letter-spacing:-.02em !important;
        color:var(--text,#172033) !important;
      }

      body.theme-dark #returnSection .rt-stats b {
        color:#f2f6ff !important;
      }

      .rt-stat-symbol {
        position:absolute;
        right:15px;
        top:50%;
        transform:translateY(-50%);
        width:42px;
        height:42px;
        border-radius:12px;
        display:grid;
        place-items:center;
        background:rgba(90,63,192,.12);
        color:#8a73e8;
        font-size:20px;
        font-weight:900;
      }

      #rtGuideBtn {
        background:linear-gradient(
          115deg,
          #211a54,
          #5a3fc0 60%,
          #e3138c
        ) !important;
        color:#fff !important;
        border:0 !important;
        box-shadow:0 7px 18px rgba(90,63,192,.22) !important;
      }

      /* Return tutorial figure moves left/right */
      #rtTourLayer.rt-figure-left .tutorial-guide-wrap {
        left:18px !important;
        right:auto !important;
      }

      #rtTourLayer.rt-figure-left .tutorial-dialog {
        right:45px !important;
        left:auto !important;
      }

      #rtTourLayer.rt-figure-right .tutorial-guide-wrap {
        right:18px !important;
        left:auto !important;
      }

      #rtTourLayer.rt-figure-right .tutorial-dialog {
        left:45px !important;
        right:auto !important;
      }

      @media(max-width:900px) {
        #returnSection .rt-stats {
          grid-template-columns:repeat(3,minmax(0,1fr)) !important;
        }
      }

      @media(max-width:620px) {
        #returnSection .rt-stats {
          grid-template-columns:repeat(2,minmax(0,1fr)) !important;
        }

        #rtTourLayer .tutorial-guide-wrap {
          left:auto !important;
          right:-8px !important;
        }

        #rtTourLayer .tutorial-dialog {
          left:12px !important;
          right:12px !important;
        }
      }
    `;

    document.head.appendChild(style);

    /* ---------- BUILD REAL INTERACTIVE GUIDE ---------- */

    const originalFigure =
      document.querySelector('#tutorialLayer .tutorial-guide') ||
      document.querySelector('.tutorial-guide');

    const layer = document.createElement('div');
    layer.id = 'rtTourLayer';
    layer.className = 'tutorial-layer';

    layer.innerHTML = `
      <div class="tutorial-spotlight" id="rtTourSpotlight"></div>

      <div class="tutorial-guide-wrap">
        <img
          class="tutorial-guide"
          id="rtTourFigure"
          alt="Qaiyum Guide"
        >
      </div>

      <section class="tutorial-language-panel">
        <div class="language-panel-top">
          <div class="language-eyebrow">
            Qaiyum Interactive Guide
          </div>

          <h2>Choose tutorial language</h2>

          <p>
            Select one language before the step-by-step
            Return guide begins.
          </p>

          <span class="language-guide-name">
            Return Management Guide
          </span>
        </div>

        <div class="language-options">
          <button
            class="language-option"
            data-rt-lang="ms"
            type="button"
          >
            <span class="language-code">BM</span>
            <strong>Bahasa Melayu</strong>
            <small>Panduan Return dalam Bahasa Melayu</small>
          </button>

          <button
            class="language-option"
            data-rt-lang="en"
            type="button"
          >
            <span class="language-code">EN</span>
            <strong>English</strong>
            <small>Continue Return guide in English</small>
          </button>

          <button
            class="language-option"
            data-rt-lang="my"
            type="button"
          >
            <span class="language-code">MM</span>
            <strong>မြန်မာ</strong>
            <small>Return လမ်းညွှန်</small>
          </button>

          <button
            class="language-option"
            data-rt-lang="zh"
            type="button"
          >
            <span class="language-code">中文</span>
            <strong>Chinese</strong>
            <small>查看退货操作指南</small>
          </button>
        </div>

        <button
          class="language-later"
          id="rtTourLater"
          type="button"
        >
          Maybe later
        </button>
      </section>

      <section class="tutorial-dialog">
        <div class="tutorial-dialog-top"></div>

        <div class="tutorial-dialog-body">
          <div class="tutorial-meta">
            <span class="tutorial-name">
              Qaiyum Guide · Return
            </span>

            <span
              class="tutorial-step-count"
              id="rtTourCount"
            ></span>
          </div>

          <h2
            class="tutorial-title"
            id="rtTourTitle"
          ></h2>

          <p
            class="tutorial-copy"
            id="rtTourCopy"
          ></p>

          <div
            class="tutorial-progress"
            id="rtTourProgress"
          ></div>
        </div>

        <div class="tutorial-actions">
          <button
            class="tutorial-action tutorial-back"
            id="rtTourBack"
            type="button"
          >
            Back
          </button>

          <button
            class="tutorial-action tutorial-skip"
            id="rtTourSkip"
            type="button"
          >
            Skip
          </button>

          <button
            class="tutorial-action tutorial-next"
            id="rtTourNext"
            type="button"
          >
            Next →
          </button>
        </div>
      </section>
    `;

    document.body.appendChild(layer);

    if (originalFigure?.src) {
      document.getElementById('rtTourFigure').src =
        originalFigure.src;
    }

           /* ===== RETURN INTERACTIVE GUIDE V5 ===== */

    /* Tutorial must sit ABOVE the New Return modal */
    layer.style.zIndex = '30000';

    const TEXT = {
      en: [
        [
          "Return Management",
          "This guide will show the complete return process step by step directly on the Return screen."
        ],
        [
          "Start a New Return",
          "Click New Return Case whenever a returned parcel arrives. On the next step, the guide will open the form for you."
        ],
        [
          "Confirm Return Date",
          "Check the return date. The system automatically uses today's date, but you can change it when required."
        ],
        [
          "Choose Platform",
          "Select where the order came from such as Shopee, Lazada, Website or Others."
        ],
        [
          "Scan Tracking Number",
          "Scan or enter the parcel tracking number. Tracking is the main reference for tracing the return and detecting duplicates."
        ],
        [
          "Marketplace Order ID",
          "Enter the original marketplace Order ID. Use Can't Track only when the original order cannot be identified."
        ],
        [
          "Client Return ID",
          "If the client provides a return reference such as ST0885, enter it here. Leave it blank when there is no client reference."
        ],
        [
          "Enter Returned SKU",
          "Enter the SKU or item code being returned. Use Add Item when one parcel contains more than one SKU."
        ],
        [
          "Enter Quantity",
          "Enter the actual quantity returned for this SKU."
        ],
        [
          "Inspect Item Condition",
          "Choose Good if the item is acceptable, or Damaged if the item is damaged, wrong, worn or has another issue."
        ],
        [
          "Record the Issue",
          "For damaged or abnormal returns, choose the correct Issue Type and enter a clear remark."
        ],
        [
          "Upload Photo Evidence",
          "Upload clear photo evidence for damaged, worn, wrong or abnormal returned items."
        ],
        [
          "Choose Disposition",
          "Choose the next warehouse action such as Return to Stock, Quarantine, Return to Client or Pending Client Decision."
        ],
        [
          "Set Return Status",
          "Use Pending Inspection while checking, Pending Client Decision when waiting for instruction, or Completed when the case is finished."
        ],
        [
          "Save or Complete",
          "Use Save Draft when checking is still ongoing. Use Complete Return only after all return information has been confirmed."
        ],
        [
          "Track Saved Returns",
          "The saved return appears in the Return Cases table where you can review, edit, track and export the case."
        ]
      ],

      ms: [
        [
          "Return Management",
          "Guide ini akan tunjuk keseluruhan proses return satu per satu terus pada skrin Return sebenar."
        ],
        [
          "Buka New Return",
          "Tekan New Return Case setiap kali parcel return sampai. Pada step seterusnya guide akan buka form return secara automatik."
        ],
        [
          "Semak Tarikh Return",
          "Semak tarikh return dahulu. Sistem akan isi tarikh hari ini secara automatik tetapi boleh diubah jika perlu."
        ],
        [
          "Pilih Platform",
          "Pilih order ini datang daripada platform mana seperti Shopee, Lazada, Website atau Others."
        ],
        [
          "Scan Tracking Number",
          "Scan atau masukkan tracking parcel. Tracking ialah rujukan utama untuk trace return dan mengesan duplicate."
        ],
        [
          "Marketplace Order ID",
          "Masukkan Order ID asal. Gunakan Can't Track hanya jika order asal memang tidak dapat dikenal pasti."
        ],
        [
          "Client Return ID",
          "Jika client beri reference return seperti ST0885, masukkan di sini. Biarkan kosong jika tiada reference."
        ],
        [
          "Masukkan SKU Return",
          "Masukkan SKU atau item code yang dipulangkan. Tekan Add Item jika satu parcel mempunyai lebih daripada satu SKU."
        ],
        [
          "Masukkan Quantity",
          "Masukkan quantity sebenar item yang dipulangkan."
        ],
        [
          "Periksa Condition Item",
          "Pilih Good jika item elok, atau Damaged jika item rosak, salah item, sudah dipakai atau mempunyai isu lain."
        ],
        [
          "Rekod Issue",
          "Jika return rosak atau abnormal, pilih Issue Type yang betul dan masukkan remark yang jelas."
        ],
        [
          "Upload Bukti Gambar",
          "Upload gambar yang jelas untuk return rosak, worn, salah item atau abnormal."
        ],
        [
          "Pilih Disposition",
          "Pilih tindakan warehouse seterusnya seperti Return to Stock, Quarantine, Return to Client atau Pending Client Decision."
        ],
        [
          "Tetapkan Status Return",
          "Gunakan Pending Inspection semasa checking, Pending Client Decision jika tunggu arahan client, atau Completed apabila kes selesai."
        ],
        [
          "Save atau Complete",
          "Gunakan Save Draft jika checking belum selesai. Tekan Complete Return hanya selepas semua maklumat disahkan."
        ],
        [
          "Track Return",
          "Return yang disimpan akan keluar dalam Return Cases table untuk review, edit, track dan export."
        ]
      ]
    };

    TEXT.zh = TEXT.en;
    TEXT.my = TEXT.en;

    const steps = [
      { target:'#returnSection .section-head' },

      { target:'#rtNew' },

      { target:'#rDate', modal:true },

      { target:'#rPlatform', modal:true },

      { target:'#rTracking', modal:true },

      { target:'#rOrder', modal:true },

      { target:'#rClient', modal:true },

      { target:'#rItems .sku', modal:true },

      { target:'#rItems .qty', modal:true },

      { target:'#rItems .rt-cond', modal:true },

      { target:'#rIssue', modal:true, issue:true },

      { target:'#rPhoto', modal:true, issue:true },

      { target:'#rDisposition', modal:true },

      { target:'#rStatus', modal:true },

      { target:'#rtForm .rt-buttons', modal:true },

      {
        target:'#returnSection .table-card',
        closeModal:true
      }
    ];

    let index = 0;
    let language = 'en';
    let active = false;

    const spotlight =
      document.getElementById('rtTourSpotlight');

    async function ensureStep(step) {

      document
        .querySelector('.nav-btn[data-section="return"]')
        ?.click();

      await sleep(140);

      /*
       * Once guide reaches form fields,
       * automatically open New Return.
       */
      if (step.modal) {

        const modal =
          document.getElementById('rtModal');

        if (!modal?.classList.contains('open')) {

          document
            .getElementById('rtNew')
            ?.click();

          await sleep(320);
        }
      }

      /*
       * Show damaged-return fields when guide
       * reaches Issue / Photo steps.
       */
      if (step.issue) {

        document
          .getElementById('rIssueBox')
          ?.classList.add('show');
      }

      /*
       * Final step returns to the saved-case list.
       */
      if (step.closeModal) {

        document
          .getElementById('rtModal')
          ?.classList.remove('open');

        await sleep(220);
      }
    }

    function positionFigure(rect) {

      if (innerWidth <= 680) {

        layer.classList.remove(
          'rt-figure-left',
          'rt-figure-right'
        );

        return;
      }

      const targetIsRight =
        rect.left + rect.width / 2 >
        innerWidth / 2;

      /*
       * Figure moves away from the highlighted
       * element just like the existing guides.
       */
      layer.classList.toggle(
        'rt-figure-left',
        targetIsRight
      );

      layer.classList.toggle(
        'rt-figure-right',
        !targetIsRight
      );
    }

    async function renderStep() {

      if (!active) return;

      const step = steps[index];

      await ensureStep(step);

      let target =
        document.querySelector(step.target);

      if (!target) {

        target =
          document.querySelector(
            '#returnSection .section-head'
          );
      }

      /*
       * Automatically move the page / form
       * to the field currently being explained.
       */
      target.scrollIntoView({
        behavior:'smooth',
        block:'center',
        inline:'center'
      });

      await sleep(560);

      const rect =
        target.getBoundingClientRect();

      const pad = 10;

      const left =
        Math.max(7, rect.left - pad);

      const top =
        Math.max(7, rect.top - pad);

      const right =
        Math.min(
          innerWidth - 7,
          rect.right + pad
        );

      const bottom =
        Math.min(
          innerHeight - 7,
          rect.bottom + pad
        );

      /*
       * Move the glowing spotlight
       * to the exact Return field.
       */
      Object.assign(
        spotlight.style,
        {
          left:left + 'px',
          top:top + 'px',
          width:
            Math.max(
              36,
              right - left
            ) + 'px',

          height:
            Math.max(
              36,
              bottom - top
            ) + 'px'
        }
      );

      positionFigure(rect);

      const pack =
        TEXT[language] ||
        TEXT.en;

      const copy =
        pack[index] ||
        TEXT.en[index];

      document
        .getElementById('rtTourTitle')
        .textContent =
          copy[0];

      document
        .getElementById('rtTourCopy')
        .textContent =
          copy[1];

      document
        .getElementById('rtTourCount')
        .textContent =
          `${index + 1} / ${steps.length}`;

      document
        .getElementById('rtTourBack')
        .disabled =
          index === 0;

      document
        .getElementById('rtTourNext')
        .textContent =
          index === steps.length - 1
            ? 'Finish'
            : 'Next →';

      document
        .getElementById('rtTourProgress')
        .innerHTML =
          steps
            .map(
              (_, i) =>
                `<span class="${
                  i <= index
                    ? 'done'
                    : ''
                }"></span>`
            )
            .join('');
    }

    function openLanguagePicker() {
      document
        .getElementById('rtGuideOverlay')
        ?.classList.remove('show');

      active = false;
      index = 0;

      layer.classList.add(
        'show',
        'language-pick'
      );

      layer.setAttribute(
        'aria-hidden',
        'false'
      );
    }

    function begin(lang) {
      language =
        ['ms','en','my','zh'].includes(lang)
          ? lang
          : 'en';

      active = true;
      index = 0;

      layer.classList.remove('language-pick');

      renderStep();
    }

    function closeTour() {
      active = false;

      layer.classList.remove(
        'show',
        'language-pick',
        'rt-figure-left',
        'rt-figure-right'
      );

      layer.setAttribute(
        'aria-hidden',
        'true'
      );

      document
        .getElementById('rtModal')
        ?.classList.remove('open');

      const issueBox =
        document.getElementById('rIssueBox');

      const actualDamaged =
        [...document.querySelectorAll(
          '#rItems .cond'
        )].some(
          input => input.value === 'Damaged'
        );

      if (!actualDamaged) {
        issueBox?.classList.remove('show');
      }
    }

    layer
      .querySelectorAll('[data-rt-lang]')
      .forEach(btn => {
        btn.addEventListener('click', () => {
          begin(btn.dataset.rtLang);
        });
      });

    document.getElementById('rtTourLater')
      .onclick = closeTour;

    document.getElementById('rtTourSkip')
      .onclick = closeTour;

    document.getElementById('rtTourBack')
      .onclick = () => {
        if (index > 0) {
          index--;
          renderStep();
        }
      };

    document.getElementById('rtTourNext')
      .onclick = () => {
        if (index >= steps.length - 1) {
          closeTour();
          return;
        }

        index++;
        renderStep();
      };

    window.addEventListener('resize', () => {
      if (active) renderStep();
    });

    /* REPLACE OLD TEXT-ONLY GUIDE BUTTON */
    const guideBtn =
      document.getElementById('rtGuideBtn');

    if (guideBtn) {
      guideBtn.className =
        'btn module-guide-btn';

      guideBtn.textContent =
        '✦ Return Guide';

      guideBtn.onclick = e => {
        e.preventDefault();
        e.stopImmediatePropagation();
        openLanguagePicker();
      };
    }
  }

  const timer = setInterval(() => {
    if (document.getElementById('returnSection')) {
      clearInterval(timer);
      setupReturnV4();
    }
  }, 200);

  setTimeout(() => clearInterval(timer), 10000);
})();
