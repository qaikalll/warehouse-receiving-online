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
   TUTORIAL STABLE LAYOUT V2
   - Tutorial box avoids highlighted content
   - Qaiyum figure NEVER disappears
   - Stable dock: no jumping during scroll
   ========================================================= */
(function () {
  'use strict';

  const CLASS = 'tutorial-stable-v2';
  const STYLE_ID = 'tutorial-stable-v2-style';
  const EDGE = 18;
  const GAP = 20;

  let lastDialog = '';
  let lastGuide = '';
  let timer1 = null;
  let timer2 = null;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;

    style.textContent = `
      @media (min-width:681px) {

        .tutorial-layer.${CLASS} .tutorial-dialog {
          left:var(--v2-dialog-left,18px)!important;
          top:var(--v2-dialog-top,100px)!important;
          right:auto!important;
          bottom:auto!important;

          transition:
            left .48s cubic-bezier(.2,.8,.2,1),
            top .48s cubic-bezier(.2,.8,.2,1)!important;

          transform:translate3d(0,0,0)!important;
          will-change:left,top;
        }

        .tutorial-layer.${CLASS} .tutorial-guide-wrap {
          left:var(--v2-guide-left,auto)!important;
          top:var(--v2-guide-top,auto)!important;
          right:auto!important;
          bottom:auto!important;

          width:var(--v2-guide-width,220px)!important;
          height:var(--v2-guide-height,420px)!important;

          visibility:visible!important;
          opacity:1!important;

          animation:none!important;

          transition:
            left .58s cubic-bezier(.2,.8,.2,1),
            top .58s cubic-bezier(.2,.8,.2,1),
            width .4s ease,
            height .4s ease!important;

          transform:translate3d(0,0,0)!important;
          will-change:left,top;
        }

        .tutorial-layer.${CLASS} .tutorial-guide {
          visibility:visible!important;
          opacity:1!important;
        }
      }
    `;

    document.head.appendChild(style);
  }


  function makeRect(c) {
    return {
      left:c.left,
      top:c.top,
      right:c.left + c.width,
      bottom:c.top + c.height,
      width:c.width,
      height:c.height
    };
  }


  function overlap(a,b,gap=0) {

    const left = Math.max(a.left,b.left-gap);
    const right = Math.min(a.right,b.right+gap);

    const top = Math.max(a.top,b.top-gap);
    const bottom = Math.min(a.bottom,b.bottom+gap);

    if (right <= left || bottom <= top) return 0;

    return (right-left)*(bottom-top);
  }


  function distance(a,b) {

    const ax=(a.left+a.right)/2;
    const ay=(a.top+a.bottom)/2;

    const bx=(b.left+b.right)/2;
    const by=(b.top+b.bottom)/2;

    return Math.hypot(ax-bx,ay-by);
  }


  function corners(width,height,safeTop,vw,vh) {

    const right = Math.max(
      EDGE,
      vw-width-EDGE
    );

    const bottom = Math.max(
      safeTop,
      vh-height-EDGE
    );

    return [

      {
        key:'TL',
        left:EDGE,
        top:safeTop,
        width,
        height
      },

      {
        key:'TR',
        left:right,
        top:safeTop,
        width,
        height
      },

      {
        key:'BL',
        left:EDGE,
        top:bottom,
        width,
        height
      },

      {
        key:'BR',
        left:right,
        top:bottom,
        width,
        height
      }

    ];
  }


  function choose(candidates,target,avoid,last) {

    const scored = candidates.map(c => {

      const r=makeRect(c);

      let obstruction =
        overlap(r,target,GAP)*100;

      avoid.forEach(x=>{
        obstruction += overlap(r,x,14)*10;
      });

      return {
        c,
        r,
        obstruction,
        distance:distance(r,target)
      };

    });


    /* Keep same corner if it is still safe.
       This prevents jumping between every step. */

    const old = scored.find(x=>x.c.key===last);

    if(old && old.obstruction===0){
      return old.c;
    }


    const clear = scored
      .filter(x=>x.obstruction===0)
      .sort((a,b)=>b.distance-a.distance);

    if(clear.length){
      return clear[0].c;
    }


    /* If all corners are tight, choose the one covering
       the smallest amount instead of hiding anything. */

    scored.sort((a,b)=>{

      if(a.obstruction!==b.obstruction){
        return a.obstruction-b.obstruction;
      }

      return b.distance-a.distance;

    });

    return scored[0].c;
  }


  function layoutTutorial() {

    const layer =
      document.getElementById('tutorialLayer');

    const spotlight =
      document.getElementById('tutorialSpotlight');

    const dialog =
      document.querySelector('.tutorial-dialog');

    const guide =
      document.querySelector('.tutorial-guide-wrap');


    if(!layer || !spotlight || !dialog || !guide){
      return;
    }


    /* Keep original mobile design */

    if(
      innerWidth<=680 ||
      !layer.classList.contains('show') ||
      layer.classList.contains('language-pick')
    ){

      layer.classList.remove(CLASS);
      return;
    }


    addStyle();

    layer.classList.add(CLASS);


    const t=spotlight.getBoundingClientRect();

    if(t.width<10 || t.height<10){
      return;
    }


    const target={

      left:t.left,
      top:t.top,

      right:t.right,
      bottom:t.bottom,

      width:t.width,
      height:t.height

    };


    const vw=innerWidth;
    const vh=innerHeight;


    const topbar =
      document.querySelector('.topbar');

    const safeTop =
      Math.max(
        EDGE,
        (topbar?.getBoundingClientRect().bottom || 0)+14
      );


    /* =================================
       TUTORIAL TEXT BOX
       ================================= */


    const currentDialog =
      dialog.getBoundingClientRect();


    const dw =
      Math.min(
        currentDialog.width || 560,
        vw-(EDGE*2)
      );


    const dh =
      Math.min(
        currentDialog.height || 260,
        vh-safeTop-EDGE
      );


    const dialogOptions =
      corners(
        dw,
        dh,
        safeTop,
        vw,
        vh
      );


    const dialogDock =
      choose(
        dialogOptions,
        target,
        [],
        lastDialog
      );


    lastDialog =
      dialogDock.key;


    layer.style.setProperty(
      '--v2-dialog-left',
      Math.round(dialogDock.left)+'px'
    );


    layer.style.setProperty(
      '--v2-dialog-top',
      Math.round(dialogDock.top)+'px'
    );


    const dialogRect =
      makeRect(dialogDock);


    /* =================================
       QAIYUM FIGURE
       ================================= */


    let gw =
      clamp(
        vw*.17,
        170,
        260
      );


    let gh =
      clamp(
        vh*.46,
        310,
        500
      );


    let guideOptions =
      corners(
        gw,
        gh,
        safeTop,
        vw,
        vh
      );


    let guideDock =
      choose(
        guideOptions,
        target,
        [dialogRect],
        lastGuide
      );


    let guideRect =
      makeRect(guideDock);


    /* If space is tight,
       shrink the figure slightly.
       NEVER hide it. */

    const figureArea =
      guideRect.width *
      guideRect.height;


    const badOverlap =
      overlap(
        guideRect,
        target,
        GAP
      );


    const dialogOverlap =
      overlap(
        guideRect,
        dialogRect,
        14
      );


    if(
      badOverlap > figureArea*.08 ||
      dialogOverlap > figureArea*.08
    ){

      gw =
        clamp(
          gw*.78,
          145,
          210
        );


      gh =
        clamp(
          gh*.78,
          260,
          390
        );


      guideOptions =
        corners(
          gw,
          gh,
          safeTop,
          vw,
          vh
        );


      guideDock =
        choose(
          guideOptions,
          target,
          [dialogRect],
          lastGuide
        );

    }


    lastGuide =
      guideDock.key;


    layer.style.setProperty(
      '--v2-guide-left',
      Math.round(guideDock.left)+'px'
    );


    layer.style.setProperty(
      '--v2-guide-top',
      Math.round(guideDock.top)+'px'
    );


    layer.style.setProperty(
      '--v2-guide-width',
      Math.round(guideDock.width)+'px'
    );


    layer.style.setProperty(
      '--v2-guide-height',
      Math.round(guideDock.height)+'px'
    );

  }


  function scheduleLayout(){

    clearTimeout(timer1);
    clearTimeout(timer2);


    /*
      Don't recalculate continuously while page is scrolling.
      Wait for target movement to settle.
    */

    timer1=setTimeout(
      layoutTutorial,
      140
    );


    timer2=setTimeout(
      layoutTutorial,
      560
    );

  }


  function start(){

    addStyle();


    const layer =
      document.getElementById('tutorialLayer');


    const spotlight =
      document.getElementById('tutorialSpotlight');


    if(!layer || !spotlight){
      return;
    }


    new MutationObserver(
      scheduleLayout
    ).observe(
      layer,
      {
        attributes:true,
        attributeFilter:['class']
      }
    );


    new MutationObserver(
      scheduleLayout
    ).observe(
      spotlight,
      {
        attributes:true,
        attributeFilter:['style']
      }
    );


    spotlight.addEventListener(
      'transitionend',
      scheduleLayout
    );


    window.addEventListener(
      'resize',
      scheduleLayout
    );


    /*
      IMPORTANT:
      No continuous scroll listener here.
      This is what stops the jumping.
    */


    document.addEventListener(
      'click',
      function(e){

        if(
          e.target.closest(
            '.tutorial-action,'+
            '.module-guide-btn,'+
            '.guide-launch,'+
            '.language-option'
          )
        ){
          scheduleLayout();
        }

      }
    );


    scheduleLayout();

  }


  if(document.readyState==='loading'){

    document.addEventListener(
      'DOMContentLoaded',
      start
    );

  }else{

    start();

  }

})();
