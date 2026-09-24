/* Landing page — all numbers come from the live API, never hardcoded. */

document.getElementById("year").textContent = new Date().getFullYear();

function renderStats(stats) {
  document.getElementById("st-campaigns").textContent = fmt(stats.activeCampaigns);
  document.getElementById("st-creators").textContent = fmt(stats.creators);
  document.getElementById("st-posts").textContent = fmt(stats.posts);
  document.getElementById("st-paid").textContent = "$" + fmt(stats.paidOut);
}

function platformPills(list) {
  const icons = { tiktok: "fa-music", instagram: "fa-camera", youtube: "fa-youtube" };
  return list
    .map((p) => `<span class="pill"><i class="fa-brands ${icons[p] || "fa-globe"}" style="margin-right:6px;opacity:.7"></i>${esc(p)}</span>`)
    .join("");
}

function renderCampaigns(campaigns) {
  const grid = document.getElementById("campaign-grid");
  const sub = document.getElementById("campaigns-sub");
  if (!campaigns.length) {
    sub.textContent = "No campaigns are live right now — new ones are posted weekly.";
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><i class="fa-regular fa-calendar"></i>No active campaigns yet — sign up so you never miss the next drop.</div>`;
    return;
  }
  sub.textContent = `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} accepting clips right now.`;
  grid.innerHTML = campaigns
    .slice(0, 6)
    .map((c) => {
      const cover = c.image_url
        ? `style="background-image:linear-gradient(180deg,rgba(6,4,12,.25),rgba(6,4,12,.75)),url('${esc(c.image_url)}')"`
        : "";
      return `
      <div class="card camp-card hoverable">
        <div class="camp-cover" ${cover}>
          ${c.image_url ? "" : '<img class="logo" src="/logo.png" alt=""/>'}
        </div>
        <div class="camp-body">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:start">
            <h3>${esc(c.title)}</h3>
            <span class="badge green">Active</span>
          </div>
          <p class="desc">${esc((c.description || "").slice(0, 130))}${(c.description || "").length > 130 ? "…" : ""}</p>
          <div class="camp-pills">${platformPills(c.platformList)}</div>
          <div class="camp-meta">
            <span class="rate"><i class="fa-solid fa-coins"></i> ${esc(c.payout_rate || "")}</span>
            <span>${fmt(c.posts)} post${c.posts === 1 ? "" : "s"}</span>
          </div>
        </div>
      </div>`;
    })
    .join("");
}

function renderLeaderboard(rows) {
  const host = document.getElementById("lb-list");
  if (!rows.length) {
    host.innerHTML = `<div class="empty"><i class="fa-solid fa-trophy"></i>The leaderboard is warming up — verified earnings will appear here.</div>`;
    return;
  }
  host.innerHTML = rows
    .map(
      (r, i) => `
    <div class="lb-row">
      <div class="rank ${i < 3 ? "top" : ""}">#${i + 1}</div>
      <div class="name">${esc(r.name)} ${r.verified ? '<span class="badge green">Verified</span>' : ""}</div>
      <div class="views">${fmt(r.total_views)} views</div>
      <div class="earn">${money(r.total_earnings)}</div>
    </div>`
    )
    .join("");
}

async function boot() {
  const [stats, campaigns, leaderboard] = await Promise.all([
    api("/stats").catch(() => null),
    api("/campaigns").catch(() => []),
    api("/leaderboard").catch(() => []),
  ]);
  if (stats) renderStats(stats);
  renderCampaigns(campaigns || []);
  renderLeaderboard(leaderboard || []);
}

boot();
