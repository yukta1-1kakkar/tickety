const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root=path.join(__dirname,'..');
function load(extra={}) {
  const ctx=vm.createContext({URL,URLSearchParams,Intl,AbortSignal,atob,...extra});
  for (const file of ['config.js','utils/context.js','utils/api.js','detectors/genericFlightDetector.js','detectors/googleFlights.js','detectors/detectorManager.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
  return ctx.Tickety;
}
const T=load();
const c={origin:'DEL',destination:'BOM',departureDate:'2026-10-15',fare:5240,currency:'INR'};
test('IATA codes and city aliases normalize without conflating airports',()=>{
  assert.equal(T.context.airport('New Delhi (DEL)'),'DEL');
  assert.equal(T.context.airport('Bangalore'),'BLR');
  assert.equal(T.context.airport('DEL BOM'),null);
  assert.equal(T.context.airport('Goa'),null);
  assert.equal(T.context.airport('Mopa (GOX)'),'GOX');
  assert.equal(T.context.airport('London'),null);
});
test('date parsing preserves explicit years and rejects guesses',()=>{
  for (const text of ['15 October 2026','Oct 15, 2026','2026-10-15T08:00:00+05:30']) assert.equal(T.context.date(text),'2026-10-15');
  for (const text of ['10/11/26','Oct 15','2026-02-30','not a date']) assert.equal(T.context.date(text),null);
});
test('fare and currency parsing refuses ambiguous quotes',()=>{
  assert.equal(T.context.price('₹5,240').fare,5240);
  assert.equal(T.context.price('INR 1,25,000.50').fare,125000.5);
  assert.equal(T.context.price('$5240').currency,'USD');
  assert.equal(T.context.price('₹5240 and ₹6000').fare,undefined);
  assert.equal(T.context.price('₹0').fare,undefined);
});
test('confidence requires exact context and comparable scope',()=>{
  assert.equal(T.context.confidence(c,true,true),'HIGH');
  assert.equal(T.context.confidence(c,true,false),'MEDIUM');
  assert.equal(T.context.confidence({...c,destination:'DEL'},true,true),'LOW');
});
test('request sends normalized allowlisted context only',()=>{
  const url=new URL(T.api.requestUrl('http://localhost:8000/api',{...c,pageContent:'secret',airline:'private'}));
  assert.equal(url.pathname,'/api/tickety/insights');
  assert.equal(url.searchParams.get('currentFare'),'5240');
  assert.equal([...url.searchParams].length,4);
  assert.throws(()=>T.api.requestUrl('http://localhost:8000/api',{...c,currency:'USD'}),/INR/);
  assert.throws(()=>T.api.requestUrl('http://localhost:8000/api',{...c,origin:''}),/valid route/);
});
test('response parsing never invents missing values or trends',()=>{
  const data=T.api.parse({route:{origin:'DEL',destination:'BOM'},departureDate:c.departureDate,currency:'INR',hasData:false,currentFare:NaN,lowestPrice:0,priceLevel:'BEST',leadTime:[]});
  assert.equal(data.currentFare,null);assert.equal(data.lowestPrice,null);assert.equal(data.priceLevel,null);
  assert.equal(data.leadTime.length,5);assert.ok(data.leadTime.every(p=>p.fare === null));
  assert.throws(()=>T.api.parse({}),/invalid response/);
});
test('deep link uses the existing website route contract',()=>{
  const link=T.api.deepLink('http://localhost:5173',{route:{routeId:'DELHI-MUMBAI'},departureDate:c.departureDate});
  assert.equal(link,'http://localhost:5173/fare?route=DELHI-MUMBAI&date=2026-10-15');
});
test('unsupported routes and backend failures are actionable',async()=>{
  await assert.rejects(T.api.fetchInsight('http://localhost:8000/api',c,async()=>({ok:false,status:404})),/not supported/);
  await assert.rejects(T.api.fetchInsight('http://localhost:8000/api',c,async()=>({ok:false,status:503})),/could not connect/);
  await assert.rejects(T.api.fetchInsight('http://localhost:8000/api',c,async()=>{throw new TypeError('Failed to fetch');}),/backend is running/);
});
function documentFixture({origin='Delhi (DEL)',destination='Mumbai (BOM)',date='Departure October 15, 2026',controls='One way Economy 1 adult',price='₹5,240'}={}) {
  const field=value=>({value,textContent:'',getAttribute:()=>null});
  return {
    querySelector(selector) {
      if (selector.includes('Where from')) return field(origin);
      if (selector.includes('Where to')) return field(destination);
      if (selector.includes('Departure')) return field(date);
      if (selector.includes('aria-selected')) return {textContent:price,getAttribute:()=>null};
      return null;
    },
    querySelectorAll(selector) {
      if(selector.includes('ld+json')) return [];
      if(selector.includes('aria-selected')) return [{textContent:price,getAttribute:()=>null}];
      if(selector.includes('data-selected') || selector.startsWith('li:')) return [];
      return [{textContent:controls,getAttribute:()=>null}];
    },
  };
}
test('Google adapter extracts a comparable explicitly selected flight',()=>{
  const d=T.detectors.detect(documentFixture(),'https://www.google.com/travel/flights');
  assert.equal(d.confidence,'HIGH');assert.equal(d.context.fare,5240);assert.equal(d.context.departureDate,c.departureDate);
});
test('Google adapter downgrades round trips, missing year and conflicting URL',()=>{
  assert.equal(T.googleFlights.detect(documentFixture({controls:'Round trip Economy 1 adult'}),'https://www.google.com/travel/flights').confidence,'MEDIUM');
  assert.equal(T.googleFlights.detect(documentFixture({date:'Oct 15'}),'https://www.google.com/travel/flights').confidence,'LOW');
  assert.equal(T.googleFlights.detect(documentFixture(),'https://www.google.com/travel/flights?origin=BLR').confidence,'LOW');
});
test('Google yearless date agrees with explicit URL year, never wall-clock guessing',()=>{
  const doc=documentFixture({date:'Oct 15'});
  assert.equal(T.googleFlights.detect(doc,'https://www.google.com/travel/flights?q=Flights%20on%20October%2015%202026').context.departureDate,'2026-10-15');
  assert.equal(T.googleFlights.detect(doc,'https://www.google.com/travel/flights?q=Flights%20on%20October%2016%202026').confidence,'LOW');
  const tfs=Buffer.from('data 2026-10-15 segment').toString('base64url');
  assert.equal(T.googleFlights.urlDate(`https://www.google.com/travel/flights?tfs=${tfs}`),'2026-10-15');
  const multi=Buffer.from('2026-10-15 2026-10-20').toString('base64url');
  assert.equal(T.googleFlights.urlDate(`https://www.google.com/travel/flights?tfs=${multi}`),null);
});
test('generic JSON-LD only uses a single Flight object',()=>{
  const f={'@type':'Flight',departureAirport:{iataCode:'DEL'},arrivalAirport:{iataCode:'BOM'},departureTime:'2026-10-15T08:10:00',offers:{price:5240,priceCurrency:'INR'}};
  const doc={querySelectorAll:()=>[{textContent:JSON.stringify(f)}]};
  assert.equal(T.generic.detect(doc,'https://example.com/flights').confidence,'MEDIUM');
  doc.querySelectorAll=()=>[{textContent:JSON.stringify([f,f])}];
  assert.equal(T.generic.detect(doc,'https://example.com/flights').confidence,'LOW');
});
test('background deduplicates concurrent requests and caches by fare too',async()=>{
  let calls=0, handler;
  const ctx=vm.createContext({URL,URLSearchParams,Intl,AbortSignal,Map,Date,
    chrome:{storage:{local:{get:async()=>({environment:'local'})}},runtime:{id:'test',onMessage:{addListener:fn=>handler=fn}}},
    fetch:async()=>{calls++;await new Promise(r=>setTimeout(r,5));return {ok:true,json:async()=>({route:{origin:'DEL',destination:'BOM',routeId:'DELHI-MUMBAI'},departureDate:c.departureDate,currency:'INR',hasData:false})};},
  });
  ctx.importScripts=(...files)=>files.forEach(f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx));
  vm.runInContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),ctx);
  const send=context=>new Promise(resolve=>handler({type:'INSIGHT',context},{id:'test'},resolve));
  const results=await Promise.all([send(c),send(c)]);assert.ok(results.every(r=>r.ok));assert.equal(calls,1);
  await send(c);assert.equal(calls,1);await send({...c,fare:6000});assert.equal(calls,2);
  assert.equal(handler({type:'INSIGHT',context:c},{id:'other'},()=>{}),false);
});

