(function(){
 let promptEvent=null;
 const q=id=>document.getElementById(id),ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;

 function setInstallButton(installed=false){
  const b=q('installAppBtn'); if(!b)return;
  const label=b.querySelector('.install-label');
  b.style.display='';
  b.disabled=false;
  if(installed){
   if(label)label.textContent='App Installed';
   b.setAttribute('aria-label','App already installed');
   b.setAttribute('title','App already installed');
   b.classList.add('is-installed');
  }else{
   if(label)label.textContent='Install App';
   b.setAttribute('aria-label','Install app');
   b.setAttribute('title','Install Warehouse Receiving Sheet');
   b.classList.remove('is-installed');
  }
 }

 function showInstallHelp(installed=false){
  const m=q('installModal'),copy=q('installCopy'),steps=q('installSteps');
  if(!m||!copy||!steps)return;
  if(installed){
   copy.textContent='Warehouse Receiving Sheet is already installed on this device.';
   steps.innerHTML='<li>Open it from your desktop, Start menu, taskbar, or app list.</li><li>You can keep using the same GitHub link for future updates.</li>';
  }else if(ios){
   copy.textContent='On iPhone, use Safari:';
   steps.innerHTML='<li>Tap Share.</li><li>Tap Add to Home Screen.</li><li>Tap Add.</li>';
  }else{
   copy.textContent='Use Chrome or Microsoft Edge:';
   steps.innerHTML='<li>Click Install App when the browser install prompt is available.</li><li>Click Install in the browser confirmation.</li><li>The app will then be available from Windows Start/app list. Desktop shortcut availability depends on the browser.</li>';
  }
  m.classList.add('show');
 }

 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  promptEvent=event;
  setInstallButton(false);
 });

 window.addEventListener('appinstalled',()=>{
  promptEvent=null;
  setInstallButton(true);
 });

 window.addEventListener('DOMContentLoaded',()=>{
  const b=q('installAppBtn'),m=q('installModal'),c=q('installClose');
  setInstallButton(standalone());

  if(b)b.addEventListener('click',async()=>{
   if(standalone()){
    setInstallButton(true);
    showInstallHelp(true);
    return;
   }

   if(promptEvent){
    const event=promptEvent;
    promptEvent=null;
    event.prompt();
    const choice=await event.userChoice.catch(()=>null);
    if(choice&&choice.outcome==='accepted')setInstallButton(true);
    else setInstallButton(false);
    return;
   }

   showInstallHelp(false);
  });

  if(c)c.addEventListener('click',()=>m&&m.classList.remove('show'));
  if(m)m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show')});
  if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(console.warn);
 });
})();

/* =========================================================
   TUTORIAL GUIDE ANTI-BLOCK FIX
   Auto moves Qaiyum figure away from highlighted content.
   ========================================================= */
