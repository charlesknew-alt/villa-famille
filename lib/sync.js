const FamilySync = {
  blobId: "019ff126-d7b1-7f39-ba13-ad2e9e811bc2",
  endpoint: "https://jsonblob.com/api/jsonBlob/",
  keys: ["users", "removedIds", "bookings", "reviews", "places", "expenses", "maintenance", "comments", "owners", "settings"],

  async init() {
    try {
      const res = await fetch("data/config.json", { cache: "no-store" });
      if (res.ok) {
        const cfg = await res.json();
        if (cfg.jsonBlobId) this.blobId = cfg.jsonBlobId;
      }
    } catch (_) { /* offline */ }
  },

  url() {
    return this.endpoint + this.blobId;
  },

  headers() {
    return { Accept: "application/json", "Content-Type": "application/json" };
  },

  async pull() {
    if (!this.blobId) return null;
    try {
      const res = await fetch(this.url(), { method: "GET", headers: this.headers(), cache: "no-store", mode: "cors" });
      if (!res.ok) return null;
      const data = await res.json();
      return data && typeof data === "object" ? data : null;
    } catch (_) {
      return null;
    }
  },

  async push(payload) {
    if (!this.blobId) return false;
    try {
      const body = JSON.stringify(payload);
      const res = await fetch(this.url(), { method: "PUT", headers: this.headers(), body, cache: "no-store", mode: "cors" });
      return !!(res && res.ok);
    } catch (_) {
      return false;
    }
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
      out[key] = this.stripPhotos(src[key] || (key === "users" ? [] : []));
    });
    return out;
  }
};
