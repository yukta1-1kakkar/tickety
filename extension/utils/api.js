(() => {
  const { normalize, complete, positive } = Tickety.context;
  function requestUrl(base, raw) {
    const c = normalize(raw);
    if (!complete(c)) throw new Error('Enter a valid route and departure date.');
    if (c.fare && c.currency !== 'INR') throw new Error('Fare comparison currently supports INR only.');
    const params = new URLSearchParams({ origin: c.origin, destination: c.destination, departureDate: c.departureDate });
    if (c.fare) params.set('currentFare', String(c.fare));
    return `${base}/tickety/insights?${params}`;
  }
  function parse(data) {
    if (!data || !data.route || !complete({...data.route, departureDate:data.departureDate}) || data.currency !== 'INR' || typeof data.hasData !== 'boolean') throw new Error('Tickety received an invalid response.');
    const typical = data.typicalPriceRange;
    return {...data, currentFare:positive(data.currentFare), storedFare:positive(data.storedFare), lowestPrice:positive(data.lowestPrice),
      priceLevel:['LOW','TYPICAL','HIGH'].includes(data.priceLevel) ? data.priceLevel : null,
      typicalPriceRange:positive(typical?.low) && positive(typical?.high) && typical.low <= typical.high ? typical : null,
      leadTime:[60,30,15,7,1].map(days => ({days, fare:positive(data.leadTime?.find(p => p.days === days)?.fare)}))};
  }
  function deepLink(base, data) {
    if (!/^[A-Z][A-Z_-]{1,49}$/.test(data?.route?.routeId || '') || !Tickety.context.date(data?.departureDate)) throw new Error('A valid route is needed to open Tickety.');
    return `${base}/fare?${new URLSearchParams({route:data.route.routeId, date:data.departureDate})}`;
  }
  async function fetchInsight(base, c, fetcher = fetch) {
    const url=requestUrl(base,c);
    let response;
    try {
      response = await fetcher(url, { headers:{Accept:'application/json'}, credentials:'omit', referrerPolicy:'no-referrer', signal:AbortSignal.timeout(Tickety.config.timeoutMs) });
    } catch(error) {
      throw new Error(error.name === 'TimeoutError' ? 'Tickety timed out. Please try again.' : 'Tickety could not connect to airfare intelligence. Check that the selected backend is running.');
    }
    if (!response.ok) throw new Error(response.status === 404 ? 'This route direction is not supported yet.' : response.status === 422 ? 'Check the route, date, and fare.' : 'Tickety could not connect to airfare intelligence.');
    return parse(await response.json());
  }
  Tickety.api = {requestUrl, parse, deepLink, fetchInsight};
})();
