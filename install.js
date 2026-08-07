
(function(){
 let promptEvent=null;
 const q=id=>document.getElementById(id),ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;});
 window.addEventListener('appinstalled',()=>{promptEvent=null;const b=q('installAppBtn');if(b)b.style.display='none';});
 window.addEventListener('DOMContentLoaded',()=>{
  const b=q('installAppBtn'),m=q('installModal'),c=q('installClose'),copy=q('installCopy'),steps=q('installSteps');
  if(standalone()&&b)b.style.display='none';
  if(b)b.addEventListener('click',async()=>{
   if(promptEvent){promptEvent.prompt();await promptEvent.userChoice.catch(()=>null);promptEvent=null;return;}
   copy.textContent=ios?'On iPhone, use Safari:':'Use Chrome or Microsoft Edge:';
   steps.innerHTML=ios?'<li>Tap Share.</li><li>Tap Add to Home Screen.</li><li>Tap Add.</li>':'<li>Open this link in Chrome or Edge.</li><li>Tap Download App again when the install prompt is ready.</li><li>Tap Install.</li>';
   m.classList.add('show');
  });
  if(c)c.addEventListener('click',()=>m.classList.remove('show'));
  if(m)m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show')});
  if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(console.warn);
 });
})();
