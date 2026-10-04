importScripts('config.js', 'utils/context.js', 'utils/api.js', 'utils/alerts.js');
const cache = new Map();
const pending = new Map();
async function environment() {
  const {environment} = await chrome.storage.local.get('environment');
  return Tickety.config.environments[environment] || Tickety.config.environments[Tickety.config.defaultEnvironment];
}
async function insight(raw) {
  const config = await environment();
  const context = Tickety.context.normalize(raw);
  const key = Tickety.api.requestUrl(config.api,context);
  if (cache.get(key)?.expires > Date.now()) return cache.get(key).value;
  if (pending.has(key)) return pending.get(key);
  const promise = Tickety.api.fetchInsight(config.api,context).then(data => {
    const value = {...data, webUrl:Tickety.api.deepLink(config.web,data)};
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(key,{value,expires:Date.now()+Tickety.config.cacheMs});
    return value;
  }).finally(() => pending.delete(key));
  pending.set(key,promise);
  return promise;
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  // No arbitrary URL fetch/open proxy; only a validated context and fixed API.
  const actions = {
    INSIGHT: () => insight(message.context),
    CONFIG: async () => environment(),
    SAVE_ALERT: async () => {
      const saved=await chrome.storage.local.get('environment');
      return Tickety.alerts.save(message.context,message.targetFare,saved.environment || Tickety.config.defaultEnvironment);
    },
    LIST_ALERTS: () => Tickety.alerts.read(),
    REMOVE_ALERT: () => Tickety.alerts.remove(message.id),
    CHECK_ALERTS: () => Tickety.alerts.check(),
  };
  if (!actions[message?.type]) return false;
  actions[message.type]().then(data => sendResponse({ok:true,data})).catch(error => sendResponse({ok:false,error:error.name === 'TimeoutError' ? 'Tickety timed out. Please try again.' : error.message || 'Tickety could not connect.'}));
  return true;
});
