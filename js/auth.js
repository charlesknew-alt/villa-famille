const Auth = {
  sessionKey: "tfh-user",
  lockKey: "tfh-lock",
  current: null,

  user() { return this.current; },
  isAdmin() { return this.current && this.current.role === "admin"; },
  isGuest() { return this.current && this.current.role === "guest"; },
  canEdit() { return this.current && this.current.role !== "guest"; },

  restore() {
    const id = localStorage.getItem(this.sessionKey);
    if (!id) return null;
    this.current = (Store.data.users || []).find((u) => u.id === id) || null;
    return this.current;
  },

  setSession(user) {
    this.current = user;
    localStorage.setItem(this.sessionKey, user.id);
    this.recordOk();
    return user;
  },

  logout() {
    this.current = null;
    localStorage.removeItem(this.sessionKey);
  },

  lockState() {
    try { return JSON.parse(sessionStorage.getItem(this.lockKey) || "{}"); }
    catch (_) { return {}; }
  },

  setLock(state) {
    sessionStorage.setItem(this.lockKey, JSON.stringify(state));
  },

  lockedUntil() {
    const s = this.lockState();
    return s.until && Date.now() < s.until ? s.until : 0;
  },

  recordFail() {
    const s = this.lockState();
    const fails = (s.fails || 0) + 1;
    let wait = 0;
    if (fails >= 12) wait = 5 * 60 * 1000;
    else if (fails >= 8) wait = 2 * 60 * 1000;
    else if (fails >= 5) wait = 30 * 1000;
    const until = wait ? Date.now() + wait : 0;
    this.setLock({ fails, until });
    return { fails, until };
  },

  recordOk() {
    this.setLock({ fails: 0, until: 0 });
  },

  async login(pin) {
    const until = this.lockedUntil();
    if (until) return { ok: false, locked: until };
    const clean = String(pin || "").replace(/\D/g, "");
    if (clean.length !== 4) return { ok: false, error: "PIN is 4 digits." };
    for (const user of Store.data.users || []) {
      const hash = await CryptoUtil.hashPin(clean, user.pinSalt);
      if (hash === user.pinHash) {
        this.setSession(user);
        Store.log("login", "user", user.id, user.name + " signed in");
        Store.save();
        return { ok: true, user };
      }
    }
    const fail = this.recordFail();
    return { ok: false, error: "That PIN is not recognised.", fails: fail.fails, locked: fail.until };
  }
};
