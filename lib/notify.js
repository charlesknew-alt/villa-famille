window.Notify = {
  cfg: null,
  lastError: "",
  lastResult: null,

  async init() {
    // Always re-read config so key updates on the live site take effect after refresh.
    this.cfg = { publicKey: "", serviceId: "", templateId: "" };
    try {
      const res = await fetch("data/config.json?v=" + encodeURIComponent((window.TFH_VERSION || Date.now())), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const ej = data.emailjs || {};
        this.cfg.publicKey = String(ej.publicKey || data.emailjsPublicKey || "").trim();
        this.cfg.serviceId = String(ej.serviceId || data.emailjsServiceId || "").trim();
        this.cfg.templateId = String(ej.templateId || data.emailjsTemplateId || "").trim();
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
    if (window.emailjs && window.emailjs.send) {
      try { window.emailjs.init({ publicKey: this.cfg.publicKey }); } catch (_) { /* already init */ }
      return true;
    }
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

  templateParams(toEmail, toName, subject, message) {
    const name = toName || "Family";
    const email = String(toEmail || "").trim();
    return {
      to_email: email,
      to_name: name,
      subject: subject || "Family House",
      message: message || "",
      reply_to: email,
      // Aliases for leftover Contact Us template fields
      email: email,
      name: "Family House",
      from_name: "Family House",
      time: new Date().toLocaleString()
    };
  },

  async sendOne(toEmail, toName, subject, message) {
    try {
      const ok = await this.ensureSdk();
      if (!ok) {
        this.lastError = "Email sending is not set up yet (EmailJS keys missing in data/config.json).";
        return false;
      }
      if (!this.validEmail(toEmail)) {
        this.lastError = "Missing or invalid recipient email.";
        return false;
      }
      const params = this.templateParams(toEmail, toName, subject, message);
      await window.emailjs.send(this.cfg.serviceId, this.cfg.templateId, params, {
        publicKey: this.cfg.publicKey
      });
      this.lastError = "";
      return true;
    } catch (err) {
      const text = err && (err.text || err.message) ? (err.text || err.message) : String(err);
      this.lastError = text;
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
    this.lastResult = { sent: 0, skippedSelf: 0, targets: 0, error: "" };
    const immediate = this.subscribers("immediate");
    this.lastResult.targets = immediate.length;
    if (!immediate.length) {
      this.lastError = "No one has Booking emails set to Straight away yet.";
      this.lastResult.error = this.lastError;
      return 0;
    }
    let sent = 0;
    const bookerId = booking && booking.createdBy;
    for (let i = 0; i < immediate.length; i++) {
      const u = immediate[i];
      // Still email the booker a short confirmation so solo testing works.
      const isBooker = !!(u.id && bookerId && u.id === bookerId);
      if (isBooker) this.lastResult.skippedSelf += 1;
      const subject = isBooker
        ? "Family House · your stay is saved · " + UI.fmt(booking.arrival)
        : "Family House booking · " + UI.fmt(booking.arrival);
      const message = (isBooker
        ? "Your stay at The Family House was saved.\n\n"
        : "A stay was booked at The Family House.\n\n") +
        this.bookingSummary(booking) +
        "\n\nNew stays stay pending for 3 days, then become confirmed.\n" +
        "Open https://france.directestates.co.uk to see the calendar.";
      if (await this.sendOne(u.email, u.name || u.firstName || "Family", subject, message)) {
        sent += 1;
        u.emailLastNotifiedAt = new Date().toISOString();
        Store.rememberUser(u);
      }
    }
    this.lastResult.sent = sent;
    if (!sent && this.lastError) this.lastResult.error = this.lastError;
    else if (!sent) {
      this.lastError = "EmailJS did not send. Check the EmailJS dashboard logs and that To Email is {{to_email}}.";
      this.lastResult.error = this.lastError;
    }
    return sent;
  },

  async sendTest(toEmail, toName) {
    const subject = "Family House · test email";
    const message = "Hello " + (toName || "Family") + ",\n\n" +
      "This is a test from The Family House website. If you got this, booking alerts can send.\n\n" +
      "Open https://france.directestates.co.uk";
    const ok = await this.sendOne(toEmail, toName || "Family", subject, message);
    this.lastResult = { sent: ok ? 1 : 0, test: true, error: ok ? "" : this.lastError };
    return ok;
  },

  statusLine() {
    if (!this.cfg) return "Email helper not loaded yet.";
    if (!this.configured()) return "EmailJS keys are missing.";
    if (this.lastError) return "Last email error: " + this.lastError;
    if (this.lastResult && this.lastResult.test && this.lastResult.sent) return "Test email sent.";
    if (this.lastResult && typeof this.lastResult.sent === "number") {
      return "Last booking emails sent: " + this.lastResult.sent +
        (this.lastResult.targets != null ? " of " + this.lastResult.targets : "") + ".";
    }
    return "EmailJS is configured.";
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
