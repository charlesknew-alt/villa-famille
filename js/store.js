const Store = {
  key: "tfh-draft",
  data: null,
  dirty: false,
  source: "repo",

  empty() {
    return {
      version: 1,
      house: { name: "The Family House", place: "La Croix-Valmer", region: "Var", lat: 43.2072, lon: 6.5694 },
      users: [], bookings: [], documents: [], restaurants: [], reviews: [], contacts: [],
      maintenance: [], comments: [], recurring: [], expenses: [], inventory: [],
      checklistItems: [], checklistRecords: [], mapSpots: [], systems: {},
      ideas: [], announcements: [], activity: [], settings: {}
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
    return this.data;
  },

  save() {
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

  log(action, entity, entityId, detail) {
    const user = Auth.user();
    this.data.activity.unshift({
      id: CryptoUtil.uid("act"),
      action, entity, entityId: entityId || "",
      userId: user ? user.id : "",
      at: new Date().toISOString(),
      detail: detail || ""
    });
    if (this.data.activity.length > 200) this.data.activity.length = 200;
  },

  userName(id) {
    const u = (this.data.users || []).find((x) => x.id === id);
    return u ? u.name : "Someone";
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
    this.download("house.json", JSON.stringify(this.data, null, 2), "application/json");
  },

  exportCsvPack() {
    const d = this.data;
    this.download("bookings.csv", this.toCsv(d.bookings, ["id", "arrival", "departure", "guestCount", "guests", "notes", "status", "createdBy"]), "text/csv");
    this.download("contacts.csv", this.toCsv(d.contacts, ["id", "name", "business", "category", "phone", "email", "notes", "lastUsed"]), "text/csv");
    this.download("maintenance.csv", this.toCsv(d.maintenance, ["id", "title", "category", "priority", "status", "reporter", "date", "assignedContractorId", "estimatedCompletion"]), "text/csv");
    this.download("expenses.csv", this.toCsv(d.expenses, ["id", "category", "amount", "currency", "date", "supplier", "notes", "issueId"]), "text/csv");
    this.download("restaurants.csv", this.toCsv(d.restaurants, ["id", "name", "town", "cuisine", "rating", "phone", "address", "notes"]), "text/csv");
    this.download("inventory.csv", this.toCsv(d.inventory, ["id", "name", "category", "location", "purchaseDate", "warrantyUntil", "notes"]), "text/csv");
  },

  importJson(obj) {
    if (!obj || typeof obj !== "object") throw new Error("Not a house file");
    this.data = Object.assign(this.empty(), obj.house && obj.users ? obj : (obj.data || obj));
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
