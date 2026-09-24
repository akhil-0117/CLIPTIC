// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEB JSON API — everything the website (and a future swapped-in UI) needs.
// Stable contract: all routes live under /api/web/*, JSON in / JSON out,
// session auth via the Better Auth cookie. Frontend files in web/public
// can be replaced entirely without touching this router.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Router, Response } from "express";
import {
  auth,
  toWebHeaders,
  requireUser,
  requireAdmin,
  getSession,
  ensureClipticUser,
  discordConfigured,
  googleConfigured,
  adminSignupAllowed,
  AuthedRequest,
} from "./auth";
import { config } from "../config";
import {
  getActiveCampaigns,
  getCampaign,
  getCampaignStats,
  hasUserPostedInCampaign,
  submitCampaignPost,
  joinCampaign,
  addSocialAccount,
  getSocialAccounts,
  getSocialAccountByPlatform,
  verifySocialAccount,
  removeSocialAccount,
  updateSocialMetrics,
  setUserVerified,
  getPayment,
  addPaymentMethod,
  createPayoutRequest,
  getPaymentHistory,
  getEarningsHistory,
  addNotification,
  getUnreadNotifications,
  markNotificationsRead,
  getMyCampaignPosts,
  getUserByEmail,
  setUserRole,
} from "../database";
import {
  generateVerificationCode,
  verifyBio,
  fetchPlatformStats,
} from "../utils/bioScraper";

const router = Router();

