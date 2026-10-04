(() => {
  const {money, complete, normalize, positive} = Tickety.context;
  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function button(text, action, primary = false) {
    const node = el('button',text,primary ? 'tk-primary' : '');
    node.type = 'button'; node.addEventListener('click',action); return node;
  }
  function brand(mascot) {
    const label=el('span',null,'tk-brand');
    label.append(mascot.element,document.createTextNode('tickety.'));return label;
  }
  function mount(root, {floating = false, onDismiss = () => {}} = {}) {
    root.className = `tk-root${floating ? ' tk-floating' : ''}`;
    let detection = {context:{},confidence:'LOW'}, expanded = !floating, version = 0, mascot;
    const clear = () => {mascot?.destroy();mascot=null;root.replaceChildren();};
    const card = (state = 'idle') => {
      clear();
      mascot=Tickety.mascot.create(state);
      const body = el('section',null,'tk-card');
      body.setAttribute('aria-label','Tickety airfare intelligence');
      const header = el('div',null,'tk-header');
      header.append(brand(mascot));
      if (floating) {
        const close = button('−',() => { expanded=false; version++; render(); });
        close.setAttribute('aria-label','Collapse Tickety'); header.append(close);
      }
      body.append(header); root.append(body); return body;
    };
    function route(body,context) {
      body.append(el('h2',`${context.origin} → ${context.destination}`),el('p',context.departureDate,'tk-muted'));
    }
    function trend(body,data) {
      const points = (data.leadTime || []).filter(p => positive(p.fare));
      const details = el('details'), summary = el('summary','How fares change'); details.append(summary);
      if (points.length < 2) details.append(el('p','Not enough observations to show a trend.','tk-muted'));
      else {
        const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        const days = Math.round((Date.parse(data.departureDate)-Date.parse(today))/86400000);
        details.append(el('p',`Your booking window: ${days} days before departure.`, 'tk-muted'));
        const chart = el('div',null,'tk-chart'); chart.setAttribute('role','img');
        chart.setAttribute('aria-label',`Stored route minima by days before departure: ${data.leadTime.map(p => `${p.days} days: ${money(p.fare)}`).join('; ')}`);
        const max = Math.max(...points.map(p => p.fare));
        for (const p of data.leadTime) {
          const cell = el('div'); cell.setAttribute('aria-current',String(days === p.days));
          cell.append(el('span',positive(p.fare) ? money(p.fare) : '—'));
          if (positive(p.fare)) { const bar = el('span',null,'tk-bar'); bar.style.height = `${p.fare/max*72}px`; cell.append(bar); }
          cell.append(el('span',`${p.days}d`)); chart.append(cell);
        }
        details.append(chart,el('p','Observed route minima; itineraries may differ. Missing windows are not estimated.','tk-muted'));
      }
      body.append(details);
    }
    function result(data) {
      const body = card(data.hasData ? 'ready' : 'unavailable'); route(body,{...data.route,departureDate:data.departureDate});
      body.append(el('p',data.fareSource === 'provided' ? 'Fare you supplied · INR' : 'Latest stored fare · INR','tk-muted'));
      body.append(el('div',money(data.currentFare),'tk-fare'));
      body.append(Tickety.extras.grid(data));
      if (!data.hasData) body.append(el('p',"Price insight isn't available for this route and date yet.",'tk-error'));
      const dl = el('dl');
      dl.append(el('dt','Observed typical range'),el('dd',data.typicalPriceRange ? `${money(data.typicalPriceRange.low)} – ${money(data.typicalPriceRange.high)}` : 'Unavailable'),
        el('dt','Lowest stored observation'),el('dd',money(data.lowestPrice)));
      body.append(dl);
      const diff = data.differenceFromRange;
      if (data.classificationBasis === 'observed_typical_range' && Number.isFinite(diff)) {
        body.append(el('p',diff < 0 ? `${money(-diff)} below the observed typical range.` : diff > 0 ? `${money(diff)} above the observed typical range.` : 'Within the observed typical range.'));
      } else if (data.classificationBasis === 'google_flights_stored_search') body.append(el('p','Google Flights classification from the stored search.','tk-muted'));
      body.append(el('p','One-way · Economy · One adult · City-pair context','tk-muted'));
      if (data.hasData) {
        body.append(el('p',`Google Flights via SerpAPI. Observed ${data.collectedAt || data.observationDate || 'time unavailable'}. Stored observations may differ from live quotes.`, 'tk-muted'));
        trend(body,data);
      }
      Tickety.extras.notes(body,data);
      Tickety.extras.alertForm(body,data);
      const link = el('a','View full Tickety analysis ↗','tk-link'); link.href=data.webUrl; link.target='_blank'; link.rel='noopener noreferrer'; body.append(link);
      body.append(button('Change flight',manual));
    }
    async function check(context) {
      const c = normalize(context);
      if (!complete(c)) { manual(); return; }
      const id = ++version, body = card('checking'); route(body,c);
      const status = el('p','Retrieving stored fare intelligence…'); status.setAttribute('role','status'); body.append(status);
      try {
        const response = await chrome.runtime.sendMessage({type:'INSIGHT',context:c});
        if (id !== version) return;
        if (!response?.ok) throw new Error(response?.error || 'Tickety could not connect to airfare intelligence.');
        result(response.data);
      } catch (error) {
        if (id !== version) return;
        mascot?.setState('error');
        status.textContent = error.message || 'Tickety could not connect. Reload the extension and page.';
        status.className = 'tk-error'; status.setAttribute('role','alert');
        body.append(button('Try again',() => check(c)),button('Change flight',manual));
      }
    }
    function manual() {
      version++; expanded=true;
      const body=card(); body.append(el('h2','Check a fare'),el('p','One-way economy travel for one adult. Enter airport codes or city names.','tk-muted'));
      const form=el('form'); form.setAttribute('aria-label','Manual flight search');
      const fields={};
      for (const [key,label,type] of [['origin','From','text'],['destination','To','text'],['departureDate','Departure date','date'],['fare','Current fare in INR (optional)','number']]) {
        const wrapper=el('label',label), input=el('input'); input.name=key; input.type=type;
        if (key !== 'fare') input.required=true;
        else {input.min='1';input.max='10000000';input.step='0.01';}
        if (type === 'text') input.maxLength=80;
        input.value = key === 'fare' && detection.context.currency !== 'INR' ? '' : detection.context[key] || '';
        wrapper.append(input); form.append(wrapper); fields[key]=input;
      }
      const status=el('p',null,'tk-error'); status.setAttribute('role','alert');
      const submit=el('button','Check Fare','tk-primary'); submit.type='submit'; form.append(status,submit);
      form.addEventListener('submit',event => {
        event.preventDefault();
        const raw=Object.fromEntries(Object.entries(fields).map(([k,v]) => [k,v.value]));
        const c=normalize({...raw,fare:raw.fare ? Number(raw.fare) : undefined,currency:'INR'});
        if (!complete(c)) { status.textContent='Enter two different recognized airports and a valid date. Use airport codes for Goa (GOI or GOX).'; return; }
        detection={context:c,confidence:'HIGH'}; check(c);
      });
      body.append(form);
    }
    function render() {
      if (!expanded) {
        clear(); const bubble=el('div',null,'tk-bubble');
        mascot=Tickety.mascot.create(detection.confidence === 'LOW' ? 'idle' : 'detected');
        const open=button('',() => {expanded=true;render();}); open.setAttribute('aria-expanded','false');
        open.setAttribute('aria-label','Open Tickety airfare assistant');open.title='Tickety · Check your fare';open.append(mascot.element);
        const dismiss=button('×',() => {version++; clear(); onDismiss();}); dismiss.setAttribute('aria-label','Dismiss Tickety for this page');
        bubble.append(open,dismiss);root.append(bubble);return;
      }
      if (detection.confidence === 'HIGH' && complete(detection.context)) {check(detection.context);return;}
      const body=card(detection.confidence === 'MEDIUM' ? 'detected' : 'unavailable');
      body.append(el('h2',detection.confidence === 'MEDIUM' ? 'We found a possible flight.' : "We couldn't confidently detect your flight."));
      if (complete(detection.context)) route(body,detection.context);
      body.append(el('p',detection.reason || 'Enter your flight details to check a fare.','tk-muted'));
      const actions=el('div',null,'tk-actions');
      // Confirm scope as well as route. Never compare a round-trip or foreign-currency total.
      if (detection.confidence === 'MEDIUM') {
        const label=el('label'), confirm=el('input'); confirm.type='checkbox';
        label.append(confirm,document.createTextNode('This is one-way economy for one adult.'));body.append(label);
        const yes=button("Yes, that's my flight",() => {if (confirm.checked) check(detection.context);else confirm.reportValidity();},true);
        confirm.required=true;actions.append(yes);
      }
      actions.append(button('Enter flight manually',manual));body.append(actions);
    }
    return {setDetection(value) {version++;detection=value || {context:{},confidence:'LOW'};render();}, manual,
      expand() {expanded=true;render();}, destroy() {version++;clear();}};
  }
  Tickety.ui = {mount};
})();
