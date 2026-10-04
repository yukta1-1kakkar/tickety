(() => {
  const list=document.getElementById('alerts-list'),status=document.getElementById('alerts-status');
  async function refresh() {
    const response=await chrome.runtime.sendMessage({type:'LIST_ALERTS'});
    if(!response?.ok) {status.textContent=response?.error||'Could not load alerts.';return;}
    list.replaceChildren();
    if(!response.data.length) {list.textContent='No alerts yet. Check a fare to set one.';return;}
    for(const row of response.data) {
      const card=document.createElement('div');card.className='tk-alert-row';
      const title=document.createElement('strong');title.textContent=`${row.origin} → ${row.destination} · ${row.departureDate}`;
      const description=document.createElement('p');description.className='tk-muted';
      description.textContent=`Target ${Tickety.context.money(row.targetFare)} · ${row.status} · ${row.environment}. ${row.lastChecked?`Last checked ${new Date(row.lastChecked).toLocaleString()}.`:'Not checked yet.'}${row.lastFare?` Last observed ${Tickety.context.money(row.lastFare)}.`:''}`;
      const remove=document.createElement('button');remove.type='button';remove.textContent='Remove alert';
      remove.addEventListener('click',async()=>{remove.disabled=true;try {const result=await chrome.runtime.sendMessage({type:'REMOVE_ALERT',id:row.id});if(!result.ok)throw new Error(result.error);await refresh();}catch(error){status.textContent=error.message;remove.disabled=false;}});
      card.append(title,description,remove);list.append(card);
    }
  }
  document.getElementById('enable-alerts').addEventListener('click',async()=>{
    try {
      const granted=await chrome.permissions.request({permissions:['notifications']});
      status.textContent=granted?'Desktop notifications enabled. Alerts remain visible here too.':'Desktop notifications are off. You can still check alerts here.';
    } catch {status.textContent='Could not enable notifications. Check Chrome extension permissions.';}
  });
  document.getElementById('check-alerts').addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;status.textContent='Checking stored fares…';
    try {const response=await chrome.runtime.sendMessage({type:'CHECK_ALERTS'});if(!response.ok)throw new Error(response.error);status.textContent='Checks complete. Browser and operating-system settings may silence notifications.';await refresh();}
    catch(error){status.textContent=error.message;}finally{button.disabled=false;}
  });
  document.addEventListener('tickety-alerts-changed',()=>refresh().catch(()=>{}));
  refresh().catch(()=>{status.textContent='Could not load alerts.';});
})();
