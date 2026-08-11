const App = {
  view: "dashboard",
  params: {},
  houseTab: "guide",
  cal: { mode: "month", cursor: null },

  async init() {
    UI.applyTheme();
    await Store.load();
    this.cal.cursor = UI.today().slice(0, 7) + "-01";
    this.bindChrome();
    this.renderPinPad();
    this.bindSignup();
    if (Auth.restore()) this.showApp();
    else this.showLogin();
    window.addEventListener("hashchange", () => this.route());
  },

  bindChrome() {
    document.getElementById("theme-toggle").onclick = () => UI.toggleTheme();
    document.getElementById("logout-btn").onclick = () => { Auth.logout(); this.showLogin(); };
    document.getElementById("nav-toggle").onclick = () => document.getElementById("sidenav").classList.toggle("open");
    document.getElementById("global-search-form").onsubmit = (e) => {
      e.preventDefault();
      location.hash = "search/" + encodeURIComponent(document.getElementById("global-search").value);
    };
    document.getElementById("save-banner-btn").onclick = () => this.openSave();
    document.querySelectorAll("[data-nav]").forEach((a) => {
      a.addEventListener("click", () => document.getElementById("sidenav").classList.remove("open"));
    });
  },

  syncSaveChip() {
    const btn = document.getElementById("save-banner-btn");
    if (btn) btn.hidden = !Store.dirty;
  },

  showLogin() {
    document.getElementById("boot-screen").hidden = true;
    document.getElementById("app").hidden = true;
    document.getElementById("login-screen").hidden = false;
    this.pin = "";
    this.drawDots();
    this.tickLock();
    this.showLoginPanels("pin");
  },

  showApp() {
    document.getElementById("boot-screen").hidden = true;
    document.getElementById("login-screen").hidden = true;
    document.getElementById("app").hidden = false;
    const u = Auth.user();
    document.getElementById("who-chip").textContent = u.name + " · " + u.role;
    this.syncSaveChip();
    this.route();
  },

  pin: "",
  renderPinPad() {
    const pad = document.getElementById("pin-pad");
    const keys = ["1","2","3","4","5","6","7","8","9","clear","0","ok"];
    pad.innerHTML = keys.map((k) => {
      const label = k === "clear" ? "Clear" : k === "ok" ? "Enter" : k;
      const cls = k === "clear" || k === "ok" ? " pad-action" : "";
      return '<button type="button" class="' + cls + '" data-k="' + k + '">' + label + "</button>";
    }).join("");
    pad.onclick = async (e) => {
      const k = e.target.getAttribute("data-k");
      if (!k) return;
      if (Auth.lockedUntil()) { this.tickLock(); return; }
      if (k === "clear") this.pin = this.pin.slice(0, -1);
      else if (k === "ok") await this.submitPin();
      else if (this.pin.length < 6) this.pin += k;
      this.drawDots();
    };
  },

  drawDots() {
    const el = document.getElementById("pin-dots");
    el.innerHTML = Array.from({ length: Math.max(4, this.pin.length) }, (_, i) =>
      '<i class="' + (i < this.pin.length ? "on" : "") + '"></i>'
    ).join("");
  },

  tickLock() {
    const banner = document.getElementById("lockout-banner");
    const until = Auth.lockedUntil();
    if (!until) { banner.hidden = true; return; }
    const sec = Math.ceil((until - Date.now()) / 1000);
    banner.hidden = false;
    banner.textContent = "Please wait " + sec + "s before trying again.";
    setTimeout(() => this.tickLock(), 1000);
  },

  async submitPin() {
    const err = document.getElementById("pin-error");
    err.hidden = true;
    const res = await Auth.login(this.pin);
    if (res.ok) { this.pin = ""; this.showApp(); return; }
    this.pin = "";
    this.drawDots();
    document.querySelector(".login-card").classList.remove("shake");
    void document.querySelector(".login-card").offsetWidth;
    document.querySelector(".login-card").classList.add("shake");
    if (res.locked) this.tickLock();
    err.hidden = false;
    err.textContent = res.error || "Please try again.";
  },

  showLoginPanels(which) {
    document.getElementById("login-pin-panel").hidden = which !== "pin";
    document.getElementById("login-signup-panel").hidden = which !== "signup";
    document.getElementById("login-signup-done").hidden = which !== "done";
  },

  bindSignup() {
    const showBtn = document.getElementById("show-signup-btn");
    const form = document.getElementById("signup-form");
    if (showBtn) showBtn.onclick = () => {
      const err = document.getElementById("signup-error");
      if (err) err.hidden = true;
      this.showLoginPanels("signup");
    };
    document.querySelectorAll("[data-login-back]").forEach((b) => {
      b.onclick = () => this.showLoginPanels("pin");
    });
    if (form) form.onsubmit = (e) => {
      e.preventDefault();
      this.submitSignup(form);
    };
  },

  normName(first, last) {
    return (String(first || "") + " " + String(last || "")).trim().toLowerCase().replace(/\s+/g, " ");
  },

  personNameKey(p) {
    if (p.firstName || p.lastName) return this.normName(p.firstName, p.lastName);
    return this.normName(p.name || "", "");
  },

  nameTaken(first, last) {
    const key = this.normName(first, last);
    const users = Store.data.users || [];
    const pending = Store.data.pendingUsers || [];
    return users.some((u) => this.personNameKey(u) === key) ||
      pending.some((p) => this.personNameKey(p) === key);
  },

  async submitSignup(form) {
    const first = UI.val(form, "firstName");
    const last = UI.val(form, "lastName");
    const pin = UI.val(form, "pin").replace(/\D/g, "");
    const err = document.getElementById("signup-error");
    const showErr = (msg) => { err.hidden = false; err.textContent = msg; };
    if (!first || !last) return showErr("Please enter your name and surname.");
    if (!/^\d{6}$/.test(pin)) return showErr("PIN must be 6 digits.");
    if (this.nameTaken(first, last)) return showErr("That name already has an account or a request waiting.");
    const salt = CryptoUtil.randomSalt();
    Store.data.pendingUsers = Store.data.pendingUsers || [];
    Store.data.pendingUsers.push({
      id: CryptoUtil.uid("p"),
      firstName: first,
      lastName: last,
      name: first + " " + last,
      pinSalt: salt,
      pinHash: await CryptoUtil.hashPin(pin, salt),
      requestedAt: new Date().toISOString()
    });
    Store.log("request", "user", "", first + " " + last + " asked for a PIN");
    Store.save();
    form.reset();
    this.showLoginPanels("done");
  },

  route() {
    const raw = (location.hash || "#dashboard").replace(/^#/, "");
    const [view, ...rest] = raw.split("/");
    this.view = view || "dashboard";
    this.params = { id: rest[0] ? decodeURIComponent(rest[0]) : "", extra: rest.slice(1).join("/") };
    document.querySelectorAll("[data-nav]").forEach((a) => {
      a.classList.toggle("active", a.getAttribute("data-nav") === this.view ||
        (this.view === "search" && a.getAttribute("data-nav") === "dashboard"));
    });
    const map = {
      dashboard: () => this.renderDashboard(),
      calendar: () => this.renderCalendar(),
      travel: () => this.renderTravel(),
      maintenance: () => this.renderMaintenance(),
      house: () => this.renderHouse(),
      restaurants: () => this.renderGuide(),
      guide: () => this.renderGuide(),
      expenses: () => this.renderExpenses(),
      ideas: () => this.renderIdeas(),
      announcements: () => this.renderNews(),
      settings: () => this.renderSettings(),
      search: () => this.renderSearch(),
      documents: () => { this.houseTab = "docs"; this.renderHouse(); },
      contacts: () => { this.houseTab = "people"; this.renderHouse(); }
    };
    (map[this.view] || map.dashboard)();
  },

  dirtyBar() {
    if (!Store.dirty) return "";
    return '<div class="dirty-bar"><span>You have unsaved changes. Download the data files and put them back in the GitHub repo (or save with a token in Settings).</span><span class="actions"><button class="btn primary" type="button" id="bar-save">Save</button></span></div>';
  },

  afterRender() {
    const bar = document.getElementById("bar-save");
    if (bar) bar.onclick = () => this.openSave();
    this.syncSaveChip();
  },

  head(title, sub, actions) {
    return this.dirtyBar() + '<div class="page-head"><div><h2>' + UI.esc(title) + "</h2><p>" + UI.esc(sub) +
      '</p></div><div class="actions">' + (actions || "") + "</div></div>";
  },

  async renderDashboard() {
    const d = Store.data;
    const here = Store.currentStays();
    const next = Store.upcomingBookings().slice(0, 4);
    const open = Store.openIssues();
    const due = Store.dueRecurring();
    const news = (d.announcements || []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
    const recentFix = (d.maintenance || []).filter((m) => m.status === "completed").slice(0, 3);
    const docs = (d.documents || []).slice(0, 3);
    const view = document.getElementById("view");
    view.innerHTML = this.head("Welcome home", d.house.place + " · " + (d.house.region || ""),
      '<a class="btn primary" href="#calendar">New stay</a><a class="btn" href="#maintenance">Report issue</a>') +
      this.holidayDashNote() +
      '<div class="grid stats">' +
        this.stat(here.length ? here[0].guests.split(",")[0] : "Empty", "Who is here") +
        this.stat(next.length, "Upcoming stays") +
        this.stat(open.length, "Open issues") +
        this.stat(due.length, "Tasks due") +
      "</div>" +
      this.dashMoney() +
      '<div class="grid two" style="margin-top:16px">' +
        '<div class="card"><h3>Who is at the house?</h3>' + this.whoBlock(here, next) + "</div>" +
        '<div class="card" id="weather-card"><h3>Weather · La Croix-Valmer</h3><p class="muted">Checking the sky…</p></div>' +
      "</div>" +
      '<div class="grid two" style="margin-top:16px">' +
        '<div class="card"><h3>Open maintenance</h3>' + this.issueList(open.slice(0, 4)) +
          '<p><a href="#maintenance">All issues</a></p></div>' +
        '<div class="card"><h3>Due around the house</h3>' + this.recurringList(due.length ? due : d.recurring.slice(0, 3)) + "</div>" +
      "</div>" +
      '<div class="grid two" style="margin-top:16px">' +
        '<div class="card"><h3>News</h3>' + news.map((a) => "<div class='row'><div><b>" + UI.esc(a.title) + "</b><div class='muted'>" + UI.esc(a.body) + "</div></div></div>").join("") + "</div>" +
        '<div class="card"><h3>Travel</h3><p>London to Nice, Marseille or Toulon — then a short drive to La Croix-Valmer.</p>' +
          '<div class="quick-links"><a href="#travel">Compare flights</a></div>' +
          '<p class="muted" id="travel-hint">Most convenient is often Gatwick → Toulon (direct), then about an hour by car.</p></div>' +
      "</div>" +
      '<div class="grid two" style="margin-top:16px">' +
        '<div class="card"><h3>Recent repairs</h3>' + (recentFix.length ? recentFix.map((m) => "<div class='row'><span>" + UI.esc(m.title) + "</span><span class='chip done'>Done</span></div>").join("") : "<p class='empty'>None yet.</p>") + "</div>" +
        '<div class="card"><h3>Documents</h3>' + docs.map((doc) => "<div class='row'><a href='#house'>" + UI.esc(doc.title) + "</a><span class='chip'>" + UI.esc(doc.category) + "</span></div>").join("") + "</div>" +
      "</div>" +
      '<div class="card" style="margin-top:16px"><h3>Quick links</h3><div class="quick-links">' +
        '<a href="#calendar">Calendar</a><a href="#house">House guide</a><a href="#house">Map & shut-offs</a>' +
        '<a href="#travel">Travel</a><a href="#guide">Local guide</a><a href="#expenses">Expenses</a></div></div>';
    this.afterRender();
    document.querySelector('[href="#calendar"].btn') && (document.querySelector("a.btn.primary").onclick = (e) => {
      e.preventDefault(); location.hash = "calendar"; setTimeout(() => this.bookingForm(), 50);
    });
    const w = await UI.weather();
    const box = document.getElementById("weather-card");
    if (box) {
      if (!w || !w.current) box.innerHTML = "<h3>Weather · La Croix-Valmer</h3><p class='muted'>Weather unavailable offline — try again when you have a signal.</p>";
      else box.innerHTML = "<h3>Weather · La Croix-Valmer</h3><p class='price'>" + Math.round(w.current.temperature_2m) + "°</p><p>" + UI.weatherLabel(w.current.weather_code) +
        (w.daily ? " · High " + Math.round(w.daily.temperature_2m_max[0]) + "° / low " + Math.round(w.daily.temperature_2m_min[0]) + "°" : "") + "</p>";
    }
    Flights.getFares().then((fares) => {
      const h = Flights.highlights(fares);
      const el = document.getElementById("travel-hint");
      if (el && h.convenient) el.textContent = "Suggested: " + h.convenient.from + " → " + h.convenient.to + " with " + h.convenient.airline +
        (h.convenient.direct ? " (direct)" : "") + ". Drive " + h.convenient.drive.label + ".";
    });
  },

  holidayDashNote() {
    const t = UI.today();
    const now = Store.holidayOn(t);
    const soon = (Store.data.schoolHolidays || []).filter((h) => h.start > t).sort((a, b) => a.start.localeCompare(b.start))[0];
    if (!now && !soon) return "";
    const names = Store.prioritySchoolNames();
    if (now) {
      return '<div class="holiday-banner">School holiday now (' + UI.esc(now.label) + '). ' +
        UI.esc(names) + " families have priority.</div>";
    }
    return '<div class="holiday-banner soft">Next school holiday: <b>' + UI.esc(soon.label) + "</b> · " +
      UI.fmt(soon.start) + " – " + UI.fmt(soon.end) + ". " + UI.esc(names) + " families have priority.</div>";
  },

  holidayBannerHtml(arrival, departure) {
    const hits = Store.holidaysOverlapping(arrival, departure);
    if (!hits.length) return "";
    return '<div class="holiday-banner">School holiday — ' + UI.esc(Store.prioritySchoolNames()) +
      " families have priority." +
      '<div class="muted" style="font-weight:500;margin-top:6px">' +
      hits.map((h) => UI.esc(h.label) + " · " + UI.fmt(h.start) + " – " + UI.fmt(h.end)).join("<br>") +
      "</div></div>";
  },

  needsHolidayAck(arrival, departure, status) {
    if (status === "blocked") return false;
    if (!Store.holidaysOverlapping(arrival, departure).length) return false;
    if (Auth.isAdmin()) return false;
    if (Store.isSchoolPriority(Auth.user())) return false;
    return true;
  },

  holidayAckHtml(arrival, departure, status) {
    if (!this.needsHolidayAck(arrival, departure, status)) return "";
    return '<label class="check-item" id="bk-ack-wrap"><input type="checkbox" name="holidayAck" id="bk-ack">' +
      "<span>These dates are a school holiday. I have picked other dates if I can, or I understand a school family / the house admin may need to confirm.</span></label>";
  },

  costBoxHtml(est, arrival, departure) {
    const out = arrival || UI.today();
    const back = departure || UI.addDays(out, 7);
    const links = (est && est.links) || Flights.liveLinks("LGW", "TLN", out, back, 2);
    let body = '<p>Search live prices on Skyscanner below for these dates.</p>';
    if (est && est.live && est.lowPp) {
      body = "<p>About <b>£" + est.lowPp + (est.highPp && est.highPp !== est.lowPp ? "–£" + est.highPp : "") +
        "</b> return pp · about <b>£" + est.lowTotal +
        (est.highTotal !== est.lowTotal ? "–£" + est.highTotal : "") + "</b> for " + est.guests +
        " guest" + (est.guests === 1 ? "" : "s") + ".</p>";
    }
    return '<div class="cost-box" id="bk-cost"><p class="guide-price">Flights for these dates</p>' +
      body +
      Flights.widgetHtml({ from: "LGW", to: "TLN", date: out, back: back }) +
      '<p class="muted">Or open the airline with the same dates.</p>' +
      Flights.buttonsHtml(links) +
      '<p><a href="#travel">Open Travel</a></p></div>';
  },

  stat(n, label) {
    return '<div class="card stat"><b>' + UI.esc(n) + "</b><span>" + UI.esc(label) + "</span></div>";
  },

  dashMoney() {
    const s = Store.moneySummary();
    return '<div class="grid stats" style="margin-top:16px">' +
      this.stat(Store.pound(s.month), "Spent this month") +
      this.stat(Store.pound(s.year), "Spent this year") +
      this.stat(Store.pound(s.owed), "Still to settle") +
      this.stat(s.largest[0] ? Store.pound(s.largest[0].amount) : "—", "Largest bill") +
      '</div><p class="muted" style="margin:8px 0 0"><a href="#expenses">Open expenses</a>' +
      (s.recent[0] ? " · Latest: " + UI.esc(s.recent[0].description) + " " + Store.pound(s.recent[0].amount) : "") + "</p>";
  },

  whoBlock(here, next) {
    if (!here.length) {
      const n = next[0];
      return "<p>The house is empty right now.</p>" + (n ? "<p>Next: <b>" + UI.esc(n.guests || "A stay") + "</b> from " + UI.fmt(n.arrival) + ".</p>" : "");
    }
    return here.map((b) => "<div class='row'><div><b>" + UI.esc(b.guests || "Guests") + "</b><div class='muted'>Until " + UI.fmt(b.departure) + " · " + b.guestCount + " guests</div></div><a href='#calendar'>Stay</a></div>").join("") +
      (next[0] ? "<p class='muted'>Next arrival: " + UI.esc(next[0].guests || "guests") + " on " + UI.fmt(next[0].arrival) + ".</p>" : "");
  },

  issueList(items) {
    if (!items.length) return "<p class='empty'>Nothing open. Nice.</p>";
    return items.map((m) => "<div class='row'><div><b>" + UI.esc(m.title) + "</b><div class='muted'>" + UI.esc(m.category) + " · " + UI.esc(m.priority) + "</div></div><span class='chip " + m.priority + "'>" + UI.esc(this.statusLabel(m.status)) + "</span></div>").join("");
  },

  recurringList(items) {
    if (!items.length) return "<p class='empty'>All clear.</p>";
    return items.map((r) => "<div class='row'><div><b>" + UI.esc(r.title) + "</b><div class='muted'>Next " + UI.fmt(r.nextDue) + " · " + UI.esc(Store.contactName(r.assignedContactId)) + "</div></div></div>").join("");
  },

  statusLabel(s) {
    return ({ reported: "Reported", reviewed: "Being reviewed", assigned: "Assigned", progress: "In progress", completed: "Completed" })[s] || s;
  },

  renderCalendar() {
    if (!this.cal.cursor) this.cal.cursor = UI.today().slice(0, 7) + "-01";
    const mode = this.cal.mode;
    const view = document.getElementById("view");
    view.innerHTML = this.head("Calendar", "Green free · Blue booked · Red blocked · Gold flag = school holiday",
      (Auth.canEdit() ? '<button class="btn primary" id="add-stay" type="button">Add stay</button><button class="btn" id="add-block" type="button">Block dates</button>' : "")) +
      this.holidayDashNote() +
      '<div class="legend"><span><i class="swatch available"></i>Available</span><span><i class="swatch booked"></i>Booked</span><span><i class="swatch blocked"></i>Blocked</span><span><i class="swatch holiday"></i>School holiday</span></div>' +
      '<div class="filters"><div class="seg">' +
        ["month","week","list"].map((m) => '<button type="button" data-mode="' + m + '" class="' + (mode === m ? "on" : "") + '">' + m[0].toUpperCase() + m.slice(1) + "</button>").join("") +
      '</div><div class="actions"><button class="btn ghost" id="cal-prev" type="button">Back</button><button class="btn ghost" id="cal-today" type="button">Today</button><button class="btn ghost" id="cal-next" type="button">Next</button></div></div>' +
      '<div id="cal-body"></div><div class="card" style="margin-top:16px"><h3>Booking history</h3><div id="cal-hist"></div></div>';
    this.paintCal();
    view.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => { this.cal.mode = b.getAttribute("data-mode"); this.renderCalendar(); });
    document.getElementById("cal-prev").onclick = () => this.shiftCal(-1);
    document.getElementById("cal-next").onclick = () => this.shiftCal(1);
    document.getElementById("cal-today").onclick = () => { this.cal.cursor = UI.today().slice(0, 7) + "-01"; this.renderCalendar(); };
    const add = document.getElementById("add-stay");
    if (add) add.onclick = () => this.bookingForm();
    const blk = document.getElementById("add-block");
    if (blk) blk.onclick = () => this.bookingForm({ status: "blocked" });
    this.afterRender();
  },

  shiftCal(dir) {
    const d = new Date(this.cal.cursor + "T12:00:00");
    if (this.cal.mode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    this.cal.cursor = d.toISOString().slice(0, 10);
    this.paintCal();
  },

  paintCal() {
    const body = document.getElementById("cal-body");
    const hist = document.getElementById("cal-hist");
    if (!body) return;
    if (this.cal.mode === "list") body.innerHTML = this.calList();
    else if (this.cal.mode === "week") body.innerHTML = this.calWeek();
    else body.innerHTML = this.calMonth();
    const all = (Store.data.bookings || []).slice().sort((a, b) => b.arrival.localeCompare(a.arrival));
    hist.innerHTML = all.length ? '<table class="table"><tr><th>Dates</th><th>Who</th><th>Status</th><th></th></tr>' +
      all.map((b) => "<tr><td>" + UI.fmt(b.arrival) + " – " + UI.fmt(b.departure) + "</td><td>" + UI.esc(b.guests || b.notes || "—") +
        "</td><td><span class='chip " + (b.status === "blocked" ? "open" : b.status === "cancelled" ? "rejected" : "done") + "'>" + b.status +
        "</span></td><td><button class='text-btn' data-open='" + b.id + "'>Open</button></td></tr>").join("") + "</table>"
      : "<p class='empty'>No stays yet.</p>";
    body.querySelectorAll("[data-day]").forEach((el) => el.onclick = () => this.onDay(el.getAttribute("data-day")));
    hist.querySelectorAll("[data-open]").forEach((el) => el.onclick = () => this.openBooking(el.getAttribute("data-open")));
    body.querySelectorAll("[data-open]").forEach((el) => el.onclick = (e) => { e.stopPropagation(); this.openBooking(el.getAttribute("data-open")); });
  },

  calMonth() {
    const start = new Date(this.cal.cursor.slice(0, 7) + "-01T12:00:00");
    const title = start.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const firstDow = (start.getDay() + 6) % 7;
    const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    let html = "<h3>" + title + '</h3><div class="cal-grid">' +
      ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => '<div class="cal-dow">' + d + "</div>").join("");
    for (let i = 0; i < firstDow; i++) html += '<div class="cal-day out"></div>';
    for (let day = 1; day <= days; day++) {
      const iso = start.toISOString().slice(0, 8) + String(day).padStart(2, "0");
      const st = Store.dayStatus(iso);
      const hol = Store.holidayOn(iso);
      const stays = (Store.data.bookings || []).filter((b) => b.status !== "cancelled" && b.arrival <= iso && iso < b.departure);
      html += '<div class="cal-day ' + st + (hol ? " holiday" : "") + (iso === UI.today() ? " today" : "") + '" data-day="' + iso + '"><b>' + day +
        (hol ? ' <span class="cal-flag" title="' + UI.esc(hol.label) + '">H</span>' : "") + "</b>" +
        stays.map((b) => '<a class="cal-pill" data-open="' + b.id + '">' + UI.esc((b.guests || b.notes || b.status).slice(0, 22)) + "</a>").join("") +
        "</div>";
    }
    return html + "</div>";
  },

  calWeek() {
    const d = new Date(this.cal.cursor + "T12:00:00");
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    let html = '<div class="cal-grid">';
    for (let i = 0; i < 7; i++) {
      const iso = d.toISOString().slice(0, 10);
      const stays = (Store.data.bookings || []).filter((b) => b.status !== "cancelled" && b.arrival <= iso && iso < b.departure);
      const hol = Store.holidayOn(iso);
      html += '<div class="cal-day week-col ' + Store.dayStatus(iso) + (hol ? " holiday" : "") + '" data-day="' + iso + '"><b>' +
        d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) +
        (hol ? ' <span class="cal-flag">H</span>' : "") + "</b>" +
        stays.map((b) => "<div class='cal-pill' data-open='" + b.id + "'>" + UI.esc(b.guests || b.notes || b.status) + "</div>").join("") +
        "</div>";
      d.setDate(d.getDate() + 1);
    }
    return html + "</div>";
  },

  calList() {
    const t = UI.today();
    const future = (Store.data.bookings || []).filter((b) => b.status !== "cancelled" && b.departure >= t).sort((a, b) => a.arrival.localeCompare(b.arrival));
    const past = (Store.data.bookings || []).filter((b) => b.status !== "cancelled" && b.departure < t).sort((a, b) => b.arrival.localeCompare(a.arrival));
    const block = (title, rows) => "<div class='card' style='margin-bottom:12px'><h3>" + title + "</h3>" +
      (rows.length ? rows.map((b) => "<div class='row'><div><b>" + UI.esc(b.guests || b.notes || "Stay") + "</b><div class='muted'>" +
        UI.fmt(b.arrival) + " – " + UI.fmt(b.departure) + " · " + (b.guestCount || 0) + " guests · " + b.status +
        (Store.holidaysOverlapping(b.arrival, b.departure).length ? " · school holiday" : "") +
        "</div></div><button class='btn' data-open='" + b.id + "'>Open</button></div>").join("") : "<p class='empty'>None</p>") + "</div>";
    return block("Coming up", future) + block("Past", past);
  },

  onDay(iso) {
    const stays = (Store.data.bookings || []).filter((b) => b.status !== "cancelled" && b.arrival <= iso && iso < b.departure);
    if (stays.length === 1) return this.openBooking(stays[0].id);
    if (stays.length > 1) return this.openBooking(stays[0].id);
    if (Auth.canEdit()) this.bookingForm({ arrival: iso, departure: UI.addDays(iso, 7) });
  },

  openBooking(id) {
    const b = Store.data.bookings.find((x) => x.id === id);
    if (!b) return;
    const rec = (Store.data.checklistRecords || []).find((r) => r.bookingId === b.id);
    UI.modal((b.status === "blocked" ? "Blocked" : "Stay") + " · " + UI.fmt(b.arrival),
      this.holidayBannerHtml(b.arrival, b.departure) +
      "<p><b>" + UI.esc(b.guests || "—") + "</b></p><p>" + UI.fmt(b.arrival) + " → " + UI.fmt(b.departure) + " · " + (b.guestCount || 0) + " guests</p>" +
      "<p>" + UI.esc(b.notes || "") + "</p><p class='muted'>Booked by " + UI.esc(Store.userName(b.createdBy)) + " · " + b.status + "</p>" +
      (rec ? "<p>Departure checklist completed " + UI.fmtTime(rec.completedAt) + ".</p>" : "<p><a href='#house'>Open departure checklist</a></p>"),
      '<div class="actions">' +
        (Auth.canEdit() && b.status !== "cancelled" ? '<button class="btn" id="ed-b">Edit</button>' : "") +
        (Auth.canEdit() && b.status === "booked" ? '<button class="btn danger" id="cx-b">Cancel stay</button>' : "") +
        "</div>");
    const ed = document.getElementById("ed-b");
    if (ed) ed.onclick = () => this.bookingForm(b);
    const cx = document.getElementById("cx-b");
    if (cx) cx.onclick = () => {
      if (!UI.confirm("Cancel this stay?")) return;
      b.status = "cancelled";
      b.cancelledBy = Auth.user().id;
      b.cancelledAt = new Date().toISOString();
      Store.log("cancel", "booking", b.id, b.guests);
      Store.save();
      UI.closeModal();
      UI.toast("Stay cancelled");
      this.renderCalendar();
    };
  },

  bookingForm(existing) {
    const b = existing || { arrival: UI.today(), departure: UI.addDays(UI.today(), 7), guestCount: 2, guests: "", notes: "", status: "booked" };
    UI.modal(existing && existing.id ? "Edit stay" : (b.status === "blocked" ? "Block dates" : "New stay"),
      '<form id="bk-form">' +
        '<div class="field-row"><label class="field"><span>Arrival</span><input name="arrival" type="date" value="' + UI.esc(b.arrival || "") + '" required></label>' +
        '<label class="field"><span>Departure</span><input name="departure" type="date" value="' + UI.esc(b.departure || "") + '" required></label></div>' +
        '<div id="bk-hol">' + this.holidayBannerHtml(b.arrival, b.departure) + "</div>" +
        '<div id="bk-cost" class="cost-box"><p class="guide-price">Flights for these dates</p><p class="muted">Preparing airline links…</p></div>' +
        '<label class="field"><span>Who is staying</span><input name="guests" value="' + UI.esc(b.guests || "") + '" placeholder="Names"></label>' +
        '<label class="field"><span>Guest count</span><input name="guestCount" type="number" min="0" value="' + (b.guestCount || 0) + '"></label>' +
        '<label class="field"><span>Notes</span><textarea name="notes" rows="3">' + UI.esc(b.notes || "") + "</textarea></label>" +
        (Auth.isAdmin() ? '<label class="field"><span>Type</span><select name="status"><option value="booked"' + (b.status !== "blocked" ? " selected" : "") + ">Booked</option><option value='blocked'" + (b.status === "blocked" ? " selected" : "") + ">Blocked / unavailable</option></select></label>" : '<input type="hidden" name="status" value="' + UI.esc(b.status || "booked") + '">') +
        '<div id="bk-ack-slot">' + this.holidayAckHtml(b.arrival, b.departure, b.status) + "</div>" +
        '<div id="bk-warn" class="pin-error" hidden></div>' +
        '<div class="actions"><button class="btn primary" type="submit">Save</button></div></form>');
    const form = document.getElementById("bk-form");
    const refreshExtras = () => {
      const arrival = UI.val(form, "arrival");
      const departure = UI.val(form, "departure");
      const status = UI.val(form, "status") || b.status || "booked";
      const guests = UI.val(form, "guestCount");
      document.getElementById("bk-hol").innerHTML = this.holidayBannerHtml(arrival, departure);
      document.getElementById("bk-ack-slot").innerHTML = this.holidayAckHtml(arrival, departure, status);
      Flights.estimateReturn(arrival, departure, guests).then((est) => {
        const box = document.getElementById("bk-cost");
        if (box) box.outerHTML = this.costBoxHtml(est, arrival, departure);
        Flights.mountWidget();
      });
    };
    form.elements.arrival.onchange = refreshExtras;
    form.elements.departure.onchange = refreshExtras;
    form.elements.guestCount.onchange = refreshExtras;
    refreshExtras();
    form.onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      const next = {
        id: b.id || CryptoUtil.uid("b"),
        arrival: UI.val(f, "arrival"),
        departure: UI.val(f, "departure"),
        guests: UI.val(f, "guests"),
        guestCount: Number(UI.val(f, "guestCount") || 0),
        notes: UI.val(f, "notes"),
        status: UI.val(f, "status") || "booked",
        createdBy: b.createdBy || Auth.user().id,
        createdAt: b.createdAt || new Date().toISOString()
      };
      if (next.departure <= next.arrival) {
        document.getElementById("bk-warn").hidden = false;
        document.getElementById("bk-warn").textContent = "Departure must be after arrival.";
        return;
      }
      if (this.needsHolidayAck(next.arrival, next.departure, next.status)) {
        const ack = document.getElementById("bk-ack");
        if (!ack || !ack.checked) {
          document.getElementById("bk-warn").hidden = false;
          document.getElementById("bk-warn").textContent = "School holiday — pick other dates, or tick the box if the house admin is happy for you to continue.";
          return;
        }
        next.holidayAck = true;
        next.holidayAckAt = new Date().toISOString();
        next.holidayAckBy = Auth.user().id;
      }
      const clash = Store.bookingConflict(next);
      if (clash) {
        document.getElementById("bk-warn").hidden = false;
        document.getElementById("bk-warn").textContent = "Those dates overlap another stay or block (" + (clash.guests || clash.notes || clash.arrival) + "). Same-day checkout / check-in is fine.";
        return;
      }
      const i = Store.data.bookings.findIndex((x) => x.id === next.id);
      if (i >= 0) Store.data.bookings[i] = next;
      else Store.data.bookings.push(next);
      Store.log(b.id ? "edit" : "create", "booking", next.id, next.guests || next.status);
      Store.save();
      UI.closeModal();
      UI.toast("Stay saved");
      this.renderCalendar();
    };
  },

  renderMaintenance() {
    const id = this.params.id;
    if (id && Store.data.maintenance.find((m) => m.id === id)) return this.renderIssue(id);
    const q = this.maintFilter || { status: "", priority: "", category: "", reporter: "" };
    this.maintFilter = q;
    let rows = Store.data.maintenance.slice().sort((a, b) => b.date.localeCompare(a.date));
    if (q.status) rows = rows.filter((m) => m.status === q.status);
    if (q.priority) rows = rows.filter((m) => m.priority === q.priority);
    if (q.category) rows = rows.filter((m) => m.category === q.category);
    if (q.reporter) rows = rows.filter((m) => m.reporter === q.reporter);
    const open = Store.openIssues();
    const count = (p) => open.filter((m) => m.priority === p).length;
    const done = Store.data.maintenance.filter((m) => m.status === "completed").slice(0, 3);
    const view = document.getElementById("view");
    view.innerHTML = this.head("Maintenance", "Report something. We will track it.",
      '<button class="btn primary" id="new-issue" type="button">Report an issue</button>') +
      '<div class="grid stats">' +
        this.stat(open.length, "Open") + this.stat(count("urgent"), "Urgent") +
        this.stat(count("important"), "Important") + this.stat(count("minor"), "Minor") +
      "</div>" +
      '<div class="filters" style="margin-top:16px">' +
        this.select("mf-status", [["","All status"],["reported","Reported"],["reviewed","Being reviewed"],["assigned","Assigned"],["progress","In progress"],["completed","Completed"]], q.status) +
        this.select("mf-pri", [["","All priority"],["urgent","Urgent"],["important","Important"],["minor","Minor"]], q.priority) +
        this.select("mf-cat", [["","All categories"]].concat(this.maintCats().map((c) => [c, c])), q.category) +
      "</div>" +
      '<div class="grid cards">' + rows.map((m) =>
        '<a class="card" href="#maintenance/' + m.id + '" style="text-decoration:none;color:inherit"><h3>' + UI.esc(m.title) +
        '</h3><p class="muted">' + UI.esc(m.category) + " · " + UI.fmt(m.date) + '</p><div class="meta"><span class="chip ' + m.priority + '">' +
        m.priority + '</span> <span class="chip">' + UI.esc(this.statusLabel(m.status)) + "</span></div></a>"
      ).join("") + "</div>" +
      (done.length ? "<div class='card' style='margin-top:16px'><h3>Recently completed</h3>" + done.map((m) => "<div class='row'><span>" + UI.esc(m.title) + "</span><span class='muted'>" + UI.fmt(m.date) + "</span></div>").join("") + "</div>" : "");
    document.getElementById("new-issue").onclick = () => this.issueForm();
    ["mf-status","mf-pri","mf-cat"].forEach((id) => {
      const el = document.getElementById(id);
      el.onchange = () => {
        this.maintFilter = { status: document.getElementById("mf-status").value, priority: document.getElementById("mf-pri").value, category: document.getElementById("mf-cat").value };
        this.renderMaintenance();
      };
    });
    this.afterRender();
  },

  select(id, opts, val) {
    return '<select id="' + id + '" class="search-box" style="width:auto;min-width:160px">' +
      opts.map((o) => "<option value='" + UI.esc(o[0]) + "'" + (o[0] === val ? " selected" : "") + ">" + UI.esc(o[1]) + "</option>").join("") + "</select>";
  },

  maintCats() { return ["Pool","Plumbing","Electrical","Garden","Cleaning","Furniture","Appliances","Security","General"]; },
  flow() { return ["reported","reviewed","assigned","progress","completed"]; },

  renderIssue(id) {
    const m = Store.data.maintenance.find((x) => x.id === id);
    const comments = Store.data.comments.filter((c) => c.parentType === "maintenance" && c.parentId === id);
    const view = document.getElementById("view");
    view.innerHTML = this.head(m.title, m.category + " · " + UI.fmt(m.date) + " · " + Store.userName(m.reporter),
      '<a class="btn" href="#maintenance">Back</a>') +
      '<div class="card"><div class="flow">' + this.flow().map((s) => "<span class='" + (s === m.status ? "on" : "") + "'>" + UI.esc(this.statusLabel(s)) + "</span>").join("") + "</div>" +
      "<p>" + UI.esc(m.description) + "</p>" +
      "<p><span class='chip " + m.priority + "'>" + m.priority + "</span> · Contractor: " + UI.esc(Store.contactName(m.assignedContractorId)) +
      (m.estimatedCompletion ? " · Due " + UI.fmt(m.estimatedCompletion) : "") + "</p>" +
      (m.completionNotes ? "<p><b>Completion notes</b><br>" + UI.esc(m.completionNotes) + "</p>" : "") +
      this.media(m.photos, m.videos) + this.media(m.invoices, [], "Invoices") +
      (Auth.isAdmin() || Auth.canEdit() ? '<div class="actions"><button class="btn" id="up-issue">Update</button></div>' : "") +
      "</div>" +
      '<div class="card" style="margin-top:16px"><h3>Comments</h3>' +
      comments.map((c) => "<div class='comment'><b>" + UI.esc(Store.userName(c.createdBy)) + "</b> · " + UI.fmtTime(c.at || c.createdAt) + "<div>" + UI.esc(c.text) + "</div></div>").join("") +
      '<form id="c-form"><label class="field"><span>Add a note</span><textarea name="text" rows="3" required></textarea></label><button class="btn primary" type="submit">Comment</button></form></div>';
    const up = document.getElementById("up-issue");
    if (up) up.onclick = () => this.issueForm(m);
    document.getElementById("c-form").onsubmit = (e) => {
      e.preventDefault();
      Store.data.comments.push({ id: CryptoUtil.uid("cm"), parentType: "maintenance", parentId: id, text: UI.val(e.target, "text"), createdBy: Auth.user().id, createdAt: new Date().toISOString() });
      Store.log("comment", "maintenance", id, "");
      Store.save();
      this.renderIssue(id);
    };
    this.afterRender();
  },

  media(photos, videos, title) {
    photos = photos || []; videos = videos || [];
    if (!photos.length && !videos.length) return title ? "" : "";
    return (title ? "<h3>" + title + "</h3>" : "") + '<div class="media-row">' +
      photos.map((p) => "<img src='" + p.data + "' alt='" + UI.esc(p.name || "photo") + "'>").join("") +
      (videos || []).map((v) => "<video src='" + v.data + "' controls></video>").join("") + "</div>";
  },

  issueForm(existing) {
    const m = existing || { title: "", description: "", category: "General", priority: "important", status: "reported", date: UI.today(), assignedContractorId: "", estimatedCompletion: "", completionNotes: "", photos: [], videos: [], invoices: [] };
    const contractors = Store.data.contacts.filter((c) => ["pool","cleaner","electrician","plumber","gardener","builder","manager"].includes(c.category));
    UI.modal(existing ? "Update issue" : "Report an issue",
      '<form id="is-form">' +
        '<label class="field"><span>Title</span><input name="title" required value="' + UI.esc(m.title) + '"></label>' +
        '<label class="field"><span>What happened</span><textarea name="description" rows="4" required>' + UI.esc(m.description) + "</textarea></label>" +
        '<div class="field-row"><label class="field"><span>Category</span><select name="category">' + this.maintCats().map((c) => "<option" + (c === m.category ? " selected" : "") + ">" + c + "</option>").join("") + "</select></label>" +
        '<label class="field"><span>Priority</span><select name="priority"><option value="urgent">Urgent</option><option value="important">Important</option><option value="minor">Minor</option></select></label></div>' +
        (Auth.isAdmin() ? '<label class="field"><span>Status</span><select name="status">' + this.flow().map((s) => "<option value='" + s + "'" + (s === m.status ? " selected" : "") + ">" + this.statusLabel(s) + "</option>").join("") + "</select></label>" +
          '<label class="field"><span>Assigned contractor</span><select name="assignedContractorId"><option value="">None</option>' +
          contractors.map((c) => "<option value='" + c.id + "'" + (c.id === m.assignedContractorId ? " selected" : "") + ">" + UI.esc(c.name) + "</option>").join("") + "</select></label>" +
          '<label class="field"><span>Estimated completion</span><input type="date" name="estimatedCompletion" value="' + UI.esc(m.estimatedCompletion || "") + '"></label>' +
          '<label class="field"><span>Completion notes</span><textarea name="completionNotes" rows="2">' + UI.esc(m.completionNotes || "") + "</textarea></label>" +
          '<label class="field"><span>Invoice / receipt</span><input type="file" name="invoice" accept="image/*,.pdf"></label>' : "") +
        '<label class="field"><span>Photos</span><input type="file" name="photos" accept="image/*" multiple></label>' +
        '<label class="field"><span>Video</span><input type="file" name="videos" accept="video/*" multiple></label>' +
        '<button class="btn primary" type="submit">Save</button></form>');
    const form = document.getElementById("is-form");
    form.elements.priority.value = m.priority;
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const photos = m.photos ? m.photos.slice() : [];
        const videos = m.videos ? m.videos.slice() : [];
        const invoices = m.invoices ? m.invoices.slice() : [];
        for (const f of form.elements.photos.files) photos.push(await UI.fileToData(f, 3));
        for (const f of form.elements.videos.files) videos.push(await UI.fileToData(f, 6));
        if (form.elements.invoice && form.elements.invoice.files[0]) invoices.push(await UI.fileToData(form.elements.invoice.files[0], 3));
        const next = {
          id: m.id || CryptoUtil.uid("m"),
          title: UI.val(form, "title"),
          description: UI.val(form, "description"),
          category: UI.val(form, "category"),
          priority: UI.val(form, "priority"),
          status: form.elements.status ? UI.val(form, "status") : (m.status || "reported"),
          reporter: m.reporter || Auth.user().id,
          date: m.date || UI.today(),
          assignedContractorId: form.elements.assignedContractorId ? UI.val(form, "assignedContractorId") : (m.assignedContractorId || ""),
          estimatedCompletion: form.elements.estimatedCompletion ? UI.val(form, "estimatedCompletion") : "",
          completionNotes: form.elements.completionNotes ? UI.val(form, "completionNotes") : "",
          photos, videos, invoices,
          createdBy: m.createdBy || Auth.user().id,
          createdAt: m.createdAt || new Date().toISOString()
        };
        const i = Store.data.maintenance.findIndex((x) => x.id === next.id);
        if (i >= 0) Store.data.maintenance[i] = next;
        else Store.data.maintenance.unshift(next);
        Store.log(m.id ? "edit" : "report", "maintenance", next.id, next.title);
        Store.save();
        UI.closeModal();
        location.hash = "maintenance/" + next.id;
        this.route();
      } catch (err) { UI.toast(err.message); }
    };
  },

  renderHouse() {
    const tabs = [
      ["guide", "Guide"], ["map", "Map"], ["stock", "Inventory"],
      ["leave", "Leaving"], ["money", "Money"], ["docs", "Documents"], ["people", "People"]
    ];
    if (!tabs.find((t) => t[0] === this.houseTab)) this.houseTab = "guide";
    const view = document.getElementById("view");
    view.innerHTML = this.head("The house", "Everything you need in one place", "") +
      '<div class="tabs">' + tabs.map((t) => '<button type="button" class="btn ' + (this.houseTab === t[0] ? "primary" : "") + '" data-ht="' + t[0] + '">' + t[1] + "</button>").join("") + "</div>" +
      '<div id="house-body"></div>';
    view.querySelectorAll("[data-ht]").forEach((b) => b.onclick = () => { this.houseTab = b.getAttribute("data-ht"); this.renderHouse(); });
    this.paintHouse();
    this.afterRender();
  },

  paintHouse() {
    const el = document.getElementById("house-body");
    const t = this.houseTab;
    if (t === "guide") el.innerHTML = this.houseGuide();
    else if (t === "map") el.innerHTML = this.houseMap();
    else if (t === "stock") el.innerHTML = this.houseStock();
    else if (t === "leave") el.innerHTML = this.houseLeave();
    else if (t === "money") el.innerHTML = this.houseMoney();
    else if (t === "docs") el.innerHTML = this.houseDocs();
    else el.innerHTML = this.housePeople();
    if (t === "map") {
      el.querySelectorAll("[data-spot]").forEach((n) => n.onclick = () => {
        const s = Store.data.mapSpots.find((x) => x.id === n.getAttribute("data-spot"));
        if (s) UI.modal(s.label, "<p>" + UI.esc(s.note) + "</p>");
      });
    }
    if (t === "leave") this.bindLeave();
    if (t === "docs") this.bindDocs();
    if (t === "people") this.bindPeople();
    if (t === "stock" && document.getElementById("add-inv")) document.getElementById("add-inv").onclick = () => this.invForm();
  },

  houseGuide() {
    const s = Store.data.systems || {};
    const em = Store.data.contacts.filter((c) => ["emergency","hospital","police","fire"].includes(c.category) || ["112","15","17","18"].includes(c.phone));
    return '<div class="grid two"><div class="card"><h3>If something is wrong</h3>' +
      em.map((c) => "<div class='row'><div><b>" + UI.esc(c.name) + "</b><div class='muted'>" + UI.esc(c.notes) + "</div></div><a class='btn' href='tel:" + UI.esc(c.phone) + "'>" + UI.esc(c.phone) + "</a></div>").join("") +
      "</div><div class='card'><h3>House systems</h3>" +
      [["Water shut-off", s.waterShutoff],["Electrical panel", s.electricalPanel],["Fuse box", s.fuseBox],["Gas shut-off", s.gasShutoff],["Pool controls", s.poolControls],["Alarm", s.alarm]]
        .map((r) => "<div class='row'><div><b>" + r[0] + "</b><div class='muted'>" + UI.esc(r[1] || "") + "</div></div></div>").join("") +
      "<p><button class='btn' data-ht-jump='map'>Open the site map</button></p></div></div>";
  },

  houseMap() {
    const spots = Store.data.mapSpots || [];
    return '<div class="card"><h3>Where things are</h3><p class="muted">Tap a labelled spot. Useful in a hurry.</p><div class="site-map">' +
      '<svg viewBox="0 0 100 100" role="img" aria-label="Simple site plan">' +
      '<rect x="8" y="8" width="28" height="18" rx="2" fill="#cfd9c0" stroke="#4f5d3a"/>' +
      '<text x="22" y="19" font-size="4" text-anchor="middle">Parking</text>' +
      '<rect x="30" y="24" width="40" height="36" rx="2" fill="#f7f1e5" stroke="#4f5d3a"/>' +
      '<text x="50" y="44" font-size="5" text-anchor="middle">House</text>' +
      '<rect x="70" y="58" width="22" height="22" rx="2" fill="#b7d3e8" stroke="#4f5d3a"/>' +
      '<text x="81" y="71" font-size="4" text-anchor="middle">Pool</text>' +
      spots.map((s) => '<g class="map-hot" data-spot="' + s.id + '"><circle cx="' + s.x + '" cy="' + s.y + '" r="3.2" fill="#c25b3c"/><text x="' + s.x + '" y="' + (s.y - 4) + '" font-size="3" text-anchor="middle">' + UI.esc(s.label) + "</text></g>").join("") +
      "</svg></div><div class='list' style='margin-top:12px'>" +
      spots.map((s) => "<button class='btn ghost' style='justify-content:flex-start' data-spot='" + s.id + "'>" + UI.esc(s.label) + "</button>").join("") +
      "</div></div>";
  },

  houseStock() {
    return '<div class="page-head"><h3>Inventory</h3>' + (Auth.canEdit() ? '<button class="btn" id="add-inv" type="button">Add item</button>' : "") + "</div>" +
      '<div class="grid cards">' + Store.data.inventory.map((i) => "<div class='card'><h3>" + UI.esc(i.name) + "</h3><p class='muted'>" + UI.esc(i.category) + " · " + UI.esc(i.location) +
        "</p><p>Bought " + UI.fmt(i.purchaseDate) + (i.warrantyUntil ? " · Warranty to " + UI.fmt(i.warrantyUntil) : "") + "</p><p>" + UI.esc(i.notes || "") + "</p></div>").join("") + "</div>";
  },

  houseLeave() {
    const stays = Store.data.bookings.filter((b) => b.status === "booked").sort((a, b) => b.arrival.localeCompare(a.arrival));
    const current = Store.currentStays()[0] || stays[0];
    const rec = current && (Store.data.checklistRecords || []).find((r) => r.bookingId === current.id);
    const done = new Set(rec ? rec.completedItemIds : []);
    return '<div class="card"><h3>Departure checklist</h3><p class="muted">Tick everything before you leave. Admins can edit the list in the data file or below.</p>' +
      (current ? "<p>For stay: <b>" + UI.esc(current.guests || current.arrival) + "</b> (" + UI.fmt(current.arrival) + "–" + UI.fmt(current.departure) + ")</p>" : "<p>No stay selected.</p>") +
      '<form id="leave-form">' + (current ? '<input type="hidden" name="bookingId" value="' + current.id + '">' : "") +
      Store.data.checklistItems.filter((i) => i.active).sort((a, b) => a.sort - b.sort).map((i) =>
        '<label class="check-item"><input type="checkbox" name="ck" value="' + i.id + '"' + (done.has(i.id) ? " checked" : "") + "> " + UI.esc(i.label) + "</label>"
      ).join("") +
      (current ? '<button class="btn primary" type="submit">Save checklist</button>' : "") + "</form></div>" +
      (Auth.isAdmin() ? '<div class="card" style="margin-top:16px"><h3>Edit checklist items</h3><form id="ck-add"><div class="field-row"><input name="label" placeholder="New item" required><button class="btn" type="submit">Add</button></div></form></div>' : "") +
      '<div class="card" style="margin-top:16px"><h3>Past completions</h3>' +
      (Store.data.checklistRecords || []).map((r) => {
        const b = Store.data.bookings.find((x) => x.id === r.bookingId);
        return "<div class='row'><span>" + UI.esc(b ? (b.guests || b.arrival) : r.bookingId) + "</span><span class='muted'>" + UI.fmtTime(r.completedAt) + " · " + UI.esc(Store.userName(r.completedBy)) + "</span></div>";
      }).join("") + "</div>";
  },

  bindLeave() {
    const f = document.getElementById("leave-form");
    if (f) f.onsubmit = (e) => {
      e.preventDefault();
      const bookingId = UI.val(f, "bookingId");
      const ids = [...f.querySelectorAll("input[name=ck]:checked")].map((i) => i.value);
      let rec = Store.data.checklistRecords.find((r) => r.bookingId === bookingId);
      if (!rec) { rec = { id: CryptoUtil.uid("cr"), bookingId }; Store.data.checklistRecords.push(rec); }
      rec.completedItemIds = ids;
      rec.completedBy = Auth.user().id;
      rec.completedAt = new Date().toISOString();
      Store.log("checklist", "booking", bookingId, ids.length + " items");
      Store.save();
      UI.toast("Checklist saved");
      this.paintHouse();
    };
    const add = document.getElementById("ck-add");
    if (add) add.onsubmit = (e) => {
      e.preventDefault();
      Store.data.checklistItems.push({ id: CryptoUtil.uid("ck"), label: UI.val(add, "label"), sort: Store.data.checklistItems.length + 1, active: true });
      Store.save();
      this.paintHouse();
    };
  },

  houseMoney() {
    const s = Store.moneySummary();
    return '<div class="card"><h3>House money</h3><p>This month ' + Store.pound(s.month) + " · This year " + Store.pound(s.year) +
      " · Outstanding " + Store.pound(s.owed) + '</p><p><a class="btn primary" href="#expenses">Open expenses</a></p></div>';
  },

  invForm() {
    UI.modal("Add inventory item",
      '<form id="iv-form"><label class="field"><span>Name</span><input name="name" required></label>' +
      '<label class="field"><span>Category</span><select name="category"><option>furniture</option><option>appliances</option><option>electronics</option><option>garden</option><option>pool</option><option>tools</option></select></label>' +
      '<label class="field"><span>Location</span><input name="location"></label>' +
      '<div class="field-row"><label class="field"><span>Bought</span><input type="date" name="purchaseDate"></label><label class="field"><span>Warranty until</span><input type="date" name="warrantyUntil"></label></div>' +
      '<label class="field"><span>Notes</span><textarea name="notes"></textarea></label><button class="btn primary" type="submit">Save</button></form>');
    document.getElementById("iv-form").onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      Store.data.inventory.push({ id: CryptoUtil.uid("inv"), name: UI.val(f, "name"), category: UI.val(f, "category"), location: UI.val(f, "location"), purchaseDate: UI.val(f, "purchaseDate"), warrantyUntil: UI.val(f, "warrantyUntil"), notes: UI.val(f, "notes"), manualDocId: "" });
      Store.save();
      UI.closeModal();
      this.paintHouse();
    };
  },

  houseDocs() {
    const cats = ["Arrival","Departure","Manuals"];
    const q = (this.docQ || "").toLowerCase();
    const rows = Store.data.documents.filter((d) => !q || (d.title + d.body + d.category).toLowerCase().includes(q));
    return '<input class="search-box" id="doc-q" placeholder="Search documents" value="' + UI.esc(this.docQ || "") + '">' +
      cats.map((c) => "<h3 style='margin-top:18px'>" + c + "</h3>" + rows.filter((d) => d.category === c).map((d) =>
        "<div class='card' style='margin-bottom:10px'><h3>" + UI.esc(d.title) + "</h3><div class='prose'>" + UI.esc(d.body) + "</div></div>"
      ).join("") ).join("") +
      (Auth.canEdit() ? '<p><button class="btn" id="add-doc" type="button">Add note</button></p>' : "");
  },

  bindDocs() {
    const q = document.getElementById("doc-q");
    if (q) q.oninput = () => { this.docQ = q.value; this.paintHouse(); document.getElementById("doc-q").focus(); };
    const add = document.getElementById("add-doc");
    if (add) add.onclick = () => {
      UI.modal("Add document", '<form id="dc-form"><label class="field"><span>Title</span><input name="title" required></label>' +
        '<label class="field"><span>Category</span><select name="category"><option>Arrival</option><option>Departure</option><option>Manuals</option></select></label>' +
        '<label class="field"><span>Text</span><textarea name="body" rows="6" required></textarea></label><button class="btn primary">Save</button></form>');
      document.getElementById("dc-form").onsubmit = (e) => {
        e.preventDefault();
        Store.data.documents.push({ id: CryptoUtil.uid("d"), title: UI.val(e.target, "title"), category: UI.val(e.target, "category"), body: UI.val(e.target, "body"), createdBy: Auth.user().id, createdAt: new Date().toISOString() });
        Store.log("create", "document", "", UI.val(e.target, "title"));
        Store.save();
        UI.closeModal();
        this.paintHouse();
      };
    };
  },

  housePeople() {
    const groups = { emergency: "Emergency", hospital: "Hospital", utility: "Utilities", pool: "Pool", cleaner: "Cleaning", electrician: "Electrical", plumber: "Plumbing", gardener: "Garden", builder: "Builder", manager: "Property manager" };
    let html = "";
    Object.keys(groups).forEach((cat) => {
      const rows = Store.data.contacts.filter((c) => c.category === cat);
      if (!rows.length) return;
      html += "<h3>" + groups[cat] + "</h3>" + rows.map((c) =>
        "<div class='card' style='margin-bottom:10px'><h3>" + UI.esc(c.name) + "</h3><p>" + UI.esc(c.business) + "</p>" +
        (c.phone ? "<p><a href='tel:" + UI.esc(c.phone) + "'>" + UI.esc(c.phone) + "</a></p>" : "") +
        (c.email ? "<p><a href='mailto:" + UI.esc(c.email) + "'>" + UI.esc(c.email) + "</a></p>" : "") +
        "<p class='muted'>" + UI.esc(c.notes || "") + (c.lastUsed ? " · Last used " + UI.fmt(c.lastUsed) : "") + "</p></div>"
      ).join("");
    });
    if (Auth.canEdit()) html += '<p><button class="btn" id="add-c" type="button">Add contact</button></p>';
    return html;
  },

  bindPeople() {
    const b = document.getElementById("add-c");
    if (!b) return;
    b.onclick = () => {
      UI.modal("Add contact", '<form id="ct-form"><label class="field"><span>Name</span><input name="name" required></label>' +
        '<label class="field"><span>Business</span><input name="business"></label>' +
        '<label class="field"><span>Type</span><select name="category"><option>pool</option><option>cleaner</option><option>electrician</option><option>plumber</option><option>gardener</option><option>builder</option><option>manager</option><option>emergency</option><option>utility</option><option>hospital</option></select></label>' +
        '<label class="field"><span>Phone</span><input name="phone"></label><label class="field"><span>Email</span><input name="email"></label>' +
        '<label class="field"><span>Notes</span><textarea name="notes"></textarea></label><button class="btn primary">Save</button></form>');
      document.getElementById("ct-form").onsubmit = (e) => {
        e.preventDefault();
        Store.data.contacts.push({ id: CryptoUtil.uid("c"), name: UI.val(e.target, "name"), business: UI.val(e.target, "business"), category: UI.val(e.target, "category"), phone: UI.val(e.target, "phone"), email: UI.val(e.target, "email"), notes: UI.val(e.target, "notes"), lastUsed: "", createdBy: Auth.user().id });
        Store.save();
        UI.closeModal();
        this.paintHouse();
      };
    };
  },

  async renderTravel() {
    const date = this.travelDate || UI.addDays(UI.today(), 14);
    const back = this.travelBack || UI.addDays(date, 7);
    this.travelDate = date;
    this.travelBack = back;
    const from = this.travelFrom || "";
    const to = this.travelTo || "";
    const guests = this.travelGuests || 2;
    const fares = await Flights.getFares({ date, back, from, to, adults: guests });
    const hl = Flights.highlights(fares);
    const links = Flights.liveLinks(from || "LGW", to || "TLN", date, back, guests);
    const priceBit = (f) => f && f.live && f.price ? "<p class='price'>£" + f.price + "</p>" : "<p class='muted'>Open the airline to see today’s price.</p>";
    const card = (title, cls, f) => f ? '<div class="card hl ' + cls + '"><h3>' + title + "</h3>" + priceBit(f) +
      "<p><b>" + f.from + " → " + f.to + "</b> · " + UI.esc(f.airline) +
      (f.direct ? ' <span class="badge-direct">Direct</span>' : "") + "</p><p class='muted'>Flight " + UI.mins(f.durationMin) + " · Drive " + f.drive.label + "</p></div>" : "";
    const view = document.getElementById("view");
    const skyFrom = from || "LGW";
    const skyTo = to || "TLN";
    view.innerHTML = this.head("Travel", "London to the house near La Croix-Valmer", "") +
      '<div class="card sky-card"><h3>Live prices on Skyscanner</h3>' +
      '<p class="muted">Search sits on this page. Change the dates below, then tap Search live prices. Results open from Skyscanner (BA, easyJet and others).</p>' +
      Flights.widgetHtml({ from: skyFrom, to: skyTo, date: date, back: back }) +
      "</div>" +
      '<div class="filters"><label class="field"><span>Outbound</span><input id="tr-date" type="date" value="' + date + '"></label>' +
      '<label class="field"><span>Return</span><input id="tr-back" type="date" value="' + back + '"></label>' +
      '<label class="field"><span>Guests</span><input id="tr-guests" type="number" min="1" max="9" value="' + guests + '"></label>' +
      this.select("tr-from", [["","All London airports"],["LHR","Heathrow"],["LGW","Gatwick"],["STN","Stansted"],["LCY","London City"]], from) +
      this.select("tr-to", [["","All arrivals"],["NCE","Nice"],["MRS","Marseille"],["TLN","Toulon–Hyères"]], to) + "</div>" +
      '<p class="muted">Prefer the airline site?</p>' +
      Flights.buttonsHtml(links) +
      '<div class="grid highlights">' + card("Live fare", "cheap", hl.cheapest) + card("Fastest door to door", "fast", hl.fastest) + card("Most convenient", "easy", hl.convenient) + "</div>" +
      '<div class="grid cards" style="margin-top:16px">' + fares.map((f) =>
        '<div class="card route-card"><h3>' + f.from + " → " + f.to + "</h3><p>" + UI.esc(f.fromName) + " to " + UI.esc(f.toName) + "</p>" +
        '<div class="meta">' + (f.preferred ? '<span class="badge-direct">BA / easyJet</span>' : "") +
        (f.direct ? '<span class="badge-direct">Direct</span>' : '<span class="chip">Via ' + UI.esc(f.via || "connection") + "</span>") +
        (f.seasonal ? '<span class="chip">Seasonal</span>' : "") + "</div>" +
        (f.live && f.price ? "<p class='price'>£" + f.price + "</p>" : "<p class='muted'>Check today’s price on the airline site.</p>") +
        "<p>" + UI.esc(f.airline) + " · " + UI.mins(f.durationMin) + "</p>" +
        "<p>Drive to La Croix-Valmer: <b>" + f.drive.label + "</b>" + (f.drive.closest ? " (closest airport)" : "") + (f.drive.summerNote ? " · " + f.drive.summerNote : "") + "</p>" +
        '<div class="book-links">' +
        (f.preferred && String(f.airline).indexOf("British") >= 0 ? '<a class="btn primary" target="_blank" rel="noopener" href="' + f.baUrl + '">Check live price on British Airways</a>' : "") +
        (f.preferred && String(f.airline).toLowerCase().indexOf("easyjet") >= 0 ? '<a class="btn primary" target="_blank" rel="noopener" href="' + f.easyJetUrl + '">Check live price on easyJet</a>' : "") +
        '<a class="btn" target="_blank" rel="noopener" href="' + f.googleUrl + '">Google Flights</a>' +
        '<a class="btn" target="_blank" rel="noopener" href="' + f.skyscannerUrl + '">Skyscanner</a>' +
        "</div></div>"
      ).join("") + "</div>";
    const apply = () => {
      this.travelDate = document.getElementById("tr-date").value;
      this.travelBack = document.getElementById("tr-back").value;
      this.travelFrom = document.getElementById("tr-from").value;
      this.travelTo = document.getElementById("tr-to").value;
      this.travelGuests = Number(document.getElementById("tr-guests").value) || 2;
      this.renderTravel();
    };
    document.getElementById("tr-date").onchange = apply;
    document.getElementById("tr-back").onchange = apply;
    document.getElementById("tr-from").onchange = apply;
    document.getElementById("tr-to").onchange = apply;
    document.getElementById("tr-guests").onchange = apply;
    Flights.mountWidget();
    this.afterRender();
  },

  placeKinds() {
    return [["", "All"], ["restaurant", "Restaurants"], ["beach", "Beaches"], ["attraction", "Attractions"], ["shop", "Shops"], ["other", "Other"]];
  },

  avgRating(placeId) {
    const revs = (Store.data.reviews || []).filter((r) => r.placeId === placeId && r.rating);
    if (!revs.length) return 0;
    return Math.round(revs.reduce((n, r) => n + Number(r.rating), 0) / revs.length);
  },

  renderGuide() {
    if (this.params.id && (Store.data.places || []).find((p) => p.id === this.params.id)) return this.renderPlace(this.params.id);
    const q = (this.foodQ || "").toLowerCase();
    const kind = this.foodKind || "";
    let rows = (Store.data.places || []).filter((r) => !q || (r.name + r.town + (r.cuisine || "") + (r.notes || "") + r.kind).toLowerCase().includes(q));
    if (kind) rows = rows.filter((r) => r.kind === kind);
    const view = document.getElementById("view");
    view.innerHTML = this.head("Local guide", "Restaurants, beaches, shops and days out near La Croix-Valmer",
      Auth.canEdit() ? '<button class="btn primary" id="add-r" type="button">Add a place</button>' : "") +
      '<div class="tabs">' + this.placeKinds().map((k) => '<button type="button" class="btn ' + (kind === k[0] ? "primary" : "") + '" data-kind="' + k[0] + '">' + k[1] + "</button>").join("") + "</div>" +
      '<input class="search-box" id="food-q" placeholder="Search places" value="' + UI.esc(this.foodQ || "") + '">' +
      '<div class="grid cards" style="margin-top:16px">' + rows.map((r) => {
        const stars = this.avgRating(r.id) || r.rating || 0;
        const n = (Store.data.reviews || []).filter((x) => x.placeId === r.id).length;
        return "<a class='card' href='#guide/" + r.id + "' style='text-decoration:none;color:inherit'><span class='chip'>" + UI.esc(r.kind) +
          "</span><h3>" + UI.esc(r.name) + "</h3><p class='stars'>" + "★".repeat(stars) + "</p><p>" + UI.esc(r.town) +
          (r.cuisine ? " · " + UI.esc(r.cuisine) : "") + "</p><p class='muted'>" + UI.esc(r.notes || "") + "</p><p class='muted'>" + n + " reviews</p></a>";
      }).join("") + "</div>";
    document.getElementById("food-q").oninput = (e) => { this.foodQ = e.target.value; this.renderGuide(); };
    view.querySelectorAll("[data-kind]").forEach((b) => b.onclick = () => { this.foodKind = b.getAttribute("data-kind"); this.renderGuide(); });
    const add = document.getElementById("add-r");
    if (add) add.onclick = () => this.placeForm();
    this.afterRender();
  },

  renderPlace(id) {
    const r = Store.data.places.find((p) => p.id === id);
    const revs = (Store.data.reviews || []).filter((x) => x.placeId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const view = document.getElementById("view");
    view.innerHTML = this.head(r.name, r.kind + " · " + r.town, '<a class="btn" href="#guide">Back</a>') +
      '<div class="card"><p class="stars">' + "★".repeat(this.avgRating(id) || r.rating || 0) + "</p><p>" + UI.esc(r.notes || "") + "</p>" +
      (r.address ? "<p>" + UI.esc(r.address) + "</p>" : "") +
      (r.phone ? "<p><a href='tel:" + UI.esc(r.phone) + "'>" + UI.esc(r.phone) + "</a></p>" : "") +
      (r.website ? "<p><a href='" + UI.esc(r.website) + "' target='_blank' rel='noopener'>Website</a></p>" : "") +
      "</div><div class='card' style='margin-top:16px'><h3>Reviews</h3>" +
      revs.map((v) => "<div class='comment'><b>" + UI.esc(Store.userName(v.createdBy)) + "</b> · " + UI.fmtTime(v.createdAt) +
        " · <span class='stars'>" + "★".repeat(v.rating || 0) + "</span><div>" + UI.esc(v.text) + "</div>" +
        this.media(v.photos, []) +
        (v.replies || []).map((rp) => "<div class='comment' style='margin-left:16px'><b>" + UI.esc(Store.userName(rp.createdBy)) + "</b> · " +
          UI.fmtTime(rp.createdAt) + "<div>" + UI.esc(rp.text) + "</div></div>").join("") +
        '<form data-reply="' + v.id + '"><input name="text" placeholder="Reply or add an update" required><button class="btn" type="submit">Reply</button></form></div>'
      ).join("") +
      '<form id="rev-form"><label class="field"><span>Your review</span><textarea name="text" rows="3" required></textarea></label>' +
      '<div class="field-row"><label class="field"><span>Stars</span><select name="rating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label>' +
      '<label class="field"><span>Photo</span><input type="file" name="photo" accept="image/*"></label></div>' +
      '<button class="btn primary" type="submit">Post review</button></form></div>';
    view.querySelectorAll("[data-reply]").forEach((f) => f.onsubmit = (e) => {
      e.preventDefault();
      const rev = Store.data.reviews.find((x) => x.id === f.getAttribute("data-reply"));
      rev.replies = rev.replies || [];
      rev.replies.push({ id: CryptoUtil.uid("rp"), text: UI.val(f, "text"), createdBy: Auth.user().id, createdAt: new Date().toISOString() });
      Store.log("reply", "review", rev.id, r.name);
      Store.save();
      this.renderPlace(id);
    });
    document.getElementById("rev-form").onsubmit = async (e) => {
      e.preventDefault();
      const photos = [];
      const file = e.target.elements.photo.files[0];
      try {
        if (file) photos.push(await UI.fileToData(file, 3));
      } catch (err) { return UI.toast(err.message); }
      Store.data.reviews.unshift({
        id: CryptoUtil.uid("rv"), placeId: id, restaurantId: id,
        rating: Number(UI.val(e.target, "rating")), text: UI.val(e.target, "text"),
        photos, replies: [], createdBy: Auth.user().id, createdAt: new Date().toISOString()
      });
      Store.log("review", "place", id, r.name);
      Store.save();
      this.renderPlace(id);
    };
    this.afterRender();
  },

  placeForm() {
    UI.modal("Add a place",
      '<form id="rf"><label class="field"><span>Name</span><input name="name" required></label>' +
      '<div class="field-row"><label class="field"><span>Type</span><select name="kind"><option value="restaurant">Restaurant</option><option value="beach">Beach</option><option value="attraction">Attraction</option><option value="shop">Shop</option><option value="other">Other</option></select></label>' +
      '<label class="field"><span>Town</span><input name="town" value="La Croix-Valmer"></label></div>' +
      '<label class="field"><span>Phone</span><input name="phone"></label>' +
      '<label class="field"><span>Cuisine / tag</span><input name="cuisine" placeholder="Optional"></label>' +
      '<label class="field"><span>Notes</span><textarea name="notes"></textarea></label>' +
      '<button class="btn primary">Save</button></form>');
    document.getElementById("rf").onsubmit = (e) => {
      e.preventDefault();
      const id = CryptoUtil.uid("p");
      Store.data.places.push({
        id, kind: UI.val(e.target, "kind"), name: UI.val(e.target, "name"), town: UI.val(e.target, "town"),
        address: "", phone: UI.val(e.target, "phone"), website: "", cuisine: UI.val(e.target, "cuisine"),
        rating: 0, notes: UI.val(e.target, "notes"), createdBy: Auth.user().id, createdAt: new Date().toISOString()
      });
      Store.log("create", "place", id, UI.val(e.target, "name"));
      Store.save();
      UI.closeModal();
      location.hash = "guide/" + id;
      this.route();
    };
  },

  expCats() {
    return ["drainage", "plumbing", "pool", "cleaning", "gardening", "furniture", "utilities", "improvements", "emergency"];
  },

  renderExpenses() {
    this.expFilter = this.expFilter || { category: "", paidBy: "", type: "", from: "", to: "" };
    const f = this.expFilter;
    let rows = (Store.data.expenses || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (f.category) rows = rows.filter((e) => e.category === f.category);
    if (f.paidBy) rows = rows.filter((e) => e.paidBy === f.paidBy);
    if (f.type) rows = rows.filter((e) => e.type === f.type);
    if (f.from) rows = rows.filter((e) => e.date >= f.from);
    if (f.to) rows = rows.filter((e) => e.date <= f.to);
    const s = Store.moneySummary(rows);
    const cats = Object.keys(s.byCat).sort((a, b) => s.byCat[b] - s.byCat[a]);
    const view = document.getElementById("view");
    view.innerHTML = this.head("Expenses", "House bills in pounds. Shared costs split between the owners.",
      Auth.canEdit() ? '<button class="btn primary" id="add-exp" type="button">Add expense</button>' : "") +
      '<div class="grid stats">' +
        this.stat(Store.pound(s.month), "This month") +
        this.stat(Store.pound(s.year), "This year") +
        this.stat(Store.pound(s.owed), "Still owed") +
        this.stat(s.largest[0] ? Store.pound(s.largest[0].amount) : "—", "Largest") +
      "</div>" +
      '<div class="card" style="margin-top:16px"><h3>Spending by category</h3>' +
      (cats.length ? cats.map((c) => "<div class='row'><span>" + UI.esc(c) + "</span><b>" + Store.pound(s.byCat[c]) + "</b></div>").join("") : "<p class='empty'>No spend in this filter.</p>") +
      "</div>" +
      '<div class="filters" style="margin-top:16px">' +
        this.select("ex-type", [["", "All types"], ["shared", "Shared property"], ["personal", "Personal"]], f.type) +
        this.select("ex-cat", [["", "All categories"]].concat(this.expCats().map((c) => [c, c])), f.category) +
        this.select("ex-who", [["", "Anyone paid"]].concat(Store.ownerList().map((o) => [o.id, o.name])), f.paidBy) +
        '<label class="field"><span>From</span><input id="ex-from" type="date" value="' + UI.esc(f.from) + '"></label>' +
        '<label class="field"><span>To</span><input id="ex-to" type="date" value="' + UI.esc(f.to) + '"></label>' +
      "</div>" +
      '<div class="card" style="margin-top:8px"><h3>Recent</h3>' +
      rows.map((e) => {
        const out = Store.expenseOutstanding(e);
        return "<div class='row'><div><b>" + UI.esc(e.description) + "</b><div class='muted'>" + UI.fmt(e.date) + " · " + UI.esc(e.category) +
          " · " + (e.type === "personal" ? "Personal" : "Shared") + " · Paid by " + UI.esc(Store.userName(e.paidBy)) +
          (out ? " · Outstanding " + Store.pound(out) : "") + "</div></div>" +
          "<div><b>" + Store.pound(e.amount) + '</b><div><button class="text-btn" data-ex="' + e.id + '">Open</button></div></div></div>';
      }).join("") + "</div>" +
      (s.largest.length ? '<div class="card" style="margin-top:16px"><h3>Largest</h3>' + s.largest.map((e) => "<div class='row'><span>" + UI.esc(e.description) + "</span><b>" + Store.pound(e.amount) + "</b></div>").join("") + "</div>" : "");
    const apply = () => {
      this.expFilter = {
        type: document.getElementById("ex-type").value,
        category: document.getElementById("ex-cat").value,
        paidBy: document.getElementById("ex-who").value,
        from: document.getElementById("ex-from").value,
        to: document.getElementById("ex-to").value
      };
      this.renderExpenses();
    };
    ["ex-type", "ex-cat", "ex-who", "ex-from", "ex-to"].forEach((id) => { document.getElementById(id).onchange = apply; });
    view.querySelectorAll("[data-ex]").forEach((b) => b.onclick = () => this.openExpense(b.getAttribute("data-ex")));
    const add = document.getElementById("add-exp");
    if (add) add.onclick = () => this.expenseForm();
    this.afterRender();
  },

  openExpense(id) {
    const e = Store.data.expenses.find((x) => x.id === id);
    if (!e) return;
    const canSettle = Auth.isAdmin() || (Auth.user() && Auth.user().id === e.paidBy);
    const splits = (e.splits || []).map((s) => "<div class='row'><span>" + UI.esc(Store.userName(s.userId)) + " · " + Store.pound(s.amount) +
      '</span><span class="chip ' + (s.status === "owed" ? "open" : "done") + '">' + s.status + "</span>" +
      (canSettle && s.status === "owed" ? ' <button class="btn" data-set="' + s.userId + '">Mark paid</button>' : "") + "</div>").join("");
    UI.modal(e.description,
      "<p class='price'>" + Store.pound(e.amount) + "</p><p>" + UI.fmt(e.date) + " · " + UI.esc(e.category) + " · " +
      (e.type === "personal" ? "Personal expense" : "Shared property expense") + "</p>" +
      "<p>Paid by <b>" + UI.esc(Store.userName(e.paidBy)) + "</b>" + (e.supplier ? " · " + UI.esc(e.supplier) : "") + "</p>" +
      "<p>" + UI.esc(e.notes || "") + "</p>" + this.media(e.receipts, [], "Receipts") +
      (e.type === "shared" ? "<h3>Split</h3><p class='muted'>Equal split between owners. Outstanding " + Store.pound(Store.expenseOutstanding(e)) + "</p>" + splits : ""),
      canSettle && e.type === "shared" && Store.expenseOutstanding(e) > 0
        ? '<div class="actions"><button class="btn primary" id="settle-all" type="button">Settle up — all paid</button></div>' : "");
    document.querySelectorAll("[data-set]").forEach((b) => b.onclick = () => {
      const split = e.splits.find((s) => s.userId === b.getAttribute("data-set"));
      if (split) split.status = "paid";
      Store.log("reimburse", "expense", e.id, Store.userName(split.userId));
      Store.save();
      UI.toast("Marked paid");
      this.openExpense(id);
    });
    const all = document.getElementById("settle-all");
    if (all) all.onclick = () => {
      e.splits.forEach((s) => { if (s.status === "owed") s.status = "settled"; });
      Store.log("settle", "expense", e.id, e.description);
      Store.save();
      UI.closeModal();
      UI.toast("Settled");
      this.renderExpenses();
    };
  },

  expenseForm() {
    const owners = Store.ownerList();
    UI.modal("Add expense",
      '<form id="ex-form"><label class="field"><span>Description</span><input name="description" required placeholder="Drainage Repair"></label>' +
      '<div class="field-row"><label class="field"><span>Amount £</span><input name="amount" type="number" step="0.01" required></label>' +
      '<label class="field"><span>Date</span><input name="date" type="date" value="' + UI.today() + '"></label></div>' +
      '<div class="field-row"><label class="field"><span>Category</span><select name="category">' + this.expCats().map((c) => "<option>" + c + "</option>").join("") + "</select></label>" +
      '<label class="field"><span>Type</span><select name="type"><option value="shared">Shared property</option><option value="personal">Personal</option></select></label></div>' +
      '<label class="field"><span>Who paid</span><select name="paidBy">' + owners.map((o) => "<option value='" + o.id + "'" + (Auth.user() && o.id === Auth.user().id ? " selected" : "") + ">" + UI.esc(o.name) + "</option>").join("") + "</select></label>" +
      '<label class="field"><span>Supplier</span><input name="supplier"></label>' +
      '<label class="field"><span>Notes</span><textarea name="notes"></textarea></label>' +
      '<label class="field"><span>Receipt / photo</span><input type="file" name="receipt" accept="image/*,.pdf"></label>' +
      '<button class="btn primary" type="submit">Save</button></form>');
    document.getElementById("ex-form").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const receipts = [];
      try {
        if (f.elements.receipt.files[0]) receipts.push(await UI.fileToData(f.elements.receipt.files[0], 3));
      } catch (err) { return UI.toast(err.message); }
      const amount = Number(UI.val(f, "amount"));
      const paidBy = UI.val(f, "paidBy");
      const type = UI.val(f, "type");
      const next = {
        id: CryptoUtil.uid("e"),
        description: UI.val(f, "description"),
        amount, currency: "GBP", date: UI.val(f, "date"),
        category: UI.val(f, "category"), type, paidBy,
        supplier: UI.val(f, "supplier"), notes: UI.val(f, "notes"),
        issueId: "", receipts,
        splits: type === "shared" ? Store.equalSplits(paidBy, amount) : [],
        createdBy: Auth.user().id
      };
      Store.data.expenses.unshift(next);
      Store.log("create", "expense", next.id, next.description);
      Store.save();
      UI.closeModal();
      UI.toast("Expense saved");
      this.renderExpenses();
    };
  },

  renderIdeas() {
    const view = document.getElementById("view");
    view.innerHTML = this.head("Ideas", "Furniture, garden, little improvements",
      '<button class="btn primary" id="add-idea">Suggest</button>') +
      '<div class="grid cards">' + Store.data.ideas.map((i) =>
        "<div class='card'><h3>" + UI.esc(i.title) + "</h3><p>" + UI.esc(i.description) + "</p><span class='chip " + i.status + "'>" + i.status + "</span>" +
        "<p>" + (i.votes || []).length + " votes</p><button class='btn' data-vote='" + i.id + "'>Vote</button>" +
        (Auth.isAdmin() ? " <select data-st='" + i.id + "'>" + ["suggested","considered","approved","rejected","completed"].map((s) => "<option" + (s === i.status ? " selected" : "") + ">" + s + "</option>").join("") + "</select>" : "") +
        "</div>"
      ).join("") + "</div>";
    view.querySelectorAll("[data-vote]").forEach((b) => b.onclick = () => {
      const i = Store.data.ideas.find((x) => x.id === b.getAttribute("data-vote"));
      i.votes = i.votes || [];
      if (!i.votes.includes(Auth.user().id)) i.votes.push(Auth.user().id);
      Store.save(); this.renderIdeas();
    });
    view.querySelectorAll("[data-st]").forEach((s) => s.onchange = () => {
      Store.data.ideas.find((x) => x.id === s.getAttribute("data-st")).status = s.value;
      Store.save(); this.renderIdeas();
    });
    document.getElementById("add-idea").onclick = () => {
      UI.modal("New idea", '<form id="idf"><label class="field"><span>Title</span><input name="title" required></label><label class="field"><span>Details</span><textarea name="description"></textarea></label><button class="btn primary">Save</button></form>');
      document.getElementById("idf").onsubmit = (e) => {
        e.preventDefault();
        Store.data.ideas.unshift({ id: CryptoUtil.uid("i"), title: UI.val(e.target, "title"), description: UI.val(e.target, "description"), status: "suggested", votes: [Auth.user().id], createdBy: Auth.user().id, createdAt: new Date().toISOString() });
        Store.save(); UI.closeModal(); this.renderIdeas();
      };
    };
    this.afterRender();
  },

  renderNews() {
    const list = Store.data.announcements.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const view = document.getElementById("view");
    view.innerHTML = this.head("News", "Notes from the house", Auth.isAdmin() ? '<button class="btn primary" id="add-n">Post</button>' : "") +
      list.map((a) => "<div class='card' style='margin-bottom:12px'><h3>" + UI.esc(a.title) + "</h3><p>" + UI.esc(a.body) + "</p><p class='muted'>" + UI.esc(Store.userName(a.createdBy)) + " · " + UI.fmtTime(a.createdAt) + "</p></div>").join("");
    const b = document.getElementById("add-n");
    if (b) b.onclick = () => {
      UI.modal("Announcement", '<form id="nf"><label class="field"><span>Title</span><input name="title" required></label><label class="field"><span>Message</span><textarea name="body" required></textarea></label><button class="btn primary">Post</button></form>');
      document.getElementById("nf").onsubmit = (e) => {
        e.preventDefault();
        Store.data.announcements.unshift({ id: CryptoUtil.uid("a"), title: UI.val(e.target, "title"), body: UI.val(e.target, "body"), createdBy: Auth.user().id, createdAt: new Date().toISOString() });
        Store.log("create", "announcement", "", UI.val(e.target, "title"));
        Store.save(); UI.closeModal(); this.renderNews();
      };
    };
    this.afterRender();
  },

  renderSearch() {
    const q = (this.params.id || "").toLowerCase();
    document.getElementById("global-search").value = this.params.id || "";
    const hit = (text) => text.toLowerCase().includes(q);
    const blocks = [];
    if (q) {
      Store.data.documents.filter((d) => hit(d.title + d.body)).forEach((d) => blocks.push(["Document", d.title, "#house"]));
      (Store.data.places || Store.data.restaurants || []).filter((r) => hit(r.name + r.town + (r.notes || "") + (r.kind || ""))).forEach((r) => blocks.push(["Place", r.name, "#guide"]));
      Store.data.contacts.filter((c) => hit(c.name + c.business + c.notes)).forEach((c) => blocks.push(["Contact", c.name, "#house"]));
      Store.data.maintenance.filter((m) => hit(m.title + m.description)).forEach((m) => blocks.push(["Issue", m.title, "#maintenance/" + m.id]));
      Store.data.ideas.filter((i) => hit(i.title + i.description)).forEach((i) => blocks.push(["Idea", i.title, "#ideas"]));
      Store.data.inventory.filter((i) => hit(i.name + i.location)).forEach((i) => blocks.push(["Inventory", i.name, "#house"]));
    }
    document.getElementById("view").innerHTML = this.head("Search", q ? 'Results for “' + this.params.id + '”' : "Type in the search box", "") +
      (blocks.length ? blocks.map((b) => "<div class='row'><div><b>" + UI.esc(b[1]) + "</b><div class='muted'>" + b[0] + "</div></div><a class='btn' href='" + b[2] + "'>Open</a></div>").join("") : "<p class='empty'>Nothing matched. Try “pool” or “Gigaro”.</p>");
    this.afterRender();
  },

  renderSettings() {
    const acts = Store.data.activity.slice(0, 40);
    const view = document.getElementById("view");
    view.innerHTML = this.head("Settings", "PINs, backup, and activity") +
      '<div class="card"><h3>One house, one address</h3>' +
      '<p>Calendar, flights, PINs and maintenance are <b>one website</b>: <a href="https://france.directestates.co.uk">france.directestates.co.uk</a>.</p></div>' +
      '<div class="card" style="margin-top:16px"><h3>How this runs, and where the calendar lives</h3>' +
      '<p>There is no server on this PC. <b>index.html</b> is a website file — open it in a browser. The GitHub page is only the code locker, not the live house.</p>' +
      '<p>The real calendar, bookings, people, and the rest live in <b>data/house.json</b> on GitHub. While you use the site, new bookings first save as a <b>draft in this browser</b>. Then download that file and put it back on GitHub so the family at home sees the same dates. Spreadsheet copies are in <b>data/csv/</b>.</p>' +
      '<div class="actions"><button class="btn primary" id="dl-json">Download house.json</button><button class="btn" id="dl-csv">Download CSVs</button><label class="btn">Restore JSON<input type="file" id="up-json" accept="application/json" hidden></label></div></div>' +
      '<div class="card" style="margin-top:16px"><h3>Flight prices (optional)</h3>' +
      '<p class="muted">BA and easyJet need paid API keys. Leave this blank — the Travel buttons still open those sites with your dates. If you later get a Kiwi / Duffel / Amadeus key, paste it here. It stays in this browser only.</p>' +
      '<form id="fare-key-form"><label class="field"><span>Provider</span><select name="provider">' +
        '<option value="kiwi"' + (Flights.apiProvider() === "kiwi" ? " selected" : "") + ">Kiwi / Tequila</option>" +
        '<option value="duffel"' + (Flights.apiProvider() === "duffel" ? " selected" : "") + ">Duffel (later)</option>" +
        '<option value="amadeus"' + (Flights.apiProvider() === "amadeus" ? " selected" : "") + ">Amadeus (later)</option>" +
      '</select></label><label class="field"><span>API key</span><input name="key" type="password" autocomplete="off" placeholder="' +
      (Flights.apiKey() ? "Key saved in this browser" : "Optional") + '"></label><button class="btn" type="submit">Save key</button></form></div>' +
      '<div class="card" style="margin-top:16px"><h3>Save to GitHub</h3><form id="gh-form"><label class="field"><span>Owner / repo</span><input name="repo" placeholder="yourname/villa-famille"></label>' +
      '<label class="field"><span>Token (repo contents)</span><input name="token" type="password" autocomplete="off"></label><button class="btn">Save to GitHub</button></form></div>' +
      this.schoolFamilyCard() +
      (Auth.isAdmin() ? this.approvalsCard() + this.pinAdmin() + this.schoolHolidaysCard() : "") +
      '<div class="card" style="margin-top:16px"><h3>Activity</h3>' +
      acts.map((a) => "<div class='row'><div><b>" + UI.esc(a.action) + "</b> " + UI.esc(a.entity) + "<div class='muted'>" + UI.esc(a.detail) + " · " + UI.esc(Store.userName(a.userId)) + "</div></div><span class='muted'>" + UI.fmtTime(a.at) + "</span></div>").join("") +
      "</div>";
    document.getElementById("dl-json").onclick = () => Store.exportJson();
    document.getElementById("dl-csv").onclick = () => Store.exportCsvPack();
    document.getElementById("up-json").onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      Store.importJson(JSON.parse(await f.text()));
      UI.toast("Data restored");
      this.renderSettings();
    };
    document.getElementById("gh-form").onsubmit = async (e) => {
      e.preventDefault();
      const parts = UI.val(e.target, "repo").split("/");
      try {
        await Store.saveToGitHub(UI.val(e.target, "token"), parts[0], parts[1], "main");
        UI.toast("Saved to GitHub");
      } catch (err) { UI.toast(err.message); }
    };
    const fareForm = document.getElementById("fare-key-form");
    if (fareForm) fareForm.onsubmit = (e) => {
      e.preventDefault();
      const key = UI.val(fareForm, "key");
      const provider = UI.val(fareForm, "provider") || "kiwi";
      Flights.setApiKey(key, provider);
      UI.toast(key ? "Flight key saved in this browser" : "Flight key cleared");
      this.renderSettings();
    };
    this.bindPinAdmin();
    this.bindSchoolSettings();
    this.afterRender();
  },

  schoolOptions(selected) {
    return '<option value="">No school children</option>' +
      Store.schools().map((s) => "<option value='" + s.id + "'" + (selected === s.id ? " selected" : "") + ">" +
        UI.esc(s.name) + "</option>").join("");
  },

  schoolFamilyCard() {
    const u = Auth.user();
    if (!u || u.role === "guest") return "";
    return '<div class="card" style="margin-top:16px"><h3>School children</h3>' +
      "<p class='muted'>Families at Seaford College, King Edward’s Woking, or Greenfield Woking have priority in school holidays.</p>" +
      '<label class="field"><span>Your family</span><select id="my-school">' + this.schoolOptions(u.schoolId || "") + "</select></label></div>";
  },

  schoolHolidaysCard() {
    const note = Store.data.schoolHolidayNote || "Typical term dates — admin can edit.";
    const rows = (Store.data.schoolHolidays || []).slice().sort((a, b) => a.start.localeCompare(b.start));
    return '<div class="card" style="margin-top:16px"><h3>School holidays</h3>' +
      "<p class='muted'>" + UI.esc(note) + "</p>" +
      "<p>Priority schools: <b>Seaford</b> · <b>KE Woking</b> · <b>Greenfield Woking</b></p>" +
      (rows.length ? rows.map((h) => "<div class='row'><div><b>" + UI.esc(h.label) + "</b><div class='muted'>" +
        UI.fmt(h.start) + " – " + UI.fmt(h.end) + "</div></div><button class='text-btn' type='button' data-delh='" + h.id + "'>Remove</button></div>").join("") : "<p class='muted'>None listed.</p>") +
      '<form id="hol-form"><div class="field-row"><label class="field"><span>Label</span><input name="label" placeholder="May half term 2028" required></label>' +
      '<label class="field"><span>Kind</span><select name="kind"><option value="halfTerm">Half term</option><option value="easter">Easter</option><option value="summer">Summer</option><option value="christmas">Christmas</option></select></label></div>' +
      '<div class="field-row"><label class="field"><span>From</span><input name="start" type="date" required></label>' +
      '<label class="field"><span>To</span><input name="end" type="date" required></label></div>' +
      '<button class="btn" type="submit">Add holiday dates</button></form></div>';
  },

  bindSchoolSettings() {
    const mine = document.getElementById("my-school");
    if (mine) mine.onchange = () => {
      const u = Auth.user();
      if (!u) return;
      u.schoolId = mine.value;
      u.hasSchoolChildren = !!mine.value;
      Store.log("update", "user", u.id, u.name + (u.schoolId ? " · " + (Store.schoolById(u.schoolId) || {}).short : " · no school"));
      Store.save();
      UI.toast("Saved");
    };
    if (!Auth.isAdmin()) return;
    document.querySelectorAll("[data-school]").forEach((sel) => {
      sel.onchange = () => {
        const u = Store.data.users.find((x) => x.id === sel.getAttribute("data-school"));
        if (!u) return;
        u.schoolId = sel.value;
        u.hasSchoolChildren = !!sel.value;
        Store.save();
        this.renderSettings();
      };
    });
    document.querySelectorAll("[data-delh]").forEach((b) => b.onclick = () => {
      Store.data.schoolHolidays = (Store.data.schoolHolidays || []).filter((h) => h.id !== b.getAttribute("data-delh"));
      Store.save();
      this.renderSettings();
    });
    const hf = document.getElementById("hol-form");
    if (hf) hf.onsubmit = (e) => {
      e.preventDefault();
      const start = UI.val(hf, "start");
      const end = UI.val(hf, "end");
      if (end < start) return UI.toast("End must be on or after the start");
      Store.data.schoolHolidays.push({
        id: CryptoUtil.uid("sh"),
        label: UI.val(hf, "label"),
        kind: UI.val(hf, "kind"),
        start,
        end
      });
      Store.save();
      UI.toast("Holiday dates added");
      this.renderSettings();
    };
  },

  approvalsCard() {
    const pending = Store.data.pendingUsers || [];
    return '<div class="card" style="margin-top:16px"><h3>Approvals</h3><p class="muted">People who asked for a PIN. Only the house admin can approve.</p>' +
      (pending.length ? pending.map((p) => "<div class='row'><div><b>" + UI.esc(p.name) + "</b><div class='muted'>Asked " + UI.esc(UI.fmtTime(p.requestedAt)) + "</div></div>" +
        "<span class='actions'><button class='btn primary' type='button' data-approve='" + p.id + "'>Approve</button><button class='btn' type='button' data-decline='" + p.id + "'>Decline</button></span></div>").join("") :
        "<p class='muted'>No one is waiting.</p>") +
      "</div>";
  },

  pinAdmin() {
    return '<div class="card" style="margin-top:16px"><h3>Family PINs</h3><p class="muted">PINs are stored as SHA-256 + salt. Raw PINs are never saved.</p>' +
      Store.data.users.map((u) => "<div class='row'><div><b>" + UI.esc(u.name) + "</b><div class='muted'>" + u.role +
        (u.approvedBy ? " · approved by " + UI.esc(Store.userName(u.approvedBy)) + (u.approvedAt ? " · " + UI.fmtTime(u.approvedAt) : "") : "") +
        "</div><label class='field' style='margin:8px 0 0'><span>School children</span><select data-school='" + u.id + "'>" +
        this.schoolOptions(u.schoolId || "") + "</select></label></div>" +
        (u.id !== Auth.user().id ? "<button class='text-btn' data-delu='" + u.id + "'>Remove</button>" : "") + "</div>").join("") +
      '<form id="pin-form"><div class="field-row"><input name="name" placeholder="Name" required><select name="role"><option value="family">Family</option><option value="guest">Guest</option><option value="admin">Admin</option></select></div>' +
      '<label class="field"><span>New 4–6 digit PIN</span><input name="pin" inputmode="numeric" pattern="[0-9]{4,6}" required></label><button class="btn">Add person</button></form></div>';
  },

  bindPinAdmin() {
    if (!Auth.isAdmin()) return;
    const f = document.getElementById("pin-form");
    if (f) f.onsubmit = async (e) => {
      e.preventDefault();
      const pin = UI.val(f, "pin");
      if (!/^\d{4,6}$/.test(pin)) return UI.toast("PIN must be 4–6 digits");
      const salt = CryptoUtil.randomSalt();
      const person = { id: CryptoUtil.uid("u"), name: UI.val(f, "name"), role: UI.val(f, "role"), pinSalt: salt, pinHash: await CryptoUtil.hashPin(pin, salt), createdAt: new Date().toISOString(), createdBy: Auth.user().id };
      Store.data.users.push(person);
      Store.addOwner(person);
      Store.log("create", "user", "", UI.val(f, "name"));
      Store.save();
      UI.toast("Person added");
      this.renderSettings();
    };
    document.querySelectorAll("[data-delu]").forEach((b) => b.onclick = () => {
      if (!UI.confirm("Remove this person?")) return;
      const id = b.getAttribute("data-delu");
      Store.data.users = Store.data.users.filter((u) => u.id !== id);
      Store.data.owners = (Store.data.owners || []).filter((o) => o.id !== id);
      Store.save();
      this.renderSettings();
    });
    document.querySelectorAll("[data-approve]").forEach((b) => b.onclick = () => this.approvePending(b.getAttribute("data-approve")));
    document.querySelectorAll("[data-decline]").forEach((b) => b.onclick = () => this.declinePending(b.getAttribute("data-decline")));
  },

  approvePending(id) {
    if (!Auth.isAdmin()) return;
    const pending = (Store.data.pendingUsers || []).find((p) => p.id === id);
    if (!pending) return;
    const admin = Auth.user();
    const now = new Date().toISOString();
    const person = {
      id: CryptoUtil.uid("u"),
      name: pending.name,
      firstName: pending.firstName,
      lastName: pending.lastName,
      role: "family",
      pinSalt: pending.pinSalt,
      pinHash: pending.pinHash,
      createdAt: now,
      createdBy: admin.id,
      approvedBy: admin.id,
      approvedAt: now
    };
    Store.data.users.push(person);
    Store.addOwner(person);
    Store.data.pendingUsers = Store.data.pendingUsers.filter((p) => p.id !== id);
    Store.log("approve", "user", "", admin.name + " approved " + pending.name);
    Store.save();
    UI.toast(pending.name + " can now sign in");
    this.renderSettings();
  },

  declinePending(id) {
    if (!Auth.isAdmin()) return;
    const pending = (Store.data.pendingUsers || []).find((p) => p.id === id);
    Store.data.pendingUsers = (Store.data.pendingUsers || []).filter((p) => p.id !== id);
    Store.log("decline", "user", "", (pending && pending.name) || id);
    Store.save();
    UI.toast("Request declined");
    this.renderSettings();
  },

  openSave() {
    location.hash = "settings";
  }
};

document.addEventListener("DOMContentLoaded", () => {
  App.init().catch((err) => {
    const boot = document.getElementById("boot-screen");
    if (boot) {
      boot.hidden = false;
      boot.innerHTML = "<p>Could not open the house.</p><p class='muted'>" +
        String(err && err.message ? err.message : err) + "</p>";
    }
    console.error(err);
  });
});
