(() => {
  // Accessible labels first. Keep assumptions localized; Google changes its UI.
  const selectors = {
    origin: ['input[aria-label*="Where from"]','input[placeholder*="Where from"]','input[aria-label="Origin"]'],
    destination: ['input[aria-label*="Where to"]','input[placeholder*="Where to"]','input[aria-label="Destination"]'],
    date: ['input[aria-label*="Departure"]','input[placeholder="Departure"]','button[aria-label*="Departure"]'],
    selected: ['[role="listitem"][aria-selected="true"]','[data-selected-flight="true"]','li:has([aria-expanded="true"])'],
    controls: '[role="combobox"], [role="button"][aria-label], button[aria-label]',
  };
  function urlDate(url) {
    const params=new URL(url).searchParams;
    const explicit=Tickety.context.date(params.get('q'));
    const encoded=params.get('tfs');
    if (encoded && encoded.length < 12000) {
      try {
        const text=atob(encoded.replaceAll('-','+').replaceAll('_','/'));
        const dates=[...new Set(text.match(/\d{4}-\d{2}-\d{2}/g) || [])].filter(Tickety.context.date);
        // Multiple dates may be return/multi-city segments. Do not guess which applies.
        if (dates.length === 1) return dates[0];
        if (dates.length > 1) return null;
      } catch { /* Undocumented URL encoding: fail closed. */ }
    }
    return explicit;
  }
  function field(doc, choices) {
    for (const selector of choices) {
      const node = doc.querySelector(selector);
      if (node) return [node.value, node.getAttribute('aria-label'),node.getAttribute('data-date'),node.textContent].filter(Boolean).join(' ');
    }
    return '';
  }
  function detect(doc, url) {
    const fallback = Tickety.generic.detect(doc,url);
    const origin = Tickety.context.airport(field(doc,selectors.origin));
    const destination = Tickety.context.airport(field(doc,selectors.destination));
    const dateField = field(doc,selectors.date);
    const fromUrl = urlDate(url);
    // Google's visible English field often omits the year. Recover it only
    // from an explicit URL date AND require month/day agreement with the field.
    const dateText = doc.querySelector('input[aria-label="Departure"]')?.value || dateField;
    const departureDate = Tickety.context.date(dateField) || (fromUrl && Tickety.context.date(`${dateText} ${fromUrl.slice(0,4)}`) === fromUrl ? fromUrl : null);
    // URL/structured context must agree with explicit search controls when both exist.
    const conflict = Object.entries({origin,destination,departureDate}).some(([key,value]) => value && fallback.context[key] && value !== fallback.context[key]);
    const selected = selectors.selected.map(s => [...doc.querySelectorAll(s)]).find(nodes => nodes.length === 1)?.[0];
    const quote = selected ? Tickety.context.price((selected.getAttribute('aria-label') || selected.textContent || '').slice(0,3000)) : {};
    const context = Tickety.context.normalize({...fallback.context, origin:origin || fallback.context.origin,
      destination:destination || fallback.context.destination, departureDate:departureDate || fallback.context.departureDate,
      ...quote});
    const controls = [...doc.querySelectorAll(selectors.controls)].slice(0,80)
      .map(n => `${n.getAttribute('aria-label') || ''} ${n.textContent || ''}`).join(' ').slice(0,10000);
    const comparable = /one[ -]way/i.test(controls) && /\beconomy\b/i.test(controls)
      && !/premium economy|business|first class|round[ -]trip|multi[ -]city/i.test(controls)
      && /\b1 (?:adult|passenger)\b/i.test(controls) && !/\b[2-9] (?:adult|passenger)|\b[1-9] (?:child|infant)/i.test(controls);
    return {context:conflict ? {} : context, site:'Google Flights',
      confidence:conflict ? 'LOW' : Tickety.context.confidence(context,!!(origin && destination && departureDate),comparable),
      reason:conflict ? 'The search controls and page context disagree. Please enter your flight.' : 'Compare one-way economy travel for one adult in INR. Confirm the date and fare before checking.'};
  }
  Tickety.googleFlights = {detect,selectors,urlDate};
})();