test('route alerts persist, notify once, re-arm after price rises, and ignore stale data',async()=>{
  let stored={}, notices=[], permission=true, currentPrice=5000, observed=new Date().toISOString(), alarm;
  const chrome={storage:{local:{get:async key=>({[key]:stored[key]}),set:async value=>{stored={...stored,...value};}}},
    runtime:{getURL:p=>p,onStartup:{addListener(){}},onInstalled:{addListener(){}}},
    alarms:{get:async()=>alarm,create:async(name,options)=>{alarm={name,...options};},clear:async()=>{alarm=null;},onAlarm:{addListener(){}}},
    permissions:{contains:async()=>permission},notifications:{create:async(id,data)=>notices.push({id,...data})}};
  const ctx=vm.createContext({chrome,URL,URLSearchParams,Intl,AbortSignal,Date});
  for(const f of ['config.js','utils/context.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
  ctx.Tickety.api={fetchInsight:async()=>({hasData:true,storedFare:currentPrice,collectedAt:observed})};
  vm.runInContext(fs.readFileSync(path.join(root,'utils/alerts.js'),'utf8'),ctx);
  const alerts=ctx.Tickety.alerts, future=new Date(Date.now()+10*86400000).toISOString().slice(0,10);
  const route={origin:'DEL',destination:'BOM',departureDate:future};
  const saved=await alerts.save(route,5500,'local');
  assert.equal((await alerts.read()).length,1);assert.equal(alarm.periodInMinutes,60);
  await alerts.check();await alerts.check();assert.equal(notices.length,1);
  currentPrice=6000;await alerts.check();currentPrice=4900;await alerts.check();assert.equal(notices.length,2);
  observed=new Date(Date.now()-72*3600000).toISOString();currentPrice=1000;await alerts.check();
  assert.equal(notices.length,2);assert.equal((await alerts.read())[0].status,'Waiting for a fresh observation');
  await alerts.remove(saved.id);assert.equal((await alerts.read()).length,0);assert.equal(alarm,null);
  await assert.rejects(alerts.save({...route,departureDate:'2020-01-01'},5500,'local'),/future/);
  await assert.rejects(alerts.save(route,0,'local'),/positive/);
  await assert.rejects(alerts.save(route,5500,'invalid'),/environment/);
  permission=false;observed=new Date().toISOString();await alerts.save(route,5500,'local');await alerts.check();assert.equal(notices.length,2);
  permission=true;await alerts.check();assert.equal(notices.length,3);
});
