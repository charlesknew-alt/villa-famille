// Must be on window: a top-level const is NOT window.FamilySync, and Store
// used to skip all cloud pull/push when that check failed (phones saw nothing).
window.FamilySync = {
  blobId: "019ff15c-4188-76c2-b7ee-8fb7c20316e8",
  endpoint: "https://jsonblob.com/api/jsonBlob/",
  keys: ["users", "removedIds", "bookings", "reviews", "places", "expenses", "maintenance", "comments", "owners", "settings"],
  lastError: "",

  async init() {
    try {
      const res = await fetch("data/config.json", { cache: "no-store" });
      if (res.ok) {
        const cfg = await res.json();
        if (cfg.jsonBlobId) this.blobId = cfg.jsonBlobId;
        if (cfg.jsonBlobUrl && /^https:\/\/jsonblob\.com\/api\/jsonBlob\//.test(cfg.jsonBlobUrl)) {
          this.endpoint = "https://jsonblob.com/api/jsonBlob/";
          this.blobId = cfg.jsonBlobId || cfg.jsonBlobUrl.replace(/^.*\//, "");
        }
      }
    } catch (_) { /* offline */ }
  },

  url() {
    return this.endpoint + this.blobId;
  },

  // Content-Type only on PUT: JSONBlob's CORS allow-list omits Accept, and
  // some mobile browsers (Safari) preflight-fail when Accept is also set.
  putHeaders() {
    return { "Content-Type": "application/json" };
  },

  async pull() {
    if (!this.blobId) return null;
    try {
      // GET with no custom headers so it stays a simple request (no CORS preflight).
      const res = await fetch(this.url(), {
        method: "GET",
        cache: "no-store",
        mode: "cors",
        credentials: "omit"
      });
      if (!res.ok) {
        this.lastError = "pull HTTP " + res.status;
        return null;
      }
      const data = await res.json();
      this.lastError = "";
      return data && typeof data === "object" ? data : null;
    } catch (err) {
      this.lastError = "pull " + String(err && err.message ? err.message : err);
      return null;
    }
  },

  async push(payload) {
    if (!this.blobId) return false;
    let body;
    try {
      body = JSON.stringify(this.sanitize(payload));
    } catch (err) {
      this.lastError = "stringify " + String(err && err.message ? err.message : err);
      return false;
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(this.url(), {
          method: "PUT",
          headers: this.putHeaders(),
          body,
          cache: "no-store",
          mode: "cors",
          credentials: "omit"
        });
        if (res && res.ok) {
          this.lastError = "";
          return true;
        }
        this.lastError = "push HTTP " + (res ? res.status : "no response");
      } catch (err) {
        this.lastError = "push " + String(err && err.message ? err.message : err);
      }
      await this.sleep(350 * (attempt + 1));
    }
    return false;
  },

  sanitize(payload) {
    const src = payload && typeof payload === "object" ? payload : {};
    return {
      users: this.usersForBlob(src.users),
      removedIds: Array.isArray(src.removedIds) ? src.removedIds.filter(Boolean) : [],
      bookings: this.stripPhotos(src.bookings || []),
      reviews: this.stripPhotos(src.reviews || []),
      places: this.stripPhotos(src.places || []),
      expenses: this.stripPhotos(src.expenses || []),
      maintenance: this.stripPhotos(src.maintenance || []),
      comments: this.stripPhotos(src.comments || []),
      owners: this.stripPhotos(src.owners || []),
      settings: {
        updatedAt: (src.settings && src.settings.updatedAt) || "",
        schoolHolidayNote: (src.settings && src.settings.schoolHolidayNote) || ""
      }
    };
  },

  usersForBlob(list) {
    return (list || []).filter((u) => u && u.id).map((u) => {
      const out = {
        id: u.id,
        name: u.name || "",
        firstName: u.firstName || "",
        lastName: u.lastName || "",
        familyBranch: u.familyBranch || "",
        role: u.role || "family",
        pinSalt: u.pinSalt || "",
        pinHash: u.pinHash || "",
        pinDisplay: u.pinDisplay || "",
        createdAt: u.createdAt || "",
        updatedAt: u.updatedAt || "",
        createdBy: u.createdBy || ""
      };
      if (u.hasSchoolChildren) out.hasSchoolChildren = true;
      if (u.schoolId) out.schoolId = u.schoolId;
      return out;
    });
  },

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  stamp(item) {
    if (!item) return 0;
    return Date.parse(item.updatedAt || item.createdAt || item.cancelledAt || 0) || 0;
  },

  mergeById(a, b) {
    const map = {};
    (a || []).concat(b || []).forEach((item) => {
      if (!item || !item.id) return;
      const cur = map[item.id];
      if (!cur || this.stamp(item) >= this.stamp(cur)) map[item.id] = Object.assign({}, cur || {}, item);
    });
    return Object.keys(map).map((id) => map[id]);
  },

  stripPhotos(value) {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map((item) => this.stripPhotos(item));
    const out = {};
    Object.keys(value).forEach((key) => {
      if (key === "photos" || key === "receipts") out[key] = [];
      else if (key === "photo" || key === "image" || key === "dataUrl") return;
      else out[key] = this.stripPhotos(value[key]);
    });
    return out;
  },

  familySlice(data) {
    const src = data || {};
    const out = { removedIds: src.removedIds || [] };
    this.keys.forEach((key) => {
      if (key === "removedIds") return;
      if (key === "settings") {
        out.settings = {
          updatedAt: (src.settings && src.settings.updatedAt) || "",
          schoolHolidayNote: (src.settings && src.settings.schoolHolidayNote) || ""
        };
        return;
      }
      if (key === "users") {
        out.users = this.usersForBlob(src.users || []);
        return;
      }
      out[key] = this.stripPhotos(src[key] || []);
    });
    return out;
  }
};

var FamilySync = window.FamilySync;
