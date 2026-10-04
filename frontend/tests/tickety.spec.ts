import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Fare } from '../src/components/tickety/data';

// Test-only observations. These intercept browser requests and are never
// imported by the product or inserted into its database.
const routes = [
  { route_id: 'DEL-BOM', origin: 'Delhi', destination: 'Mumbai' },
  { route_id: 'BOM-DEL', origin: 'Mumbai', destination: 'Delhi' },
  { route_id: 'DEL-BLR', origin: 'Delhi', destination: 'Bengaluru' },
];
const fare: Fare = {
  id: 1, route_id: 'DEL-BOM', fare: 5240, currency: 'INR', price_level: 'Low',
  lowest_price: 4850, typical_price_low: 5700, typical_price_high: 6300,
  airline: 'Fixture Airways', flight_number: 'TEST101', departure_time: '2026-10-15T08:10:00+05:30',
  arrival_time: '2026-10-15T10:25:00+05:30', duration_minutes: 135, stops: 0, cabin: 'economy',
  travel_date: '2026-10-15', observation_date: '2026-10-08', collected_at: '2026-10-08T05:00:00Z', advance_purchase_days: 7,
};
const second = { ...fare, id: 2, airline: 'Second Fixture Air', flight_number: 'TEST202', fare: 5680, duration_minutes: 120, stops: 1 };
const intelligence = {
  current: fare, routeId: fare.route_id, departureDate: fare.travel_date, flights: [fare, second],
  history: [{ date: '2026-09-15', fare: 4850, count: 1 }, { date: '2026-10-08', fare: 5240, count: 2 }],
  leadTime: [60, 30, 15, 7, 1].map(days => ({ days, fare: days === 15 || days === 1 ? null : days === 7 ? 5240 : 4850, count: days === 15 || days === 1 ? 0 : 1 })),
};

async function mockApi(page: Page) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const payload = path.endsWith('/routes') ? { total: routes.length, routes }
      : path.endsWith('/fares/coverage') ? { registeredRoutes: 3, observedRoutes: 2, observations: 5, observedWindows: [60, 30, 7], ticketWindowRuns: [
          { observationDate: '2026-10-04', windows: [{days:30,travelDate:'2026-11-03'},{days:60,travelDate:'2026-12-03'}] },
          { observationDate: '2026-09-13', windows: [{days:60,travelDate:'2026-11-12'}] },
        ], updatedAt: fare.collected_at }
      : path.endsWith('/fares/compare') ? { fares: [fare, { ...second, route_id: 'DEL-BLR', price_level: 'Typical' }] }
      : path.endsWith('/fares') ? intelligence : { hasData: false };
    await route.fulfill({ json: payload });
  });
}

async function noOverflow(page: Page) {
  const overflow = await page.locator('.tickety').evaluate(root => {
    const width = window.innerWidth;
    return [...root.querySelectorAll<HTMLElement>('h1,h2,h3,form,button,input,select,section,article,nav,footer,.tk-route-grid,.tk-window-values')]
      .filter(el => { const rect = el.getBoundingClientRect(); return rect.width > 0 && (rect.right > width + 1 || rect.left < -1); })
      .map(el => `${el.tagName}.${el.className}`);
  });
  expect(overflow).toEqual([]);
}

test('Tickety plane branding and three-day Diwali travel window', async ({ page }) => {
  await mockApi(page);
  await page.goto('/fare?route=DEL-BOM&date=2026-11-06');
  await expect(page).toHaveTitle('Tickety – Know your fare before you book.');
  await expect(page.locator('.tk-nav .tk-brand')).toHaveText('tickety.');
  await expect(page.locator('.tk-nav img')).toHaveAttribute('src','/tickety-plane.svg');
  const calendar=page.getByRole('region',{name:'Fare pressure calendar'});
  await expect(calendar.locator('.tk-calendar-day.is-before-event').filter({hasText:'Diwali'})).toHaveCount(3);
  await expect(calendar.locator('.tk-calendar-day.is-after-event').filter({hasText:'Diwali'})).toHaveCount(3);
  await expect(calendar.locator('.is-selected')).toContainText('2d before Diwali');
  await expect(calendar.getByText('T+ marks a ticket window confirmed by stored scraper data.')).toBeVisible();
  await expect(calendar.locator('.tk-calendar-window')).toHaveCount(3);
  await expect(calendar.getByRole('button', { name: /12 November 2026, T\+60 ticket window from scraper run 13 September 2026/ })).toBeVisible();
  await expect(calendar.getByRole('button', { name: /7 November 2026/ })).not.toContainText('T+');
  await calendar.getByRole('button', { name: /7 November 2026/ }).click();
  await expect(page).toHaveURL(/\/fare\?route=DEL-BOM&date=2026-11-06/);
  await expect(calendar.getByRole('heading', { name: '7 November 2026' })).toBeVisible();
  await expect(calendar.locator('.tk-calendar-fare-preview')).toContainText('₹5,240');
  await noOverflow(page);
});

