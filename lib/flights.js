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

  isBaOrEj(r) {
    const a = String((r && r.airline) || "").toLowerCase();
    return a.indexOf("easyjet") >= 0 || a.indexOf("british") >= 0;
  },

  fmtBaDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T12:00:00");
    const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
    return String(d.getDate()).padStart(2, "0") + "-" + mon + "-" + d.getFullYear();
  },

  skyDate(iso) {
    return iso ? String(iso).replace(/-/g, "").slice(2) : "";
  },

  googleFlightsUrl(from, to, date, back) {
    const q = "Flights from " + from + " to " + to +
      (date ? " on " + date : "") +
      (back ? " returning " + back : "");
    return "https://www.google.com/travel/flights?q=" + encodeURIComponent(q);
  },

  skyscannerUrl(from, to, date, back) {
    let path = "https://www.skyscanner.net/transport/flights/" +
      String(from).toLowerCase() + "/" + String(to).toLowerCase() + "/";
    if (date) path += this.skyDate(date) + "/";
    if (back) path += this.skyDate(back) + "/";
    return path;
  },

  baUrl(from, to, date, back) {
    const q = new URLSearchParams({
      eId: "111014",
      departurePoint: from || "LHR",
      destinationPoint: to || "NCE"
    });
    if (date) q.set("outboundDate", date);
    if (back) q.set("inboundDate", back);
    return "https://www.britishairways.com/travel/book/public/en_gb?" + q.toString();
  },

  easyJetUrl(from, to, date, back) {
    const q = new URLSearchParams({
      lang: "EN",
      dep: from || "LGW",
      dest: to || "TLN",
      apax: "1",
      isOneWay: back ? "off" : "on"
    });
    if (date) q.set("dd", date);
    if (back) q.set("rd", back);
    return "https://www.easyjet.com/en/buy/flights?" + q.toString();
  },

  liveLinks(from, to, date, back) {
    const baFrom = from || "LHR";
    const baTo = to && to !== "TLN" ? to : "NCE";
    const ejFrom = from && from !== "LHR" && from !== "LCY" ? from : "LGW";
    const ejTo = to || "TLN";
    return {
      ba: this.baUrl(baFrom, baTo, date, back),
      easyJet: this.easyJetUrl(ejFrom, ejTo, date, back),
      google: this.googleFlightsUrl(from || "LGW", to || "TLN", date, back),
      skyscanner: this.skyscannerUrl(from || "LGW", to || "TLN", date, back)
    };
  },

  /**
   * Optional no-key live helper. BA/easyJet have no free public API.
   * Leave this as the swap point — return [] to use guide prices.
   */
  async tryLiveHelper(_query) {
    return [];
  },

  /**
   * Single entry point for fares. Guide prices from the repo today.
   * Later, put an API key call in tryLiveHelper() and keep this shape.
   */
  async getFares(query) {
    const q = query || {};
    try {
      const live = await this.tryLiveHelper(q);
      if (live && live.length) return live;
    } catch (_) { /* offline or blocked */ }
    return this.fromSample(q);
  },

  async fromSample(q) {
    const data = await this.load();
    let routes = (data.routes || []).slice();
    if (q.from) routes = routes.filter((r) => r.from === q.from);
    if (q.to) routes = routes.filter((r) => r.to === q.to);
    routes.sort((a, b) => {
      const ap = this.isBaOrEj(a) ? 0 : 1;
      const bp = this.isBaOrEj(b) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      const at = a.to === "TLN" ? 0 : 1;
      const bt = b.to === "TLN" ? 0 : 1;
      return at - bt;
    });
    return routes.map((r) => {
      const drive = (data.drives || {})[r.to] || { min: 90, max: 105, label: "about 1h30" };
      const totalMin = r.durationMin + drive.min;
      const preferred = this.isBaOrEj(r);
      return Object.assign({}, r, {
        currency: data.currency || "GBP",
        asOf: data.asOf,
        guide: true,
        preferred,
        fromName: (data.airports[r.from] || {}).name || r.from,
        toName: (data.airports[r.to] || {}).name || r.to,
        drive,
        totalMin,
        baUrl: this.baUrl(r.from, r.to === "TLN" ? "NCE" : r.to, q.date, q.back),
        easyJetUrl: this.easyJetUrl(r.from === "LHR" || r.from === "LCY" ? "LGW" : r.from, r.to, q.date, q.back),
        googleUrl: this.googleFlightsUrl(r.from, r.to, q.date, q.back),
        skyscannerUrl: this.skyscannerUrl(r.from, r.to, q.date, q.back)
      });
    });
  },

  highlights(fares) {
    if (!fares.length) return {};
    const preferred = fares.filter((f) => f.preferred);
    const pool = preferred.length ? preferred : fares;
    const cheapest = pool.slice().sort((a, b) => a.price - b.price)[0];
    const fastest = fares.slice().sort((a, b) => a.totalMin - b.totalMin)[0];
    const convenient = fares.slice().sort((a, b) => {
      const score = (x) => (x.preferred ? 0 : 80) + (x.direct ? 0 : 1000) + (x.to === "TLN" ? 0 : 100) + x.totalMin;
      return score(a) - score(b);
    })[0];
    return { cheapest, fastest, convenient };
  },

  async estimateReturn(arrival, departure, guests) {
    const fares = await this.getFares({ date: arrival, back: departure });
    const baej = fares.filter((f) => f.preferred);
    const pool = baej.length ? baej : fares;
    const tln = pool.filter((f) => f.to === "TLN");
    const src = tln.length ? tln : pool.filter((f) => f.direct).length ? pool.filter((f) => f.direct) : pool;
    if (!src.length) return null;
    const prices = src.map((f) => Number(f.price) || 0).filter((n) => n > 0).sort((a, b) => a - b);
    if (!prices.length) return null;
    const lowOne = prices[0];
    const highOne = prices[prices.length - 1];
    const lowPp = Math.round(lowOne * 2);
    const highPp = Math.max(Math.round(highOne * 2), Math.round(lowPp * 1.35));
    const n = Math.max(1, Number(guests) || 1);
    return {
      lowPp,
      highPp,
      lowTotal: lowPp * n,
      highTotal: highPp * n,
      guests: n,
      airport: src[0].to,
      asOf: src[0].asOf,
      links: this.liveLinks(src[0].from, src[0].to, arrival, departure)
    };
  }
};