function parseDetails(raw: string | undefined): any {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function detectPlatform(url: string): string | null {
  const u = url.toLowerCase();
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  return null;
}

/** Best-effort: pull the @username out of a post URL (null when the format hides it). */
function extractUrlUsername(url: string, platform: string): string | null {
  try {
    const parsed = new URL(url);
    if (platform === "tiktok") {
      const m = parsed.pathname.match(/\/@([\w.\-]+)/);
      return m ? m[1] : null;
    }
    if (platform === "youtube") {
      const m = parsed.pathname.match(/\/@([\w.\-]+)/) || parsed.pathname.match(/\/channel\/([\w.\-]+)/);
      return m ? m[1] : null;
    }
    if (platform === "instagram") {
      const m = parsed.pathname.match(/^\/([A-Za-z0-9._]+)\//);
      if (!m) return null;
      const reserved = ["p", "reel", "reels", "tv", "explore", "stories", "direct", "about", "developer"];
      return reserved.includes(m[1].toLowerCase()) ? null : m[1];
    }
    return null;
  } catch {
    return null;
  }
}

function profileUrlFor(platform: string, username: string): string {
  if (platform === "tiktok") return `https://www.tiktok.com/@${username}`;
  if (platform === "instagram") return `https://www.instagram.com/${username}/`;
  return `https://www.youtube.com/@${username}`;
}

function campaignOut(c: any) {
  return {
    ...c,
    platformList: (c.platforms || "").split(",").map((p: string) => p.trim()).filter(Boolean),
    details: parseDetails(c.details_json),
  };
}

// ── Public routes (no session required) ───────────────────────────

router.get("/config", (_req, res) => {
  res.json({
    name: "CLIPTIC NETWORK",
    providers: { discord: discordConfigured(), google: googleConfigured() },
    adminSignup: adminSignupAllowed(), // "open" | "code" | "closed"
    verification: {
      minFollowers: config.verification.minFollowers,
      minAvgViews: config.verification.minAvgViews,
    },
    minPayout: config.payment.minPayoutThreshold,
  });
});

router.get("/stats", (_req, res) => {
  const q = (sql: string) => (require("../database").default.prepare(sql).get() as any)?.c || 0;
  res.json({
    activeCampaigns: q("SELECT COUNT(*) as c FROM campaigns WHERE status = 'active'"),
    creators: q("SELECT COUNT(*) as c FROM users"),
    posts: q("SELECT COUNT(*) as c FROM campaign_posts"),
    paidOut: q("SELECT COALESCE(SUM(total_paid), 0) as c FROM payments"),
    verifiedClippers: q("SELECT COUNT(*) as c FROM users WHERE verified = 1"),
  });
});

router.get("/campaigns", (_req, res) => {
  const campaigns = (getActiveCampaigns() as any[]).map((c) => {
    const stats = getCampaignStats(c.id);
    return { ...campaignOut(c), posts: stats.totalPosts, participants: 0 };
  });
  res.json(campaigns);
});

router.get("/campaigns/:id", async (req, res) => {
  const campaign = getCampaign(req.params.id) as any;
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  const session = await getSession(req);
  let myPost: any = null;
  if (session) {
    myPost = (require("../database").default
      .prepare("SELECT * FROM campaign_posts WHERE campaign_id = ? AND user_id = ?")
      .get(campaign.id, session.user.id) as any) || null;
  }
  res.json({ ...campaignOut(campaign), stats: getCampaignStats(campaign.id), myPost });
});

router.get("/leaderboard", (_req, res) => {
  const rows = require("../database").default
    .prepare(
      `SELECT * FROM (
         SELECT u.id, u.discord_tag as name, u.verified,
           COALESCE((SELECT SUM(earnings) FROM clip_submissions WHERE user_id = u.id AND status = 'approved'), 0) +
           COALESCE((SELECT SUM(earnings) FROM campaign_posts WHERE user_id = u.id AND status = 'verified'), 0) as total_earnings,
           COALESCE((SELECT SUM(views) FROM clip_submissions WHERE user_id = u.id AND status = 'approved'), 0) +
           COALESCE((SELECT SUM(views) FROM campaign_posts WHERE user_id = u.id AND status = 'verified'), 0) as total_views
         FROM users u
       ) t WHERE t.total_earnings > 0
       ORDER BY t.total_earnings DESC LIMIT 10`
    )
    .all();
  res.json(rows);
});

// ── Auth extras (Better Auth handles /api/auth/* itself) ──────────

router.post("/auth/register-admin", async (req, res) => {
  try {
    const { name, email, password, code } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const mode = adminSignupAllowed();
    if (mode === "closed") {
      return res.status(403).json({ error: "Admin sign-up is closed. Ask an existing admin for access." });
    }
    if (mode === "code" && code !== config.web.adminSignupCode) {
      return res.status(403).json({ error: "Invalid admin invite code" });
    }

    const headers = toWebHeaders(req.headers);
    const elevate = (user: any, response?: any) => {
      const cliptic = ensureClipticUser(user);
      setUserRole(cliptic.id, "admin");
      if (response) {
        const cookies = typeof response.headers?.getSetCookie === "function" ? response.headers.getSetCookie() : [];
        if (cookies.length) res.setHeader("Set-Cookie", cookies as any);
      }
      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: "admin" } });
    };

    const response = await auth.api.signUpEmail({
      body: { name, email, password },
      headers,
      asResponse: true,
    } as any);

    if (response.ok) {
      const data = (await response.json()) as any;
      return elevate(data.user, response);
    }

    // Account already exists — allow elevation when they prove ownership
    // with the right password AND a valid invite code (mode "code").
    const err = (await response.json().catch(() => ({}))) as any;
    const alreadyExists = /exist/i.test(String(err?.message || "")) || response.status === 422;
    if (alreadyExists && mode === "code" && code === config.web.adminSignupCode) {
      const signin = await auth.api.signInEmail({ body: { email, password }, headers, asResponse: true } as any);
      if (signin.ok) {
        const data = (await signin.json()) as any;
        const existingUser = getUserByEmail(email);
        if (existingUser) setUserRole(existingUser.id, "admin");
        const cookies = typeof signin.headers?.getSetCookie === "function" ? signin.headers.getSetCookie() : [];
        if (cookies.length) res.setHeader("Set-Cookie", cookies as any);
        return res.json({ success: true, user: { id: data.user?.id, email, role: "admin" } });
      }
    }
    return res.status(response.status || 400).json({ error: err?.message || "Sign-up failed" });
  } catch (e: any) {
    console.error("[Web] register-admin failed:", e?.message || e);
    res.status(500).json({ error: e?.message || "Sign-up failed" });
  }
});

// ── Signed-in user routes ─────────────────────────────────────────

router.get("/me", requireUser, (req, res) => {
  const { authUser, user } = (req as AuthedRequest).session!;
  const payment: any = getPayment(user.id) || { balance: 0, total_paid: 0, method: "NONE", wallet_address: "" };
  res.json({
    id: user.id,
    name: user.discord_tag,
    email: authUser.email || user.email || null,
    image: authUser.image || null,
    verified: user.verified === 1,
    role: user.role || "user",
    balance: payment.balance || 0,
    totalPaid: payment.total_paid || 0,
    method: payment.method || "NONE",
    wallet: payment.wallet_address || "",
    accounts: getSocialAccounts(user.id),
    unread: getUnreadNotifications(user.id).length,
    isWebUser: String(user.discord_id || "").startsWith("web_"),
  });
});