test('2027 calendar shows events and their three-day travel windows', async ({ page }) => {
  await mockApi(page);
  await page.goto('/fare?route=DEL-BOM&date=2027-10-27');
  const calendar=page.getByRole('region',{name:'Fare pressure calendar'});
  await expect(calendar.locator('.tk-calendar-day.is-holiday').filter({hasText:'Diwali'})).toHaveCount(1);
  await expect(calendar.locator('.tk-calendar-day.is-before-event').filter({hasText:'Diwali'})).toHaveCount(3);
  await expect(calendar.locator('.tk-calendar-day.is-after-event').filter({hasText:'Diwali'})).toHaveCount(3);
  await expect(calendar.locator('.is-selected')).toContainText('2d before Diwali');
});

test('home to fare, calendar preview, flight sorting and responsive layout', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mockApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Is this a good fare?' })).toBeVisible();
  await expect(page.getByLabel('From', { exact: true })).toHaveValue('Delhi');
  await expect(page.locator('.recharts-wrapper')).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath('home.png'), fullPage: true });
  await page.getByRole('form', { name: 'Check a fare' }).getByLabel('Departure date').fill('2026-10-15');
  await page.getByRole('button', { name: 'Check Fare', exact: true }).click();
  await expect(page).toHaveURL(/\/fare\?route=DEL-BOM&date=2026-10-15/);
  await expect(page.locator('.tk-big-fare')).toHaveText('₹5,240');
  await expect(page.getByText('Your fare is ₹460 below the typical range.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How this route’s fares change.' })).toHaveCount(0);
  await expect(page.locator('.tk-calendar-fare-preview')).toContainText('₹5,240');
  await page.getByLabel('Sort flights').selectOption('duration');
  await expect(page.locator('.tk-flight-card').first()).toContainText('Second Fixture Air');
  await page.getByLabel('Sort flights').selectOption('stops');
  await expect(page.locator('.tk-flight-card').first()).toContainText('Fixture Airways');
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath('fare.png'), fullPage: true });
  await page.locator('.tk-result-top').screenshot({ path: info.outputPath('fare-top.png'), scale: 'css' });
  expect(errors).toEqual([]);
});

test('explorer filters, navigation, legacy search URLs and invalid dates', async ({ page }, info) => {
  await mockApi(page);
  await page.goto('/explore');
  await expect(page.locator('.tk-route-card')).toHaveCount(2);
  await page.getByLabel('Price level', { exact: true }).selectOption('high');
  await expect(page.getByText('No routes match those filters.')).toBeVisible();
  await page.getByLabel('Price level', { exact: true }).selectOption('all');
  await page.getByLabel('City', { exact: true }).selectOption('Mumbai');
  await expect(page.locator('.tk-route-card')).toHaveCount(1);
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath('explore.png'), fullPage: true });
  await page.goto('/trends');
  await expect(page.getByRole('heading', { name: 'Every price has a little history.' })).toBeVisible();
  await noOverflow(page);
  await page.goto('/tickety?route=DEL-BOM&date=2026-10-15');
  await expect(page).toHaveURL(/\/fare\?/);
  await page.goto('/fare?route=DEL-BOM&date=2026-02-30');
  await expect(page.getByRole('heading', { name: 'Let’s start with your route.' })).toBeVisible();
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('link', { name: 'Price Trends', exact: true }).click();
    await expect(page).toHaveURL('/trends');
  }
});

