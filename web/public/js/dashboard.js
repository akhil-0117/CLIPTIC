/* CLIPTIC dashboard — all data comes from /api/web/* (swap this file freely). */

let ME = null;
let CONFIG = { minPayout: 10, verification: { minFollowers: 0, minAvgViews: 0 } };
let CAMPAIGNS = [];
let POSTS = [];

const PAGES = ["overview", "campaigns", "posts", "connect", "earnings", "payouts", "notifications", "leaderboard"];
const PLATFORM_META = {
  tiktok: { name: "TikTok", icon: "fa-brands fa-tiktok", hint: "Short-form videos & reposts" },
  instagram: { name: "Instagram Reels", icon: "fa-brands fa-instagram", hint: "Reels & feed clips" },
  youtube: { name: "YouTube Shorts", icon: "fa-brands fa-youtube", hint: "Shorts under 60s" },
};

// ── Routing ───────────────────────────────────────────────────────

function go(page) {
  if (!PAGES.includes(page)) page = "overview";
  location.hash = "#" + page;
  showPage(page);
}

function showPage(page) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  const el = document.getElementById("page-" + page);
  if (el) el.classList.add("active");
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  document.getElementById("sidebar").classList.remove("open");
  loadPage(page);
}

async function loadPage(page) {
  try {
    if (page === "overview") renderOverview();
    else if (page === "campaigns") await loadCampaigns();
    else if (page === "posts") await loadPosts();
    else if (page === "connect") renderConnect();
    else if (page === "earnings") await loadEarnings();
    else if (page === "payouts") await loadPayouts();
    else if (page === "notifications") await loadNotifications();
    else if (page === "leaderboard") await loadLeaderboard();
  } catch (err) {
    if (err.status === 401) location.href = "/login?next=/dashboard";
  }
}

document.querySelectorAll("#nav button").forEach((b) => b.addEventListener("click", () => go(b.dataset.page)));

// ── Auth / boot ───────────────────────────────────────────────────

