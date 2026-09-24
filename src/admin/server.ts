// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLIPTIC NETWORK — ADMIN DASHBOARD v2
// Reflect.app-inspired UI with real API data
// Auto-starts with the bot (imported by src/index.ts)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { LOGO_DATA_URI } from "../utils/logo";
import { getClient } from "./bridge";
import { authHandler, getSession } from "../web/auth";
import webRouter from "../web/api";

const DB_PATH = path.join(__dirname, "..", "..", "cliptic.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Ensure campaign_posts table exists
try {
  db.exec(`CREATE TABLE IF NOT EXISTS campaign_posts (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    post_url TEXT NOT NULL,
    platform TEXT DEFAULT '',
    platform_username TEXT DEFAULT '',
    views INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    verified_by TEXT,
    earnings REAL DEFAULT 0.0,
    credited INTEGER DEFAULT 0,
    submitted_at TEXT DEFAULT (datetime('now')),
    reviewed_at TEXT,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
} catch {}

const app = express();
app.use(cors());

// Better Auth (Discord / Google / password) — MUST be mounted before
// express.json() because it consumes the raw request body itself.
app.all("/api/auth/{*splat}", authHandler);
app.use(express.json());

// Website JSON API — public + signed-in user routes (session-based).
app.use("/api/web", webRouter);

// Everything else under /api belongs to the admin dashboard → admin session only.
app.use(async (req: any, res, next) => {
  if (!req.path.startsWith("/api/")) return next();
  if (req.path.startsWith("/api/auth/") || req.path.startsWith("/api/web/")) return next();
  try {
    const session = await getSession(req);
    if (session?.user?.role === "admin") return next();
    if (session) return res.status(403).json({ error: "Admin access required", code: "FORBIDDEN" });
    return res.status(401).json({ error: "Admin sign-in required", code: "UNAUTHENTICATED" });
  } catch {
    return res.status(401).json({ error: "Admin sign-in required", code: "UNAUTHENTICATED" });
  }
});

// Freebuff injects PORT for the preview workspace; ADMIN_PORT kept for local overrides.
const PORT = parseInt(process.env.PORT || process.env.ADMIN_PORT || "3001", 10);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.get("/api/analytics", (_req, res) => {
  const totalUsers = (db.prepare("SELECT COUNT(*) as c FROM users").get() as any).c;
  const verifiedUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE verified = 1").get() as any).c;
  const totalClips = (db.prepare("SELECT COUNT(*) as c FROM clip_submissions").get() as any).c;
  const approvedClips = (db.prepare("SELECT COUNT(*) as c FROM clip_submissions WHERE status = 'approved'").get() as any).c;
  const totalBalance = (db.prepare("SELECT COALESCE(SUM(balance), 0) as c FROM payments").get() as any).c;
  const totalPaid = (db.prepare("SELECT COALESCE(SUM(total_paid), 0) as c FROM payments").get() as any).c;
  const totalViews = (db.prepare("SELECT COALESCE(SUM(views), 0) as c FROM clip_submissions WHERE status = 'approved'").get() as any).c;
  const activeCampaigns = (db.prepare("SELECT COUNT(*) as c FROM campaigns WHERE status = 'active'").get() as any).c;
  const openTickets = (db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status = 'open'").get() as any).c;
  const platformStats = db.prepare("SELECT platform, COUNT(*) as count, SUM(follower_count) as total_followers FROM social_accounts GROUP BY platform").all();
  res.json({ totalUsers, verifiedUsers, totalClips, approvedClips, totalBalance, totalPaid, totalViews, activeCampaigns, openTickets, platformStats });
});

app.get("/api/users", (_req, res) => {
  const users = db.prepare(`
    SELECT u.*,
      (SELECT COUNT(*) FROM social_accounts WHERE user_id = u.id) as account_count,
      (SELECT GROUP_CONCAT(platform || ':' || username || ':' || follower_count || ':' || avg_views || ':' || verified) FROM social_accounts WHERE user_id = u.id) as accounts_raw,
      (SELECT balance FROM payments WHERE user_id = u.id) as balance,
      (SELECT total_paid FROM payments WHERE user_id = u.id) as total_paid,
      (SELECT method FROM payments WHERE user_id = u.id) as payment_method,
      (SELECT wallet_address FROM payments WHERE user_id = u.id) as wallet_address,
      (SELECT COUNT(*) FROM clip_submissions WHERE user_id = u.id AND status = 'approved') as clips_approved,
      (SELECT SUM(views) FROM clip_submissions WHERE user_id = u.id AND status = 'approved') as total_views,
      (SELECT SUM(earnings) FROM clip_submissions WHERE user_id = u.id AND status = 'approved') as total_earnings
    FROM users u ORDER BY u.created_at DESC
  `).all();
  const result = (users as any[]).map(u => {
    const accounts = u.accounts_raw ? u.accounts_raw.split(",").map((raw: string) => {
      const [platform, username, follower_count, avg_views, verified] = raw.split(":");
      return { platform, username, follower_count: parseInt(follower_count) || 0, avg_views: parseInt(avg_views) || 0, verified: verified === "1" };
    }) : [];
    return { ...u, accounts, accounts_raw: undefined };
  });
  res.json(result);
});

app.get("/api/users/:discordId", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE discord_id = ?").get(req.params.discordId) as any;
  if (!user) return res.status(404).json({ error: "User not found" });
  const accounts = db.prepare("SELECT * FROM social_accounts WHERE user_id = ?").all(user.id);
  const payment = db.prepare("SELECT * FROM payments WHERE user_id = ?").get(user.id);
  const clips = db.prepare("SELECT * FROM clip_submissions WHERE user_id = ? ORDER BY submitted_at DESC LIMIT 20").all(user.id);
  const earnings = db.prepare("SELECT * FROM earnings_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20").all(user.id);
  res.json({ user, accounts, payment, clips, earnings });
});

app.post("/api/users/:discordId/balance", (req, res) => {
  const { amount, reason } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE discord_id = ?").get(req.params.discordId) as any;
  if (!user) return res.status(404).json({ error: "User not found" });
  const payment = db.prepare("SELECT * FROM payments WHERE user_id = ?").get(user.id) as any;
  if (!payment) {
    db.prepare("INSERT INTO payments (id, user_id, method, wallet_address, balance) VALUES (?, ?, 'NONE', '', ?)").run(`pay_${Date.now()}`, user.id, amount || 0);
  } else {
    db.prepare("UPDATE payments SET balance = balance + ? WHERE user_id = ?").run(amount || 0, user.id);
  }
  if (reason && amount) {
    db.prepare("INSERT INTO earnings_history (id, user_id, amount, source) VALUES (?, ?, ?, ?)").run(`earn_${Date.now()}`, user.id, amount, reason);
  }
  res.json({ success: true });
});

app.post("/api/users/:discordId/dm", async (req, res) => {
  const { message } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE discord_id = ?").get(req.params.discordId) as any;
  if (!user) return res.status(404).json({ error: "User not found" });
  db.prepare("INSERT INTO notifications (id, user_id, type, message) VALUES (?, ?, 'admin_dm', ?)").run(`notif_${Date.now()}`, user.id, message);
  let delivered = false;
  const client = getClient();
  if (client) {
    try {
      const discordUser = await client.users.fetch(user.discord_id);
      await discordUser.send(`**CLIPTIC Network \u2014 Message from Admin**\n\n${message}`);
      delivered = true;
    } catch {}
  }
  res.json({ success: true, delivered });
});

// Campaigns
app.get("/api/campaigns", (_req, res) => {
  res.json(db.prepare("SELECT * FROM campaigns ORDER BY created_at DESC").all());
});

app.post("/api/campaigns", (req, res) => {
  const { title, description, platforms, audiences, payout_rate, min_views, rules, created_by, image_url, details_json } = req.body;
  const id = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  db.prepare("INSERT INTO campaigns (id, title, description, platforms, audiences, payout_rate, min_views, rules, created_by, image_url, details_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, title, description || "", platforms || "tiktok,instagram,youtube", audiences || "English", payout_rate || "Up to $0.80 per 1,000 views", min_views || 10000, rules || "", created_by || "Admin", image_url || "", details_json || "{}");
  const client = getClient();
  if (client) {
    import("../events/campaignPoster").then(({ postCampaignToChannel }) => postCampaignToChannel(client, id)).catch(() => {});
  }
  res.json({ success: true, id });
});

app.put("/api/campaigns/:id", (req, res) => {
  const { title, description, platforms, audiences, payout_rate, min_views, rules, status, image_url, details_json } = req.body;
  const existing = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: "Campaign not found" });
  db.prepare("UPDATE campaigns SET title=?, description=?, platforms=?, audiences=?, payout_rate=?, min_views=?, rules=?, status=?, image_url=?, details_json=? WHERE id=?").run(
    title ?? existing.title, description ?? existing.description, platforms ?? existing.platforms,
    audiences ?? existing.audiences, payout_rate ?? existing.payout_rate, min_views ?? existing.min_views,
    rules ?? existing.rules, status ?? existing.status, image_url ?? existing.image_url, details_json ?? existing.details_json, req.params.id
  );
  // Also update the campaign message in Discord (delete old + repost updated)
  const client = getClient();
  if (client) {
    import("../events/campaignPoster")
      .then(({ repostCampaignToChannel }) => repostCampaignToChannel(client, req.params.id))
      .then((ok) => console.log(`[Admin] Campaign Discord repost: ${ok ? "done" : "failed"}`))
      .catch((err) => console.error("[Admin] Campaign Discord repost error:", err?.message || err));
  }
  res.json({ success: true });
});

app.post("/api/campaigns/:id/post-to-discord", (req, res) => {
  const client = getClient();
  if (!client) return res.json({ success: false, error: "Bot not connected" });
  import("../events/campaignPoster")
    .then(({ postCampaignToChannel }) => postCampaignToChannel(client, req.params.id))
    .then((ok) => res.json({ success: ok }))
    .catch((err) => { console.error("[Admin] Post to Discord error:", err?.message || err); res.json({ success: false, error: err?.message }); });
});

app.delete("/api/campaigns/:id", (req, res) => {
  db.prepare("DELETE FROM campaign_posts WHERE campaign_id = ?").run(req.params.id);
  db.prepare("DELETE FROM campaign_members WHERE campaign_id = ?").run(req.params.id);
  db.prepare("DELETE FROM campaigns WHERE id = ?").run(req.params.id);
  // Also delete the campaign message from Discord
  const client = getClient();
  if (client) {
    import("../events/campaignPoster")
      .then(({ deleteCampaignFromChannel }) => deleteCampaignFromChannel(client, req.params.id))
      .then((ok) => console.log(`[Admin] Campaign Discord delete: ${ok ? "done" : "not found"}`))
      .catch((err) => console.error("[Admin] Campaign Discord delete error:", err?.message || err));
  }
  res.json({ success: true });
});

// Campaign Posts
app.get("/api/campaigns/:id/posts", (req, res) => {
  res.json(db.prepare("SELECT cp.*, u.discord_tag, u.discord_id FROM campaign_posts cp JOIN users u ON cp.user_id = u.id WHERE cp.campaign_id = ? ORDER BY cp.submitted_at DESC").all(req.params.id));
});

app.get("/api/campaigns/:id/stats", (req, res) => {
  const q = (sql: string) => (db.prepare(sql).get(req.params.id) as any)?.c || (db.prepare(sql).get(req.params.id) as any)?.t || 0;
  res.json({
    totalPosts: q("SELECT COUNT(*) as c FROM campaign_posts WHERE campaign_id = ?"),
    verifiedPosts: q("SELECT COUNT(*) as c FROM campaign_posts WHERE campaign_id = ? AND status = 'verified'"),
    pendingPosts: q("SELECT COUNT(*) as c FROM campaign_posts WHERE campaign_id = ? AND status = 'pending'"),
    rejectedPosts: q("SELECT COUNT(*) as c FROM campaign_posts WHERE campaign_id = ? AND status = 'rejected'"),
    totalViews: (db.prepare("SELECT COALESCE(SUM(views),0) as t FROM campaign_posts WHERE campaign_id = ? AND status = 'verified'").get(req.params.id) as any)?.t || 0,
    totalEarnings: (db.prepare("SELECT COALESCE(SUM(earnings),0) as t FROM campaign_posts WHERE campaign_id = ? AND status = 'verified'").get(req.params.id) as any)?.t || 0,
    totalCredited: q("SELECT COUNT(*) as c FROM campaign_posts WHERE campaign_id = ? AND credited = 1"),
  });
});

app.post("/api/campaigns/:id/posts/:postId/verify", (req, res) => {
  const { views, earnings } = req.body;
  db.prepare("UPDATE campaign_posts SET status='verified', views=?, earnings=?, verified_by='admin', reviewed_at=datetime('now') WHERE id=? AND campaign_id=?").run(views || 0, earnings || 0, req.params.postId, req.params.id);
  res.json({ success: true });
});

app.post("/api/campaigns/:id/posts/:postId/reject", (req, res) => {
  db.prepare("UPDATE campaign_posts SET status='rejected', verified_by='admin', reviewed_at=datetime('now') WHERE id=? AND campaign_id=?").run(req.params.postId, req.params.id);
  res.json({ success: true });
});

app.post("/api/campaigns/:id/credit", (req, res) => {
  const posts = db.prepare("SELECT * FROM campaign_posts WHERE campaign_id = ? AND status = 'verified' AND credited = 0").all(req.params.id) as any[];
  let count = 0;
  for (const post of posts) {
    db.prepare("UPDATE campaign_posts SET credited = 1 WHERE id = ?").run(post.id);
    const payment = db.prepare("SELECT * FROM payments WHERE user_id = ?").get(post.user_id) as any;
    if (payment) db.prepare("UPDATE payments SET balance = balance + ? WHERE user_id = ?").run(post.earnings, post.user_id);
    else db.prepare("INSERT INTO payments (id, user_id, method, wallet_address, balance) VALUES (?, ?, 'NONE', '', ?)").run(`pay_${Date.now()}`, post.user_id, post.earnings);
    db.prepare("INSERT INTO earnings_history (id, user_id, amount, source) VALUES (?, ?, ?, ?)").run(`earn_${Date.now()}_${Math.random().toString(36).substr(2,4)}`, post.user_id, post.earnings, "campaign: verified post");
    count++;
  }
  res.json({ success: true, credited: count });
});

// Clips
app.get("/api/clips", (_req, res) => {
  res.json(db.prepare("SELECT cs.*, u.discord_tag, u.discord_id FROM clip_submissions cs JOIN users u ON cs.user_id = u.id ORDER BY cs.submitted_at DESC LIMIT 50").all());
});

app.post("/api/clips/:id/approve", (req, res) => {
  const clip = db.prepare("SELECT * FROM clip_submissions WHERE id = ?").get(req.params.id) as any;
  if (clip && clip.status === "pending") {
    db.prepare("UPDATE clip_submissions SET status = 'approved', reviewed_at = datetime('now') WHERE id = ?").run(req.params.id);
    const earnings = (clip.views || 0) * 0.0008;
    if (earnings > 0) {
      db.prepare("INSERT INTO earnings_history (id, user_id, amount, source, clip_id) VALUES (?, ?, ?, ?, ?)").run(`earn_${Date.now()}`, clip.user_id, earnings, "clip", clip.id);
      db.prepare("UPDATE payments SET balance = balance + ? WHERE user_id = ?").run(earnings, clip.user_id);
    }
  }
  res.json({ success: true });
});

app.post("/api/clips/:id/reject", (req, res) => {
  db.prepare("UPDATE clip_submissions SET status = 'rejected', reviewed_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Payouts
app.get("/api/payouts", (_req, res) => {
  res.json(db.prepare("SELECT p.*, u.discord_tag, u.discord_id FROM payout_requests p JOIN users u ON p.user_id = u.id ORDER BY p.requested_at DESC LIMIT 50").all());
});

// NOTE: createPayoutRequest() already deducts the balance (and counts
// total_paid) at request time — approval only confirms the transfer,
// rejection refunds it. (Previously approve deducted a second time.)
app.post("/api/payouts/:id/approve", (req, res) => {
  const payout = db.prepare("SELECT * FROM payout_requests WHERE id = ?").get(req.params.id) as any;
  if (payout && payout.status === "pending") {
    db.prepare("UPDATE payout_requests SET status = 'approved', processed_at = datetime('now') WHERE id = ?").run(req.params.id);
  }
  res.json({ success: true });
});

app.post("/api/payouts/:id/reject", (req, res) => {
  const payout = db.prepare("SELECT * FROM payout_requests WHERE id = ?").get(req.params.id) as any;
  if (payout && payout.status === "pending") {
    db.prepare("UPDATE payments SET balance = balance + ?, total_paid = MAX(0, total_paid - ?) WHERE user_id = ?").run(payout.amount, payout.amount, payout.user_id);
    db.prepare("UPDATE payout_requests SET status = 'rejected', processed_at = datetime('now') WHERE id = ?").run(req.params.id);
  }
  res.json({ success: true });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FRONTEND — Reflect.app-inspired UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const HTML = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>CLIPTIC Admin</title>
<link rel="icon" type="image/png" href="${LOGO_DATA_URI}"/>
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet"/>
<style>
:root{--bg:#050507;--surface:rgba(16,16,20,.64);--line:rgba(255,255,255,.075);--line-s:rgba(255,255,255,.12);--text:#f4f4f5;--muted:#8b8b94;--dim:#5d5d66;--purple:#8b5cf6;--purple-s:rgba(139,92,246,.13);--green:#45d483;--red:#ff647c;--amber:#ffc766;--blue:#6ea8ff;--ease:cubic-bezier(.22,.61,.36,1)}
*{box-sizing:border-box;margin:0;padding:0}
html{background:var(--bg);scroll-behavior:smooth}
body{min-height:100vh;color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Inter","Segoe UI",sans-serif;letter-spacing:-.012em;background:radial-gradient(900px 500px at 78% -18%,rgba(139,92,246,.075),transparent 65%),linear-gradient(180deg,#0a0a0c,#09090b);overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;opacity:.12;background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:48px 48px;mask-image:linear-gradient(to bottom,black,transparent 88%)}
::selection{background:rgba(139,92,246,.38);color:#fff}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:99px}
.app{display:flex;min-height:100vh}
#sidebar{width:240px;background:rgba(12,12,15,.88);border-right:1px solid var(--line);position:fixed;height:100vh;display:flex;flex-direction:column;justify-content:space-between;backdrop-filter:blur(22px) saturate(120%);z-index:40}
.brand{padding:22px 16px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line)}
.brand-icon{width:32px;height:32px;border-radius:10px;background:linear-gradient(145deg,#b18aff,#6942dc);display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;box-shadow:0 8px 24px rgba(130,83,255,.28)}
.brand-text{font-size:15px;font-weight:700;letter-spacing:-.025em}.brand-sub{font-size:9px;letter-spacing:.12em;color:#77727f;text-transform:uppercase}
nav{padding:8px;display:flex;flex-direction:column;gap:2px}
nav button{position:relative;min-height:36px;padding:8px 12px;border-radius:8px;background:transparent;border:1px solid transparent;color:#8e8e97;font-size:12px;font-weight:600;cursor:pointer;transition:all .18s var(--ease);display:flex;align-items:center;gap:10px;text-align:left;font-family:inherit}
nav button:hover{background:rgba(255,255,255,.045);color:#e7e7ea;transform:translateX(1px)}
nav button.active{color:#f1eff8;background:rgba(139,92,246,.105);border-color:rgba(139,92,246,.14)}
nav button.active::before{content:"";position:absolute;left:-8px;top:8px;width:2px;height:18px;border-radius:999px;background:#9b78ff;box-shadow:0 0 14px rgba(139,92,246,.45)}
nav button i{width:16px;font-size:12px;opacity:.82}
.badge-count{margin-left:auto;background:rgba(139,92,246,.15);color:#b8a0ff;font-size:10px;padding:2px 7px;border-radius:99px;font-weight:600}
#content{margin-left:240px;flex:1;padding:36px 48px 80px;max-width:1280px}
.tab{display:none}.tab.active{display:block;animation:pageIn .3s var(--ease) both}
@keyframes pageIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
h1{font-size:26px;font-weight:700;letter-spacing:-.035em;margin-bottom:6px}
.subtitle{color:#777780;font-size:12px;margin-bottom:28px}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-bottom:28px}
.stat-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px;backdrop-filter:blur(18px) saturate(120%);transition:all .22s var(--ease)}
.stat-card:hover{transform:translateY(-2px);border-color:var(--line-s);box-shadow:0 18px 60px rgba(0,0,0,.24)}
.stat-label{font-size:9px;font-weight:600;letter-spacing:.11em;text-transform:uppercase;color:#73737c;margin-bottom:10px;display:flex;align-items:center;gap:8px}
.stat-label i{font-size:11px;opacity:.7}
.stat-value{font-size:24px;font-weight:650;letter-spacing:-.035em}
.stat-value.green{color:var(--green)}.stat-value.purple{color:var(--purple)}.stat-value.amber{color:var(--amber)}.stat-value.red{color:var(--red)}.stat-value.blue{color:var(--blue)}
.stat-badge{display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;border-radius:99px;margin-top:6px}
.stat-badge.green{background:rgba(69,212,131,.1);color:var(--green);border:1px solid rgba(69,212,131,.2)}
.stat-badge.purple{background:var(--purple-s);color:#b8a0ff;border:1px solid rgba(139,92,246,.2)}
.stat-badge.amber{background:rgba(255,199,102,.1);color:var(--amber);border:1px solid rgba(255,199,102,.2)}
.table-wrap{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-bottom:24px;backdrop-filter:blur(18px)}
table{width:100%;border-collapse:separate;border-spacing:0 2px}
thead th{color:#686871;font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;text-align:left;padding:12px 16px;border:0}
tbody tr{transition:background .16s ease}
tbody tr:hover{background:rgba(255,255,255,.035)}
tbody td{font-size:12px;padding:11px 16px;border-top:1px solid transparent;border-bottom:1px solid transparent}
.badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:600}
.badge.green{background:rgba(69,212,131,.1);color:var(--green);border:1px solid rgba(69,212,131,.2)}
.badge.red{background:rgba(255,100,124,.1);color:var(--red);border:1px solid rgba(255,100,124,.2)}
.badge.amber{background:rgba(255,199,102,.1);color:var(--amber);border:1px solid rgba(255,199,102,.2)}
.badge.purple{background:var(--purple-s);color:#b8a0ff;border:1px solid rgba(139,92,246,.2)}
.badge.blue{background:rgba(110,168,255,.1);color:var(--blue);border:1px solid rgba(110,168,255,.2)}
.btn{padding:6px 14px;border-radius:8px;font-size:11px;font-weight:600;border:1px solid var(--line);background:rgba(255,255,255,.04);color:#fff;cursor:pointer;transition:all .18s var(--ease);font-family:inherit}
.btn:hover{background:rgba(255,255,255,.08)}
.btn.primary{background:var(--purple);color:#fff;border-color:rgba(139,92,246,.5)}
.btn.primary:hover{background:#9370f0}
.btn.success{background:rgba(69,212,131,.12);color:var(--green);border-color:rgba(69,212,131,.3)}
.btn.danger{background:rgba(255,100,124,.12);color:var(--red);border-color:rgba(255,100,124,.3)}
.btn-group{display:flex;gap:6px}
.search-box{width:100%;max-width:320px;padding:8px 14px;border-radius:8px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:#fff;font-size:12px;outline:none;margin-bottom:20px;font-family:inherit}
.search-box:focus{border-color:rgba(139,92,246,.4)}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(16px)}
.modal-overlay.open{display:flex}
.modal{background:rgba(18,18,22,.92);border:1px solid rgba(255,255,255,.11);border-radius:14px;padding:28px;width:min(520px,92vw);max-height:84vh;overflow-y:auto;box-shadow:0 35px 100px rgba(0,0,0,.55);backdrop-filter:blur(30px)}
.modal h3{font-size:16px;font-weight:700;margin-bottom:18px;display:flex;align-items:center;gap:8px}
.form-group{margin-bottom:14px}
.form-group label{display:block;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.form-group input,.form-group textarea,.form-group select{width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:#fff;font-size:12px;font-family:inherit;outline:none;transition:border-color .2s}
.form-group input:focus,.form-group textarea:focus,.form-group select:focus{border-color:rgba(139,92,246,.4);box-shadow:0 0 0 3px rgba(139,92,246,.07)}
.form-group textarea{min-height:72px;resize:vertical}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.empty{padding:40px;text-align:center;color:var(--muted);font-size:12px}
.campaign-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.campaign-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px;backdrop-filter:blur(18px);transition:all .22s var(--ease)}
.campaign-card:hover{transform:translateY(-2px);border-color:var(--line-s);box-shadow:0 18px 60px rgba(0,0,0,.24)}
.campaign-card h3{font-size:15px;font-weight:700;margin-bottom:6px}
.campaign-meta{font-size:11px;color:var(--muted);margin-bottom:12px}
.campaign-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.campaign-stat{text-align:center}.campaign-stat .val{font-size:16px;font-weight:700;display:block}.campaign-stat .lbl{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.toast{position:fixed;bottom:24px;right:24px;background:rgba(20,20,24,.92);border:1px solid var(--line);color:#fff;padding:12px 18px;border-radius:10px;font-size:12px;font-weight:600;box-shadow:0 18px 55px rgba(0,0,0,.38);backdrop-filter:blur(20px);opacity:0;transform:translateY(10px);transition:all .3s;z-index:200;pointer-events:none}
.toast.show{opacity:1;transform:translateY(0)}
@media(max-width:767px){#sidebar{display:none}#content{margin-left:0;padding:20px 16px}.stat-grid{grid-template-columns:1fr 1fr}.campaign-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="app">
<aside id="sidebar">
  <div>
    <div class="brand">
      <div class="brand-icon"><i class="fa-solid fa-bolt"></i></div>
      <div><div class="brand-text">CLIPTIC</div><div class="brand-sub">Admin OS</div></div>
    </div>
    <nav>
      <button class="active" onclick="showTab('dashboard')" id="nav-dashboard"><i class="fa-solid fa-chart-pie"></i>Dashboard</button>
      <button onclick="showTab('users')" id="nav-users"><i class="fa-solid fa-users"></i>Users</button>
      <button onclick="showTab('campaigns')" id="nav-campaigns"><i class="fa-solid fa-bullhorn"></i>Campaigns</button>
      <button onclick="showTab('clips')" id="nav-clips"><i class="fa-solid fa-film"></i>Clips <span class="badge-count" id="clips-count">0</span></button>
      <button onclick="showTab('payouts')" id="nav-payouts"><i class="fa-solid fa-wallet"></i>Payouts <span class="badge-count" id="payouts-count">0</span></button>
    </nav>
  </div>
  <div style="padding:12px"><div style="padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.025);border:1px solid var(--line);font-size:11px;color:var(--muted);display:flex;align-items:center;gap:8px"><i class="fa-solid fa-shield-halved" style="color:var(--green)"></i>All systems operational</div></div>
</aside>

<div id="content">
  <!-- DASHBOARD -->
  <div id="tab-dashboard" class="tab active">
    <h1>Network Overview</h1>
    <p class="subtitle">Real-time metrics across the CLIPTIC creator network</p>
    <div class="stat-grid" id="dash-stats"></div>
  </div>

  <!-- USERS -->
  <div id="tab-users" class="tab">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h1>User Management</h1><p class="subtitle" style="margin:0">Manage clippers and platform permissions</p></div></div>
    <input class="search-box" placeholder="Search users..." oninput="filterUsers(this.value)"/>
    <div class="table-wrap"><table><thead><tr><th>User</th><th>Verified</th><th>Accounts</th><th>Followers</th><th>Balance</th><th>Actions</th></tr></thead><tbody id="users-tbody"></tbody></table></div>
  </div>

  <!-- CAMPAIGNS -->
  <div id="tab-campaigns" class="tab">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h1>Campaigns</h1><p class="subtitle" style="margin:0">Create and manage clip campaigns</p></div><button class="btn primary" onclick="openModal('campaign-modal')"><i class="fa-solid fa-plus"></i> New Campaign</button></div>
    <div class="campaign-grid" id="campaigns-grid"></div>
  </div>

  <!-- CLIPS -->
  <div id="tab-clips" class="tab">
    <h1>Clip Submissions</h1>
    <p class="subtitle">Review and moderate clips</p>
    <div class="table-wrap"><table><thead><tr><th>User</th><th>Platform</th><th>URL</th><th>Views</th><th>Status</th><th>Actions</th></tr></thead><tbody id="clips-tbody"></tbody></table></div>
  </div>

  <!-- PAYOUTS -->
  <div id="tab-payouts" class="tab">
    <h1>Payout Requests</h1>
    <p class="subtitle">Approve or reject withdrawal requests</p>
    <div class="table-wrap"><table><thead><tr><th>User</th><th>Amount</th><th>Method</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody id="payouts-tbody"></tbody></table></div>
  </div>
</div>
</div>

<!-- Campaign Modal -->
<div id="campaign-modal" class="modal-overlay" onclick="if(event.target===this)closeModal('campaign-modal')">
  <div class="modal">
    <h3><i class="fa-solid fa-bullhorn" style="color:var(--purple)"></i><span id="campaign-modal-title">Create Campaign</span></h3>
    <div class="form-group"><label>Title</label><input id="c-title" placeholder="Campaign title"/></div>
    <div class="form-group"><label>Description</label><textarea id="c-desc" placeholder="Campaign description..."></textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Platforms (comma separated)</label><input id="c-platforms" value="tiktok,instagram,youtube"/></div>
      <div class="form-group"><label>Audience</label><input id="c-audiences" value="English"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Payout Rate</label><input id="c-payout" value="Up to $0.80 per 1,000 views"/></div>
      <div class="form-group"><label>Min Views</label><input id="c-minviews" type="number" value="10000"/></div>
    </div>
    <div class="form-group"><label>Rules</label><textarea id="c-rules" placeholder="Campaign rules..."></textarea></div>
    <div class="form-group"><label>Image URL (optional)</label><input id="c-image" placeholder="https://..."/></div>
    <div class="form-group"><label>References / Links (optional)</label><textarea id="c-refs" placeholder="Reference links, videos, docs..."></textarea></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
      <button class="btn" onclick="closeModal('campaign-modal')">Cancel</button>
      <button class="btn primary" onclick="saveCampaign()">Save</button>
    </div>
  </div>
</div>

<!-- User Detail Modal -->
<div id="user-modal" class="modal-overlay" onclick="if(event.target===this)closeModal('user-modal')">
  <div class="modal">
    <h3><i class="fa-solid fa-user-gear" style="color:var(--purple)"></i>User Details</h3>
    <div id="user-modal-body"></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px"><button class="btn" onclick="closeModal('user-modal')">Close</button></div>
  </div>
</div>

<!-- DM Modal -->
<div id="dm-modal" class="modal-overlay" onclick="if(event.target===this)closeModal('dm-modal')">
  <div class="modal">
    <h3><i class="fa-solid fa-paper-plane" style="color:var(--purple)"></i>Send DM</h3>
    <div class="form-group"><label>Recipient</label><input id="dm-to" readonly/></div>
    <div class="form-group"><label>Message</label><textarea id="dm-msg" placeholder="Type message..."></textarea></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
      <button class="btn" onclick="closeModal('dm-modal')">Cancel</button>
      <button class="btn primary" onclick="sendDM()">Send</button>
    </div>
  </div>
</div>

<!-- Campaign Posts Modal -->
<div id="posts-modal" class="modal-overlay" onclick="if(event.target===this)closeModal('posts-modal')">
  <div class="modal" style="max-width:700px">
    <h3><i class="fa-solid fa-film" style="color:var(--purple)"></i>Campaign Posts</h3>
    <div id="posts-modal-body"></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px"><button class="btn" onclick="closeModal('posts-modal')">Close</button></div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
const A='';
let editingId=null, dmDiscordId='';

function fmt(n){if(!n)return'0';if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return String(n)}
function timeAgo(d){if(!d)return'\u2014';const s=Math.floor((Date.now()-new Date(d.replace(' ','T')+'Z').getTime())/1000);if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago'}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000)}
function openModal(id){document.getElementById(id).classList.add('open')}
function closeModal(id){document.getElementById(id).classList.remove('open')}
function showTab(id){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));document.getElementById('tab-'+id).classList.add('active');document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));document.getElementById('nav-'+id).classList.add('active');if(id==='users')loadUsers();if(id==='campaigns')loadCampaigns();if(id==='clips')loadClips();if(id==='payouts')loadPayouts()}
async function api(path,opts){const r=await fetch(A+'/api/'+path,opts);if(r.status===401){location.href='/login?next=/admin';return {}}return r.json()}

// Dashboard
async function loadDashboard(){
  const d=await api('analytics');
  document.getElementById('dash-stats').innerHTML=
    '<div class="stat-card"><div class="stat-label"><i class="fa-solid fa-users"></i>Total Users</div><div class="stat-value">'+fmt(d.totalUsers)+'</div><div class="stat-badge green">'+d.verifiedUsers+' verified</div></div>'+
    '<div class="stat-card"><div class="stat-label"><i class="fa-solid fa-film"></i>Total Clips</div><div class="stat-value purple">'+fmt(d.totalClips)+'</div><div class="stat-badge green">'+d.approvedClips+' approved</div></div>'+
    '<div class="stat-card"><div class="stat-label"><i class="fa-solid fa-eye"></i>Total Views</div><div class="stat-value blue">'+fmt(d.totalViews)+'</div></div>'+
    '<div class="stat-card"><div class="stat-label"><i class="fa-solid fa-wallet"></i>Total Paid</div><div class="stat-value green">$'+fmt(d.totalPaid)+'</div></div>'+
    '<div class="stat-card"><div class="stat-label"><i class="fa-solid fa-clock-rotate-left"></i>Pending Balance</div><div class="stat-value amber">$'+fmt(d.totalBalance)+'</div></div>'+
    '<div class="stat-card"><div class="stat-label"><i class="fa-solid fa-bullhorn"></i>Active Campaigns</div><div class="stat-value purple">'+d.activeCampaigns+'</div><div class="stat-badge purple">Live</div></div>'+
    '<div class="stat-card"><div class="stat-label"><i class="fa-solid fa-headset"></i>Open Tickets</div><div class="stat-value red">'+d.openTickets+'</div></div>'+
    (d.platformStats||[]).map(p=>'<div class="stat-card"><div class="stat-label"><i class="fa-brands fa-'+(p.platform==='tiktok'?'tiktok':p.platform==='instagram'?'instagram':'youtube')+'"></i>'+p.platform.charAt(0).toUpperCase()+p.platform.slice(1)+'</div><div class="stat-value">'+p.count+' accounts</div><div class="stat-badge blue">'+fmt(p.total_followers)+' followers</div></div>').join('');
}

// Users
let allUsers=[];
async function loadUsers(){
  allUsers=await api('users');
  renderUsers(allUsers);
  document.getElementById('clips-count').textContent=allUsers.reduce((s,u)=>s+(u.clips_total||0),0);
}
function renderUsers(users){
  document.getElementById('users-tbody').innerHTML=users.map(u=>'<tr><td><strong>'+u.discord_tag+'</strong><br><span style="color:var(--muted);font-size:10px">'+u.discord_id+'</span></td><td>'+(u.verified?'<span class="badge green">YES</span>':'<span class="badge red">NO</span>')+'</td><td>'+(u.account_count||0)+'/3</td><td>'+fmt((u.accounts||[]).reduce((s,a)=>s+(a.follower_count||0),0))+'</td><td>$'+(u.balance||0).toFixed(2)+'</td><td><div class="btn-group"><button class="btn" onclick="viewUser(\\''+u.discord_id+'\\')">View</button><button class="btn" onclick="openDM(\\''+u.discord_id+'\\',\\''+u.discord_tag.replace(/'/g,"\\\\'")+'\\')">DM</button></div></td></tr>').join('')||'<tr><td colspan="6" class="empty">No users yet</td></tr>';
}
function filterUsers(q){const f=allUsers.filter(u=>(u.discord_tag+' '+u.discord_id).toLowerCase().includes(q.toLowerCase()));renderUsers(f)}
async function viewUser(id){
  const d=await api('users/'+id);
  const u=d.user,p=d.payment||{};
  document.getElementById('user-modal-body').innerHTML=
    '<div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--line)"><div style="width:48px;height:48px;border-radius:12px;background:var(--purple-s);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:var(--purple)">'+u.discord_tag.charAt(0)+'</div><div><div style="font-weight:700">'+u.discord_tag+'</div><div style="color:var(--muted);font-size:11px">'+u.discord_id+'</div></div></div>'+
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px"><div style="padding:12px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid var(--line)"><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em">Balance</div><div style="font-size:18px;font-weight:700;color:var(--amber)">$'+(p.balance||0).toFixed(2)+'</div></div><div style="padding:12px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid var(--line)"><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em">Paid</div><div style="font-size:18px;font-weight:700;color:var(--green)">$'+(p.total_paid||0).toFixed(2)+'</div></div><div style="padding:12px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid var(--line)"><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em">Clips</div><div style="font-size:18px;font-weight:700">'+(d.clips||[]).length+'</div></div></div>'+
    '<div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Connected Accounts</div>'+
    (d.accounts.length>0?d.accounts.map(a=>{
      const url=a.platform==='tiktok'?'https://tiktok.com/@'+a.username:a.platform==='instagram'?'https://instagram.com/'+a.username:'https://youtube.com/@'+a.username;
      const icon=a.platform==='tiktok'?'fa-brands fa-tiktok':a.platform==='instagram'?'fa-brands fa-instagram':'fa-brands fa-youtube';
      const color=a.platform==='tiktok'?'#ff0050':a.platform==='instagram'?'#e4405f':'#ff0000';
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid var(--line);margin-bottom:6px;font-size:12px"><span><i class="'+icon+'" style="color:'+color+';margin-right:6px"></i><strong style="text-transform:capitalize">'+a.platform+'</strong> @'+a.username+' \u00b7 '+fmt(a.follower_count)+' followers</span><div style="display:flex;align-items:center;gap:6px">'+(a.verified?'<span class="badge green">Verified</span>':'<span class="badge amber">Unverified</span>')+'<a href="'+url+'" target="_blank" class="btn" style="text-decoration:none;font-size:10px;padding:4px 8px"><i class="fa-solid fa-external-link"></i> Visit</a></div></div>';
    }).join(''):'<div class="empty" style="padding:16px">No connected accounts</div>')+
    '<div style="display:flex;gap:8px;margin-top:14px"><button class="btn success" onclick="adjustBal(\\''+id+'\\',10)">+$10</button><button class="btn success" onclick="adjustBal(\\''+id+'\\',50)">+$50</button><button class="btn danger" onclick="adjustBal(\\''+id+'\\',-10)">-$10</button></div>';
  openModal('user-modal');
}
async function adjustBal(id,amt){const r=prompt('Reason:',amt>0?'Bonus':'Correction');if(!r)return;await api('users/'+id+'/balance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:amt,reason:r})});toast('Balance updated');viewUser(id)}
function openDM(id,tag){dmDiscordId=id;document.getElementById('dm-to').value=tag;document.getElementById('dm-msg').value='';openModal('dm-modal')}
async function sendDM(){const msg=document.getElementById('dm-msg').value;if(!msg)return;await api('users/'+dmDiscordId+'/dm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});toast('DM sent');closeModal('dm-modal')}

// Campaigns
let allCampaigns=[];
async function loadCampaigns(){
  allCampaigns=await api('campaigns');
  renderCampaigns();
}
function renderCampaigns(){
  document.getElementById('campaigns-grid').innerHTML=allCampaigns.map(c=>{
    const isActive=c.status==='active';
    return '<div class="campaign-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span class="badge '+(isActive?'green':'red')+'">'+c.status.toUpperCase()+'</span><span style="font-size:11px;color:var(--muted)">'+timeAgo(c.created_at)+'</span></div><h3>'+c.title+'</h3><div class="campaign-meta">'+c.platforms+' \u00b7 '+c.audiences+' \u00b7 '+c.payout_rate+'</div>'+(c.description?'<p style="font-size:11px;color:var(--muted);margin-bottom:10px">'+c.description.substring(0,120)+'</p>':'')+(c.rules?'<div style="font-size:11px;color:var(--red);margin-bottom:10px">\ud83d\udea8 '+c.rules.substring(0,80)+'</div>':'')+'<div style="display:flex;justify-content:flex-end;gap:6px"><button class="btn" onclick="viewPosts(\\''+c.id+'\\')">Posts</button><button class="btn" onclick="editCampaign(\\''+c.id+'\\')">Edit</button><button class="btn primary" onclick="postToDiscord(\\''+c.id+'\\')">Post to Discord</button>'+(isActive?'<button class="btn danger" onclick="endCampaign(\\''+c.id+'\\')">End</button>':'')+'<button class="btn danger" onclick="deleteCampaign(\\''+c.id+'\\')">Delete</button></div></div>';
  }).join('')||'<div class="empty" style="grid-column:1/-1">No campaigns yet</div>';
}
function openCampaignModal(data){
  editingId=data?data.id:null;
  document.getElementById('campaign-modal-title').textContent=data?'Edit Campaign':'Create Campaign';
  document.getElementById('c-title').value=data?data.title:'';
  document.getElementById('c-desc').value=data?data.description:'';
  document.getElementById('c-platforms').value=data?data.platforms:'tiktok,instagram,youtube';
  document.getElementById('c-audiences').value=data?data.audiences:'English';
  document.getElementById('c-payout').value=data?data.payout_rate:'Up to $0.80 per 1,000 views';
  document.getElementById('c-minviews').value=data?data.min_views:10000;
  document.getElementById('c-rules').value=data?data.rules:'';
  document.getElementById('c-image').value=data?(data.image_url||''):'';
  const dj=data&&data.details_json?JSON.parse(data.details_json):{};
  document.getElementById('c-refs').value=dj.references||'';
  openModal('campaign-modal');
}
async function saveCampaign(){
  const data={
    title:document.getElementById('c-title').value,
    description:document.getElementById('c-desc').value,
    platforms:document.getElementById('c-platforms').value,
    audiences:document.getElementById('c-audiences').value,
    payout_rate:document.getElementById('c-payout').value,
    min_views:parseInt(document.getElementById('c-minviews').value)||10000,
    rules:document.getElementById('c-rules').value,
    image_url:document.getElementById('c-image').value,
    details_json:JSON.stringify({references:document.getElementById('c-refs').value})
  };
  if(editingId){await api('campaigns/'+editingId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});toast('Campaign updated')}
  else{data.created_by='Admin Dashboard';await api('campaigns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});toast('Campaign created')}
  closeModal('campaign-modal');loadCampaigns();
}
async function editCampaign(id){const c=allCampaigns.find(x=>x.id===id);if(c)openCampaignModal(c)}
async function endCampaign(id){if(!confirm('End this campaign?'))return;await api('campaigns/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'ended'})});toast('Campaign ended');loadCampaigns()}
async function deleteCampaign(id){if(!confirm('Delete this campaign?'))return;await api('campaigns/'+id,{method:'DELETE'});toast('Campaign deleted');loadCampaigns()}
async function postToDiscord(id){toast('Posting to Discord...','info');const r=await api('campaigns/'+id+'/post-to-discord',{method:'POST'});if(r.success){toast('Campaign posted to Discord channel!')}else{toast('Failed to post: '+(r.error||'Unknown error'),'danger')}}

// Campaign Posts
async function viewPosts(cid){
  const[posts,stats]=await Promise.all([api('campaigns/'+cid+'/posts'),api('campaigns/'+cid+'/stats')]);
  const c=allCampaigns.find(x=>x.id===cid);
  let html='<div style="margin-bottom:16px"><strong>'+(c?c.title:'Campaign')+'</strong></div>';
  html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">';
  html+='<div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid var(--line);text-align:center"><div style="font-size:9px;color:var(--muted);text-transform:uppercase">Total</div><div style="font-size:18px;font-weight:700">'+stats.totalPosts+'</div></div>';
  html+='<div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid var(--line);text-align:center"><div style="font-size:9px;color:var(--muted);text-transform:uppercase">Pending</div><div style="font-size:18px;font-weight:700;color:var(--amber)">'+stats.pendingPosts+'</div></div>';
  html+='<div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid var(--line);text-align:center"><div style="font-size:9px;color:var(--muted);text-transform:uppercase">Verified</div><div style="font-size:18px;font-weight:700;color:var(--green)">'+stats.verifiedPosts+'</div></div>';
  html+='<div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid var(--line);text-align:center"><div style="font-size:9px;color:var(--muted);text-transform:uppercase">Views</div><div style="font-size:18px;font-weight:700;color:var(--blue)">'+fmt(stats.totalViews)+'</div></div>';
  html+='</div>';
  if(stats.verifiedPosts>0&&stats.totalCredited<stats.verifiedPosts){
    html+='<button class="btn success" onclick="creditAll(\\''+cid+'\\')" style="margin-bottom:16px">\ud83d\udcb0 Credit All Verified ($'+stats.totalEarnings.toFixed(2)+')</button>';
  }
  if(posts.length>0){
    html+='<table><thead><tr><th>User</th><th>Platform</th><th>URL</th><th>Views</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
    posts.forEach(p=>{
      const statusBadge=p.status==='verified'?'<span class="badge green">VERIFIED</span>':p.status==='rejected'?'<span class="badge red">REJECTED</span>':'<span class="badge amber">PENDING</span>';
      let actions='';if(p.status==='pending'){actions='<div class="btn-group"><button class="btn success" onclick="verifyPost(\\''+cid+'\\',\\''+p.id+'\\')">Verify</button><button class="btn danger" onclick="rejectPost(\\''+cid+'\\',\\''+p.id+'\\')">Reject</button></div>'}else if(p.status==='verified'&&!p.credited){actions='<span style="color:var(--amber);font-size:11px">Awaiting credit</span>'}else if(p.credited){actions='<span style="color:var(--green);font-size:11px">Credited \u2713</span>'}
      html+='<tr><td><strong>'+p.discord_tag+'</strong></td><td style="text-transform:capitalize">'+p.platform+'</td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><a href="'+p.post_url+'" target="_blank" style="color:var(--blue);text-decoration:none">'+p.post_url+'</a></td><td>'+(p.status==='verified'?fmt(p.views):'\u2014')+'</td><td>'+statusBadge+'</td><td>'+actions+'</td></tr>';
    });
    html+='</tbody></table>';
  }else{html+='<div class="empty">No posts submitted yet</div>'}
  document.getElementById('posts-modal-body').innerHTML=html;
  openModal('posts-modal');
}
async function verifyPost(cid,pid){const v=prompt('Enter verified view count:','0');if(v===null)return;const views=parseInt(v)||0;const c=allCampaigns.find(x=>x.id===cid);let rate=0.0008;if(c&&c.payout_rate){const m=c.payout_rate.match(/\\$(\\d+\\.?\\d*)/);if(m)rate=parseFloat(m[1])/1000}const earnings=Math.round(views*rate*100)/100;await api('campaigns/'+cid+'/posts/'+pid+'/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({views,earnings})});toast('Post verified');viewPosts(cid)}
async function rejectPost(cid,pid){if(!confirm('Reject?'))return;await api('campaigns/'+cid+'/posts/'+pid+'/reject',{method:'POST'});toast('Rejected');viewPosts(cid)}
async function creditAll(cid){if(!confirm('Credit all verified posts?'))return;const r=await api('campaigns/'+cid+'/credit',{method:'POST'});toast('Credited '+r.credited+' posts');viewPosts(cid)}

// Clips
async function loadClips(){
  const clips=await api('clips');
  document.getElementById('clips-tbody').innerHTML=clips.map(c=>'<tr><td>'+c.discord_tag+'</td><td style="text-transform:capitalize">'+c.platform+'</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><a href="'+c.url+'" target="_blank" style="color:var(--blue);text-decoration:none">'+c.url+'</a></td><td>'+fmt(c.views)+'</td><td>'+(c.status==='approved'?'<span class="badge green">APPROVED</span>':c.status==='rejected'?'<span class="badge red">REJECTED</span>':'<span class="badge amber">PENDING</span>')+'</td><td>'+(c.status==='pending'?'<div class="btn-group"><button class="btn success" onclick="approveClip(\\''+c.id+'\\')">Approve</button><button class="btn danger" onclick="rejectClip(\\''+c.id+'\\')">Reject</button></div>':'\u2014')+'</td></tr>').join('')||'<tr><td colspan="6" class="empty">No clips</td></tr>';
}
async function approveClip(id){await api('clips/'+id+'/approve',{method:'POST'});toast('Clip approved');loadClips()}
async function rejectClip(id){await api('clips/'+id+'/reject',{method:'POST'});toast('Clip rejected');loadClips()}

// Payouts
async function loadPayouts(){
  const payouts=await api('payouts');
  document.getElementById('payouts-count').textContent=payouts.filter(p=>p.status==='pending').length;
  document.getElementById('payouts-tbody').innerHTML=payouts.map(p=>'<tr><td>'+p.discord_tag+'</td><td style="font-weight:700">$'+p.amount.toFixed(2)+'</td><td>'+p.method+'</td><td style="color:var(--muted)">'+timeAgo(p.requested_at)+'</td><td>'+(p.status==='approved'?'<span class="badge green">APPROVED</span>':p.status==='rejected'?'<span class="badge red">REJECTED</span>':'<span class="badge amber">PENDING</span>')+'</td><td>'+(p.status==='pending'?'<div class="btn-group"><button class="btn success" onclick="approvePayout(\\''+p.id+'\\')">Approve</button><button class="btn danger" onclick="rejectPayout(\\''+p.id+'\\')">Reject</button></div>':'\u2014')+'</td></tr>').join('')||'<tr><td colspan="6" class="empty">No payouts</td></tr>';
}
async function approvePayout(id){await api('payouts/'+id+'/approve',{method:'POST'});toast('Payout approved');loadPayouts()}
async function rejectPayout(id){if(!confirm('Reject and refund?'))return;await api('payouts/'+id+'/reject',{method:'POST'});toast('Payout rejected');loadPayouts()}

loadDashboard();
</script>
</body>
</html>`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAGES — / is the public website, /admin is the protected dashboard
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const WEB_DIR = path.join(process.cwd(), "web", "public");

// Serve the embedded CLIPTIC logo (never depends on an external URL).
app.get("/logo.png", (_req, res) => {
  res.type("png");
  res.send(Buffer.from(LOGO_DATA_URI.split(",")[1] || "", "base64"));
});

// Swappable frontend — the friend's future UI replaces web/public/*.
app.use(express.static(WEB_DIR));

async function pageGuard(req: any, res: any, next: any) {
  try {
    const session = await getSession(req);
    if (session?.user?.role === "admin") return next();
    if (session) return res.redirect("/dashboard");
    return res.redirect("/login?next=/admin");
  } catch {
    return res.redirect("/login?next=/admin");
  }
}

async function dashboardGuard(req: any, res: any, next: any) {
  try {
    const session = await getSession(req);
    if (session) return next();
    return res.redirect("/login?next=/dashboard");
  } catch {
    return res.redirect("/login?next=/dashboard");
  }
}

const sendPage = (file: string) => (_req: any, res: any) => {
  const full = path.join(WEB_DIR, file);
  if (fs.existsSync(full)) return res.sendFile(full);
  res.status(404).type("html").send("<h1>Page not found</h1>");
};

app.get("/", sendPage("index.html"));
app.get("/login", sendPage("login.html"));
app.get("/auth", (_req, res) => res.redirect("/login"));
app.get("/dashboard", dashboardGuard, sendPage("dashboard.html"));
app.get("/admin", pageGuard, (_req, res) => {
  res.type("html").send(HTML);
});
app.get("/admin/", pageGuard, (_req, res) => {
  res.type("html").send(HTML);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n\u{1F3AF} CLIPTIC running — website at http://localhost:${PORT} · admin at /admin\n`);
});

export default app;