// Connected social accounts
router.post("/accounts", requireUser, (req, res) => {
  const { user } = (req as AuthedRequest).session!;
  const platform = String(req.body?.platform || "").toLowerCase();
  const username = String(req.body?.username || "").replace(/^@+/, "").trim();
  if (!["tiktok", "instagram", "youtube"].includes(platform)) {
    return res.status(400).json({ error: "Platform must be tiktok, instagram or youtube" });
  }
  if (!/^[A-Za-z0-9._-]{1,50}$/.test(username)) {
    return res.status(400).json({ error: "That doesn't look like a valid username" });
  }
  const code = generateVerificationCode();
  addSocialAccount(user.id, platform, username, code, profileUrlFor(platform, username));
  addNotification(user.id, "account", `Connected ${platform} @${username} — add code ${code} to your bio to verify`);
  res.json({ success: true, platform, username, code, profileUrl: profileUrlFor(platform, username) });
});

router.post("/accounts/:platform/verify", requireUser, async (req, res) => {
  const { user } = (req as AuthedRequest).session!;
  const platform = String(req.params.platform).toLowerCase();
  const account: any = getSocialAccountByPlatform(user.id, platform);
  if (!account) return res.status(404).json({ error: "No pending account for that platform" });
  if (account.verified) return res.json({ success: true, verified: true, already: true });

  const codeOk = await verifyBio(platform, account.username, account.verification_code || "");
  if (!codeOk) {
    return res.json({
      success: false,
      verified: false,
      error: "Code not found in your bio yet. Add it, save your bio, then try again.",
    });
  }
  verifySocialAccount(user.id, platform, account.username);
  const stats = await fetchPlatformStats(platform, account.username);
  if (stats) updateSocialMetrics(user.id, platform, stats.followers, stats.avgViews);

  const followers = stats?.followers ?? account.follower_count ?? 0;
  const avgViews = stats?.avgViews ?? account.avg_views ?? 0;
  const meetsRequirements =
    followers >= config.verification.minFollowers && avgViews >= config.verification.minAvgViews;

  let serverVerified = false;
  if (meetsRequirements && user.verified !== 1) {
    setUserVerified(user.discord_id);
    serverVerified = true;
  }
  addNotification(
    user.id,
    "account",
    `${platform} @${account.username} verified — ${followers} followers, ${avgViews} avg views`
  );
  res.json({ success: true, verified: true, stats: stats || null, meetsRequirements, serverVerified });
});

router.post("/accounts/:platform/sync", requireUser, async (req, res) => {
  const { user } = (req as AuthedRequest).session!;
  const platform = String(req.params.platform).toLowerCase();
  const account: any = getSocialAccountByPlatform(user.id, platform);
  if (!account) return res.status(404).json({ error: "Account not connected" });
  const stats = await fetchPlatformStats(platform, account.username);
  if (!stats) return res.status(502).json({ error: "Could not reach the platform right now. Try again shortly." });
  updateSocialMetrics(user.id, platform, stats.followers, stats.avgViews);
  res.json({ success: true, stats });
});

router.delete("/accounts/:platform", requireUser, (req, res) => {
  const { user } = (req as AuthedRequest).session!;
  removeSocialAccount(user.id, String(req.params.platform).toLowerCase());
  res.json({ success: true });
});

// My campaign posts
router.get("/posts", requireUser, (req, res) => {
  const { user } = (req as AuthedRequest).session!;
  res.json(getMyCampaignPosts(user.id));
});

