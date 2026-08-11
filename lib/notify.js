window.Notify = {
  cfg: null,
  lastError: "",

  async init() {
    if (this.cfg) return this.cfg;
    this.cfg = { publicKey: "", serviceId: "", templateId: "" };
    try {
      const res = await fetch("data/config.json", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const ej = data.emailjs || {};
        this.cfg.publicKey = ej.publicKey || data.emailjsPublicKey || "";
        this.cfg.serviceId = ej.serviceId || data.emailjsServiceId || "";
        this.cfg.templateId = ej.templateId || data.emailjsTemplateId || "";
      }
    } catch (_) { /* offline */ }
    return this.cfg;
  },

  configured() {
    const c = this.cfg || {};
    return !!(c.publicKey && c.serviceId && c.templateId);
  },

  async ensureSdk() {
    await this.init();
    if (!this.configured()) return false;
    if (window.emailjs && window.emailjs.send) return true;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Could not load email helper"));
      document.head.appendChild(s);
    });
    window.emailjs.init({ publicKey: this.cfg.publicKey });
    return true;
  },

  validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  },

  intervalMs(pref) {
    if (pref === "every3days") return 3 * 86400000;
    if (pref === "weekly") return 7 * 86400000;
    return 0;
  },

  bookingSummary(booking) {
    if (!booking) return "";
    const who = booking.guests || Store.userName(booking.createdBy) || "Family";
    const status = booking.status === "pending" ? "pending (confirms in 3 days)" : (booking.status || "booked");
    return who + ": " + UI.fmt(booking.arrival) + " → " + UI.fmt(booking.departure) + " (" + status + ")";
  },

  queueEvent(booking) {
    if (!Store.data) return;
    Store.data.notifyEvents = Store.data.notifyEvents || [];
    const event = {
      id: CryptoUtil.uid("n"),
      bookingId: booking.id,
      kind: "booking",
      summary: this.bookingSummary(booking),
      createdAt: new Date().toISOString(),
      createdBy: Auth.user() ? Auth.user().id : ""
    };
    Store.data.notifyEvents.unshift(event);
    Store.data.notifyEvents = Store.data.notifyEvents.slice(0, 80);
    return event;
  },

  async sendOne(toEmail, toName, subject, message) {
    try {
      const ok = await this.ensureSdk();
      if (!ok) {
        this.lastError = "Email sending is not set up yet (add EmailJS keys in data/config.json).";
        return false;
      }
      await window.emailjs.send(this.cfg.serviceId, this.cfg.templateId, {
        to_email: toEmail,
        to_name: toName || "Family",
        subject: subject,
        message: message,
        reply_to: toEmail
      });
      this.lastError = "";
      return true;
    } catch (err) {
      this.lastError = String(err && err.message ? err.message : err);
      return false;
    }
  },

  subscribers(pref) {
    return Store.allUsers().filter((u) => {
      if (!u || !this.validEmail(u.email)) return false;
      const mode = u.emailNotify || "off";
      if (pref) return mode === pref;
      return mode && mode !== "off";
    });
  },

  async notifyBooking(booking) {
    this.queueEvent(booking);
    const immediate = this.subscribers("immediate");
    let sent = 0;
    for (let i = 0; i < immediate.length; i++) {
      const u = immediate[i];
      if (u.id && booking.createdBy && u.id === booking.createdBy) continue;
      const subject = "Family House booking · " + UI.fmt(booking.arrival);
      const message = "A stay was booked at The Family House.\n\n" +
        this.bookingSummary(booking) +
        "\n\nNew stays stay pending for 3 days, then become confirmed.\n" +
        "Open https://france.directestates.co.uk to see the calendar.";
      if (await this.sendOne(u.email, u.name || u.firstName || "Family", subject, message)) {
        sent += 1;
        u.emailLastNotifiedAt = new Date().toISOString();
        Store.rememberUser(u);
      }
    }
    return sent;
  },

  async flushDigests() {
    await this.init();
    const events = Store.data.notifyEvents || [];
    if (!events.length) return 0;
    let sent = 0;
    const modes = ["every3days", "weekly"];
    for (let m = 0; m < modes.length; m++) {
      const pref = modes[m];
      const wait = this.intervalMs(pref);
      const people = this.subscribers(pref);
      for (let i = 0; i < people.length; i++) {
        const u = people[i];
        const last = Date.parse(u.emailLastNotifiedAt || 0) || 0;
        if (last && Date.now() - last < wait) continue;
        const fresh = events.filter((ev) => {
          const at = Date.parse(ev.createdAt || 0) || 0;
          return at > last;
        });
        if (!fresh.length) continue;
        const subject = "Family House booking update";
        const message = "Recent booking news for The Family House:\n\n" +
          fresh.slice(0, 12).map((ev) => "• " + ev.summary).join("\n") +
          "\n\nOpen https://france.directestates.co.uk to see the calendar.\n" +
          "You can change how often you get these emails in Settings.";
        if (await this.sendOne(u.email, u.name || u.firstName || "Family", subject, message)) {
          sent += 1;
          u.emailLastNotifiedAt = new Date().toISOString();
          Store.rememberUser(u);
        }
      }
    }
    if (sent) {
      Store.persistUsers();
      Store.queueRemotePush();
    }
    return sent;
  }
};

var Notify = window.Notify;
