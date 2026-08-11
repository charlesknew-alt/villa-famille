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
      if (!res.ok) {
        // #region agent log
        fetch('http://127.0.0.1:7588/ingest/1d17a817-3fb2-4d95-8b0b-17bae48361e0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'36c946'},body:JSON.stringify({sessionId:'36c946',runId:'pre-fix',hypothesisId:'D',location:'sync.js:pull',message:'blob pull failed',data:{ok:false,status:res.status,blobId:this.blobId},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return null;
      }
      const data = await res.json();
      // #region agent log
      fetch('http://127.0.0.1:7588/ingest/1d17a817-3fb2-4d95-8b0b-17bae48361e0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'36c946'},body:JSON.stringify({sessionId:'36c946',runId:'pre-fix',hypothesisId:'D',location:'sync.js:pull',message:'blob pull ok',data:{ok:true,status:res.status,userCount:(data&&data.users||[]).length,bookingCount:(data&&data.bookings||[]).length,hasUsers:!!(data&&data.users&&data.users.length),hasBookings:!!(data&&data.bookings&&data.bookings.length)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return data && typeof data === "object" ? data : null;
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7588/ingest/1d17a817-3fb2-4d95-8b0b-17bae48361e0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'36c946'},body:JSON.stringify({sessionId:'36c946',runId:'pre-fix',hypothesisId:'A',location:'sync.js:pull',message:'blob pull exception',data:{err:String(err&&err.message||err)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return null;
    }
  },

  async push(payload) {
    if (!this.blobId) return false;
    try {
      const body = JSON.stringify(payload);
      const res = await fetch(this.url(), { method: "PUT", headers: this.headers(), body, cache: "no-store", mode: "cors" });
      // #region agent log
      fetch('http://127.0.0.1:7588/ingest/1d17a817-3fb2-4d95-8b0b-17bae48361e0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'36c946'},body:JSON.stringify({sessionId:'36c946',runId:'pre-fix',hypothesisId:'B',location:'sync.js:push',message:'blob push result',data:{ok:!!(res&&res.ok),status:res&&res.status,bytes:body.length,userCount:(payload&&payload.users||[]).length,bookingCount:(payload&&payload.bookings||[]).length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return !!(res && res.ok);
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7588/ingest/1d17a817-3fb2-4d95-8b0b-17bae48361e0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'36c946'},body:JSON.stringify({sessionId:'36c946',runId:'pre-fix',hypothesisId:'A',location:'sync.js:push',message:'blob push exception',data:{err:String(err&&err.message||err)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
