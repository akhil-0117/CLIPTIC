/* CLIPTIC — shared front-end helpers (safe to keep when the UI is swapped) */

async function api(path, opts = {}) {
  const res = await fetch("/api/web" + path, {
    credentials: "same-origin",
    ...opts,
    headers: { ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (res.status === 401) {
    const err = new Error((data && data.error) || "Not signed in");
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || "Request failed (" + res.status + ")");
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Better Auth endpoints (/api/auth/*) — separate from the /api/web wrapper. */
async function authFetch(path, body) {
  const res = await fetch("/api/auth" + path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error((data && (data.message || data.error)) || "Authentication failed");
    err.status = res.status;
    err.code = data && data.code;
    throw err;
  }
  return data;
}

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function money(n) {
  return "$" + (Number(n) || 0).toFixed(2);
}

function timeAgo(d) {
  if (!d) return "—";
  const then = new Date(String(d).replace(" ", "T") + (String(d).includes("Z") ? "" : "Z")).getTime();
  const s = Math.floor((Date.now() - then) / 1000);
  if (!isFinite(s) || s < 0) return "—";
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

function toast(message, type) {
  let host = document.getElementById("toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "toasts";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = "toast " + (type || "");
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 350);
  }, 3600);
}

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}
