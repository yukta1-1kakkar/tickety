const panel=Tickety.ui.mount(document.getElementById('insight'));
const environment=document.getElementById('environment');
async function config() {
  const saved=await chrome.storage.local.get('environment');
  environment.value=saved.environment || Tickety.config.defaultEnvironment;
  const c=Tickety.config.environments[environment.value] || Tickety.config.environments.local;
  document.getElementById('open').href=c.web;
}
async function current(inject = false) {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  try {
    if (!tab?.id) throw new Error('No active tab.');
    if (inject) await chrome.scripting.executeScript({target:{tabId:tab.id},files:[
      'config.js','utils/context.js','detectors/genericFlightDetector.js','detectors/googleFlights.js','detectors/detectorManager.js','ui/mascot.js','ui/insightExtras.js','ui/ticketyWidget.js','content.js',
    ]});
    panel.setDetection(await chrome.tabs.sendMessage(tab.id,{type:'CONTEXT'}));
  } catch {
    panel.setDetection({context:{},confidence:'LOW',reason:'No flight detected on this page. Use manual entry, or detect on this page. Browser settings pages cannot be read.'});
  }
}
document.getElementById('manual').addEventListener('click',() => panel.manual());
document.getElementById('detect').addEventListener('click',() => current(true));
environment.addEventListener('change',async () => {await chrome.storage.local.set({environment:environment.value});await config();await current();});
config();current();
