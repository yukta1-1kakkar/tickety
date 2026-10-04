(() => {
  const NAME='tickety-route-alerts';
  const today=() => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  // Serialize storage changes: a poll must never resurrect an alert deleted by a user.
  let queue=Promise.resolve();
  const serial=work => {const next=queue.then(work);queue=next.catch(()=>{});return next;};
  const read=async()=> (await chrome.storage.local.get('fareAlerts')).fareAlerts || [];
  const write=async rows=>chrome.storage.local.set({fareAlerts:rows});
  const key=(c,env)=>`${env}:${c.origin}:${c.destination}:${c.departureDate}`;
  async function schedule() {
    if((await read()).some(r=>r.departureDate>=today())) {
      if(!await chrome.alarms.get(NAME)) await chrome.alarms.create(NAME,{periodInMinutes:60});
    } else await chrome.alarms.clear(NAME);
  }
  function validate(raw, targetFare, env) {
    const c=Tickety.context.normalize(raw);
    if(!Tickety.context.complete(c)||c.departureDate<today()) throw new Error('Choose a valid future route and travel date for an alert.');
    if(!Tickety.context.positive(targetFare)) throw new Error('Enter a positive target fare in INR.');
    if(!Tickety.config.environments[env]) throw new Error('Unknown backend environment.');
    return {origin:c.origin,destination:c.destination,departureDate:c.departureDate,targetFare,environment:env,id:key(c,env)};
  }
  const save=(raw,targetFare,env)=>serial(async()=>{
    const row=validate(raw,targetFare,env), rows=await read();
    const remaining=rows.filter(r=>r.id!==row.id);
    if(remaining.length>=10) throw new Error('You can watch up to 10 route/date pairs. Remove one first.');
    // Resolve the supported route before saving; don't include a user-supplied fare.
    await Tickety.api.fetchInsight(Tickety.config.environments[env].api,row);
    const saved={...row,status:'Watching',lastChecked:null,lastFare:null,lastNotified:null,matched:false};
    await write([...remaining,saved]);await schedule();return saved;
  });
  const remove=id=>serial(async()=>{await write((await read()).filter(r=>r.id!==id));await schedule();return {removed:true};});
  function freshness(data,now=Date.now()) {
    const timestamp=Date.parse(data.collectedAt || (data.observationDate ? `${data.observationDate}T00:00:00+05:30` : ''));
    return Number.isFinite(timestamp) && timestamp<=now+300000 && now-timestamp<=48*3600000;
  }
  const check=()=>serial(async()=>{
    const rows=await read();
    for(const row of rows) {
      if(row.departureDate<today()) {row.status='Expired';continue;}
      try {
        const data=await Tickety.api.fetchInsight(Tickety.config.environments[row.environment].api,row);
        row.lastChecked=new Date().toISOString();row.lastFare=data.storedFare;row.observedAt=data.collectedAt || data.observationDate;
        if(!data.hasData||!Tickety.context.positive(data.storedFare)) {row.status='No observations yet';continue;}
        if(!freshness(data)) {row.status='Waiting for a fresh observation';continue;}
        const matched=data.storedFare<=row.targetFare;
        row.status=matched?'Target reached':'Watching';
        if(matched&&(!row.matched||!row.lastNotified)) {
          const allowed=await chrome.permissions.contains({permissions:['notifications']});
          if(allowed) {
            await chrome.notifications.create(`tickety:${row.id}`,{type:'basic',iconUrl:chrome.runtime.getURL('icons/tickety-128.png'),
              title:`Tickety · ${row.origin} → ${row.destination}`,message:`Stored fare ${Tickety.context.money(data.storedFare)} meets your ${Tickety.context.money(row.targetFare)} target for ${row.departureDate}. Check the live quote before booking.`});
            row.lastNotified=new Date().toISOString();
          }
        }
        row.matched=matched;
      } catch {row.status='Could not check — will retry';row.lastChecked=new Date().toISOString();}
    }
    await write(rows);await schedule();return rows;
  });
  Tickety.alerts={read,save,remove,check,schedule,validate,freshness};
  chrome.alarms?.onAlarm.addListener(alarm=>{if(alarm.name===NAME)check().catch(()=>{});});
  chrome.runtime.onStartup?.addListener(()=>schedule().catch(()=>{}));
  chrome.runtime.onInstalled?.addListener(()=>schedule().catch(()=>{}));
  // Alarms can be cleared by the browser between sessions; restore on worker startup.
  if(chrome.alarms) schedule().catch(()=>{});
})();
