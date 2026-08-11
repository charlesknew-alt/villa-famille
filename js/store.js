const Store = {
  key: "tfh-draft-v3",
  ghKey: "tfh-gh",
  data: null,
  dirty: false,
  source: "repo",

  empty() {
    return {
      version: 1,
      house: { name: "The Family House", place: "La Croix-Valmer", region: "Var", lat: 43.2072, lon: 6.5694 },
      users: [], pendingUsers: [], owners: [], bookings: [], documents: [], restaurants: [], places: [], reviews: [], contacts: [],
      maintenance: [], comments: [], recurring: [], expenses: [], inventory: [],
      checklistItems: [], checklistRecords: [], mapSpots: [], systems: {},
      ideas: [], announcements: [], activity: [], settings: {},
      schools: [], schoolHolidays: [], schoolHolidayNote: ""
    };
  },

  async load() {
    let repo = null;
    try {
      const res = await fetch("data/house.json", { cache: "no-store" });
      if (res.ok) repo = await res.json();
    } catch (_) { /* file:// or offline */ }
    if (!repo && window.HOUSE_DATA) repo = window.HOUSE_DATA;
    this.data = Object.assign(this.empty(), repo || {});
    this.normalize();
    const repoHouse = {
      salt: (this.data.settings && this.data.settings.houseCodeSalt) || "",
      hash: (this.data.settings && this.data.settings.houseCodeHash) || ""
    };
    try {
      localStorage.removeItem("tfh-pending");
      sessionStorage.removeItem("tfh-draft-v2");
    } catch (_) { /* private mode */ }
    const draft = sessionStorage.getItem(this.key);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed && parsed.version) {
          this.data = Object.assign(this.empty(), parsed);
          this.dirty = true;
          this.source = "draft";
        }
      } catch (_) { /* ignore bad draft */ }
    }
    this.normalize();
    if (repoHouse.hash) {
      this.data.settings = this.data.settings || {};
      this.data.settings.houseCodeSalt = repoHouse.salt;
      this.data.settings.houseCodeHash = repoHouse.hash;
    }
    return this.data;
  },

  async checkHouseCode(code) {
    const clean = String(code || "").replace(/\D/g, "");
    const salt = this.data && this.data.settings && this.data.settings.houseCodeSalt;
    const expected = this.data && this.data.settings && this.data.settings.houseCodeHash;
    if (!salt || !expected || !clean) return false;
    const hash = await CryptoUtil.hashPin(clean, salt);
    return hash === expected;
  },

  save() {
    this.data.pendingUsers = [];
    this.data.settings = this.data.settings || {};
    this.data.settings.updatedAt = new Date().toISOString();
    this.dirty = true;
    sessionStorage.setItem(this.key, JSON.stringify(this.data));
    if (window.App) App.syncSaveChip();
  },

  clearDraft() {
    sessionStorage.removeItem(this.key);
    this.dirty = false;
    this.source = "repo";
    if (window.App) App.syncSaveChip();
  },

  ghCreds() {
    try {
      const raw = localStorage.getItem(this.ghKey);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  },

  setGhCreds(token, repo) {
    try {
      if (token && repo) localStorage.setItem(this.ghKey, JSON.stringify({ token: String(token), repo: String(repo) }));
    } catch (_) { /* private mode */ }
  },

  async tryPushIfAuthed() {
    const creds = this.ghCreds();
    if (!creds || !creds.token || !creds.repo) return false;
    const parts = String(creds.repo).split("/");
    if (parts.length < 2) return false;
    try {
      await this.saveToGitHub(creds.token, parts[0], parts[1], "main");
      return true;
    } catch (_) { return false; }
  },

  log(action, entity, entityId, detail) {
    const user = Auth.user();
    this.data.activity = this.data.activity || [];
    this.data.activity.unshift({
      id: CryptoUtil.uid("act"),
      action, entity, entityId: entityId || "",
      userId: user ? user.id : "",
      at: new Date().toISOString(),
      detail: detail || ""
    });
    if (this.data.activity.length > 200) this.data.activity.length = 200;
  },

  normalize() {
    const d = this.data;
    d.users = d.users || [];
    d.users.forEach((u) => {
      if (u && u.id === "u-admin" && !/^\d{4}$/.test(u.pinDisplay || "")) u.pinDisplay = "1232";
    });
    d.pendingUsers = [];
    d.settings = d.settings || {};
    d.activity = d.activity || [];
    d.bookings = d.bookings || [];
    d.places = d.places || [];
    d.owners = d.owners || [];
    d.schools = d.schools || [];
    d.schoolHolidays = d.schoolHolidays || [];
    d.schoolHolidayNote = d.schoolHolidayNote || "Typical term dates for West Sussex / Surrey independents — admin can edit.";
    if (!d.schools.length) {
      d.schools = [
        { id: "seaford", name: "Seaford College, Sussex", short: "Seaford" },
        { id: "keswoking", name: "King Edward's School, Woking", short: "KE Woking" },
        { id: "greenfield", name: "Greenfield School, Woking", short: "Greenfield" },
        { id: "other", name: "Other school", short: "Other" }
      ];
    }
    d.reviews = d.reviews || [];
    if (!d.places.length && (d.restaurants || []).length) {
      d.places = d.restaurants.map((r) => Object.assign({ kind: "restaurant" }, r));
    }
    d.reviews.forEach((r) => {
      if (!r.placeId && r.restaurantId) r.placeId = r.restaurantId;
      if (!r.replies) r.replies = [];
      if (!r.photos) r.photos = [];
    });
    if (!d.owners.length) {
      d.owners = (d.users || []).filter((u) => u.role === "admin" || u.role === "family").map((u) => ({ id: u.id, name: u.name }));
    }
    (d.expenses || []).forEach((e) => {
      e.currency = e.currency || "GBP";
      e.type = e.type || "shared";
      e.description = e.description || e.notes || e.supplier || "Expense";
      e.paidBy = e.paidBy || e.createdBy || "";
      e.receipts = e.receipts || [];
      if (!e.splits) e.splits = [];
    });
  },

  userName(id) {
    const u = (this.data.users || []).find((x) => x.id === id);
    if (u) return u.name;
    const o = (this.data.owners || []).find((x) => x.id === id);
    return o ? o.name : "Someone";
  },

  ownerList() {
    return (this.data.owners || []).slice();
  },

  addOwner(user) {
    if (!user || !user.id) return;
    if (user.role === "guest") return;
    this.data.owners = this.data.owners || [];
    if (this.data.owners.some((o) => o.id === user.id)) return;
    this.data.owners.push({ id: user.id, name: user.name });
  },

  pound(n) {
    const v = Math.round(Number(n || 0) * 100) / 100;
    return "£" + v.toFixed(2);
  },

  equalSplits(paidBy, amount) {
    const owners = this.ownerList();
    const n = Math.max(1, owners.length);
    const share = Math.round((Number(amount) / n) * 100) / 100;
    let allocated = 0;
    return owners.map((o, i) => {
      const amt = i === owners.length - 1 ? Math.round((Number(amount) - allocated) * 100) / 100 : share;
      allocated += amt;
      return { userId: o.id, amount: amt, status: o.id === paidBy ? "settled" : "owed" };
    });
  },

  expenseOutstanding(e) {
    if (!e || e.type !== "shared") return 0;
    return (e.splits || []).filter((s) => s.status === "owed").reduce((n, s) => n + Number(s.amount || 0), 0);
  },

  moneySummary(list) {
    const rows = list || this.data.expenses || [];
    const year = String(new Date().getFullYear());
    const month = UI.today().slice(0, 7);
    const sum = (xs) => xs.reduce((n, e) => n + Number(e.amount || 0), 0);
    const byCat = {};
    rows.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0); });
    const owed = rows.filter((e) => e.type === "shared").reduce((n, e) => n + this.expenseOutstanding(e), 0);
    return {
      month: sum(rows.filter((e) => (e.date || "").startsWith(month))),
      year: sum(rows.filter((e) => (e.date || "").startsWith(year))),
      byCat,
      owed,
      recent: rows.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5),
      largest: rows.slice().sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0)).slice(0, 3)
    };
  },

  contactName(id) {
    const c = (this.data.contacts || []).find((x) => x.id === id);
    return c ? c.name + (c.business ? " · " + c.business : "") : "Unassigned";
  },

  overlaps(a, b) {
    if (a.id && b.id && a.id === b.id) return false;
    if (a.status === "cancelled" || b.status === "cancelled") return false;
    return a.arrival < b.departure && a.departure > b.arrival;
  },

  bookingConflict(candidate) {
    return (this.data.bookings || []).find((b) => this.overlaps(candidate, b));
  },

  prioritySchoolIds() {
    return ["seaford", "keswoking", "greenfield"];
  },

  schools() {
    return this.data.schools || [];
  },

  schoolById(id) {
    return this.schools().find((s) => s.id === id) || null;
  },

  isSchoolPriority(user) {
    if (!user || !user.hasSchoolChildren || !user.schoolId) return false;
    return this.prioritySchoolIds().indexOf(user.schoolId) >= 0;
  },

  prioritySchoolNames() {
    return this.schools()
      .filter((s) => this.prioritySchoolIds().indexOf(s.id) >= 0)
      .map((s) => s.short)
      .join(" / ");
  },

  holidayOn(iso) {
    if (!iso) return null;
    return (this.data.schoolHolidays || []).find((h) => h.start <= iso && iso <= h.end) || null;
  },

  holidaysOverlapping(arrival, departure) {
    if (!arrival || !departure) return [];
    return (this.data.schoolHolidays || []).filter((h) => arrival <= h.end && departure > h.start);
  },

  dayStatus(iso) {
    const list = (this.data.bookings || []).filter((b) => b.status !== "cancelled" && b.arrival <= iso && iso < b.departure);
    if (list.some((b) => b.status === "blocked")) return "blocked";
    if (list.some((b) => b.status === "booked")) return "booked";
    return "available";
  },

  staysOn(iso) {
    return (this.data.bookings || []).filter((b) => b.status === "booked" && b.arrival <= iso && iso < b.departure);
  },

  currentStays() {
    const t = UI.today();
    return this.staysOn(t);
  },

  upcomingBookings() {
    const t = UI.today();
    return (this.data.bookings || [])
      .filter((b) => b.status === "booked" && b.arrival >= t)
      .sort((a, b) => a.arrival.localeCompare(b.arrival));
  },

  monthName(n) {
    return ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"][Number(n) - 1] || "";
  },

  weekOfMonth(iso) {
    const day = Number(String(iso || "").slice(8, 10));
    if (!day) return 1;
    return Math.min(5, Math.ceil(day / 7));
  },

  weekLabel(week) {
    if (week <= 1) return "early";
    if (week >= 4) return "late";
    return "mid";
  },

  stayBelongsTo(booking, user) {
    if (!booking || !user) return false;
    if (booking.createdBy && booking.createdBy === user.id) return true;
    const guests = String(booking.guests || "").toLowerCase();
    if (!guests) return false;
    const name = String(user.name || "").toLowerCase().trim();
    const first = String(user.firstName || "").toLowerCase().trim();
    const last = String(user.lastName || "").toLowerCase().trim();
    if (name && guests.indexOf(name) >= 0) return true;
    if (first && last && guests.indexOf(first) >= 0 && guests.indexOf(last) >= 0) return true;
    return false;
  },

  pendingStayReview(user) {
    const t = UI.today();
    return (this.data.bookings || [])
      .filter((b) => b.status === "booked" && b.departure < t && !b.stayReview && this.stayBelongsTo(b, user))
      .sort((a, b) => a.departure.localeCompare(b.departure))[0] || null;
  },

  stayReviews() {
    return (this.data.bookings || []).map((b) => b.stayReview).filter(Boolean);
  },

  weeksInRange(arrival, departure) {
    const out = [];
    const seen = {};
    if (!arrival || !departure) return out;
    let d = arrival;
    let guard = 0;
    while (d < departure && guard < 400) {
      const month = Number(d.slice(5, 7));
      const week = this.weekOfMonth(d);
      const key = month + "-" + week;
      if (!seen[key]) {
        seen[key] = true;
        out.push({ month, week, key });
      }
      d = UI.addDays(d, 1);
      guard += 1;
    }
    return out;
  },

  busyReviewsFor(arrival, departure) {
    const slots = this.weeksInRange(arrival, departure);
    if (!slots.length) return [];
    return this.stayReviews().filter((r) => {
      if (r.busy !== "busy" && r.busy !== "packed") return false;
      const month = Number(r.month);
      const week = Number(r.weekOfMonth || 0);
      return slots.some((s) => s.month === month && (!week || s.week === week || Math.abs(s.week - week) <= 1));
    });
  },

  busyHint(arrival, departure) {
    const hits = this.busyReviewsFor(arrival, departure);
    if (!hits.length) return "";
    const years = [];
    const months = [];
    const weeks = [];
    hits.forEach((r) => {
      if (years.indexOf(r.year) < 0) years.push(r.year);
      if (months.indexOf(Number(r.month)) < 0) months.push(Number(r.month));
      if (r.weekOfMonth && weeks.indexOf(Number(r.weekOfMonth)) < 0) weeks.push(Number(r.weekOfMonth));
    });
    const generic = "This time of year is usually busy (from family reviews). Book restaurants and popular places ahead.";
    if (years.length < 2 || months.length !== 1) return generic;
    const month = this.monthName(months[0]);
    if (!month) return generic;
    let when = month;
    if (weeks.length === 1) when = this.weekLabel(weeks[0]) + "-" + month;
    else if (weeks.length && weeks.every((w) => w === 2 || w === 3)) when = "mid-" + month;
    return "Usually busy in " + when + ".";
  },

  busyHintForMonth(ym) {
    if (!ym) return "";
    const start = String(ym).slice(0, 7) + "-01";
    const d = new Date(start + "T12:00:00");
    d.setMonth(d.getMonth() + 1);
    return this.busyHint(start, d.toISOString().slice(0, 10));
  },

  openIssues() {
    return (this.data.maintenance || []).filter((m) => m.status !== "completed");
  },

  dueRecurring() {
    const t = UI.today();
    return (this.data.recurring || []).filter((r) => r.nextDue && r.nextDue <= t);
  },

  csvEscape(v) {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  },

  toCsv(rows, headers) {
    const lines = [headers.join(",")];
    rows.forEach((row) => {
      lines.push(headers.map((h) => this.csvEscape(row[h])).join(","));
    });
    return lines.join("\n");
  },

  download(filename, text, type) {
    const blob = new Blob([text], { type: type || "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },

  exportJson() {
    const data = JSON.parse(JSON.stringify(this.data));
    if (!Auth.isAdmin()) {
      (data.users || []).forEach((u) => { delete u.pinDisplay; });
    }
    this.download("house.json", JSON.stringify(data, null, 2), "application/json");
  },

  exportCsvPack() {
    const d = this.data;
    this.download("bookings.csv", this.toCsv(d.bookings, ["id", "arrival", "departure", "guestCount", "guests", "notes", "status", "createdBy"]), "text/csv");
    this.download("contacts.csv", this.toCsv(d.contacts, ["id", "name", "business", "category", "phone", "email", "notes", "lastUsed"]), "text/csv");
    this.download("maintenance.csv", this.toCsv(d.maintenance, ["id", "title", "category", "priority", "status", "reporter", "date", "assignedContractorId", "estimatedCompletion"]), "text/csv");
    this.download("expenses.csv", this.toCsv((d.expenses || []).map((e) => Object.assign({}, e, { paidBy: this.userName(e.paidBy), outstanding: this.expenseOutstanding(e) })), ["id", "description", "amount", "currency", "date", "category", "type", "paidBy", "notes", "outstanding"]), "text/csv");
    this.download("places.csv", this.toCsv(d.places || d.restaurants || [], ["id", "kind", "name", "town", "cuisine", "rating", "phone", "address", "notes"]), "text/csv");
    this.download("inventory.csv", this.toCsv(d.inventory, ["id", "name", "category", "location", "purchaseDate", "warrantyUntil", "notes"]), "text/csv");
  },

  importJson(obj) {
    if (!obj || typeof obj !== "object") throw new Error("Not a house file");
    this.data = Object.assign(this.empty(), obj.house && obj.users ? obj : (obj.data || obj));
    this.normalize();
    this.save();
  },

  async saveToGitHub(token, owner, repo, branch) {
    branch = branch || "main";
    const path = "data/house.json";
    const api = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path;
    const head = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" };
    let sha;
    const get = await fetch(api + "?ref=" + branch, { headers: head });
    if (get.ok) sha = (await get.json()).sha;
    const body = {
      message: "Update house data from The Family House",
      content: btoa(unescape(encodeURIComponent(JSON.stringify(this.data, null, 2)))),
      branch
    };
    if (sha) body.sha = sha;
    const put = await fetch(api, { method: "PUT", headers: head, body: JSON.stringify(body) });
    if (!put.ok) throw new Error("GitHub save failed (" + put.status + ")");
    this.clearDraft();
  }
};