(function () {
  'use strict';

  const EDGE = 18;
  const GAP = 22;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function overlaps(a, b, gap = 0) {
    if (!a || !b) return false;

    return !(
      a.right + gap <= b.left ||
      a.left - gap >= b.right ||
      a.bottom + gap <= b.top ||
      a.top - gap >= b.bottom
    );
  }

  function visibleRect(el) {
    if (!el) return null;

    const style = getComputedStyle(el);

    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity || '1') === 0
    ) {
      return null;
    }

    const rect = el.getBoundingClientRect();

    if (rect.width < 5 || rect.height < 5) return null;

    return rect;
  }

  function resetMobileGuide(guide) {
    [
      'left',
      'top',
      'right',
      'bottom',
      'width',
      'height',
      'visibility',
      'opacity',
      'transition'
    ].forEach(prop => guide.style.removeProperty(prop));
  }

  function placeTutorialGuide() {
    const layer = document.getElementById('tutorialLayer');
    const guide = document.querySelector('.tutorial-guide-wrap');
    const spotlight = document.getElementById('tutorialSpotlight');
    const dialog = document.querySelector('.tutorial-dialog');

    if (!layer || !guide || !spotlight) return;

    if (!layer.classList.contains('show')) return;

    /* Keep original mobile behaviour */
    if (window.innerWidth <= 680) {
      resetMobileGuide(guide);
      return;
    }

    /* Language selection screen can keep original position */
    if (layer.classList.contains('language-pick')) {
      guide.style.removeProperty('visibility');
      guide.style.removeProperty('opacity');
      return;
    }

    const target = visibleRect(spotlight);

    if (!target) return;

    const dialogRect = visibleRect(dialog);

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const topbar = document.querySelector('.topbar');
    const safeTop = (topbar?.getBoundingClientRect().bottom || 0) + 12;

    let width = clamp(vw * 0.19, 210, 300);
    let height = clamp(vh * 0.62, 330, 560);

    function buildCandidates(w, h) {
      return [
        /* Right of highlighted item */
        {
          left: target.right + GAP,
          top: clamp(
            target.top + target.height / 2 - h / 2,
            safeTop,
            vh - h - EDGE
          ),
          width: w,
          height: h
        },

        /* Left of highlighted item */
        {
          left: target.left - GAP - w,
          top: clamp(
            target.top + target.height / 2 - h / 2,
            safeTop,
            vh - h - EDGE
          ),
          width: w,
          height: h
        },

        /* Top-right */
        {
          left: vw - w - EDGE,
          top: safeTop,
          width: w,
          height: h
        },

        /* Top-left */
        {
          left: EDGE,
          top: safeTop,
          width: w,
          height: h
        },

        /* Bottom-right */
        {
          left: vw - w - EDGE,
          top: vh - h - EDGE,
          width: w,
          height: h
        },

        /* Bottom-left */
        {
          left: EDGE,
          top: vh - h - EDGE,
          width: w,
          height: h
        }
      ];
    }

    function validCandidate(c) {
      if (
        c.left < EDGE ||
        c.top < safeTop ||
        c.left + c.width > vw - EDGE ||
        c.top + c.height > vh - EDGE
      ) {
        return false;
      }

      const rect = {
        left: c.left,
        top: c.top,
        right: c.left + c.width,
        bottom: c.top + c.height
      };

      /* Never cover the thing currently being explained */
      if (overlaps(rect, target, 18)) return false;

      /* Also avoid tutorial text box */
      if (dialogRect && overlaps(rect, dialogRect, 10)) return false;

      return true;
    }

    let candidate = buildCandidates(width, height).find(validCandidate);

    /* Try smaller character if space is tight */
    if (!candidate) {
      width *= 0.78;
      height *= 0.78;

      candidate = buildCandidates(width, height).find(validCandidate);
    }

    /* If there is genuinely no safe space, hide figure for this step.
       Spotlight + tutorial explanation remain visible. */
    if (!candidate) {
      guide.style.visibility = 'hidden';
      guide.style.opacity = '0';
      return;
    }

    guide.style.visibility = 'visible';
    guide.style.opacity = '1';

    guide.style.right = 'auto';
    guide.style.bottom = 'auto';

    guide.style.left = Math.round(candidate.left) + 'px';
    guide.style.top = Math.round(candidate.top) + 'px';
    guide.style.width = Math.round(candidate.width) + 'px';
    guide.style.height = Math.round(candidate.height) + 'px';

    guide.style.transition =
      'left .28s ease, top .28s ease, width .28s ease, height .28s ease, opacity .2s ease';
  }

  let scheduled = false;

  function scheduleGuidePosition() {
    if (scheduled) return;

    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      placeTutorialGuide();
    });
  }

  window.addEventListener('resize', scheduleGuidePosition);
  window.addEventListener('scroll', scheduleGuidePosition, true);

  window.addEventListener('DOMContentLoaded', () => {
    const layer = document.getElementById('tutorialLayer');
    const spotlight = document.getElementById('tutorialSpotlight');

    if (layer) {
      new MutationObserver(scheduleGuidePosition).observe(layer, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    if (spotlight) {
      new MutationObserver(scheduleGuidePosition).observe(spotlight, {
        attributes: true,
        attributeFilter: ['style']
      });
    }

    document.addEventListener('click', () => {
      setTimeout(scheduleGuidePosition, 80);
      setTimeout(scheduleGuidePosition, 350);
    });
  });
})();