async function signOut() {
  try { await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin" }); } catch {}
  location.href = "/login";
}

async function refreshMe() {
  ME = await api("/me");
  document.getElementById("me-name").textContent = ME.name || "Clipper";
  document.getElementById("me-role").textContent = ME.role === "admin" ? "Administrator" : ME.verified ? "Verified clipper" : "Clipper";
  if (ME.role === "admin") document.getElementById("btn-admin").style.display = "inline-flex";

  const notif = document.getElementById("count-notif");
  notif.style.display = ME.unread > 0 ? "inline-block" : "none";
  notif.textContent = ME.unread || 0;

  return ME;
}

async function boot() {
  try {
    [CONFIG] = await Promise.all([api("/config").catch(() => ({ minPayout: 10, verification: {} }))]);
    await refreshMe();
  } catch (err) {
    if (err.status === 401) { location.href = "/login?next=/dashboard"; return; }
    toast("Could not load your profile — refresh the page", "error");
  }
  const vh = document.getElementById("vh-req");
  if (vh) vh.textContent = `${CONFIG.verification.minFollowers}+ followers · ${CONFIG.verification.minAvgViews}+ avg views`;
  const poMin = document.getElementById("po-min");
  if (poMin) poMin.textContent = money(CONFIG.minPayout || 10);

  // Preload posts in the background so the overview shows real numbers.
  loadPosts().catch(() => {});

  const page = (location.hash || "#overview").slice(1);
  showPage(PAGES.includes(page) ? page : "overview");
}

window.addEventListener("hashchange", () => showPage((location.hash || "#overview").slice(1)));

// ── Overview ──────────────────────────────────────────────────────

function statCard(label, icon, value, cls, foot) {
  return `<div class="stat-card">
    <div class="stat-label"><i class="fa-solid ${icon}"></i> ${label}</div>
    <div class="stat-value ${cls || ""}">${value}</div>
    ${foot ? `<div class="stat-foot">${foot}</div>` : ""}
  </div>`;
}

function renderOverview() {
  if (!ME) return;
  document.getElementById("ov-balance").textContent = money(ME.balance);
  document.getElementById("ov-name").textContent = ME.name || "Clipper";
  document.getElementById("ov-verified").innerHTML = ME.verified
    ? '<span class="badge green"><i class="fa-solid fa-circle-check"></i> Verified</span>'
    : '<span class="badge amber">Unverified</span>';

  const connected = (ME.accounts || []).filter((a) => a.verified).length;
  const posts = POSTS.length;
  const pending = POSTS.filter((p) => p.status === "pending").length;
  document.getElementById("ov-tagline").textContent =
    connected === 0
      ? "Connect your first social account to unlock campaigns and earning."
      : ME.verified
        ? "You're verified — join campaigns, submit clips and track your payouts here."
        : `You have ${connected} connected account${connected === 1 ? "" : "s"} — finish verification to unlock the CLIPPER role.`;

  document.getElementById("ov-stats").innerHTML =
    statCard("Available balance", "fa-wallet", money(ME.balance), "green", "Ready to withdraw") +
    statCard("Total paid out", "fa-money-bill-trend-up", money(ME.totalPaid), "purple") +
    statCard("Connected accounts", "fa-link", `${connected} / 3`, "blue", `${(ME.accounts || []).length} added`) +
    statCard("Posts submitted", "fa-film", fmt(posts), "amber", pending ? `${pending} pending review` : "all reviewed");
}

// ── Campaigns ─────────────────────────────────────────────────────

async function loadCampaigns() {
  CAMPAIGNS = await api("/campaigns");
  renderCampaigns();
}

function renderCampaigns() {
  const q = (document.getElementById("camp-search").value || "").toLowerCase();
  const list = CAMPAIGNS.filter((c) => !q || c.title.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q));
  const grid = document.getElementById("camp-grid");
  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><i class="fa-regular fa-calendar-xmark"></i>${q ? "No campaigns match your search." : "No live campaigns right now — check back soon!"}</div>`;
    return;
  }
  grid.innerHTML = list
    .map((c) => {
      const cover = c.image_url
        ? `style="background-image:linear-gradient(180deg,rgba(6,4,12,.2),rgba(6,4,12,.7)),url('${esc(c.image_url)}')"`
        : "";
      return `
      <div class="card camp-card hoverable">
        <div class="camp-cover" ${cover}>${c.image_url ? "" : '<img class="logo" src="/logo.png" alt=""/>'}</div>
        <div class="camp-body">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
            <h3>${esc(c.title)}</h3><span class="badge green">Active</span>
          </div>
          <p class="desc">${esc((c.description || "").slice(0, 120))}${(c.description || "").length > 120 ? "…" : ""}</p>
          <div class="camp-pills">${(c.platformList || []).map((p) => `<span class="pill">${esc(p)}</span>`).join("")}</div>
          <div class="camp-foot">
            <span style="color:var(--green);font-size:12px;font-weight:650">${esc(c.payout_rate || "")}</span>
            <button class="btn sm primary" onclick="openCampaign('${esc(c.id)}')">View &amp; submit</button>
          </div>
        </div>
      </div>`;
    })
    .join("");
}

async function openCampaign(id) {
  let c;
  try {
    c = await api("/campaigns/" + encodeURIComponent(id));
  } catch (err) {
    return toast(err.message, "error");
  }
  const refs = String((c.details && c.details.references) || "")
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//.test(s));

  const myPost = c.myPost;
  const connected = (ME.accounts || []).find((a) => a.verified && (c.platformList || []).includes(a.platform));
  const campaignPlatforms = c.platformList || [];

  let submitBlock;
  if (myPost) {
    submitBlock = `
      <div class="detail-sec">
        <div class="h">Your submission</div>
        <div class="card" style="padding:16px">
          <a href="${esc(myPost.post_url)}" target="_blank" style="color:var(--blue);font-size:13px;word-break:break-all">${esc(myPost.post_url)}</a>
          <div style="margin-top:10px;display:flex;gap:8px;align-items:center">
            ${statusBadge(myPost.status)}
            <span style="font-size:11.5px;color:var(--muted)">${timeAgo(myPost.submitted_at)} · ${esc(myPost.platform)}</span>
            ${myPost.status === "verified" ? `<span style="font-size:12px;color:var(--green);font-weight:650">${fmt(myPost.views)} views · ${money(myPost.earnings)}</span>` : ""}
          </div>
        </div>
      </div>`;
  } else if (!ME.accounts.some((a) => a.verified)) {
    submitBlock = `
      <div class="detail-sec">
        <div class="h">Submit your clip</div>
        <div class="card" style="padding:16px;text-align:center">
          <p style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:14px">
            Connect &amp; verify a <b>${campaignPlatforms.join(" / ") || "social"}</b> account first —
            we check that submitted clips are posted from your own account.
          </p>
          <button class="btn primary" onclick="closeCampaign();go('connect')"><i class="fa-solid fa-link"></i> Connect account</button>
        </div>
      </div>`;
  } else {
    submitBlock = `
      <div class="detail-sec">
        <div class="h">Submit your clip</div>
        <form onsubmit="return submitPost(event, '${esc(c.id)}')">
          <div class="field">
            <input type="url" id="post-url" placeholder="https://www.tiktok.com/@you/video/…" required/>
            <div style="font-size:11.5px;color:var(--dim);margin-top:7px">
              Posting from: <b>${connected ? esc(connected.platform + " @" + connected.username) : campaignPlatforms.join(", ")}</b>
              — links from other accounts are rejected.
            </div>
          </div>
          <button class="btn primary block" type="submit"><i class="fa-solid fa-paper-plane"></i> Submit for review</button>
        </form>
      </div>`;
  }

  document.getElementById("camp-modal-body").innerHTML = `
    ${c.image_url ? `<img src="${esc(c.image_url)}" alt="" style="width:100%;height:170px;object-fit:cover;border-radius:12px;margin-bottom:18px;border:1px solid var(--line)"/>` : ""}
    <h3 style="font-size:19px;margin-bottom:6px">${esc(c.title)}</h3>
    <div class="camp-pills" style="margin-bottom:16px">
      ${(c.platformList || []).map((p) => `<span class="pill">${esc(p)}</span>`).join("")}
      <span class="pill" style="color:var(--green)">${esc(c.payout_rate || "")}</span>
      <span class="pill">min ${fmt(c.min_views || 0)} views</span>
    </div>
    ${c.description ? `<div class="detail-sec"><div class="h">Brief</div><p>${esc(c.description)}</p></div>` : ""}
    ${c.rules ? `<div class="detail-sec"><div class="h">Rules</div><p>${esc(c.rules)}</p></div>` : ""}
    ${refs.length ? `<div class="detail-sec"><div class="h">References &amp; links</div><div class="ref-links">${refs.map((r) => `<a href="${esc(r)}" target="_blank" rel="noopener">${esc(r)}</a>`).join("")}</div></div>` : ""}
    <div class="detail-sec"><div class="h">Stats</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="pill">${fmt(c.stats.totalPosts)} posts</span>
        <span class="pill">${fmt(c.stats.pendingPosts)} pending</span>
        <span class="pill" style="color:var(--green)">${fmt(c.stats.totalViews)} verified views</span>
      </div>
    </div>
    ${submitBlock}
  `;
  document.getElementById("camp-modal").classList.add("open");
}

function closeCampaign() {
  document.getElementById("camp-modal").classList.remove("open");
}

async function submitPost(event, campaignId) {
  event.preventDefault();
  const url = document.getElementById("post-url").value.trim();
  try {
    const r = await api(`/campaigns/${encodeURIComponent(campaignId)}/posts`, { method: "POST", body: { url } });
    toast("Submitted! Your clip is pending admin verification — we also sent you a notification.", "success");
    closeCampaign();
    await Promise.all([refreshMe(), loadPosts().catch(() => {})]);
    go("posts");
  } catch (err) {
    toast(err.message, "error");
  }
  return false;
}

// ── My posts ──────────────────────────────────────────────────────

function statusBadge(status) {
  if (status === "verified") return '<span class="badge green">Verified</span>';
  if (status === "rejected") return '<span class="badge red">Rejected</span>';
  return '<span class="badge amber">Pending</span>';
}

async function loadPosts() {
  POSTS = await api("/posts");
  const counter = document.getElementById("count-posts");
  counter.style.display = POSTS.length ? "inline-block" : "none";
  counter.textContent = POSTS.length;

  const tbody = document.getElementById("posts-tbody");
  if (!POSTS.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty"><i class="fa-regular fa-folder-open"></i>No posts yet — open the Campaigns tab and submit your first clip.</td></tr>`;
    return;
  }
  tbody.innerHTML = POSTS.map((p) => `
    <tr>
      <td><b>${esc(p.campaign_title)}</b></td>
      <td style="text-transform:capitalize">${esc(p.platform)}</td>
      <td style="max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><a href="${esc(p.post_url)}" target="_blank" rel="noopener">open clip</a></td>
      <td>${p.status === "verified" ? fmt(p.views) : "—"}</td>
      <td>${statusBadge(p.status)}</td>
      <td style="color:var(--green);font-weight:650">${p.status === "verified" ? money(p.earnings) + (p.credited ? " ✓" : "") : "—"}</td>
      <td style="color:var(--muted)">${timeAgo(p.submitted_at)}</td>
    </tr>`).join("");
  renderOverview();
}