test('loading, API error retry, empty results and missing insights', async ({ page }, info) => {
  await mockApi(page);
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/fares?*', async route => { await pending; await route.fulfill({ status: 503, json: {} }); });
  await page.goto('/fare?route=DEL-BOM&date=2026-10-15');
  await expect(page.getByText('Checking airfare intelligence…')).toBeVisible();
  await noOverflow(page);
  release();
  await expect(page.getByRole('heading', { name: 'We couldn’t build your fare picture.' })).toBeVisible();
  await page.unroute('**/api/fares?*');
  await page.route('**/api/fares?*', route => route.fulfill({ json: { ...intelligence, current: null, flights: [] } }));
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'No airfare observations yet.' })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath('empty.png'), fullPage: true });
  await page.unroute('**/api/fares?*');
  await page.route('**/api/fares?*', route => route.fulfill({ json: { ...intelligence, current: { ...fare, price_level: null, typical_price_low: null, typical_price_high: null, lowest_price: null }, flights: [], leadTime: intelligence.leadTime.map(point => ({ ...point, fare: null, count: 0 })) } }));
  await page.reload();
  await expect(page.getByText('Price insight unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choose a travel date and check its fare' })).toBeVisible();
  await noOverflow(page);
});

test('government boundary, login redirect, original aliases and return to Tickety', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'VayuSetu Intelligence', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Explore VayuSetu Intelligence', exact: true })).toHaveCount(0);
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@vayusetu.gov.in');
  await page.getByLabel('Password', { exact: true }).fill('ADMIN@123');
  await page.getByRole('button', { name: 'Login to VAYUSETU' }).click();
  await expect(page).toHaveURL('/vayusetu');
  await expect(page.getByText('Waiting for the first scrape')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Tickety' })).toBeVisible();
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/vayusetu');
  await page.goto('/routes');
  await expect(page).toHaveURL('/vayusetu/routes');
  await page.getByRole('link', { name: 'Back to Tickety' }).click();
  await expect(page.getByRole('heading', { name: 'Is this a good fare?' })).toBeVisible();
});

test('route catalogue includes records beyond the first 500', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/routes?*', route => {
    const offset = new URL(route.request().url()).searchParams.get('offset');
    const items = offset === '0' ? Array.from({ length: 500 }, (_, i) => ({ route_id: `TEST${i}-BOM`, origin: `Test city ${i}`, destination: 'Mumbai' }))
      : [{ route_id: 'LAST-BOM', origin: 'Last test city', destination: 'Mumbai' }];
    return route.fulfill({ json: { total: 501, routes: items } });
  });
  await page.goto('/');
  await expect(page.getByLabel('From', { exact: true }).locator('option')).toHaveCount(501);
  await page.getByLabel('From', { exact: true }).selectOption('Last test city');
  await expect(page.getByRole('button', { name: 'Check Fare', exact: true })).toBeEnabled();
});

test('preserved VayuSetu pages render and heatmap remains interactive', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const dashboard = JSON.parse(readFileSync('test-results/government-fixture.json', 'utf-8'));
  await mockApi(page);
  await page.route('**/api/dashboard/live', route => route.fulfill({ json: dashboard }));
  await page.addInitScript(() => localStorage.setItem('vayusetu-auth', JSON.stringify({ name: 'MoSPI Admin', role: 'MOSPI_ADMIN', email: 'admin@vayusetu.gov.in' })));
  for (const path of ['', '/index', '/routes', '/heatmap', '/lead-time-elasticity', '/cpi', '/api-explorer', '/downloads', '/route-basket', '/reports', '/system-settings', '/user-management', '/scraper-control', '/user-guide']) {
    await page.goto(`/vayusetu${path}`);
    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to Tickety' })).toBeVisible();
    if (path === '') await page.screenshot({ path: info.outputPath('government-overview.png'), fullPage: true, scale: 'css' });
    if (path === '/heatmap') {
      await page.getByRole('button', { name: /T\+60.*versus available baseline/ }).first().click();
      await expect(page.getByText('Selected observation')).toBeVisible();
      await page.screenshot({ path: info.outputPath('government-heatmap.png'), fullPage: true, scale: 'css' });
    }
    expect(errors, `Runtime errors on ${path || '/vayusetu'}`).toEqual([]);
  }
});

test('consumer layouts fit small phones and tablets', async ({ page }) => {
  test.setTimeout(90_000);
  await mockApi(page);
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/fare?route=DEL-BOM&date=2026-10-15', '/explore', '/trends']) {
      await page.goto(path);
      await expect(page.locator('.tickety main')).toBeVisible();
      await noOverflow(page);
    }
  }
});
