const Auth = {
  sessionKey: "tfh-user",
  lockKey: "tfh-lock",
  returnKey: "tfh-return-admin",
  current: null,

  user() { return this.current; },
  isAdmin() { return this.current && this.current.role === "admin"; },
  isGuest() { return this.current && this.current.role === "guest"; },
  canEdit() { return this.current && this.current.role !== "guest"; },

  restore() {
    const id = localStorage.getItem(this.sessionKey);
    if (!id) return null;
    const users = Store.allUsers();
    this.current = users.find((u) => u.id === id) || null;
    return this.current;
  },

  setSession(user) {
    this.current = user;
    localStorage.setItem(this.sessionKey, user.id);
    this.recordOk();
    return user;
  },

  impersonatingId() {
    try { return sessionStorage.getItem(this.returnKey) || ""; }
    catch (_) { return ""; }
  },

  isImpersonating() {
    return !!this.impersonatingId();
  },

  openAs(user) {
    if (!user || !user.id) return null;
    if (!this.isAdmin() && !this.isImpersonating()) return null;
    if (!this.impersonatingId() && this.current) {
      try { sessionStorage.setItem(this.returnKey, this.current.id); }
      catch (_) { /* private mode */ }
    }
    return this.setSession(user);
  },

  backToAdmin() {
    const id = this.impersonatingId();
    try { sessionStorage.removeItem(this.returnKey); }
    catch (_) { /* private mode */ }
    if (!id) return null;
    const users = Store.allUsers();
    const admin = users.find((u) => u.id === id) || users.find((u) => u.role === "admin");
    if (!admin) return null;
    return this.setSession(admin);
  },

  logout() {
    this.current = null;
    localStorage.removeItem(this.sessionKey);
    try { sessionStorage.removeItem(this.returnKey); }
    catch (_) { /* private mode */ }
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
    const user = await Store.findUserByPin(clean);
    if (user) {
      this.setSession(user);
      Store.rememberUser(user);
      Store.log("login", "user", user.id, user.name + " signed in");
      Store.save();
      Store.pushRemote().catch(() => {});
      return { ok: true, user };
    }
    const fail = this.recordFail();
    return { ok: false, error: "That PIN is not recognised.", fails: fail.fails, locked: fail.until };
  }
};
