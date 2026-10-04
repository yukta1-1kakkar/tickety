(() => {
  function structured(doc) {
    const flights = [];
    function walk(value, depth = 0) {
      if (!value || depth > 8) return;
      if (Array.isArray(value)) { value.slice(0,50).forEach(v => walk(v,depth+1)); return; }
      if (typeof value !== 'object') return;
      if ([value['@type']].flat().includes('Flight')) flights.push(value);
      if (value['@graph']) walk(value['@graph'],depth+1);
      if (value.itemListElement) walk(value.itemListElement,depth+1);
      if (value.item) walk(value.item,depth+1);
    }
    for (const node of [...doc.querySelectorAll('script[type="application/ld+json"]')].slice(0,10)) {
      if (node.textContent.length > 100000) continue;
      try { walk(JSON.parse(node.textContent)); } catch { /* Malformed host data is not executable. */ }
    }
    // Multiple flights are ambiguous. Never silently pick one.
    if (flights.length !== 1) return {};
    const f = flights[0], offer = Array.isArray(f.offers) ? null : f.offers;
    return {origin:f.departureAirport?.iataCode || f.departureAirport?.name,
      destination:f.arrivalAirport?.iataCode || f.arrivalAirport?.name,
      departureDate:f.departureTime, departureTime:f.departureTime, arrivalTime:f.arrivalTime,
      airline:f.provider?.name || f.airline?.name, flightNumber:f.flightNumber,
      fare:offer ? Number(offer.price) : undefined, currency:offer?.priceCurrency};
  }
  function detect(doc, url) {
    const parsed = new URL(url), p = parsed.searchParams;
    const json = structured(doc);
    const raw = {...json, origin:json.origin || p.get('origin') || p.get('from'),
      destination:json.destination || p.get('destination') || p.get('to'),
      departureDate:json.departureDate || p.get('departureDate') || p.get('departure_date') || p.get('date')};
    const context = Tickety.context.normalize(raw);
    return {context, confidence:Tickety.context.confidence(context), site:'Generic detection',
      reason:'Confirm a one-way economy fare for one adult in INR. Generic detection is experimental.'};
  }
  Tickety.generic = {detect, structured};
})();
