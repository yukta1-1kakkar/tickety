(() => {
  const {money,positive}=Tickety.context;
  function el(tag,text,cls) {const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const distance=(a,b)=>Math.round((Date.parse(a)-Date.parse(b))/86400000);
  const offsetText=(offset,name)=>offset===0?`${name} day`:`${Math.abs(offset)} day${Math.abs(offset)===1?'':'s'} ${offset<0?'before':'after'} ${name}`;
  const shortDate=date=>new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`));
  function grid(data) {
    const grid=el('div',null,'tk-kpis');grid.setAttribute('aria-label','Fare indicators');
    const event=data.eventContext?.event;
    const days=distance(data.departureDate,today());
    const delta=data.differenceFromRange;
    const tiles=[
      ['Fare level',data.priceLevel?`${data.priceLevel} FARE`:'Unavailable',data.priceLevel?.toLowerCase()||'muted',data.classificationBasis==='google_flights_stored_search'?'Google Flights stored-search classification':'Compared with the observed typical range'],
      [event?.travelOffset>0?'Recent event':'Approaching event',event?event.name:data.eventContext?.coverageAvailable?'None nearby':'Calendar unavailable',event?'event':'muted',event?offsetText(event.travelOffset,event.name):'Calendar context, not a demand forecast'],
      ['Booking window',Number.isFinite(days)?days<0?'Past travel date':`${days} days ahead`:'Unavailable','info','Time until your selected departure'],
      ['Typical-range gap',Number.isFinite(delta)?delta===0?'Within range':`${money(Math.abs(delta))} ${delta<0?'below':'above'}`:'Unavailable',delta<0?'low':delta>0?'high':'info','Difference from the closest range boundary'],
    ];
    for(const [title,value,tone,detail] of tiles) {const tile=el('div',null,'tk-kpi');tile.dataset.tone=tone;tile.append(el('span',title),el('strong',value),el('small',detail));grid.append(tile);}
    return grid;
  }
  function notes(body,data) {
    const calendar=data.eventContext, event=calendar?.event;
    if(event) {
      const section=el('section',null,'tk-event-section');section.setAttribute('aria-label','Event travel window');
      const heading=el('div',null,'tk-event-heading');
      heading.append(el('h3',event.name),el('span','7-day fare window'));
      section.append(heading,el('p',`Fares may fluctuate from 3 days before to 3 days after ${event.name}. Compare the full window before booking.`,'tk-event-guidance'));
      const strip=el('div',null,'tk-event-strip');
      for(const day of calendar.days || []) {
        const cell=el('a',null,'tk-event-day');cell.dataset.phase=day.phase;
        const hasFare=positive(day.fare);cell.dataset.fare=hasFare?'available':'unavailable';
        const url=new URL(data.webUrl);url.searchParams.set('date',day.date);cell.href=url.href;cell.target='_blank';cell.rel='noopener noreferrer';
        cell.setAttribute('aria-label',`${day.date}, ${offsetText(day.offset,event.name)}, ${hasFare?money(day.fare):'fare not observed'}`);
        if(day.date===data.departureDate)cell.setAttribute('aria-current','date');
        const dateLabel=el('time',shortDate(day.date));dateLabel.dateTime=day.date;
        cell.append(el('strong',day.offset===0?'Event':`${day.offset>0?'+':''}${day.offset}d`),dateLabel,el('small',hasFare?money(day.fare):'—'));
        strip.append(cell);
      }
      const legend=el('p',null,'tk-event-legend');
      for(const [phase,label] of [['before','Before'],['event','Event'],['after','After']]) {const item=el('span',label);item.dataset.phase=phase;legend.append(item);}
      legend.append(el('span','— Fare unavailable'));
      section.append(strip,legend);
      const observed=(calendar.days||[]).filter(d=>positive(d.fare));
      if(observed.length>=2) {
        const best=observed.reduce((a,b)=>a.fare<=b.fare?a:b);
        section.append(el('p',`Lowest stored fare in this event window: ${money(best.fare)}, ${offsetText(best.offset,event.name)}. These are departure dates, not recommended purchase dates.`, 'tk-muted'));
      }
      const source=el('a','Calendar source ↗','tk-calendar-source');source.href=calendar.sourceUrl||'https://www.india.gov.in/calendar';source.target='_blank';source.rel='noopener noreferrer';section.append(source);
      body.append(section);
    }
    const windows=(data.leadTime||[]).filter(p=>positive(p.fare));
    const note=el('section',null,'tk-booking-note');note.append(el('h3','When to book?'));
    if(windows.length>=2) {
      const best=windows.reduce((a,b)=>a.fare<=b.fare?a:b);
      note.append(el('p',`For this departure, the lowest observed booking-window fare was ${money(best.fare)} at ${best.days} days ahead. Itineraries and observation times may differ; this does not predict the cheapest future booking date.`,'tk-muted'));
    }
    note.append(el('p','Off-hours tip: try comparing fares during quieter hours too. Booking at night is not guaranteed to be cheaper; this dataset does not establish a cheapest hour.','tk-muted'));
    body.append(note);
  }
  function alertForm(body,data) {
    const details=el('details',null,'tk-alert-setup');details.append(el('summary','Set a route fare alert'));
    const form=el('form');form.setAttribute('aria-label','Set route fare alert');
    const label=el('label','Notify when the stored fare is at or below (INR)'),input=el('input');input.type='number';input.required=true;input.min='1';input.max='10000000';input.step='1';
    if(positive(data.currentFare)) input.value=String(Math.round(data.currentFare));label.append(input);
    const submit=el('button','Save alert','tk-primary');submit.type='submit';
    const status=el('p',null,'tk-muted');status.setAttribute('role','status');
    form.append(label,el('p',`${data.route.origin} → ${data.route.destination} · ${data.departureDate}. Checks hourly while Chrome is running. Uses fresh stored observations (up to 48 hours old), not live booking quotes.`, 'tk-muted'),submit,status);
    form.addEventListener('submit',async event=>{
      event.preventDefault();submit.disabled=true;status.textContent='Saving…';
      try {
        const response=await chrome.runtime.sendMessage({type:'SAVE_ALERT',context:{...data.route,departureDate:data.departureDate},targetFare:Number(input.value)});
        if(!response?.ok)throw new Error(response?.error||'Could not save alert.');
        status.textContent='Alert saved. Open the Tickety toolbar popup to manage it and enable desktop notifications.';
        document.dispatchEvent(new Event('tickety-alerts-changed'));
      } catch(error) {status.textContent=error.message;} finally {submit.disabled=false;}
    });
    details.append(form);body.append(details);
  }
  Tickety.extras={grid,notes,alertForm};
})();
