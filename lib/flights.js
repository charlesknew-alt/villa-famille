const Flights = {
  cache: null,

  async load() {
    if (this.cache) return this.cache;
    try {
      const res = await fetch("data/fares.json", { cache: "no-store" });
      if (res.ok) this.cache = await res.json();
    } catch (_) { /* file:// */ }
    if (!this.cache && window.FARES_DATA) this.cache = window.FARES_DATA;
    return this.cache || { routes: [], airports: {}, drives: {}, currency: "GBP" };
  },

  googleFlightsUrl(from, to, date) {
    const q = "Flights from " + from + " to " + to + (date ? " on " + date : "");
    return "https://www.google.com/travel/flights?q=" + encodeURIComponent(q);
  },

  skyscannerUrl(from, to, date) {
    let path = "https://www.skyscanner.net/transport/flights/" + from.toLowerCase() + "/" + to.toLowerCase() + "/";
    if (date) path += date.replace(/-/g, "").slice(2) + "/";
    return path;
  },

  /**
   * Single entry point for fares. Today it reads repo JSON.
   * Later, replace the body with a flight-price API and keep this shape.
   */
  async getFares(query) {
    const data = await this.load();
    const q = query || {};
    let routes = (data.routes || []).slice();
    if (q.from) routes = routes.filter((r) => r.from === q.from);
    if (q.to) routes = routes.filter((r) => r.to === q.to);
    return routes.map((r) => {
      const drive = (data.drives || {})[r.to] || { min: 90, max: 105, label: "about 1h30" };
      const totalMin = r.durationMin + drive.min;
      return Object.assign({}, r, {
        currency: data.currency || "GBP",
        asOf: data.asOf,
        fromName: (data.airports[r.from] || {}).name || r.from,
        toName: (data.airports[r.to] || {}).name || r.to,
        drive,
        totalMin,
        googleUrl: this.googleFlightsUrl(r.from, r.to, q.date),
        skyscannerUrl: this.skyscannerUrl(r.from, r.to, q.date)
      });
    });
  },

  highlights(fares) {
    if (!fares.length) return {};
    const cheapest = fares.slice().sort((a, b) => a.price - b.price)[0];
    const fastest = fares.slice().sort((a, b) => a.totalMin - b.totalMin)[0];
    const convenient = fares.slice().sort((a, b) => {
      const as = (a.direct ? 0 : 1000) + (a.to === "TLN" ? 0 : 100) + a.totalMin;
      const bs = (b.direct ? 0 : 1000) + (b.to === "TLN" ? 0 : 100) + b.totalMin;
      return as - bs;
    })[0];
    return { cheapest, fastest, convenient };
  }
};
