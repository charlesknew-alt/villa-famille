const UI = {
  themeKey: "tfh-theme",

  applyTheme(theme) {
    const next = theme || localStorage.getItem(this.themeKey) || "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(this.themeKey, next);
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.textContent = next === "dark" ? "☀" : "☾";
  },

  toggleTheme() {
    const now = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    this.applyTheme(now);
  },

  today() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  },

  addDays(iso, n) {
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  },

  fmt(iso) {
    if (!iso) return "";
    const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  },

  fmtTime(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  },

  esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  },

  toast(msg) {
    const root = document.getElementById("toast-root");
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  },

  closeModal() {
    document.getElementById("modal-root").innerHTML = "";
  },

  modal(title, bodyHtml, footerHtml) {
    const root = document.getElementById("modal-root");
    root.innerHTML = '<div class="modal-back" data-close="1"><div class="modal" role="dialog" aria-modal="true"><div class="page-head"><h2>' +
      this.esc(title) + '</h2><button type="button" class="text-btn" data-close="1">Close</button></div>' +
      bodyHtml + (footerHtml || "") + "</div></div>";
    root.querySelector(".modal-back").addEventListener("click", (e) => {
      if (e.target.getAttribute("data-close")) this.closeModal();
    });
    return root.querySelector(".modal");
  },

  confirm(msg) {
    return window.confirm(msg);
  },

  val(form, name) {
    const el = form.elements[name];
    return el ? String(el.value || "").trim() : "";
  },

  weatherLabel(code) {
    if (code == null) return "Weather";
    if (code === 0) return "Clear";
    if (code <= 3) return "Partly cloudy";
    if (code <= 48) return "Fog";
    if (code <= 67) return "Rain";
    if (code <= 77) return "Snow";
    if (code <= 82) return "Showers";
    return "Stormy";
  },

  async weather() {
    const h = Store.data.house || {};
    const lat = h.lat || 43.2072;
    const lon = h.lon || 6.5694;
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe%2FParis";
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  },

  mins(n) {
    const h = Math.floor(n / 60);
    const m = n % 60;
    if (!h) return m + "m";
    return m ? h + "h " + m + "m" : h + "h";
  },

  fileToData(file, maxMb) {
    return new Promise((resolve, reject) => {
      if (file.size > (maxMb || 4) * 1024 * 1024) {
        reject(new Error("Please keep files under " + (maxMb || 4) + " MB so they can live in the GitHub data file."));
        return;
      }
      const r = new FileReader();
      r.onload = () => resolve({ name: file.name, type: file.type, data: r.result });
      r.onerror = () => reject(new Error("Could not read file"));
      r.readAsDataURL(file);
    });
  }
};
