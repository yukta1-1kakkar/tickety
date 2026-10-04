const {test,expect,chromium}=require('../../frontend/node_modules/@playwright/test');
const path=require('node:path');
const fs=require('node:fs/promises');
const os=require('node:os');
let context,worker,extensionId,profile;
const fixture={route:{origin:'DEL',destination:'BOM',routeId:'DELHI-MUMBAI'},departureDate:'2026-10-15',currency:'INR',hasData:true,currentFare:5240,storedFare:6100,fareSource:'provided',priceLevel:'LOW',classificationBasis:'observed_typical_range',differenceFromRange:-460,typicalPriceRange:{low:5700,high:6300},lowestPrice:4850,collectedAt:'2026-09-28T10:00:00Z',leadTime:[{days:60,fare:4850},{days:30,fare:null},{days:15,fare:6100},{days:7,fare:null},{days:1,fare:null}]};
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Google Flights adapter fixture</title></head><body>
<input aria-label="Where from?" value="Delhi (DEL)"><input aria-label="Where to?" value="Mumbai (BOM)">
<input aria-label="Departure October 15, 2026" value="2026-10-15">
<button role="combobox">One way</button><button role="combobox">Economy</button><button role="combobox">1 adult</button>
<div role="listitem" aria-selected="true">Fixture airline ₹5,240</div></body></html>`;
test.beforeAll(async()=>{
  profile=await fs.mkdtemp(path.join(os.tmpdir(),'tickety-extension-'));
  const extension=path.resolve(__dirname,'..');
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,
    args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  extensionId=new URL(worker.url()).host;
  await worker.evaluate(()=>{globalThis.originalTestFetch=globalThis.fetch;});
});
test.afterAll(async()=>{
  await context?.close();
  // Only this test's freshly created temporary profile can be removed.
  if(profile && path.dirname(profile) === os.tmpdir() && path.basename(profile).startsWith('tickety-extension-')) await fs.rm(profile,{recursive:true,force:true});
});
test('unpacked MV3 service worker and real API integration',async()=>{
  expect(extensionId).toMatch(/^[a-p]{32}$/);
  const popup=await context.newPage();await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await expect(popup.getByText('Your airfare intelligence companion')).toBeVisible();
  if(process.env.TICKETY_LIVE_API === '1') {
    const result=await popup.evaluate(()=>chrome.runtime.sendMessage({type:'INSIGHT',context:{origin:'DEL',destination:'BOM',departureDate:'2026-10-05'}}));
    expect(result.ok).toBe(true);expect(result.data.hasData).toBe(true);
    expect(result.data.storedFare).toBeGreaterThan(0);expect(result.data.webUrl).toContain('/fare?route=DELHI-MUMBAI&date=2026-10-05');
  }
  await popup.close();
});
test('Google DOM fixture: isolated bubble, expand, insight, deep link, collapse and dismissal',async()=>{
  await worker.evaluate(value=>{globalThis.fetch=async url=>{globalThis.testRequestUrl=url;return new Promise(resolve=>{globalThis.releaseMascotRequest=()=>resolve(new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}}));});};},fixture);
  const page=await context.newPage();
  await page.route('https://www.google.com/travel/flights*',route=>route.fulfill({contentType:'text/html',body:html}));
  await page.goto('https://www.google.com/travel/flights?tickety-fixture=1');
  await expect(page.locator('#tickety-extension-root')).toHaveCount(1);
  const popup=page;
  await expect(page.locator('.tk-card')).toHaveCount(0);
  await expect(page.locator('.tk-mascot')).toHaveAttribute('data-state','detected');
  await page.screenshot({path:path.join(__dirname,'../test-results/mascot-bubble.png')});
  await page.getByRole('button',{name:'Open Tickety airfare assistant',exact:true}).click();
  await expect(page.locator('.tk-mascot')).toHaveAttribute('data-state','checking');
  await worker.evaluate(()=>globalThis.releaseMascotRequest());
  await expect(popup.getByText('LOW FARE',{exact:true})).toBeVisible();
  await expect(page.locator('.tk-kpis .tk-kpi')).toHaveCount(4);
  await expect(page.getByText('Off-hours tip:',{exact:false})).toContainText('not guaranteed');
  await expect(page.locator('.tk-brand .tk-mascot')).toHaveAttribute('data-state','ready');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('.tk-mascot')).toHaveAttribute('data-motion','reduced');
  const still=await page.locator('.tk-mascot > path').first().getAttribute('d');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  expect(await page.locator('.tk-mascot > path').first().getAttribute('d')).toBe(still);
  expect(await worker.evaluate(()=>globalThis.testRequestUrl)).toContain('currentFare=5240');
  await expect(popup.getByText('₹460 below the observed typical range.')).toBeVisible();
  await expect(popup.getByRole('link',{name:'View full Tickety analysis'})).toHaveAttribute('href',/\/fare\?route=DELHI-MUMBAI&date=2026-10-15/);
  await popup.getByText('How fares change',{exact:true}).click();
  await expect(popup.getByRole('img')).toHaveAttribute('aria-label',/30 days: Unavailable/);
  await popup.screenshot({path:path.join(__dirname,'../test-results/insight.png'),fullPage:true});
  await page.getByRole('button',{name:'Collapse Tickety'}).click();
  await expect(page.locator('.tk-card')).toHaveCount(0);
  await page.getByRole('button',{name:'Dismiss Tickety for this page'}).click();
  await expect(page.locator('.tk-bubble')).toHaveCount(0);
  await page.close();
});
test('manual entry, unsupported route, no-data and retry states',async()=>{
  const popup=await context.newPage();await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await popup.getByRole('button',{name:'Enter flight manually'}).first().click();
  await popup.getByLabel('From',{exact:true}).fill('DEL');await popup.getByLabel('To',{exact:true}).fill('BOM');
  await popup.getByLabel('Departure date').fill('2026-10-16');
  await worker.evaluate(()=>{globalThis.fetch=async()=>new Response('{}',{status:404});});
  await popup.getByRole('button',{name:'Check Fare',exact:true}).click();
  await expect(popup.getByRole('alert')).toContainText('not supported');
  await expect(popup.locator('.tk-mascot')).toHaveAttribute('data-state','error');
  await worker.evaluate(value=>{globalThis.fetch=async()=>new Response(JSON.stringify({...value,departureDate:'2026-10-16',hasData:false,currentFare:null,priceLevel:null,classificationBasis:null,typicalPriceRange:null,lowestPrice:null,leadTime:[]}));},fixture);
  await popup.getByRole('button',{name:'Try again'}).click();
  await expect(popup.getByText("Price insight isn't available for this route and date yet.")).toBeVisible();
  await expect(popup.locator('.tk-fare')).toHaveText('Unavailable');
  await expect(popup.locator('.tk-mascot')).toHaveAttribute('data-state','unavailable');
  await popup.close();
});

test('optional live Google Flights adapter check',async()=>{
  test.skip(process.env.TICKETY_LIVE_GOOGLE !== '1','Opt in to a real public Google Flights page.');
  await worker.evaluate(()=>{globalThis.fetch=globalThis.originalTestFetch;cache.clear();});
  const page=await context.newPage();
  await page.goto('https://www.google.com/travel/flights?q=Flights%20from%20Delhi%20to%20Mumbai%20on%20October%2015%202026%20one%20way%20economy',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#tickety-extension-root')).toHaveCount(1);
  const controls=await page.locator('input, [role="combobox"], button[aria-label]').evaluateAll(nodes=>nodes.slice(0,100).map(n=>({tag:n.tagName,role:n.getAttribute('role'),label:n.getAttribute('aria-label'),value:n.value,text:n.textContent?.slice(0,200)})));
  await fs.writeFile(path.join(__dirname,'../test-results/google-live-controls.json'),JSON.stringify(controls,null,2));
  await page.getByRole('button',{name:'Open Tickety airfare assistant',exact:true}).click();
  await expect(page.locator('#tickety-extension-root h2')).toHaveText('DEL → BOM');
  await expect(page.locator('#tickety-extension-root')).toContainText('2026-10-15');
  await page.screenshot({path:path.join(__dirname,'../test-results/google-live.png'),fullPage:false});
  await page.close();
});

test('aircraft states render locally without animation in reduced-motion mode',async()=>{
  const popup=await context.newPage();await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await popup.emulateMedia({reducedMotion:'reduce'});
  await popup.evaluate(()=>{
    panel.destroy();document.body.replaceChildren();document.body.style.width='660px';
    const gallery=document.createElement('main');gallery.style.cssText='display:flex;gap:18px;padding:24px;background:#f8f9f4;font:12px Segoe UI;color:#203831';
    for(const state of ['idle','detected','checking','ready','unavailable','error']) {
      const mascot=Tickety.mascot.create(state), tile=document.createElement('div');
      mascot.element.style.cssText='width:80px;height:80px';
      tile.append(mascot.element,document.createTextNode(state));gallery.append(tile);
      mascot.destroy();
    }
    document.body.append(gallery);
  });
  await expect(popup.locator('svg')).toHaveCount(6);
  const paths=await popup.locator('svg > path').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d')));
  expect(paths.every(d=>d && !/NaN|undefined/.test(d))).toBe(true);
  await popup.locator('main').screenshot({path:path.join(__dirname,'../test-results/mascot-states.png')});
  await popup.close();
});

test('Diwali KPI window and route-alert save, check and remove',async()=>{
  const value={...fixture,departureDate:'2026-11-06',collectedAt:new Date().toISOString(),
    eventContext:{coverageAvailable:true,event:{name:'Diwali',date:'2026-11-08',travelOffset:-2},
      days:Array.from({length:7},(_,i)=>({date:`2026-11-${String(i+5).padStart(2,'0')}`,offset:i-3,phase:i<3?'before':i===3?'event':'after',fare:i===0?5000:null}))}};
  await worker.evaluate(value=>{cache.clear();globalThis.fetch=async()=>new Response(JSON.stringify(value));},value);
  const popup=await context.newPage();await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await popup.evaluate(()=>panel.setDetection({confidence:'HIGH',context:{origin:'DEL',destination:'BOM',departureDate:'2026-11-06',fare:5240,currency:'INR'}}));
  await expect(popup.locator('.tk-kpi')).toHaveCount(4);
  await expect(popup.locator('.tk-kpis')).toContainText('2 days before Diwali');
  await expect(popup.locator('.tk-event-day')).toHaveCount(7);
  await expect(popup.locator('.tk-event-day[data-phase=before]')).toHaveCount(3);
  await expect(popup.locator('.tk-event-day[data-phase=after]')).toHaveCount(3);
  await expect(popup.locator('.tk-event-day[aria-current=date]')).toHaveAttribute('href',/date=2026-11-06/);
  await popup.screenshot({path:path.join(__dirname,'../test-results/event-insights.png'),fullPage:true});
  await popup.getByText('Set a route fare alert',{exact:true}).click();
  await popup.getByLabel('Notify when the stored fare is at or below (INR)').fill('5500');
  await popup.getByRole('button',{name:'Save alert',exact:true}).click();
  await expect(popup.getByText('Alert saved.',{exact:false})).toBeVisible();
  await popup.getByText('My fare alerts',{exact:true}).click();
  await expect(popup.locator('.tk-alert-row')).toHaveCount(1);
  await worker.evaluate(value=>{globalThis.fetch=async()=>new Response(JSON.stringify({...value,storedFare:5000}));},value);
  await popup.getByRole('button',{name:'Check alerts now'}).click();
  await expect(popup.locator('.tk-alert-row')).toContainText('Target reached');
  await popup.getByRole('button',{name:'Remove alert'}).click();
  await expect(popup.locator('.tk-alert-row')).toHaveCount(0);
  await popup.close();
});
