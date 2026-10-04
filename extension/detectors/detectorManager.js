(() => {
  function isGoogle(url) {
    const u = new URL(url);
    return ['www.google.com','www.google.co.in'].includes(u.hostname) && u.pathname.startsWith('/travel/flights');
  }
  Tickety.detectors = {isGoogle, detect:(doc,url) => isGoogle(url) ? Tickety.googleFlights.detect(doc,url) : Tickety.generic.detect(doc,url)};
})();
