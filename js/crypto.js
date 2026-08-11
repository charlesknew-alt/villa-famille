const CryptoUtil = {
  async sha256Hex(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  },
  async hashPin(pin, salt) {
    return this.sha256Hex(salt + String(pin));
  },
  randomSalt() {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
  },
  uid(prefix) {
    if (crypto.randomUUID) return prefix + "-" + crypto.randomUUID();
    const a = new Uint8Array(8);
    crypto.getRandomValues(a);
    return prefix + "-" + [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
};
