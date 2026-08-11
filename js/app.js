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
      a.addEventListener("click", (e) => {
        document.getElementById("sidenav").classList.remove("open");
        const href = a.getAttribute("href") || "";
        if (href && (location.hash || "#") === href) {
          e.preventDefault();
          this.route();
        }
      });
    });
  },

  syncSaveChip() {
    const btn = document.getElementById("save-banner-btn");
    if (btn) btn.hidden = !Auth.isAdmin();
  },

  showLogin() {
    document.getElementById("boot-screen").hidden = true;
    document.getElementById("app").hidden = true;
    const review = document.getElementById("stay-review-screen");
    if (review) { review.hidden = true; review.innerHTML = ""; }
    this._stayReviewDraft = null;
    document.getElementById("login-screen").hidden = false;
    this.pin = "";
    this.drawDots();
    this.tickLock();
    this.showLoginPanels("pin");
    const pinsNav = document.getElementById("nav-family-pins");
    if (pinsNav) pinsNav.hidden = true;
  },

  showApp() {
    document.getElementById("boot-screen").hidden = true;
    document.getElementById("login-screen").hidden = true;
    document.getElementById("app").hidden = false;
    const u = Auth.user();
    document.getElementById("who-chip").textContent = (Auth.isImpersonating() ? "As " : "") + u.name + " · " + u.role;
    const pinsNav = document.getElementById("nav-family-pins");
    if (pinsNav) pinsNav.hidden = !Auth.isAdmin();
    this.syncSaveChip();
    if (this.maybeStayReview()) return;
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
      else if (k === "ok") {
        if (this.pin.length === 4) await this.submitPin();
        else this.showPinError("PIN must be 4 digits.");
      } else if (this.pin.length < 4) {
        this.pin += k;
        this.drawDots();
        if (this.pin.length === 4) await this.submitPin();
        return;
      }
      this.drawDots();
    };
    if (!this._pinKeys) {
      this._pinKeys = true;
      document.addEventListener("keydown", (e) => {
        if (document.getElementById("login-screen").hidden) return;
        if (document.getElementById("login-pin-panel").hidden) return;
        if (Auth.lockedUntil()) return;
        if (e.key === "Enter" && this.pin.length === 4) this.submitPin();
        else if (e.key === "Backspace") {
          this.pin = this.pin.slice(0, -1);
          this.drawDots();
        } else if (/^\d$/.test(e.key) && this.pin.length < 4) {
          this.pin += e.key;
          this.drawDots();
          if (this.pin.length === 4) this.submitPin();
        }
      });
    }
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

  showPinError(msg) {
    const err = document.getElementById("pin-error");
    if (!err) return;
    err.hidden = false;
    err.textContent = msg;
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
    this.bindFamilyPick();
    if (form) form.onsubmit = (e) => {
      e.preventDefault();
      this.submitSignup(form);
    };
  },

  bindFamilyPick() {
    const hidden = document.getElementById("signup-family");
    document.querySelectorAll("#signup-family-pick [data-family]").forEach((btn) => {
      btn.onclick = () => {
        if (hidden) hidden.value = btn.getAttribute("data-family") || "";
        document.querySelectorAll("#signup-family-pick [data-family]").forEach((b) => {
          b.classList.toggle("on", b === btn);
        });
      };
    });
  },

  familyOptions(selected) {
    return '<option value="">Which part of the family?</option>' +
      Store.familyBranches().map((name) => "<option value='" + name + "'" + (selected === name ? " selected" : "") + ">" +
        name + "</option>").join("");
  },

  familyLine(booking) {
    const branch = Store.stayFamily(booking);
    return branch ? branch + " family" : "";
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
    return Store.allUsers().some((u) => Store.personNameKey(u) === key);
  },

  async submitSignup(form) {
    const first = UI.val(form, "firstName").trim();
    const last = UI.val(form, "lastName").trim();
    const pin = UI.val(form, "pin").replace(/\D/g, "");
    const houseCode = UI.val(form, "houseCode").replace(/\D/g, "");
    const err = document.getElementById("signup-error");
    const btn = form.querySelector('button[type="submit"]');
    const showErr = (msg) => {
      if (err) { err.hidden = false; err.textContent = msg; }
      UI.toast(msg);
    };
    if (btn) btn.disabled = true;
    try {
      if (!first || !last) return showErr("Please enter your name and surname.");
      const familyBranch = UI.val(form, "familyBranch");
      if (Store.familyBranches().indexOf(familyBranch) < 0) return showErr("Please choose which part of the family.");
      if (!/^\d{4}$/.test(pin)) return showErr("PIN must be 4 digits.");
      if (!(await Store.checkHouseCode(houseCode))) return showErr("That house code is not right.");
      if (this.nameTaken(first, last)) return showErr("That name is already registered.");
      const salt = CryptoUtil.randomSalt();
      const now = new Date().toISOString();
      const person = {
        id: CryptoUtil.uid("u"),
        firstName: first,
        lastName: last,
        name: first + " " + last,
        familyBranch,
        role: "family",
        pinSalt: salt,
        pinHash: await CryptoUtil.hashPin(pin, salt),
        pinDisplay: pin,
        createdAt: now,
        updatedAt: now,
        createdBy: "signup"
      };
      Store.rememberUser(person);
      Store.addOwner(person);
      Auth.setSession(person);
      Store.log("create", "user", person.id, person.name + " created a PIN");
      Store.save();
      await Store.pushRemote();
      form.reset();
      this.showApp();
      UI.toast("Welcome, " + person.name);
    } catch (ex) {
      showErr((ex && ex.message) ? ex.message : "Could not create your PIN. Please try again.");
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  route() {
    const raw = (location.hash || "#dashboard").replace(/^#/, "");
    const [view, ...rest] = raw.split("/");
    this.view = view || "dashboard";
    this.params = { id: rest[0] ? decodeURIComponent(rest[0]) : "", extra: rest.slice(1).join("/") };
    if (this.maybeStayReview()) return;
    document.querySelectorAll("[data-nav]").forEach((a) => {
      const nav = a.getAttribute("data-nav");
      const onPins = this.view === "settings" && this.params.id === "pins";
      a.classList.toggle("active",
        (nav === "pins" && onPins) ||
        (nav === this.view && !(nav === "settings" && onPins)) ||
        (this.view === "search" && nav === "dashboard"));
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
      announcements: () => this.renderDashboard(),
      settings: () => this.renderSettings(),
      search: () => this.renderSearch(),
      documents: () => { this.houseTab = "docs"; this.renderHouse(); },
      contacts: () => { this.houseTab = "people"; this.renderHouse(); }
    };
    (map[this.view] || map.dashboard)();
  },

  maybeStayReview() {
    const screen = document.getElementById("stay-review-screen");
    if (!screen || !Auth.user()) return false;
    const stay = Store.pendingStayReview(Auth.user());
    if (!stay) {
      screen.hidden = true;
      screen.innerHTML = "";
      return false;
    }
    this.paintStayReview(stay);
    return true;
  },

  paintStayReview(stay) {
    const screen = document.getElementById("stay-review-screen");
    if (!screen || !stay) return;
    const draft = this._stayReviewDraft || { stars: 0, busy: "", bookingNeeded: "", notes: "", nextYear: "" };
    this._stayReviewDraft = draft;
    const choice = (name, value, label, wide) =>
      '<button type="button" class="choice-btn' + (draft[name] === value ? " on" : "") +
      '" data-rv="' + name + '" data-v="' + value + '">' + label + "</button>";
    screen.hidden = false;
    screen.innerHTML = '<div class="stay-review-card"><p class="eyebrow">After your stay</p>' +
      "<h2>How was the house?</h2>" +
      "<p class='login-sub'>You stayed " + UI.fmt(stay.arrival) + " – " + UI.fmt(stay.departure) +
      ". A short review helps next year’s group.</p>" +
      '<p id="stay-review-err" class="pin-error" hidden></p>' +
      '<form id="stay-review-form">' +
      "<label class='field'><span>1. How was the house?</span></label>" +
      '<div class="choice-grid">' +
        [1, 2, 3, 4, 5].map((n) => choice("stars", String(n), "★ " + n)).join("") +
      "</div>" +
      "<label class='field'><span>2. How busy was the area?</span></label>" +
      '<div class="choice-grid wide">' +
        choice("busy", "quiet", "Quiet") + choice("busy", "normal", "Normal") +
        choice("busy", "busy", "Busy") + choice("busy", "packed", "Packed") +
      "</div>" +
      "<label class='field'><span>3. Did you need to book restaurants / beaches / places in advance?</span></label>" +
      '<div class="choice-grid wide">' +
        choice("bookingNeeded", "yes", "Yes") + choice("bookingNeeded", "no", "No") +
        choice("bookingNeeded", "some", "Some") +
      "</div>" +
      '<label class="field"><span>4. Short comment (optional)</span>' +
      '<textarea name="notes" rows="3" placeholder="Anything simple">' + UI.esc(draft.notes) + "</textarea></label>" +
      '<label class="field"><span>5. Anything you’d tell next year’s group for these dates?</span>' +
      '<textarea name="nextYear" rows="3" placeholder="Book that restaurant, avoid that weekend…">' +
      UI.esc(draft.nextYear) + "</textarea></label>" +
      '<button class="btn primary create-pin-btn" type="submit">Save review</button></form></div>';
    screen.querySelectorAll("[data-rv]").forEach((btn) => {
      btn.onclick = () => {
        const form = document.getElementById("stay-review-form");
        if (form) {
          this._stayReviewDraft.notes = UI.val(form, "notes");
          this._stayReviewDraft.nextYear = UI.val(form, "nextYear");
        }
        const key = btn.getAttribute("data-rv");
        let val = btn.getAttribute("data-v");
        if (key === "stars") val = Number(val);
        this._stayReviewDraft[key] = val;
        this.paintStayReview(stay);
      };
    });
    const form = document.getElementById("stay-review-form");
    if (form) form.onsubmit = (e) => {
      e.preventDefault();
      this.submitStayReview(stay, form);
    };
  },

  submitStayReview(stay, form) {
    const draft = this._stayReviewDraft || {};
    const err = document.getElementById("stay-review-err");
    const showErr = (msg) => {
      if (err) { err.hidden = false; err.textContent = msg; }
      UI.toast(msg);
    };
    const stars = Number(draft.stars || 0);
    if (stars < 1 || stars > 5) return showErr("Please tap how many stars.");
    if (!draft.busy) return showErr("Please say how busy the area was.");
    if (!draft.bookingNeeded) return showErr("Please say if you needed to book ahead.");
    const user = Auth.user();
    const arrival = stay.arrival;
    stay.stayReview = {
      reviewerId: user ? user.id : "",
      reviewer: user ? user.name : "",
      arrival: stay.arrival,
      departure: stay.departure,
      year: Number(String(arrival).slice(0, 4)),
      month: Number(String(arrival).slice(5, 7)),
      weekOfMonth: Store.weekOfMonth(arrival),
      busy: draft.busy,
      bookingNeeded: draft.bookingNeeded,
      stars,
      notes: UI.val(form, "notes"),
      nextYear: UI.val(form, "nextYear"),
      reviewedAt: new Date().toISOString()
    };
    this._stayReviewDraft = null;
    Store.log("review", "booking", stay.id, (user ? user.name : "Someone") + " reviewed their stay");
    Store.save();
    UI.toast("Thank you — review saved");
    Store.tryPushIfAuthed().catch(() => {});
    if (this.maybeStayReview()) return;
    this.route();
  },

  busyBannerHtml(arrival, departure) {
    const msg = Store.busyHint(arrival, departure);
    if (!msg) return "";
    return '<div class="holiday-banner busy">' + UI.esc(msg) + "</div>";
  },

  dashBusyNote() {
    const next = Store.upcomingBookings()[0];
    const msg = next
      ? Store.busyHint(next.arrival, next.departure)
      : Store.busyHintForMonth(UI.today().slice(0, 7));
    if (!msg) return "";
    return '<div class="holiday-banner busy"><b>Coming dates look busy.</b> ' + UI.esc(msg) + "</div>";
  },

  dirtyBar() {
    if (!Auth.isAdmin()) return "";
    return "";
  },

  afterRender() {
    const bar = document.getElementById("bar-save");
    if (bar) bar.onclick = () => this.openSave();
    document.querySelectorAll("[data-back-admin]").forEach((b) => {
      b.onclick = () => this.returnToAdmin();
    });
    this.syncSaveChip();
  },

  impersonateBar() {
    if (!Auth.isImpersonating()) return "";
    const u = Auth.user();
    return '<div class="dirty-bar impersonate-bar"><span>You are in as <b>' + UI.esc(u ? u.name : "them") +
      "</b>. Changes you make are theirs.</span>" +
      '<button class="btn primary" type="button" data-back-admin>Back to admin</button></div>';
  },

  openAsUser(id) {
    const person = Store.allUsers().find((u) => u.id === id);
    if (!person) return UI.toast("That person is not here");
    if (!Auth.openAs(person)) return UI.toast("Only admin can do that");
    this.showApp();
    UI.toast("Now in as " + person.name);
  },

  returnToAdmin() {
    const admin = Auth.backToAdmin();
    if (!admin) return UI.toast("Could not return to admin");
    this.showApp();
    location.hash = "settings";
    UI.toast("Back as " + admin.name);
  },

  head(title, sub, actions) {
    return this.dirtyBar() + this.impersonateBar() + '<div class="page-head"><div><h2>' + UI.esc(title) + "</h2><p>" + UI.esc(sub) +
      '</p></div><div class="actions">' + (actions || "") + "</div></div>";
  },

  myTripsHtml() {
    const stays = Store.myUpcomingStays(Auth.user());
    let body;
    if (!stays.length) {
      body = "<p class='empty-trips'>You have no dates booked yet.</p>" +
        (Auth.canEdit() ? '<button type="button" class="btn primary trip-open" id="dash-add-stay">Add a stay</button>' : "");
    } else {
      body = stays.map((b) => {
        const nights = Store.nightsBetween(b.arrival, b.departure);
        const who = [];
        if (b.guestCount) who.push(b.guestCount + " guest" + (b.guestCount === 1 ? "" : "s"));
        if (b.guests) who.push(b.guests);
        const fam = this.familyLine(b);
        if (fam) who.push(fam);
        return '<div class="trip-card">' +
          '<p class="trip-dates">' + UI.esc(UI.fmt(b.arrival)) + " – " + UI.esc(UI.fmt(b.departure)) + "</p>" +
          "<p class='trip-meta'>" + nights + " night" + (nights === 1 ? "" : "s") +
          (who.length ? " · " + UI.esc(who.join(" · ")) : "") + "</p>" +
          '<a class="btn primary trip-open" href="#calendar/' + UI.esc(b.id) + '">Open this stay</a>' +
          "</div>";
      }).join("");
    }
    return '<div class="card my-trips"><h3>Your trips to France</h3>' + body + "</div>";
  },

  forYouHtml() {
    const tips = this.forYouTips(Auth.user());
    if (!tips.length) return "";
    return '<div class="card for-you"><h3>For you</h3><ul>' +
      tips.map((t) => "<li>" + t + "</li>").join("") + "</ul></div>";
  },

  forYouTips(user) {
    const tips = [];
    const next = Store.myUpcomingStays(user)[0];
    const t = UI.today();
    if (next) {
      if (next.arrival <= t && t < next.departure) {
        tips.push("You’re at the house until " + UI.esc(UI.fmt(next.departure)) + ".");
      } else {
        const days = Store.nightsBetween(t, next.arrival);
        if (days <= 0) tips.push("You arrive today — " + UI.esc(UI.fmt(next.arrival)) + ".");
        else if (days === 1) tips.push("You arrive tomorrow.");
        else tips.push("Your next stay is in " + days + " days (" + UI.esc(UI.fmt(next.arrival)) + ").");
      }
      const busy = Store.busyHint(next.arrival, next.departure);
      let saidRestaurants = false;
      if (busy) {
        let line = busy.replace(/\.$/, "");
        if (/usually busy/i.test(line)) line += " — book restaurants before you go.";
        tips.push(UI.esc(line));
        saidRestaurants = /restaurant/i.test(line);
      }
      if (Store.holidaysOverlapping(next.arrival, next.departure).length) {
        tips.push("School families have priority that week.");
      }
      tips.push('Compare flights on <a href="#travel">Travel</a> for these dates (BA / easyJet / Skyscanner).');
      const month = Number(String(next.arrival).slice(5, 7));
      if (!saidRestaurants && month >= 6 && month <= 9) {
        tips.push('Summer is busy locally — book restaurants before you go. See the <a href="#guide">Local guide</a>.');
      }
    } else if (Auth.canEdit()) {
      tips.push('No dates in the book yet. Add a stay when you know when you’re coming.');
    } else {
      tips.push("When a stay is booked in your name, tips for those dates will show up here.");
    }
    return tips.slice(0, 6);
  },

  async renderDashboard() {
    const d = Store.data;
    const here = Store.currentStays();
    const next = Store.upcomingBookings().slice(0, 4);
    const open = Store.openIssues();
    const due = Store.dueRecurring();
    const recentFix = (d.maintenance || []).filter((m) => m.status === "completed").slice(0, 3);
    const docs = (d.documents || []).slice(0, 3);
    const admin = Auth.isAdmin();
    const view = document.getElementById("view");
    const weatherTravel = '<div class="grid two" style="margin-top:16px">' +
        '<div class="card"><h3>Who is at the house?</h3>' + this.whoBlock(here, next) + "</div>" +
        '<div class="card" id="weather-card"><h3>Weather · La Croix-Valmer</h3><p class="muted">Checking the sky…</p></div>' +
      "</div>" +
      '<div class="card" style="margin-top:16px"><h3>Travel</h3><p>London to Nice, Marseille or Toulon — then a short drive to La Croix-Valmer.</p>' +
        '<div class="quick-links"><a href="#travel">Compare flights</a></div>' +
        '<p class="muted" id="travel-hint">Most convenient is often Gatwick → Toulon (direct), then about an hour by car.</p></div>' +
      '<div class="card" style="margin-top:16px"><h3>Quick links</h3><div class="quick-links">' +
        '<a href="#calendar">Calendar</a><a href="#house">House guide</a>' +
        '<a href="#travel">Travel</a><a href="#guide">Local guide</a><a href="#expenses">Expenses</a></div></div>';
    if (!admin) {
      view.innerHTML = this.head("Welcome home", d.house.place + " · " + (d.house.region || ""),
        (Auth.canEdit() ? '<a class="btn primary" href="#calendar">New stay</a>' : "") +
        '<a class="btn" href="#maintenance">Report issue</a>') +
        this.familyHomeNote() +
        this.myTripsHtml() +
        this.forYouHtml() +
        this.holidayDashNote() + this.dashBusyNote() +
        weatherTravel;
    } else {
      view.innerHTML = this.head("Welcome home", d.house.place + " · " + (d.house.region || ""),
        '<a class="btn primary" href="#calendar">New stay</a><a class="btn" href="#maintenance">Report issue</a>') +
        this.holidayDashNote() + this.dashBusyNote() +
        '<a class="card pin-jump-card" href="#settings/pins"><h3>Family PINs</h3><p>Everyone’s name and 4-digit PIN</p></a>' +
        this.forYouHtml() +
        '<div class="grid stats">' +
          this.stat(here.length ? here[0].guests.split(",")[0] : "Empty", "Who is here") +
          this.stat(next.length, "Upcoming stays") +
          this.stat(open.length, "Open issues") +
          this.stat(due.length, "Tasks due") +
        "</div>" +
        this.dashMoney() +
        '<div class="grid two" style="margin-top:16px">' +
          '<div class="card"><h3>Open maintenance</h3>' + this.issueList(open.slice(0, 4)) +
            '<p><a href="#maintenance">All issues</a></p></div>' +
          '<div class="card"><h3>Due around the house</h3>' + this.recurringList(due.length ? due : d.recurring.slice(0, 3)) + "</div>" +
        "</div>" +
        weatherTravel +
        '<div class="grid two" style="margin-top:16px">' +
          '<div class="card"><h3>Recent repairs</h3>' + (recentFix.length ? recentFix.map((m) => "<div class='row'><span>" + UI.esc(m.title) + "</span><span class='chip done'>Done</span></div>").join("") : "<p class='empty'>None yet.</p>") + "</div>" +
          '<div class="card"><h3>Documents</h3>' + docs.map((doc) => "<div class='row'><a href='#house'>" + UI.esc(doc.title) + "</a><span class='chip'>" + UI.esc(doc.category) + "</span></div>").join("") + "</div>" +
        "</div>";
    }
    this.afterRender();
    const newStay = document.querySelector(".page-head a.btn.primary");
    if (newStay && newStay.getAttribute("href") === "#calendar") {
      newStay.onclick = (e) => {
        e.preventDefault(); location.hash = "calendar"; setTimeout(() => this.bookingForm(), 50);
      };
    }
    const addStay = document.getElementById("dash-add-stay");
    if (addStay) addStay.onclick = () => {
      location.hash = "calendar";
      setTimeout(() => this.bookingForm(), 50);
    };
    const w = await UI.weather();
    if (this.view !== "dashboard") return;
    const box = document.getElementById("weather-card");
    if (box) {
      if (!w || !w.current) box.innerHTML = "<h3>Weather · La Croix-Valmer</h3><p class='muted'>Weather unavailable offline — try again when you have a signal.</p>";
      else box.innerHTML = "<h3>Weather · La Croix-Valmer</h3><p class='price'>" + Math.round(w.current.temperature_2m) + "°</p><p>" + UI.weatherLabel(w.current.weather_code) +
        (w.daily ? " · High " + Math.round(w.daily.temperature_2m_max[0]) + "° / low " + Math.round(w.daily.temperature_2m_min[0]) + "°" : "") + "</p>";
    }
    Flights.getFares().then((fares) => {
      if (this.view !== "dashboard") return;
      const h = Flights.highlights(fares);
      const el = document.getElementById("travel-hint");
      if (el && h.convenient) el.textContent = "Suggested: " + h.convenient.from + " → " + h.convenient.to + " with " + h.convenient.airline +
        (h.convenient.direct ? " (direct)" : "") + ". Drive " + h.convenient.drive.label + ".";
    }).catch(() => {});
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

  costBoxHtml(est, arrival, departure, guests) {
    const out = arrival || UI.today();
    const back = departure || UI.addDays(out, 7);
    const n = Flights.adults(guests || (est && est.guests) || 2);
    const links = (est && est.links) || Flights.liveLinks("LGW", "TLN", out, back, n);
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

  familyHomeNote() {
    const branch = Store.familyBranch(Auth.user());
    if (!branch) return "";
    return '<div class="family-home-note">You’re in the ' + UI.esc(branch) + " family</div>";
  },

  whoBlock(here, next) {
    const whoLabel = (b) => {
      const bits = [b.guests || "Guests"];
      const fam = this.familyLine(b);
      if (fam) bits.push(fam);
      return bits.join(" · ");
    };
    if (!here.length) {
      const n = next[0];
      return "<p>The house is empty right now.</p>" + (n ? "<p>Next: <b>" + UI.esc(whoLabel(n)) + "</b> from " + UI.fmt(n.arrival) + ".</p>" : "");
    }
    return here.map((b) => "<div class='row'><div><b>" + UI.esc(whoLabel(b)) + "</b><div class='muted'>Until " + UI.fmt(b.departure) + " · " + b.guestCount + " guests</div></div><a href='#calendar'>Stay</a></div>").join("") +
      (next[0] ? "<p class='muted'>Next arrival: " + UI.esc(whoLabel(next[0])) + " on " + UI.fmt(next[0].arrival) + ".</p>" : "");
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
    const openStay = this.params.id && (Store.data.bookings || []).find((x) => x.id === this.params.id);
    if (openStay) this.cal.cursor = openStay.arrival.slice(0, 7) + "-01";
    if (!this.cal.cursor) this.cal.cursor = UI.today().slice(0, 7) + "-01";
    const mode = this.cal.mode;
    const view = document.getElementById("view");
    view.innerHTML = this.head("Calendar", "Green free · Red booked · Gold flag = school holiday",
      (Auth.canEdit() ? '<button class="btn primary" id="add-stay" type="button">Add stay</button>' : "")) +
      this.holidayDashNote() +
      '<div id="cal-busy">' + this.calBusyBanner() + "</div>" +
      '<div class="legend"><span><i class="swatch available"></i>Available</span><span><i class="swatch booked"></i>Booked</span><span><i class="swatch holiday"></i>School holiday</span></div>' +
      '<div class="filters"><div class="seg">' +
        ["month","week","list"].map((m) => '<button type="button" data-mode="' + m + '" class="' + (mode === m ? "on" : "") + '">' + m[0].toUpperCase() + m.slice(1) + "</button>").join("") +
      '</div><div class="actions"><button class="btn ghost" id="cal-prev" type="button">Back</button><button class="btn ghost" id="cal-today" type="button">Today</button><button class="btn ghost" id="cal-next" type="button">Next</button></div></div>' +
      '<div id="cal-body"></div><div class="card" style="margin-top:16px"><h3>Booking history</h3><div id="cal-hist"></div></div>';
    this.paintCal();
    view.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => { this.cal.mode = b.getAttribute("data-mode"); this.renderCalendar(); });
    document.getElementById("cal-prev").onclick = () => this.shiftCal(-1);
    document.getElementById("cal-next").onclick = () => this.shiftCal(1);
    document.getElementById("cal-today").onclick = () => {
      this.cal.cursor = UI.today().slice(0, 7) + "-01";
      this.renderCalendar();
      this.scrollCalStart();
    };
    const add = document.getElementById("add-stay");
    if (add) add.onclick = () => this.bookingForm();
    this.afterRender();
    if (openStay) this.openBooking(openStay.id);
  },

  shiftCal(dir) {
    const d = new Date(this.cal.cursor + "T12:00:00");
    if (this.cal.mode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    this.cal.cursor = d.toISOString().slice(0, 10);
    this.paintCal();
    const busy = document.getElementById("cal-busy");
    if (busy) busy.innerHTML = this.calBusyBanner();
    this.scrollCalStart();
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
        "</td><td><span class='chip " + (b.status === "cancelled" ? "rejected" : "done") + "'>" + (b.status === "blocked" ? "booked" : b.status) +
        "</span></td><td><button class='text-btn' data-open='" + b.id + "'>Open</button></td></tr>").join("") + "</table>"
      : "<p class='empty'>No stays yet.</p>";
    body.querySelectorAll("[data-day]").forEach((el) => el.onclick = () => this.onDay(el.getAttribute("data-day")));
    hist.querySelectorAll("[data-open]").forEach((el) => el.onclick = () => this.openBooking(el.getAttribute("data-open")));
    body.querySelectorAll("[data-open]").forEach((el) => el.onclick = (e) => { e.stopPropagation(); this.openBooking(el.getAttribute("data-open")); });
  },

  scrollCalStart() {
    const filters = document.querySelector(".filters");
    if (filters) filters.scrollIntoView({ block: "start", behavior: "smooth" });
  },

  calMonth() {
    const start = new Date(this.cal.cursor.slice(0, 7) + "-01T12:00:00");
    let html = '<div class="cal-stack">';
    for (let i = 0; i < 12; i++) {
      html += this.calMonthGrid(new Date(start.getFullYear(), start.getMonth() + i, 1, 12));
    }
    return html + "</div>";
  },

  calMonthGrid(start, opts) {
    opts = opts || {};
    const ym = start.toISOString().slice(0, 7);
    const title = start.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const firstDow = (start.getDay() + 6) % 7;
    const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    let html = '<section class="cal-month" id="' + (opts.idPrefix || "") + "cal-month-" + ym + '"><h3>' + title + '</h3><div class="cal-grid">' +
      ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => '<div class="cal-dow">' + d + "</div>").join("");
    for (let i = 0; i < firstDow; i++) html += '<div class="cal-day out"></div>';
    for (let day = 1; day <= days; day++) {
      const iso = start.toISOString().slice(0, 8) + String(day).padStart(2, "0");
      const st = Store.dayStatus(iso) === "blocked" ? "booked" : Store.dayStatus(iso);
      const hol = Store.holidayOn(iso);
      const stays = (Store.data.bookings || []).filter((b) => b.status !== "cancelled" && b.arrival <= iso && iso < b.departure);
      const selected = opts.arrival === iso || opts.departure === iso;
      const inRange = !!(opts.arrival && opts.departure && iso > opts.arrival && iso < opts.departure);
      html += '<div class="cal-day ' + st + (hol ? " holiday" : "") + (iso === UI.today() ? " today" : "") +
        (selected ? " pick-on" : "") + (inRange ? " pick-range" : "") +
        '" data-day="' + iso + '"' + (opts.pick ? ' data-pick-day="' + iso + '"' : "") + "><b>" + day +
        (hol ? ' <span class="cal-flag" title="' + UI.esc(hol.label) + '">H</span>' : "") + "</b>" +
        (opts.pick ? "" : stays.map((b) => '<a class="cal-pill" data-open="' + b.id + '">' + UI.esc((b.guests || b.notes || b.status).slice(0, 22)) + "</a>").join("")) +
        "</div>";
    }
    return html + "</div></section>";
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
      html += '<div class="cal-day week-col ' + (Store.dayStatus(iso) === "blocked" ? "booked" : Store.dayStatus(iso)) + (hol ? " holiday" : "") + '" data-day="' + iso + '"><b>' +
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
        UI.fmt(b.arrival) + " – " + UI.fmt(b.departure) + " · " + (b.guestCount || 0) + " guests · " + (b.status === "blocked" ? "booked" : b.status) +
        (Store.holidaysOverlapping(b.arrival, b.departure).length ? " · school holiday" : "") +
        "</div></div><button class='btn' data-open='" + b.id + "'>Open</button></div>").join("") : "<p class='empty'>None</p>") + "</div>";
    return block("Coming up", future) + block("Past", past);
  },

  calBusyBanner() {
    if (this.cal.mode === "week") {
      const d = new Date((this.cal.cursor || UI.today()) + "T12:00:00");
      const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow);
      const start = d.toISOString().slice(0, 10);
      d.setDate(d.getDate() + 7);
      return this.busyBannerHtml(start, d.toISOString().slice(0, 10));
    }
    return this.busyBannerHtml(
      (this.cal.cursor || UI.today()).slice(0, 7) + "-01",
      UI.addDays((this.cal.cursor || UI.today()).slice(0, 7) + "-28", 8)
    );
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
    UI.modal("Stay · " + UI.fmt(b.arrival),
      this.holidayBannerHtml(b.arrival, b.departure) +
      "<p><b>" + UI.esc(b.guests || "—") + "</b>" +
      (this.familyLine(b) ? "<div class='muted'>" + UI.esc(this.familyLine(b)) + "</div>" : "") +
      "</p><p>" + UI.fmt(b.arrival) + " → " + UI.fmt(b.departure) + " · " + (b.guestCount || 0) + " guests</p>" +
      "<p>" + UI.esc(b.notes || "") + "</p><p class='muted'>Booked by " + UI.esc(Store.userName(b.createdBy)) + " · " + (b.status === "blocked" ? "booked" : b.status) + "</p>" +
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
    const modal = UI.modal(existing && existing.id ? "Edit stay" : "New stay",
      '<form id="bk-form" class="stay-form">' +
        '<div class="stay-form-body">' +
        '<div class="date-pick-row">' +
          '<button type="button" class="date-pick-btn" data-pick="arrival"><span>Arrival</span><strong id="bk-arrival-label">' + UI.esc(UI.fmt(b.arrival)) + "</strong></button>" +
          '<button type="button" class="date-pick-btn" data-pick="departure"><span>Departure</span><strong id="bk-departure-label">' + UI.esc(UI.fmt(b.departure)) + "</strong></button>" +
        "</div>" +
        '<button type="button" class="btn date-clear" id="bk-clear-dates">Clear dates</button>' +
        '<input type="hidden" name="arrival" value="' + UI.esc(b.arrival || "") + '">' +
        '<input type="hidden" name="departure" value="' + UI.esc(b.departure || "") + '">' +
        '<p id="bk-date-hint" class="muted">Tap Arrival or Departure, then tap a day on the big calendar.</p>' +
        '<div id="bk-picker" class="date-picker" hidden></div>' +
        '<div id="bk-hol">' + this.holidayBannerHtml(b.arrival, b.departure) + this.busyBannerHtml(b.arrival, b.departure) + "</div>" +
        this.costBoxHtml(null, b.arrival, b.departure, b.guestCount) +
        '<label class="field"><span>Who is staying</span><input name="guests" value="' + UI.esc(b.guests || "") + '" placeholder="Names"></label>' +
        '<label class="field"><span>Guest count</span><input name="guestCount" type="number" min="0" value="' + (b.guestCount || 0) + '"></label>' +
        '<label class="field"><span>Notes</span><textarea name="notes" rows="3">' + UI.esc(b.notes || "") + "</textarea></label>" +
        '<input type="hidden" name="status" value="booked">' +
        '<div id="bk-ack-slot">' + this.holidayAckHtml(b.arrival, b.departure, "booked") + "</div>" +
        "</div>" +
        '<div class="stay-form-foot"><div id="bk-warn" class="pin-error" hidden></div>' +
        '<button class="btn primary stay-save" type="submit">Save stay</button></div></form>');
    modal.classList.add("stay-modal");
    const form = document.getElementById("bk-form");
    const pick = { field: "", cursor: (b.arrival || UI.today()).slice(0, 7) + "-01" };
    const showDateError = (msg) => {
      const w = document.getElementById("bk-warn");
      if (!w) return;
      w.hidden = !msg;
      w.textContent = msg || "";
    };
    const syncLabels = () => {
      document.getElementById("bk-arrival-label").textContent = UI.fmt(UI.val(form, "arrival")) || "Tap to pick";
      document.getElementById("bk-departure-label").textContent = UI.fmt(UI.val(form, "departure")) || "Tap to pick";
      document.querySelectorAll(".date-pick-btn").forEach((btn) => {
        btn.classList.toggle("on", btn.getAttribute("data-pick") === pick.field);
      });
    };
    const setHintOpen = (open) => {
      const hint = document.getElementById("bk-date-hint");
      if (!hint) return;
      hint.hidden = !!open;
      if (!open) hint.textContent = "Tap Arrival or Departure, then tap a day on the big calendar.";
    };
    const paintPicker = () => {
      const box = document.getElementById("bk-picker");
      if (!box || box.hidden) return;
      const arrival = UI.val(form, "arrival");
      const departure = UI.val(form, "departure");
      const start = new Date(pick.cursor.slice(0, 7) + "-01T12:00:00");
      const title = pick.field === "departure" ? "Now tap the day you leave" : "Tap the day you arrive";
      let html = '<div class="date-picker-bar"><p>' + title + "</p>" +
        '<div class="actions"><button type="button" class="btn ghost" id="bk-pick-prev">Back</button>' +
        '<button type="button" class="btn ghost" id="bk-pick-today">Today</button>' +
        '<button type="button" class="btn ghost" id="bk-pick-next">Next</button>' +
        '<button type="button" class="btn" id="bk-pick-done">Done</button>' +
        '<button type="button" class="btn date-clear" id="bk-pick-clear">Clear dates</button></div></div>' +
        '<div class="cal-stack date-picker-stack">';
      for (let i = 0; i < 12; i++) {
        html += this.calMonthGrid(new Date(start.getFullYear(), start.getMonth() + i, 1, 12), {
          pick: true, arrival, departure, idPrefix: "pick-"
        });
      }
      box.innerHTML = html + "</div>";
      document.getElementById("bk-pick-prev").onclick = () => {
        const d = new Date(pick.cursor + "T12:00:00");
        d.setMonth(d.getMonth() - 1);
        pick.cursor = d.toISOString().slice(0, 10);
        paintPicker();
      };
      document.getElementById("bk-pick-next").onclick = () => {
        const d = new Date(pick.cursor + "T12:00:00");
        d.setMonth(d.getMonth() + 1);
        pick.cursor = d.toISOString().slice(0, 10);
        paintPicker();
      };
      document.getElementById("bk-pick-today").onclick = () => {
        pick.cursor = UI.today().slice(0, 7) + "-01";
        paintPicker();
      };
      document.getElementById("bk-pick-done").onclick = () => closePicker();
      document.getElementById("bk-pick-clear").onclick = () => clearDates();
      box.querySelectorAll("[data-pick-day]").forEach((el) => {
        el.onclick = () => chooseDay(el.getAttribute("data-pick-day"));
      });
    };
    const closePicker = () => {
      pick.field = "";
      document.getElementById("bk-picker").hidden = true;
      setHintOpen(false);
      syncLabels();
    };
    const openPicker = (field) => {
      pick.field = field || "arrival";
      const iso = UI.val(form, pick.field) || UI.today();
      pick.cursor = iso.slice(0, 7) + "-01";
      document.getElementById("bk-picker").hidden = false;
      setHintOpen(true);
      syncLabels();
      paintPicker();
    };
    const clearDates = () => {
      form.elements.arrival.value = "";
      form.elements.departure.value = "";
      showDateError("");
      pick.field = "arrival";
      pick.cursor = UI.today().slice(0, 7) + "-01";
      document.getElementById("bk-picker").hidden = false;
      setHintOpen(true);
      syncLabels();
      refreshExtras();
      paintPicker();
    };
    const chooseDay = (iso) => {
      const arr = UI.val(form, "arrival");
      const asArrival = pick.field === "arrival" || !arr || iso <= arr;
      if (asArrival) {
        form.elements.arrival.value = iso;
        const dep = UI.val(form, "departure");
        if (!dep || dep <= iso) form.elements.departure.value = "";
        showDateError("");
        refreshExtras();
        pick.field = "departure";
        syncLabels();
        paintPicker();
        return;
      }
      form.elements.departure.value = iso;
      showDateError("");
      refreshExtras();
      closePicker();
    };
    document.querySelectorAll(".date-pick-btn").forEach((btn) => {
      btn.onclick = () => openPicker(btn.getAttribute("data-pick"));
    });
    const clearBtn = document.getElementById("bk-clear-dates");
    if (clearBtn) clearBtn.onclick = () => clearDates();
    const paintCost = (est, arrival, departure, guests) => {
      const box = document.getElementById("bk-cost");
      if (box) box.outerHTML = this.costBoxHtml(est, arrival, departure, guests);
      Flights.mountWidget();
    };
    const refreshExtras = () => {
      const arrival = UI.val(form, "arrival");
      const departure = UI.val(form, "departure");
      const guests = UI.val(form, "guestCount");
      document.getElementById("bk-hol").innerHTML = this.holidayBannerHtml(arrival, departure) + this.busyBannerHtml(arrival, departure);
      document.getElementById("bk-ack-slot").innerHTML = this.holidayAckHtml(arrival, departure, "booked");
      paintCost(null, arrival, departure, guests);
      Flights.withTimeout(Flights.estimateReturn(arrival, departure, guests), 3000).then((est) => {
        if (document.getElementById("bk-cost")) paintCost(est, arrival, departure, guests);
      }).catch(() => {
        if (document.getElementById("bk-cost")) paintCost(null, arrival, departure, guests);
      });
    };
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
        status: "booked",
        createdBy: b.createdBy || Auth.user().id,
        createdAt: b.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        familyBranch: b.familyBranch || Store.familyBranch(Auth.user()) || ""
      };
      if (!next.arrival || !next.departure || next.departure <= next.arrival) {
        document.getElementById("bk-warn").hidden = false;
        document.getElementById("bk-warn").textContent = "Arrival must be before you leave. Please pick a later departure day.";
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
      ["guide", "Guide"], ["stock", "Inventory"],
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
    else if (t === "stock") el.innerHTML = this.houseStock();
    else if (t === "leave") el.innerHTML = this.houseLeave();
    else if (t === "money") el.innerHTML = this.houseMoney();
    else if (t === "docs") el.innerHTML = this.houseDocs();
    else el.innerHTML = this.housePeople();
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
      '<div id="tr-fares"><p class="muted">Checking routes…</p></div>';
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
    let fares = [];
    try {
      fares = await Flights.withTimeout(Flights.getFares({ date, back, from, to, adults: guests }), 3000);
    } catch (_) { fares = []; }
    if (this.view !== "travel") return;
    const slot = document.getElementById("tr-fares");
    if (!slot) return;
    const hl = Flights.highlights(fares);
    slot.innerHTML = '<div class="grid highlights">' + card("Live fare", "cheap", hl.cheapest) + card("Fastest door to door", "fast", hl.fastest) + card("Most convenient", "easy", hl.convenient) + "</div>" +
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
  },

  placeKinds() {
    return [["", "All"], ["restaurant", "Restaurants"], ["beach", "Beaches"], ["attraction", "Attractions"], ["shop", "Shops"], ["other", "Other"]];
  },

  avgRating(placeId) {
    const revs = (Store.data.reviews || []).filter((r) => r.placeId === placeId && r.rating);
    if (!revs.length) return 0;
    return Math.round(revs.reduce((n, r) => n + Number(r.rating), 0) / revs.length);
  },

  guidePlaceId() {
    const raw = (location.hash || "").replace(/^#/, "");
    const parts = raw.split("/");
    if (parts[0] === "guide" || parts[0] === "restaurants") return parts[1] ? decodeURIComponent(parts[1]) : "";
    return this.params.id || "";
  },

  placeCardHtml(r) {
    const stars = this.avgRating(r.id) || r.rating || 0;
    const n = (Store.data.reviews || []).filter((x) => x.placeId === r.id).length;
    const hay = (r.name + " " + r.town + " " + (r.cuisine || "") + " " + (r.notes || "") + " " + (r.phone || "") + " " + r.kind).toLowerCase();
    return "<a class='card place-card' href='#guide/" + r.id + "' data-kind='" + UI.esc(r.kind) + "' data-hay='" + UI.esc(hay) + "'><span class='chip'>" + UI.esc(r.kind) +
      "</span><h3>" + UI.esc(r.name) + "</h3><p class='stars'>" + "★".repeat(stars) + "</p><p>" + UI.esc(r.town) +
      (r.cuisine ? " · " + UI.esc(r.cuisine) : "") + "</p>" +
      (r.phone ? "<p>" + UI.esc(r.phone) + "</p>" : "") +
      "<p class='muted'>" + UI.esc(r.notes || "") + "</p><p class='muted'>" + n + " reviews</p></a>";
  },

  filterGuideList() {
    const q = (this.foodQ || "").toLowerCase();
    const kind = this.foodKind || "";
    const grid = document.getElementById("guide-list");
    if (!grid) return;
    grid.querySelectorAll(".place-card").forEach((card) => {
      const hay = card.getAttribute("data-hay") || "";
      const k = card.getAttribute("data-kind") || "";
      card.hidden = !!(kind && k !== kind) || !!(q && hay.indexOf(q) < 0);
    });
  },

  renderGuide() {
    const id = this.guidePlaceId();
    if (id && (Store.data.places || []).find((p) => p.id === id)) return this.renderPlace(id);
    const kind = this.foodKind || "";
    const rows = Store.data.places || [];
    const view = document.getElementById("view");
    view.innerHTML = this.head("Local guide", "Restaurants, beaches, shops and days out near La Croix-Valmer",
      Auth.canEdit() ? '<button class="btn primary" id="add-r" type="button">Add a place</button>' : "") +
      '<div class="tabs">' + this.placeKinds().map((k) => '<button type="button" class="btn ' + (kind === k[0] ? "primary" : "") + '" data-kind="' + k[0] + '">' + k[1] + "</button>").join("") + "</div>" +
      '<input class="search-box" id="food-q" placeholder="Search places" value="' + UI.esc(this.foodQ || "") + '">' +
      '<div class="grid cards" id="guide-list" style="margin-top:16px">' + rows.map((r) => this.placeCardHtml(r)).join("") + "</div>";
    this.filterGuideList();
    const search = document.getElementById("food-q");
    if (search) {
      search.oninput = (e) => {
        this.foodQ = e.target.value;
        this.filterGuideList();
      };
    }
    view.querySelectorAll(".tabs [data-kind]").forEach((b) => b.onclick = () => {
      this.foodKind = b.getAttribute("data-kind");
      view.querySelectorAll(".tabs [data-kind]").forEach((x) => x.classList.toggle("primary", x === b));
      this.filterGuideList();
    });
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
      '<label class="field"><span id="place-phone-label">Phone</span><input name="phone" type="tel"></label>' +
      '<label class="field"><span>Cuisine / tag</span><input name="cuisine" placeholder="Optional"></label>' +
      '<label class="field"><span>Notes</span><textarea name="notes"></textarea></label>' +
      '<button class="btn primary">Save</button></form>');
    const form = document.getElementById("rf");
    const kindSel = form.elements.kind;
    const phoneLabel = document.getElementById("place-phone-label");
    const syncPhone = () => {
      phoneLabel.textContent = kindSel.value === "restaurant" ? "Phone (required)" : "Phone";
    };
    kindSel.onchange = syncPhone;
    syncPhone();
    form.onsubmit = (e) => {
      e.preventDefault();
      const kind = UI.val(e.target, "kind");
      const phone = UI.val(e.target, "phone").trim();
      if (kind === "restaurant" && !phone) {
        return UI.toast("Add a phone number — a restaurant without a number is no use.");
      }
      const id = CryptoUtil.uid("p");
      Store.data.places.push({
        id, kind, name: UI.val(e.target, "name"), town: UI.val(e.target, "town"),
        address: "", phone, website: "", cuisine: UI.val(e.target, "cuisine"),
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

  async renderSettings() {
    if (Auth.isAdmin()) await Store.pullRemote();
    const acts = Store.data.activity.slice(0, 40);
    const admin = Auth.isAdmin();
    const view = document.getElementById("view");
    view.innerHTML = this.head("Settings", admin ? "Family PINs, backup, and activity" : "Your settings") +
      (admin ? this.pinAdmin() + this.houseCodeNote() : "") +
      '<div class="card" style="margin-top:16px"><h3>One house, one address</h3>' +
      '<p>Calendar, flights, PINs and maintenance are <b>one website</b>: <a href="https://france.directestates.co.uk">france.directestates.co.uk</a>.</p>' +
      (admin ? "" : "<p>Your dates and PIN save on their own. You do not need GitHub.</p>") + "</div>" +
      (admin ? '<div class="card" style="margin-top:16px"><h3>How this runs, and where the calendar lives</h3>' +
      '<p>There is no server on this PC. <b>index.html</b> is a website file — open it in a browser. The GitHub page is only the code locker, not the live house.</p>' +
      '<p>The real calendar, bookings, people, and the rest live in <b>data/house.json</b> on GitHub. While you use the site, new bookings first save as a <b>draft in this browser</b>. Then download that file and put it back on GitHub so the family at home sees the same dates. Spreadsheet copies are in <b>data/csv/</b>.</p>' +
      '<div class="actions"><button class="btn primary" id="dl-json">Download house.json</button><button class="btn" id="dl-csv">Download CSVs</button><label class="btn">Restore JSON<input type="file" id="up-json" accept="application/json" hidden></label></div></div>' +
      '<div class="card" style="margin-top:16px"><h3>Save to GitHub</h3><form id="gh-form"><label class="field"><span>Owner / repo</span><input name="repo" placeholder="yourname/villa-famille" value="' + UI.esc((Store.ghCreds() || {}).repo || "") + '"></label>' +
      '<label class="field"><span>Token (repo contents)</span><input name="token" type="password" autocomplete="off" placeholder="' + ((Store.ghCreds() || {}).token ? "Token saved in this browser" : "") + '"></label><button class="btn">Save to GitHub</button></form></div>' : "") +
      this.schoolFamilyCard() +
      (admin ? this.schoolHolidaysCard() : "") +
      '<div class="card" style="margin-top:16px"><h3>Activity</h3>' +
      acts.map((a) => "<div class='row'><div><b>" + UI.esc(a.action) + "</b> " + UI.esc(a.entity) + "<div class='muted'>" + UI.esc(a.detail) + " · " + UI.esc(Store.userName(a.userId)) + "</div></div><span class='muted'>" + UI.fmtTime(a.at) + "</span></div>").join("") +
      "</div>";
    const dlJson = document.getElementById("dl-json");
    if (dlJson) dlJson.onclick = () => Store.exportJson();
    const dlCsv = document.getElementById("dl-csv");
    if (dlCsv) dlCsv.onclick = () => Store.exportCsvPack();
    const upJson = document.getElementById("up-json");
    if (upJson) upJson.onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      Store.importJson(JSON.parse(await f.text()));
      UI.toast("Data restored");
      this.renderSettings();
    };
    const ghForm = document.getElementById("gh-form");
    if (ghForm) ghForm.onsubmit = async (e) => {
      e.preventDefault();
      const repo = UI.val(e.target, "repo");
      const typed = UI.val(e.target, "token");
      const token = typed || ((Store.ghCreds() || {}).token || "");
      const parts = repo.split("/");
      if (!token || parts.length < 2) return UI.toast("Need owner/repo and a token");
      Store.setGhCreds(token, repo);
      try {
        await Store.saveToGitHub(token, parts[0], parts[1], "main");
        UI.toast("Saved to GitHub");
      } catch (err) { UI.toast(err.message); }
    };
    this.bindPinAdmin();
    this.bindSchoolSettings();
    this.afterRender();
    if (admin && this._pinScroll) {
      const go = this._pinScroll;
      this._pinScroll = "";
      this.scrollToPin(go);
    } else if (admin && this.params.id === "pins") {
      this.scrollToPin("family-pins");
    }
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
      u.updatedAt = new Date().toISOString();
      Store.rememberUser(u);
      Store.log("update", "user", u.id, u.name + (u.schoolId ? " · " + (Store.schoolById(u.schoolId) || {}).short : " · no school"));
      Store.save();
      UI.toast("Saved");
    };
    if (!Auth.isAdmin()) return;
    document.querySelectorAll("[data-school]").forEach((sel) => {
      sel.onchange = () => {
        const u = Store.allUsers().find((x) => x.id === sel.getAttribute("data-school"));
        if (!u) return;
        u.schoolId = sel.value;
        u.hasSchoolChildren = !!sel.value;
        u.updatedAt = new Date().toISOString();
        Store.rememberUser(u);
        Store.save();
        UI.toast("Saved");
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

  houseCodeNote() {
    return '<div class="card" style="margin-top:16px"><h3>House code</h3>' +
      '<p class="muted">Family use this on <b>Create your PIN</b>. It is not shown on the login screen.</p>' +
      "<p>Verify code: <b>302011</b></p></div>";
  },

  pinPersonRow(u, me, opts) {
    const pin = /^\d{4}$/.test(u.pinDisplay || "") ? u.pinDisplay : "PIN not saved — remove and add again";
    const branch = Store.familyBranch(u);
    const hideFamily = opts && opts.hideFamily;
    return "<div class='row pin-admin-row' id='pin-row-" + UI.esc(u.id) + "'><div><b>" + UI.esc(u.name) + "</b>" +
      '<div class="pin-plain">' + UI.esc(pin) + "</div>" +
      "<div class='muted'>" + UI.esc(u.role) + "</div>" +
      (hideFamily ? "" : "<label class='field' style='margin:8px 0 0'><span>Family</span><select data-branch='" + u.id + "'>" +
      this.familyOptions(branch) + "</select></label>") +
      (hideFamily ? "" : "<label class='field' style='margin:8px 0 0'><span>School children</span><select data-school='" + u.id + "'>" +
      this.schoolOptions(u.schoolId || "") + "</select></label>") +
      "</div>" +
      "<span class='actions'>" +
      (u.id !== me.id ? "<button class='btn primary' type='button' data-openas='" + u.id + "'>Open as them</button>" : "") +
      (u.id !== me.id ? "<button class='text-btn' type='button' data-delu='" + u.id + "'>Remove</button>" : "") +
      "</span></div>";
  },

  scrollToPin(target) {
    if (!target) return;
    const el = document.getElementById(target);
    if (el) setTimeout(() => el.scrollIntoView({ block: "start", behavior: "smooth" }), 40);
  },

  pinAdmin() {
    const me = Auth.user();
    const people = Store.allUsers().slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    const admins = people.filter((u) => u.role === "admin");
    const familyPeople = people.filter((u) => u.role !== "admin");
    const jump = '<div class="pin-jump"><span class="muted">Jump to</span>' +
      Store.familyBranches().map((branch) => '<button class="btn" type="button" data-jump="' + UI.esc(branch) + '">' + UI.esc(branch) + "</button>").join("") +
      "</div>";
    const groups = Store.familyBranches().map((branch) => {
      const members = familyPeople.filter((u) => Store.familyBranch(u) === branch);
      return '<section class="pin-family-block" id="pin-family-' + UI.esc(branch) + '"><h3 class="pin-family-head">' + UI.esc(branch) + "</h3>" +
        (members.length ? members.map((u) => this.pinPersonRow(u, me)).join("") : "<p class='muted'>Nobody in this family yet.</p>") +
        "</section>";
    }).join("");
    const other = familyPeople.filter((u) => !Store.familyBranch(u));
    return '<div class="card pin-admin-card" id="family-pins">' +
      '<h2 class="pin-admin-title">Family PINs</h2>' +
      '<p class="pin-admin-sub">Everyone’s name and 4-digit PIN</p>' +
      '<p class="muted">Tap a family name to jump to that list. House Admin stays at the top — it is not part of News or Khanna.</p>' +
      (admins.length ? '<h3 class="pin-family-head">House admin</h3>' + admins.map((u) => this.pinPersonRow(u, me, { hideFamily: true })).join("") : "") +
      jump +
      groups +
      (other.length ? '<section class="pin-family-block"><h3 class="pin-family-head">Other</h3>' + other.map((u) => this.pinPersonRow(u, me)).join("") + "</section>" : "") +
      '<div class="pin-add-box"><h3 class="pin-family-head">Add a person</h3>' +
      '<form id="pin-form"><div class="field-row"><input name="name" placeholder="Name" required><select name="role"><option value="family">Family</option><option value="guest">Guest</option><option value="admin">Admin</option></select></div>' +
      '<label class="field"><span>Which part of the family?</span><select name="familyBranch" required>' + this.familyOptions("") + "</select></label>" +
      '<label class="field"><span>New 4-digit PIN</span><input name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required></label><button class="btn primary">Add person</button></form></div></div>';
  },

  bindPinAdmin() {
    if (!Auth.isAdmin()) return;
    const f = document.getElementById("pin-form");
    if (f) f.onsubmit = async (e) => {
      e.preventDefault();
      const pin = UI.val(f, "pin").replace(/\D/g, "");
      const name = UI.val(f, "name").trim();
      const familyBranch = UI.val(f, "familyBranch");
      if (!name) return UI.toast("Please enter a name");
      if (Store.familyBranches().indexOf(familyBranch) < 0) return UI.toast("Please choose which part of the family.");
      if (!/^\d{4}$/.test(pin)) return UI.toast("PIN must be 4 digits");
      if (this.nameTaken(name, "")) return UI.toast("That name is already registered.");
      const salt = CryptoUtil.randomSalt();
      const person = { id: CryptoUtil.uid("u"), name: name, familyBranch, role: UI.val(f, "role"), pinSalt: salt, pinHash: await CryptoUtil.hashPin(pin, salt), pinDisplay: pin, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: Auth.user().id };
      Store.rememberUser(person);
      Store.addOwner(person);
      Store.log("create", "user", person.id, name);
      Store.save();
      await Store.pushRemote();
      UI.toast("Person added");
      this._pinScroll = "pin-family-" + familyBranch;
      this.renderSettings();
    };
    document.querySelectorAll("[data-jump]").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        this.scrollToPin("pin-family-" + btn.getAttribute("data-jump"));
      };
    });
    document.querySelectorAll("[data-branch]").forEach((sel) => {
      sel.onchange = () => {
        const u = Store.allUsers().find((x) => x.id === sel.getAttribute("data-branch"));
        if (!u) return;
        u.familyBranch = sel.value;
        u.updatedAt = new Date().toISOString();
        Store.rememberUser(u);
        Store.save();
        this._pinScroll = sel.value ? "pin-family-" + sel.value : "family-pins";
        this.renderSettings();
      };
    });
    document.querySelectorAll("[data-openas]").forEach((b) => {
      b.onclick = () => this.openAsUser(b.getAttribute("data-openas"));
    });
    document.querySelectorAll("[data-delu]").forEach((b) => b.onclick = () => {
      if (!UI.confirm("Remove this person?")) return;
      const id = b.getAttribute("data-delu");
      Store.removedIds = (Store.removedIds || []).concat([id]);
      Store.data.users = Store.allUsers().filter((u) => u.id !== id);
      Store.data.owners = (Store.data.owners || []).filter((o) => o.id !== id);
      Store.persistUsers();
      Store.persistRemovedIds();
      Store.save();
      Store.pushRemote().catch(() => {});
      this.renderSettings();
    });
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
