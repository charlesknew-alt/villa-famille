window.TFH_VERSION = "20260811p";
(function () {
  var key = "tfh-version";
  var flag = "tfh-reloaded";
  var next = window.TFH_VERSION;
  try {
    var seen = localStorage.getItem(key);
    if (seen === next) {
      sessionStorage.removeItem(flag);
      return;
    }
    localStorage.setItem(key, next);
    if (sessionStorage.getItem(flag) === next) return;
    sessionStorage.setItem(flag, next);
    location.reload();
  } catch (_) { /* private mode */ }
})();
