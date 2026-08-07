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
