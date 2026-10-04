(() => {
  const cities = {
    DEL: ['Delhi', 'New Delhi'], BOM: ['Mumbai', 'Bombay'], BLR: ['Bengaluru', 'Bangalore'],
    HYD: ['Hyderabad'], CCU: ['Kolkata', 'Calcutta'], PNQ: ['Pune'], GOI: ['Dabolim'],
    GOX: ['Mopa'], AMD: ['Ahmedabad'], MAA: ['Chennai', 'Madras'], SXR: ['Srinagar'],
    GAU: ['Guwahati'], PAT: ['Patna'], LKO: ['Lucknow'], COK: ['Kochi', 'Cochin'],
  };
  function airport(value) {
    const text = String(value || '').trim();
    const codes = Object.keys(cities).filter(code => new RegExp(`\\b${code}\\b`, 'i').test(text));
    if (codes.length) return codes.length === 1 ? codes[0] : null;
    const matches = Object.entries(cities).filter(([, names]) => names.some(name => new RegExp(`\\b${name}\\b`, 'i').test(text)));
    return matches.length === 1 ? matches[0][0] : null;
  }
  function date(value) {
    const text = String(value || '').trim();
    let iso = text.match(/\b(\d{4}-\d{2}-\d{2})(?:T|\b)/)?.[1];
    if (!iso) {
      const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      const m = text.match(/\b(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})\b/i);
      const n = text.match(/\b([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/i);
      const day = m?.[1] || n?.[2], month = months.indexOf((m?.[2] || n?.[1] || '').slice(0,3).toLowerCase());
      if (day && month >= 0) iso = `${m?.[3] || n?.[3]}-${String(month+1).padStart(2,'0')}-${day.padStart(2,'0')}`;
    }
    if (!iso) return null;
    const parsed = new Date(iso);
    return Number.isFinite(+parsed) && parsed.toISOString().slice(0,10) === iso ? iso : null;
  }
  const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 10000000 ? value : null;
  function price(text) {
    // Do not choose the cheapest number on a results page or confuse USD with INR.
    const source = String(text || '');
    const matches = [...source.matchAll(/(₹|INR|Rs\.?|US\$|USD|\$|EUR|€|GBP|£)\s*([\d,]+(?:\.\d{1,2})?)/gi)];
    const values = matches.map(m => ({fare: positive(Number(m[2].replaceAll(',',''))), currency: /^(₹|INR|Rs\.?)$/i.test(m[1]) ? 'INR' : /EUR|€/.test(m[1]) ? 'EUR' : /GBP|£/.test(m[1]) ? 'GBP' : 'USD'})).filter(p => p.fare);
    const unique = [...new Map(values.map(p => [`${p.currency}:${p.fare}`, p])).values()];
    return unique.length === 1 ? unique[0] : {};
  }
  function normalize(raw = {}) {
    const result = { origin: airport(raw.origin), destination: airport(raw.destination), departureDate: date(raw.departureDate) };
    if (positive(raw.fare)) result.fare = raw.fare;
    if (/^[A-Z]{3}$/.test(raw.currency || '')) result.currency = raw.currency;
    for (const key of ['airline','flightNumber','departureTime','arrivalTime']) {
      if (typeof raw[key] === 'string' && raw[key].trim()) result[key] = raw[key].trim().slice(0,100);
    }
    for (const key of ['durationMinutes','stops']) if (Number.isInteger(raw[key]) && raw[key] >= 0) result[key] = raw[key];
    return result;
  }
  const complete = c => !!(c?.origin && c?.destination && c.origin !== c.destination && date(c.departureDate));
  const confidence = (c, strong = false, comparable = false) => !complete(c) ? 'LOW' : strong && comparable ? 'HIGH' : 'MEDIUM';
  const money = n => positive(n) ? new Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0}).format(n) : 'Unavailable';
  Tickety.context = { airport, date, price, positive, normalize, complete, confidence, money, cities };
})();