router.post("/campaigns/:id/posts", requireUser, (req, res) => {
  const { user } = (req as AuthedRequest).session!;
  const campaign = getCampaign(String(req.params.id)) as any;
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  if (campaign.status !== "active") return res.status(400).json({ error: "This campaign is no longer active" });
  if (hasUserPostedInCampaign(campaign.id, user.id)) {
    return res.status(409).json({ error: "You already submitted a post for this campaign" });
  }

  const url = String(req.body?.url || "").trim();
  if (!/^https?:\/\/\S{10,}$/i.test(url)) {
    return res.status(400).json({ error: "Paste a valid link to your reel/video" });
  }
  const platform = detectPlatform(url);
  if (!platform) {
    return res.status(400).json({ error: "Unsupported link — use a TikTok, Instagram or YouTube link" });
  }
  const campaignPlatforms = String(campaign.platforms || "").toLowerCase();
  if (!campaignPlatforms.includes(platform)) {
    return res.status(400).json({ error: `This campaign does not include ${platform} posts` });
  }
  const account: any = getSocialAccountByPlatform(user.id, platform);
  if (!account || !account.verified) {
    return res.status(403).json({
      error: `Connect and verify your ${platform} account first (Connect tab), then submit again.`,
    });
  }
  const urlUsername = extractUrlUsername(url, platform);
  if (urlUsername && urlUsername.toLowerCase() !== String(account.username).toLowerCase()) {
    return res.status(403).json({
      error: `This link belongs to @${urlUsername}, but your connected ${platform} account is @${account.username}. Submit posts from your own account.`,
    });
  }

  const postId = submitCampaignPost(campaign.id, user.id, url, platform, account.username);
  try {
    joinCampaign(campaign.id, user.id);
  } catch {}
  addNotification(
    user.id,
    "campaign_post",
    `Your post for "${campaign.title}" was submitted and is pending admin verification`
  );
  res.json({ success: true, id: postId, status: "pending", platform });
});

// Earnings + payouts
router.get("/earnings", requireUser, (req, res) => {
  const { user } = (req as AuthedRequest).session!;
  const payment: any = getPayment(user.id) || { balance: 0, total_paid: 0 };
  res.json({
    balance: payment.balance || 0,
    totalPaid: payment.total_paid || 0,
    history: getEarningsHistory(user.id),
  });
});

router.get("/payouts", requireUser, (req, res) => {
  const { user } = (req as AuthedRequest).session!;
  res.json(getPaymentHistory(user.id));
});

router.post("/payouts", requireUser, (req, res) => {
  const { user } = (req as AuthedRequest).session!;
  const amount = Math.round((parseFloat(req.body?.amount) || 0) * 100) / 100;
  const method = String(req.body?.method || "").toUpperCase();
  const wallet = String(req.body?.wallet || "").trim();

  if (amount <= 0) return res.status(400).json({ error: "Enter an amount to withdraw" });
  if (amount < config.payment.minPayoutThreshold) {
    return res.status(400).json({ error: `Minimum payout is $${config.payment.minPayoutThreshold.toFixed(2)}` });
  }
  const payment: any = getPayment(user.id);
  const balance = payment?.balance || 0;
  if (amount > balance) return res.status(400).json({ error: `Insufficient balance (you have $${balance.toFixed(2)})` });

  const existingMethod = payment?.method && payment.method !== "NONE" ? payment.method : null;
  const finalMethod = method || existingMethod;
  const finalWallet = payment?.wallet_address || wallet;
  if (!finalMethod || !finalWallet) {
    return res.status(400).json({ error: "Add a payout method and wallet address first" });
  }
  if (!existingMethod || wallet) addPaymentMethod(user.id, finalMethod, finalWallet);

  createPayoutRequest(user.id, amount); // deducts from balance, records the request
  addNotification(user.id, "payout", `Withdrawal of $${amount.toFixed(2)} to ${finalMethod} requested — pending admin approval`);
  res.json({ success: true, balance: balance - amount });
});

// Notifications
router.get("/notifications", requireUser, (req, res) => {
  const { user } = (req as AuthedRequest).session!;
  res.json({
    unread: getUnreadNotifications(user.id).length,
    items: require("../database").default
      .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
      .all(user.id),
  });
});

router.post("/notifications/read", requireUser, (req, res) => {
  const { user } = (req as AuthedRequest).session!;
  markNotificationsRead(user.id);
  res.json({ success: true });
});

// ── Admin-only JSON (handy for the website's admin chip) ──────────

router.get("/admin/pending", requireAdmin, (req, res) => {
  const db = require("../database").default;
  res.json({
    posts: db.prepare("SELECT COUNT(*) as c FROM campaign_posts WHERE status = 'pending'").get(),
    payouts: db.prepare("SELECT COUNT(*) as c FROM payout_requests WHERE status = 'pending'").get(),
    clips: db.prepare("SELECT COUNT(*) as c FROM clip_submissions WHERE status = 'pending'").get(),
  });
});

export default router;
