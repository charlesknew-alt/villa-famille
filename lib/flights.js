const Flights = {
  cache: null,
  keyStore: "tfh-flight-key",
  providerStore: "tfh-flight-provider",

  async load() {
    if (this.cache) return this.cache;
    try {
      const res = await fetch("data/fares.json", { cache: "no-store" });
      if (res.ok) this.cache = await res.json();
    } catch (_) { /* file:// */ }
    if (!this.cache && window.FARES_DATA) this.cache = window.FARES_DATA;
    return this.cache || { routes: [], airports: {}, drives: {}, currency: "GBP" };
  },

  adults(n) {
    const v = Number(n);
    return Number.isFinite(v) && v > 0 ? Math.min(9, Math.round(v)) : 1;
  },

  apiKey() {
    try { return localStorage.getItem(this.keyStore) || ""; }
    catch (_) { return ""; }
  },

  apiProvider() {
    try { return localStorage.getItem(this.providerStore) || "kiwi"; }
    catch (_) { return "kiwi"; }
  },

  setApiKey(key, provider) {
    try {
      if (key) localStorage.setItem(this.keyStore, String(key).trim());
      else localStorage.removeItem(this.keyStore);
      if (provider) localStorage.setItem(this.providerStore, provider);
    } catch (_) { /* private mode */ }
  },

  isBaOrEj(r) {
    const a = String((r && r.airline) || "").toLowerCase();
    return a.indexOf("easyjet") >= 0 || a.indexOf("british") >= 0;
  },

  baFrom(from) {
    if (!from || from === "LGW" || from === "STN") return "LHR";
    return from;
  },

  baTo(to) {
    if (!to || to === "TLN") return "NCE";
    return to;
  },

  ejFrom(from) {
    if (!from || from === "LHR" || from === "LCY") return "LGW";
    return from;
  },

  ejTo(to) {
    return to || "TLN";
  },

  skyDate(iso) {
    return iso ? String(iso).replace(/-/g, "").slice(2) : "";
  },

  kiwiDate(iso) {
    if (!iso) return "";
    const p = String(iso).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : "";
  },

  /**
   * British Airways search results (2026 flightList / onds pattern).
   * Lands on the fare list, not the homepage.
   */
  baUrl(from, to, date, back, guests) {
    const origin = this.baFrom(from);
    const dest = this.baTo(to);
    const ad = this.adults(guests);
    let onds = origin + "-" + dest + (date ? "_" + date : "");
    if (back) onds += "," + dest + "-" + origin + "_" + back;
    const q = new URLSearchParams({
      onds,
      ad: String(ad),
      yad: "0",
      ch: "0",
      inf: "0",
      cabin: "M",
      flex: "LOWEST",
      redemption: "false",
      ond: "1"
    });
    return "https://www.britishairways.com/travel/book/public/en_gb/flightList?" + q.toString();
  },

  /**
   * easyJet booking search (2026 origin / departureDate / adults).
   * Also sets the older dep/dd/apax aliases so the funnel still fills.
   */
  easyJetUrl(from, to, date, back, guests) {
    const origin = this.ejFrom(from);
    const dest = this.ejTo(to);
    const ad = this.adults(guests);
    const q = new URLSearchParams({
      lang: "EN",
      origin,
      destination: dest,
      dep: origin,
      dest,
      adults: String(ad),
      apax: String(ad),
      children: "0",
      infants: "0",
      isOneWay: back ? "off" : "on"
    });
    if (date) {
      q.set("departureDate", date);
      q.set("dd", date);
    }
    if (back) {
      q.set("returnDate", back);
      q.set("rd", back);
    }
    return "https://www.easyjet.com/en/buy/flights?" + q.toString();
  },

  googleFlightsUrl(from, to, date, back, guests) {
    const ad = this.adults(guests);
    let q = "Flights from " + (from || "LGW") + " to " + (to || "TLN");
    if (date && back) q += " on " + date + " through " + back;
    else if (date) q += " on " + date + " one way";
    if (ad > 1) q += " with " + ad + " adults";
    return "https://www.google.com/travel/flights?q=" + encodeURIComponent(q) + "&curr=GBP";
  },

  skyscannerUrl(from, to, date, back, guests) {
    const origin = String(from || "LGW").toLowerCase();
    const dest = String(to || "TLN").toLowerCase();
    let path = "https://www.skyscanner.net/transport/flights/" + origin + "/" + dest + "/";
    if (date) path += this.skyDate(date) + "/";
    if (back) path += this.skyDate(back) + "/";
    const q = new URLSearchParams({
      adultsv2: String(this.adults(guests)),
      cabinclass: "economy",
      rtn: back ? "1" : "0",
      currency: "GBP",
      market: "UK",
      locale: "en-GB"
    });
    return path + "?" + q.toString();
  },

  liveLinks(from, to, date, back, guests) {
    const baFrom = this.baFrom(from);
    const baTo = this.baTo(to);
    const ejFrom = this.ejFrom(from);
    const ejTo = this.ejTo(to);
    const gFrom = from || "LGW";
    const gTo = to || "TLN";
    return {
      ba: this.baUrl(baFrom, baTo, date, back, guests),
      easyJet: this.easyJetUrl(ejFrom, ejTo, date, back, guests),
      google: this.googleFlightsUrl(gFrom, gTo, date, back, guests),
      skyscanner: this.skyscannerUrl(gFrom, gTo, date, back, guests)
    };
  },

  buttonsHtml(links, extraClass) {
    const l = links || {};
    const wrap = extraClass || "live-links";
    return '<div class="' + wrap + '">' +
      '<a class="btn primary" target="_blank" rel="noopener" href="' + l.ba + '">Check live price on British Airways</a>' +
      '<a class="btn primary" target="_blank" rel="noopener" href="' + l.easyJet + '">Check live price on easyJet</a>' +
      '<a class="btn" target="_blank" rel="noopener" href="' + l.google + '">Google Flights</a>' +
      '<a class="btn" target="_blank" rel="noopener" href="' + l.skyscanner + '">Skyscanner</a>' +
      "</div>";
  },

  /**
   * Optional live fares. BA/easyJet have no free official API.
   * If a Kiwi/Tequila (or later Duffel/Amadeus) key is saved in Settings,
   * try that documented API. Never invent numbers when it fails.
   */
  async tryLiveHelper(query) {
    const key = this.apiKey();
    if (!key) return [];
    const q = query || {};
    const from = q.from || "LGW";
    const to = q.to || "NCE";
    if (!q.date) return [];
    const provider = this.apiProvider();
    if (provider === "duffel" || provider === "amadeus") return [];
    const params = new URLSearchParams({
      fly_from: from,
      fly_to: to,
      date_from: this.kiwiDate(q.date),
      date_to: this.kiwiDate(q.date),
      adults: String(this.adults(q.adults || q.guests)),
      curr: "GBP",
      limit: "8",
      sort: "price"
    });
    if (q.back) {
      params.set("return_from", this.kiwiDate(q.back));
      params.set("return_to", this.kiwiDate(q.back));
    }
    const res = await fetch("https://api.tequila.kiwi.com/v2/search?" + params.toString(), {
      headers: { apikey: key }
    });
    if (!res.ok) return [];
    const body = await res.json();
    const rows = Array.isArray(body.data) ? body.data : [];
    return rows.map((row, i) => {
      const routeFrom = (row.flyFrom || from);
      const routeTo = (row.flyTo || to);
      const airline = ((row.airlines || [])[0] || "Airline");
      return {
        id: "live-" + i,
        from: routeFrom,
        to: routeTo,
        airline,
        direct: Number(row.nightsInDest) === 0 ? Number(row.route && row.route.length) <= (q.back ? 2 : 1) : (row.route || []).length <= (q.back ? 2 : 1),
        durationMin: Math.round(Number(row.duration && row.duration.total ? row.duration.total : 0) / 60) || 0,
        price: Number(row.price) || 0,
        stops: Math.max(0, (row.route || []).length - (q.back ? 2 : 1)),
        live: true,
        currency: "GBP"
      };
    }).filter((r) => r.price > 0);
  },

  /**
   * Single entry point. Live fares only if tryLiveHelper returns them.
   * Otherwise route cards with no invented prices.
   */
  async getFares(query) {
    const q = query || {};
    try {
      const live = await this.tryLiveHelper(q);
      if (live && live.length) return this.decorate(live, q, true);
    } catch (_) { /* offline, blocked, or bad key */ }
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
    return this.decorate(routes, q, false);
  },

  decorate(routes, q, live) {
    return Promise.resolve(this.load()).then((data) => routes.map((r) => {
      const drive = (data.drives || {})[r.to] || { min: 90, max: 105, label: "about 1h30" };
      const totalMin = (Number(r.durationMin) || 0) + drive.min;
      const preferred = this.isBaOrEj(r);
      const guests = this.adults(q.adults || q.guests);
      return Object.assign({}, r, {
        currency: r.currency || data.currency || "GBP",
        asOf: r.asOf || data.asOf || "",
        live: !!(live && r.price),
        guide: false,
        preferred,
        fromName: (data.airports[r.from] || {}).name || r.from,
        toName: (data.airports[r.to] || {}).name || r.to,
        drive,
        totalMin,
        baUrl: this.baUrl(r.from, r.to, q.date, q.back, guests),
        easyJetUrl: this.easyJetUrl(r.from, r.to, q.date, q.back, guests),
        googleUrl: this.googleFlightsUrl(r.from, r.to, q.date, q.back, guests),
        skyscannerUrl: this.skyscannerUrl(r.from, r.to, q.date, q.back, guests)
      });
    }));
  },

  highlights(fares) {
    if (!fares.length) return {};
    const withPrice = fares.filter((f) => f.live && f.price);
    const cheapest = withPrice.length ? withPrice.slice().sort((a, b) => a.price - b.price)[0] : null;
    const fastest = fares.slice().sort((a, b) => a.totalMin - b.totalMin)[0];
    const convenient = fares.slice().sort((a, b) => {
      const score = (x) => (x.preferred ? 0 : 80) + (x.direct ? 0 : 1000) + (x.to === "TLN" ? 0 : 100) + x.totalMin;
      return score(a) - score(b);
    })[0];
    return { cheapest, fastest, convenient };
  },

  async estimateReturn(arrival, departure, guests) {
    const n = this.adults(guests);
    const links = this.liveLinks("LGW", "TLN", arrival, departure, n);
    const fares = await this.getFares({ date: arrival, back: departure, adults: n });
    const live = fares.filter((f) => f.live && f.price);
    if (!live.length) {
      return { guests: n, airport: "TLN", links, live: false };
    }
    const prices = live.map((f) => Number(f.price) || 0).filter((x) => x > 0).sort((a, b) => a - b);
    const lowOne = prices[0];
    const highOne = prices[prices.length - 1];
    return {
      live: true,
      lowPp: Math.round(lowOne),
      highPp: Math.round(highOne),
      lowTotal: Math.round(lowOne) * n,
      highTotal: Math.round(highOne) * n,
      guests: n,
      airport: live[0].to,
      asOf: live[0].asOf,
      links
    };
  }
};
