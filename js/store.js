const Store = {
  key: "tfh-draft-v3",
  usersKey: "tfh-users",
  removedKey: "tfh-removed",
  ghKey: "tfh-gh",
  legacyDraftKeys: ["tfh-draft-v3", "tfh-draft-v2", "tfh-draft-v1", "tfh-pending"],
  data: null,
  dirty: false,
  source: "repo",
  _remoteUsers: [],
  removedIds: [],

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

  readJson(storage, key) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  },

  usersFrom(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.users)) return raw.users;
    return [];
  },

  readLocalUsers() {
    return this.usersFrom(this.readJson(localStorage, this.usersKey));
  },

  readDraft() {
    return this.readJson(localStorage, this.key) || this.readJson(sessionStorage, this.key);
  },

  readDraftUsers() {
    const out = [];
    (this.legacyDraftKeys || [this.key]).forEach((key) => {
      const local = this.readJson(localStorage, key);
      const session = this.readJson(sessionStorage, key);
      if (local && local.users) out.push.apply(out, local.users);
      if (session && session.users) out.push.apply(out, session.users);
    });
    return out;
  },

  readSavedRemovedIds() {
    const raw = this.readJson(localStorage, this.removedKey);
    return Array.isArray(raw) ? raw : [];
  },

  persistRemovedIds() {
    try {
      localStorage.setItem(this.removedKey, JSON.stringify(this.removedIds || []));
    } catch (_) { /* private mode / quota */ }
  },

  collectLocalUsers() {
    return this.mergeUsers(this.readLocalUsers(), this.readDraftUsers());
  },

  personNameKey(p) {
    if (!p) return "";
    if (p.firstName || p.lastName) {
      return (String(p.firstName || "") + " " + String(p.lastName || "")).trim().toLowerCase().replace(/\s+/g, " ");
    }
    return String(p.name || "").trim().toLowerCase().replace(/\s+/g, " ");
  },

  familyBranches() {
    return ["Dossetters", "News", "Searles", "Jones", "Khanna"];
  },

  familyBranch(user) {
    if (!user) return "";
    if (user.role === "admin") return "";
    const listed = this.familyBranches();
    if (user.familyBranch && listed.indexOf(user.familyBranch) >= 0) return user.familyBranch;
    const hay = ((user.lastName || "") + " " + (user.name || "")).toLowerCase();
    if (/\bnews\b/.test(hay)) return "News";
    if (/\bdossetters?\b/.test(hay)) return "Dossetters";
    if (/\bsearles?\b/.test(hay)) return "Searles";
    if (/\bjones\b/.test(hay)) return "Jones";
    if (/\bkhannas?\b/.test(hay)) return "Khanna";
    return "";
  },

  stayFamily(booking) {
    if (!booking) return "";
    if (booking.familyBranch && this.familyBranches().indexOf(booking.familyBranch) >= 0) return booking.familyBranch;
    const people = this.allUsers();
    const by = people.find((u) => u.id === booking.createdBy);
    const fromBy = this.familyBranch(by);
    if (fromBy) return fromBy;
    const guests = String(booking.guests || "").toLowerCase();
    if (!guests) return "";
    for (let i = 0; i < people.length; i++) {
      const name = String(people[i].name || "").toLowerCase();
      if (name && guests.indexOf(name) >= 0) {
        const branch = this.familyBranch(people[i]);
        if (branch) return branch;
      }
    }
    return "";
  },

  preferUser(a, b) {
    if (!a) return b;
    if (!b) return a;
    const aPin = /^\d{4}$/.test(a.pinDisplay || "");
    const bPin = /^\d{4}$/.test(b.pinDisplay || "");
    const aTime = Date.parse(a.updatedAt || a.createdAt || 0) || 0;
    const bTime = Date.parse(b.updatedAt || b.createdAt || 0) || 0;
    const newer = bTime >= aTime ? Object.assign({}, a, b) : Object.assign({}, b, a);
    if (aPin && !bPin) newer.pinDisplay = a.pinDisplay;
    if (bPin) newer.pinDisplay = b.pinDisplay;
    if (a.pinHash && !newer.pinHash) {
      newer.pinHash = a.pinHash;
      newer.pinSalt = a.pinSalt;
    }
    if (b.pinHash && !a.pinHash) {
      newer.pinHash = b.pinHash;
      newer.pinSalt = b.pinSalt;
    }
    if (!newer.familyBranch) newer.familyBranch = a.familyBranch || b.familyBranch || "";
    return newer;
  },

  olderUser(a, b) {
    const at = Date.parse(a.createdAt || 0) || Number.MAX_SAFE_INTEGER;
    const bt = Date.parse(b.createdAt || 0) || Number.MAX_SAFE_INTEGER;
    return at <= bt ? a : b;
  },

  mergeUsers() {
    const byId = {};
    const lists = Array.prototype.slice.call(arguments);
    lists.forEach((list) => {
      (list || []).forEach((u) => {
        if (!u || !u.id) return;
        if (u.id !== "u-admin" && (this.removedIds || []).indexOf(u.id) >= 0) return;
        byId[u.id] = this.preferUser(byId[u.id], u);
      });
    });
    const byName = {};
    Object.keys(byId).forEach((id) => {
      const u = byId[id];
      const key = this.personNameKey(u);
      if (!key) return;
      if (!byName[key]) {
        byName[key] = u;
        return;
      }
      const kept = this.olderUser(byName[key], u);
      const drop = kept.id === u.id ? byName[key] : u;
      const merged = this.preferUser(kept, drop);
      merged.id = kept.id;
      merged.createdAt = kept.createdAt || drop.createdAt;
      delete byId[drop.id];
      byId[kept.id] = merged;
      byName[key] = merged;
    });
    return Object.keys(byId).map((id) => byId[id]);
  },

  allUsers() {
    return this.mergeUsers(
      this.data && this.data.users,
      this.collectLocalUsers(),
      this._remoteUsers
    );
  },

  persistUsers() {
    if (!this.data) this.data = this.empty();
    const merged = this.mergeUsers(this.data.users, this.collectLocalUsers());
    this.data.users = merged;
    try {
      localStorage.setItem(this.usersKey, JSON.stringify(merged));
    } catch (_) { /* private mode / quota */ }
    this.persistRemovedIds();
    return merged;
  },

  rememberUser(person) {
    if (!person || !person.id) return;
    if (!this.data) this.data = this.empty();
    this.data.users = this.mergeUsers(this.data.users, [person], this.collectLocalUsers());
    this.persistUsers();
  },

  applyFamilySlice(slice, opts) {
    if (!slice || typeof slice !== "object") return;
    const keys = ["bookings", "reviews", "places", "expenses", "maintenance", "comments", "owners", "contacts", "ideas", "checklistRecords", "schoolHolidays"];
    keys.forEach((key) => {
      if (!slice[key]) return;
      this.data[key] = FamilySync.mergeById(this.data[key] || [], slice[key]);
    });
    if (slice.settings) {
      const salt = this.data.settings && this.data.settings.houseCodeSalt;
      const hash = this.data.settings && this.data.settings.houseCodeHash;
      this.data.settings = Object.assign({}, this.data.settings, slice.settings);
      if (salt) this.data.settings.houseCodeSalt = salt;
      if (hash) this.data.settings.houseCodeHash = hash;
    }
    const applyRemoved = !opts || opts.applyRemoved !== false;
    if (applyRemoved && Array.isArray(slice.removedIds) && slice.removedIds.length) {
      if ((slice.users || []).length || opts.forceRemoved) {
        this.removedIds = (this.removedIds || []).concat(slice.removedIds);
      }
    }
  },

  writeLocalDraft() {
    try {
      const json = JSON.stringify(this.data);
      localStorage.setItem(this.key, json);
      sessionStorage.setItem(this.key, json);
    } catch (_) {
      try {
        const slim = FamilySync.stripPhotos(this.data);
        localStorage.setItem(this.key, JSON.stringify(slim));
      } catch (__) { /* quota */ }
    }
  },

  async load() {
    const keptUsers = this.collectLocalUsers();
    this.removedIds = this.readSavedRemovedIds();
    let repo = null;
    try {
      const res = await fetch("data/house.json", { cache: "no-store" });
      if (res.ok) repo = await res.json();
    } catch (_) { /* file:// or offline */ }
    if (!repo && window.HOUSE_DATA) repo = window.HOUSE_DATA;
    const repoUsers = (repo && repo.users) || [];
    this.data = Object.assign(this.empty(), repo || {});
    this.normalize();
    const repoHouse = {
      salt: (this.data.settings && this.data.settings.houseCodeSalt) || "",
      hash: (this.data.settings && this.data.settings.houseCodeHash) || ""
    };
    const draft = this.readDraft();
    if (draft && draft.version) {
      this.applyFamilySlice(draft, { applyRemoved: false });
      this.source = "local";
    }
    this._remoteUsers = [];
    let remote = null;
    if (window.FamilySync) {
      await FamilySync.init();
      remote = await FamilySync.pull();
      if (remote) {
        this._remoteUsers = remote.users || [];
        this.applyFamilySlice(remote, { applyRemoved: true });
      }
    }
    this.data.users = this.mergeUsers(
      repoUsers,
      keptUsers,
      draft && draft.users,
      this._remoteUsers,
      this.data.users
    );
    this.persistUsers();
    this.writeLocalDraft();
    this.dirty = false;
    this.normalize();
    if (repoHouse.hash) {
      this.data.settings = this.data.settings || {};
      this.data.settings.houseCodeSalt = repoHouse.salt;
      this.data.settings.houseCodeHash = repoHouse.hash;
    }
    if (remote || keptUsers.length || (this.data.users || []).length > 1) {
      this.pushRemote().catch(() => {});
    }
    // #region agent log
    fetch('http://127.0.0.1:7588/ingest/1d17a817-3fb2-4d95-8b0b-17bae48361e0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'36c946'},body:JSON.stringify({sessionId:'36c946',runId:'pre-fix',hypothesisId:'C',location:'store.js:load',message:'store load done',data:{keptUserCount:keptUsers.length,remoteOk:!!remote,remoteUserCount:(this._remoteUsers||[]).length,localUserCount:(this.data.users||[]).length,localBookingCount:(this.data.bookings||[]).length,willPush:!!(remote||keptUsers.length||(this.data.users||[]).length>1)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return this.data;
  },

  async findUserByPin(pin) {
    const clean = String(pin || "").replace(/\D/g, "");
    const users = this.allUsers();
    this.data.users = this.mergeUsers(this.data.users, users);
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      if (user.pinSalt && user.pinHash) {
        try {
          const hash = await CryptoUtil.hashPin(clean, user.pinSalt);
          if (hash === user.pinHash) {
            // #region agent log
            fetch('http://127.0.0.1:7588/ingest/1d17a817-3fb2-4d95-8b0b-17bae48361e0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'36c946'},body:JSON.stringify({sessionId:'36c946',runId:'pre-fix',hypothesisId:'F',location:'store.js:findUserByPin',message:'pin lookup',data:{userCount:users.length,pinLen:clean.length,found:true,via:'hash',role:user.role||''},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            return user;
          }
        } catch (_) { /* bad salt */ }
      }
    }
    for (let j = 0; j < users.length; j++) {
      if (users[j].pinDisplay === clean) return users[j];
    }
    // #region agent log
    fetch('http://127.0.0.1:7588/ingest/1d17a817-3fb2-4d95-8b0b-17bae48361e0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'36c946'},body:JSON.stringify({sessionId:'36c946',runId:'pre-fix',hypothesisId:'F',location:'store.js:findUserByPin',message:'pin lookup',data:{userCount:users.length,pinLen:clean.length,found:false,roles:(users||[]).map(function(u){return u.role||'';})},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return null;
  },

  async pullRemote() {
    if (!window.FamilySync) return;
    const remote = await FamilySync.pull();
    if (!remote) return;
    this._remoteUsers = remote.users || [];
    this.applyFamilySlice(remote, { applyRemoved: true });
    this.data.users = this.mergeUsers(this.data.users, this._remoteUsers, this.collectLocalUsers());
    this.persistUsers();
  },

  queueRemotePush() {
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => {
      this.pushRemote().catch(() => {});
    }, 250);
  },

  async pushRemote() {
    if (!window.FamilySync) return false;
    if (this._pushing) {
      this._pushAgain = true;
      return false;
    }
    this._pushing = true;
    try {
      const remote = await FamilySync.pull();
      if (remote) this._remoteUsers = remote.users || [];
      const local = FamilySync.familySlice(this.data);
      local.users = this.mergeUsers(local.users, this.collectLocalUsers(), this._remoteUsers);
      local.removedIds = this.removedIds || [];
      const merged = {
        users: this.mergeUsers(remote && remote.users, local.users),
        removedIds: (remote && remote.removedIds || []).concat(local.removedIds || []),
        bookings: FamilySync.mergeById(remote && remote.bookings, local.bookings),
        reviews: FamilySync.mergeById(remote && remote.reviews, local.reviews),
        places: FamilySync.mergeById(remote && remote.places, local.places),
        expenses: FamilySync.mergeById(remote && remote.expenses, local.expenses),
        maintenance: FamilySync.mergeById(remote && remote.maintenance, local.maintenance),
        comments: FamilySync.mergeById(remote && remote.comments, local.comments),
        owners: FamilySync.mergeById(remote && remote.owners, local.owners),
        settings: Object.assign({}, remote && remote.settings, local.settings)
      };
      const ok = await FamilySync.push(merged);
      // #region agent log
      fetch('http://127.0.0.1:7588/ingest/1d17a817-3fb2-4d95-8b0b-17bae48361e0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'36c946'},body:JSON.stringify({sessionId:'36c946',runId:'pre-fix',hypothesisId:'C',location:'store.js:pushRemote',message:'pushRemote finished',data:{ok:ok,localUserCount:(local.users||[]).length,localBookingCount:(local.bookings||[]).length,mergedUserCount:(merged.users||[]).length,mergedBookingCount:(merged.bookings||[]).length,remoteUserCount:(remote&&remote.users||[]).length,remoteBookingCount:(remote&&remote.bookings||[]).length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (ok) {
        this._remoteUsers = merged.users;
        this.data.users = this.mergeUsers(this.data.users, merged.users);
        this.persistUsers();
      }
      return ok;
    } catch (_) {
      return false;
    } finally {
      this._pushing = false;
      if (this._pushAgain) {
        this._pushAgain = false;
        this.pushRemote().catch(() => {});
      }
    }
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
    this.data.users = this.mergeUsers(this.data.users, this.collectLocalUsers());
    this.dirty = false;
    this.persistUsers();
    this.writeLocalDraft();
    if (window.App) App.syncSaveChip();
    this.queueRemotePush();
  },

  clearDraft() {
    this.dirty = false;
    this.source = "repo";
    this.persistUsers();
    this.writeLocalDraft();
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
    if (first && first.length >= 2 && guests.indexOf(first) >= 0) return true;
    return false;
  },

  nightsBetween(arrival, departure) {
    if (!arrival || !departure) return 0;
    const a = new Date(arrival + "T12:00:00");
    const b = new Date(departure + "T12:00:00");
    return Math.max(0, Math.round((b - a) / 86400000));
  },

  myUpcomingStays(user) {
    const t = UI.today();
    return (this.data.bookings || [])
      .filter((b) => b.status === "booked" && b.departure >= t && this.stayBelongsTo(b, user))
      .sort((a, b) => a.arrival.localeCompare(b.arrival));
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
