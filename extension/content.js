(() => {
  if (globalThis.__ticketyContent) return;
  globalThis.__ticketyContent = true;
  let host, widget, detection, lastKey='', dismissed=false, lastUrl=location.href, timer, lastScan=0;
  function create() {
    host=document.createElement('div');host.id='tickety-extension-root';
    host.style.setProperty('all','initial','important');
    const shadow=host.attachShadow({mode:'open'}), style=document.createElement('link');
    style.rel='stylesheet';style.href=chrome.runtime.getURL('ui/ticketyWidget.css');
    const root=document.createElement('div');shadow.append(style,root);document.documentElement.append(host);
    widget=Tickety.ui.mount(root,{floating:true,onDismiss:() => {dismissed=true;}});
  }
  function scan() {
    lastScan=Date.now();
    if (location.href !== lastUrl) {lastUrl=location.href;dismissed=false;lastKey='';}
    try {detection=Tickety.detectors.detect(document,location.href);} catch {detection={context:{},confidence:'LOW'};}
    const key=JSON.stringify(detection);
    if (key === lastKey || dismissed) return;
    lastKey=key;
    // An uncertain Google search gets a manual-entry bubble; generic pages are user-invoked only.
    if (!widget) create();
    widget.setDetection(detection);
  }
  function schedule() {clearTimeout(timer);timer=setTimeout(scan,Math.max(700,2500-(Date.now()-lastScan)));}
  const observer=new MutationObserver(records => {
    if (records.some(r => !host?.contains(r.target))) schedule();
  });
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['value','aria-label','aria-selected','data-date']});
  document.addEventListener('change',schedule,true);
  window.addEventListener('popstate',schedule);
  window.addEventListener('hashchange',schedule);
  chrome.runtime.onMessage.addListener((message,_sender,respond) => {
    if (message.type === 'CONTEXT') {scan();respond(detection);}
    if (message.type === 'SHOW') {dismissed=false;scan();widget?.expand();respond({ok:true});}
  });
  scan();
})();