// ── Connect accounts ──────────────────────────────────────────────

function renderConnect() {
  const grid = document.getElementById("platforms-grid");
  grid.innerHTML = Object.keys(PLATFORM_META).map((platform) => {
    const meta = PLATFORM_META[platform];
    const acct = (ME.accounts || []).find((a) => a.platform === platform);

    if (!acct) {
      return `
      <div class="card platform-card">
        <div class="platform-head">
          <div class="platform-icon ${platform}"><i class="${meta.icon}"></i></div>
          <div><b>${meta.name}</b><span>${meta.hint}</span></div>
        </div>
        <form onsubmit="return connectAccount(event, '${platform}')">
          <div class="field" style="margin-bottom:10px">
            <input type="text" id="acc-${platform}" placeholder="@username" required pattern="[A-Za-z0-9._-]{1,50}" title="Letters, numbers, dot, dash, underscore"/>
          </div>
          <button class="btn primary block sm" type="submit"><i class="fa-solid fa-plus"></i> Connect</button>
        </form>
      </div>`;
    }

    const verified = !!acct.verified;
    return `
      <div class="card platform-card">
        <div class="platform-head">
          <div class="platform-icon ${platform}"><i class="${meta.icon}"></i></div>
          <div style="flex:1"><b>@${esc(acct.username)}</b><span>${meta.name}</span></div>
          ${verified ? '<span class="badge green">Verified</span>' : '<span class="badge amber">Pending</span>'}
        </div>
        ${verified ? `
          <div class="platform-stats">
            <div><div class="v">${fmt(acct.follower_count)}</div><div class="k">Followers</div></div>
            <div><div class="v">${fmt(acct.avg_views)}</div><div class="k">Avg views</div></div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn sm" style="flex:1" onclick="syncAccount('${platform}')"><i class="fa-solid fa-rotate"></i> Sync stats</button>
            <button class="btn danger sm" onclick="disconnectAccount('${platform}')"><i class="fa-solid fa-xmark"></i></button>
          </div>
        ` : `
          <div class="code-box">
            <div class="code">${esc(acct.verification_code || "—")}</div>
            <div class="hint">Put this code in your ${meta.name} bio (<a href="${esc(acct.profile_url)}" target="_blank" style="color:var(--blue)">${esc(acct.username)}</a>), save, then check.</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn primary sm" style="flex:1" id="verify-${platform}" onclick="verifyAccount('${platform}')"><i class="fa-solid fa-shield-halved"></i> Check bio</button>
            <button class="btn danger sm" onclick="disconnectAccount('${platform}')"><i class="fa-solid fa-xmark"></i></button>
          </div>
        `}
      </div>`;
  }).join("");
}

async function connectAccount(event, platform) {
  event.preventDefault();
  const username = document.getElementById("acc-" + platform).value.trim().replace(/^@+/, "");
  try {
    await api("/accounts", { method: "POST", body: { platform, username } });
    await refreshMe();
    renderConnect();
    toast(`Connected @${username} — add the code to your bio, then verify`, "success");
  } catch (err) {
    toast(err.message, "error");
  }
  return false;
}

async function verifyAccount(platform) {
  const btn = document.getElementById("verify-" + platform);
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking bio…'; }
  try {
    const r = await api(`/accounts/${platform}/verify`, { method: "POST", body: {} });
    if (r.verified) {
      await refreshMe();
      renderConnect();
      const meets = r.meetsRequirements;
      toast(
        meets
          ? `Verified! ${r.stats ? r.stats.followers + " followers · " + r.stats.avgViews + " avg views — requirements met." : "Requirements met."}`
          : "Bio verified! Stats pulled — you don't meet the requirements yet, keep growing.",
        meets ? "success" : ""
      );
    } else {
      toast(r.error || "Code not found yet", "error");
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Check bio'; }
    }
  } catch (err) {
    toast(err.message, "error");
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Check bio'; }
  }
}

async function syncAccount(platform) {
  try {
    const r = await api(`/accounts/${platform}/sync`, { method: "POST", body: {} });
    await refreshMe();
    renderConnect();
    toast(`Synced — ${fmt(r.stats.followers)} followers, ${fmt(r.stats.avgViews)} avg views`, "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function disconnectAccount(platform) {
  if (!confirm(`Disconnect your ${platform} account?`)) return;
  try {
    await api("/accounts/" + platform, { method: "DELETE" });
    await refreshMe();
    renderConnect();
    toast("Account disconnected");
  } catch (err) {
    toast(err.message, "error");
  }
}

// ── Earnings ──────────────────────────────────────────────────────

async function loadEarnings() {
  const data = await api("/earnings");
  document.getElementById("er-balance").textContent = money(data.balance);
  document.getElementById("er-stats").innerHTML =
    statCard("Available balance", "fa-wallet", money(data.balance), "green", "withdraw anytime above minimum") +
    statCard("Lifetime paid", "fa-money-bill-trend-up", money(data.totalPaid), "purple", "completed withdrawals") +
    statCard("Ledger entries", "fa-receipt", fmt(data.history.length), "blue");

  const tbody = document.getElementById("er-tbody");
  if (!data.history.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty"><i class="fa-regular fa-money-bill"></i>No earnings yet — verified clips and campaigns land here.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.history.map((h) => `
    <tr>
      <td style="color:var(--green);font-weight:700">+${money(h.amount)}</td>
      <td>${esc(h.source)}</td>
      <td style="color:var(--muted)">${timeAgo(h.created_at)}</td>
    </tr>`).join("");
}

// ── Payouts ───────────────────────────────────────────────────────

async function loadPayouts() {
  const [history, earnings] = await Promise.all([api("/payouts"), api("/earnings")]);
  document.getElementById("po-bal").textContent = money(earnings.balance);
  if (ME.wallet) document.getElementById("po-wallet").value = ME.wallet;
  if (ME.method && ME.method !== "NONE") document.getElementById("po-method").value = ME.method.toLowerCase().includes("usdt") ? "USDT" : ME.method;

  const host = document.getElementById("po-history");
  if (!history.length) {
    host.innerHTML = `<div class="empty"><i class="fa-solid fa-receipt"></i>No withdrawal requests yet.</div>`;
    return;
  }
  host.innerHTML = history.map((p) => `
    <div class="notif">
      <div class="dot ${p.status === "pending" ? "" : "read"}"></div>
      <div style="flex:1">
        <div class="msg"><b>${money(p.amount)}</b> · ${esc(p.method || "—")}</div>
        <div class="when">${timeAgo(p.requested_at)}${p.processed_at ? " · processed " + timeAgo(p.processed_at) : ""}</div>
      </div>
      ${p.status === "approved" ? '<span class="badge green">Approved</span>' : p.status === "rejected" ? '<span class="badge red">Rejected</span>' : '<span class="badge amber">Pending</span>'}
    </div>`).join("");
}

async function requestPayout(event) {
  event.preventDefault();
  try {
    const r = await api("/payouts", {
      method: "POST",
      body: {
        amount: parseFloat(document.getElementById("po-amount").value),
        method: document.getElementById("po-method").value,
        wallet: document.getElementById("po-wallet").value.trim(),
      },
    });
    toast(`Withdrawal requested — ${money(r.balance)} remaining`, "success");
    await Promise.all([refreshMe(), loadPayouts()]);
    document.getElementById("po-amount").value = "";
    document.getElementById("ov-balance").textContent = money(r.balance);
  } catch (err) {
    toast(err.message, "error");
  }
  return false;
}

// ── Notifications ─────────────────────────────────────────────────

async function loadNotifications() {
  const data = await api("/notifications");
  const host = document.getElementById("notif-list");
  if (!data.items.length) {
    host.innerHTML = `<div class="empty"><i class="fa-regular fa-bell-slash"></i>Nothing here yet — verification, campaign and payout updates land here.</div>`;
    return;
  }
  host.innerHTML = data.items.map((n) => `
    <div class="notif ${n.read ? "" : "unread"}">
      <div class="dot ${n.read ? "read" : ""}"></div>
      <div><div class="msg">${esc(n.message)}</div><div class="when">${esc(n.type.replace(/_/g, " "))} · ${timeAgo(n.created_at)}</div></div>
    </div>`).join("");
}

async function markRead() {
  try {
    await api("/notifications/read", { method: "POST", body: {} });
    await Promise.all([refreshMe(), loadNotifications()]);
    toast("All notifications marked as read", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

// ── Leaderboard ───────────────────────────────────────────────────

async function loadLeaderboard() {
  const rows = await api("/leaderboard");
  const host = document.getElementById("lb-list");
  if (!rows.length) {
    host.innerHTML = `<div class="empty"><i class="fa-solid fa-trophy"></i>No verified earnings yet — you could be #1.</div>`;
    return;
  }
  host.innerHTML = rows.map((r, i) => `
    <div class="lb-row" style="display:grid;grid-template-columns:44px 1.4fr 1fr auto;gap:14px;align-items:center;padding:14px 20px;border-radius:12px;background:${r.id === ME.id ? "rgba(139,92,246,.09)" : "rgba(255,255,255,.028)"};border:1px solid ${r.id === ME.id ? "rgba(139,92,246,.3)" : "var(--line)"};margin-bottom:8px;font-size:13px">
      <div style="font-weight:750;color:${i < 3 ? "var(--amber)" : "var(--dim)"}">#${i + 1}</div>
      <div style="font-weight:620;display:flex;gap:8px;align-items:center;min-width:0">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}${r.id === ME.id ? " (you)" : ""}</span>
        ${r.verified ? '<span class="badge green">Verified</span>' : ""}
      </div>
      <div style="color:var(--muted);font-size:12.5px">${fmt(r.total_views)} views</div>
      <div style="color:var(--green);font-weight:700">${money(r.total_earnings)}</div>
    </div>`).join("");
}

boot();
