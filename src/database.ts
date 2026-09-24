import Database, { Database as DatabaseType } from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(__dirname, "..", "cliptic.db");
const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// Initialize tables
function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      discord_id TEXT UNIQUE NOT NULL,
      discord_tag TEXT NOT NULL,
      verified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS social_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      username TEXT NOT NULL,
      profile_url TEXT,
      verification_code TEXT,
      verified INTEGER DEFAULT 0,
      follower_count INTEGER DEFAULT 0,
      avg_views INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, platform)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      method TEXT NOT NULL DEFAULT 'NONE',
      wallet_address TEXT DEFAULT '',
      balance REAL DEFAULT 0.0,
      total_paid REAL DEFAULT 0.0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS payout_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      requested_at TEXT DEFAULT (datetime('now')),
      processed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS clip_submissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT DEFAULT '',
      views INTEGER DEFAULT 0,
      earnings REAL DEFAULT 0.0,
      status TEXT DEFAULT 'pending',
      reviewed_by TEXT,
      submitted_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS earnings_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      source TEXT DEFAULT 'clip',
      clip_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      platforms TEXT NOT NULL DEFAULT 'tiktok,instagram,youtube',
      audiences TEXT DEFAULT 'English',
      payout_rate TEXT DEFAULT 'Up to $0.80 per 1,000 views',
      min_views INTEGER DEFAULT 10000,
      rules TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_by TEXT NOT NULL,
      image_url TEXT DEFAULT '',
      details_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaign_members (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT DEFAULT 'joined',
      joined_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(campaign_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS campaign_posts (
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
    );

  `);

  // Migration: track which campaigns have been posted to the campaign channel
  try {
    db.exec("ALTER TABLE campaigns ADD COLUMN posted_to_channel INTEGER DEFAULT 0");
  } catch {}
  // Migration: campaign image + details
  try {
    db.exec("ALTER TABLE campaigns ADD COLUMN image_url TEXT DEFAULT ''");
  } catch {}
  try {
    db.exec("ALTER TABLE campaigns ADD COLUMN details_json TEXT DEFAULT '{}'" );
  } catch {}
  try {
    db.exec("ALTER TABLE campaigns DROP COLUMN server_invite");
  } catch {}
  try {
    db.exec("ALTER TABLE campaigns DROP COLUMN guild_id");
  } catch {}
  // Migration: campaign_posts platform_username
  try {
    db.exec("ALTER TABLE campaign_posts ADD COLUMN platform_username TEXT DEFAULT ''");
  } catch {}
  // Migration: web identity — links a CLIPTIC user to a web (Better Auth) login
  try {
    db.exec("ALTER TABLE users ADD COLUMN auth_id TEXT");
  } catch {}
  try {
    db.exec("ALTER TABLE users ADD COLUMN email TEXT");
  } catch {}
  try {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  } catch {}
  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id)");
  } catch {}

  // Better Auth tables — required for web sign-in (Discord/Google/email + admin
  // passwords). Better Auth does NOT auto-create these; without them every
  // /api/auth/* call fails with "Database schema mismatch".
  db.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      emailVerified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      expiresAt INTEGER NOT NULL,
      token TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      userId TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      userId TEXT NOT NULL,
      accessToken TEXT,
      refreshToken TEXT,
      idToken TEXT,
      accessTokenExpiresAt INTEGER,
      refreshTokenExpiresAt INTEGER,
      scope TEXT,
      password TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_user_email ON user(email);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_session_token ON session(token);
    CREATE INDEX IF NOT EXISTS idx_session_user ON session(userId);
    CREATE INDEX IF NOT EXISTS idx_account_user ON account(userId);
  `);
}

/**
 * Drop all tables and recreate — fresh start.
 */
export function resetDatabase() {
  console.log("[DB] Resetting database for fresh start...");
  db.exec(`
    DROP TABLE IF EXISTS campaign_posts;
    DROP TABLE IF EXISTS campaign_members;
    DROP TABLE IF EXISTS campaigns;
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS earnings_history;
    DROP TABLE IF EXISTS clip_submissions;
    DROP TABLE IF EXISTS payout_requests;
    DROP TABLE IF EXISTS tickets;
    DROP TABLE IF EXISTS payments;
    DROP TABLE IF EXISTS social_accounts;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS session;
    DROP TABLE IF EXISTS account;
    DROP TABLE IF EXISTS verification;
    DROP TABLE IF EXISTS user;
  `);
  initTables();
  console.log("[DB] Database reset complete.");
}

initTables();

// ---- User Operations ----

export function getOrCreateUser(discordId: string, discordTag: string) {
  let user = db.prepare("SELECT * FROM users WHERE discord_id = ?").get(discordId) as any;
  if (!user) {
    const id = `user_${discordId}`;
    db.prepare("INSERT INTO users (id, discord_id, discord_tag) VALUES (?, ?, ?)").run(id, discordId, discordTag);
    user = db.prepare("SELECT * FROM users WHERE discord_id = ?").get(discordId);
  }
  return user;
}

export function setUserVerified(discordId: string) {
  db.prepare("UPDATE users SET verified = 1 WHERE discord_id = ?").run(discordId);
}

export function isUserVerified(discordId: string): boolean {
  const user = db.prepare("SELECT verified FROM users WHERE discord_id = ?").get(discordId) as any;
  return user?.verified === 1;
}

// ---- Web Identity Operations ----

export function getUserByAuthId(authId: string) {
  return db.prepare("SELECT * FROM users WHERE auth_id = ?").get(authId) as any;
}

export function getUserByEmail(email: string) {
  return db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email) as any;
}

export function linkUserAuth(userId: string, authId: string, email?: string) {
  db.prepare("UPDATE users SET auth_id = COALESCE(auth_id, ?), email = COALESCE(email, ?) WHERE id = ?").run(authId, email || null, userId);
}

export function createWebUser(authId: string, discordId: string, tag: string, email: string, role: string) {
  const id = `user_${discordId}`;
  db.prepare(
    "INSERT OR IGNORE INTO users (id, discord_id, discord_tag, auth_id, email, role) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, discordId, tag, authId, email || null, role);
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
}

export function setUserRole(userId: string, role: string) {
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
}

export function countAdmins(): number {
  return (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get() as any)?.c || 0;
}

export function getNotifications(userId: string, limit: number = 30) {
  return db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(userId, limit);
}

export function getMyCampaignPosts(userId: string) {
  return db.prepare(
    `SELECT cp.*, c.title as campaign_title, c.status as campaign_status
     FROM campaign_posts cp JOIN campaigns c ON cp.campaign_id = c.id
     WHERE cp.user_id = ? ORDER BY cp.submitted_at DESC`
  ).all(userId);
}

// ---- Social Account Operations ----

export function addSocialAccount(userId: string, platform: string, username: string, verificationCode: string, profileUrl: string) {
  // Remove any existing account for same platform + user
  db.prepare("DELETE FROM social_accounts WHERE user_id = ? AND platform = ?").run(userId, platform);
  const id = `social_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  db.prepare(
    "INSERT INTO social_accounts (id, user_id, platform, username, verification_code, profile_url) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, userId, platform, username, verificationCode, profileUrl);
  return id;
}

export function verifySocialAccount(userId: string, platform: string, username: string) {
  db.prepare(
    "UPDATE social_accounts SET verified = 1, verification_code = NULL WHERE user_id = ? AND platform = ? AND username = ?"
  ).run(userId, platform, username);
}

export function removeSocialAccount(userId: string, platform: string) {
  db.prepare("DELETE FROM social_accounts WHERE user_id = ? AND platform = ?").run(userId, platform);
}

export function getSocialAccounts(userId: string) {
  return db.prepare("SELECT * FROM social_accounts WHERE user_id = ?").all(userId);
}

export function getSocialAccountByPlatform(userId: string, platform: string) {
  return db.prepare("SELECT * FROM social_accounts WHERE user_id = ? AND platform = ?").get(userId, platform);
}

export function updateSocialMetrics(userId: string, platform: string, followerCount: number, avgViews: number) {
  db.prepare(
    "UPDATE social_accounts SET follower_count = ?, avg_views = ? WHERE user_id = ? AND platform = ?"
  ).run(followerCount, avgViews, userId, platform);
}

// ---- Payment Operations ----

export function getPayment(userId: string) {
  return db.prepare("SELECT * FROM payments WHERE user_id = ?").get(userId);
}

export function addPaymentMethod(userId: string, method: string, walletAddress: string) {
  const existing = getPayment(userId) as any;
  if (existing) {
    db.prepare("UPDATE payments SET method = ?, wallet_address = ? WHERE user_id = ?").run(method, walletAddress, userId);
  } else {
    const id = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    db.prepare("INSERT INTO payments (id, user_id, method, wallet_address) VALUES (?, ?, ?, ?)").run(id, userId, method, walletAddress);
  }
}

export function updateBalance(userId: string, amount: number) {
  db.prepare("UPDATE payments SET balance = balance + ? WHERE user_id = ?").run(amount, userId);
}

export function getPaymentHistory(userId: string) {
  return db.prepare("SELECT * FROM payout_requests WHERE user_id = ? ORDER BY requested_at DESC").all(userId);
}

export function createPayoutRequest(userId: string, amount: number) {
  const id = `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  db.prepare("INSERT INTO payout_requests (id, user_id, amount) VALUES (?, ?, ?)").run(id, userId, amount);
  db.prepare("UPDATE payments SET balance = balance - ?, total_paid = total_paid + ? WHERE user_id = ?").run(amount, amount, userId);
  return id;
}

// ---- Ticket Operations ----

export function createTicket(userId: string, channelId: string) {
  const id = `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  db.prepare("INSERT INTO tickets (id, user_id, channel_id) VALUES (?, ?, ?)").run(id, userId, channelId);
  return id;
}

export function closeTicket(channelId: string) {
  db.prepare("UPDATE tickets SET status = 'closed' WHERE channel_id = ?").run(channelId);
}

export function getOpenTicket(channelId: string) {
  return db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'").get(channelId);
}

// ---- Clip Submission Operations ----

export function submitClip(userId: string, platform: string, url: string, description: string) {
  const id = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  db.prepare(
    "INSERT INTO clip_submissions (id, user_id, platform, url, description) VALUES (?, ?, ?, ?, ?)"
  ).run(id, userId, platform, url, description);
  return id;
}

export function reviewClip(clipId: string, status: string, reviewedBy: string) {
  db.prepare(
    "UPDATE clip_submissions SET status = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?"
  ).run(status, reviewedBy, clipId);
}

export function updateClipEarnings(clipId: string, views: number, earnings: number) {
  db.prepare(
    "UPDATE clip_submissions SET views = ?, earnings = ? WHERE id = ?"
  ).run(views, earnings, clipId);
}

export function getClipsByUser(userId: string) {
  return db.prepare("SELECT * FROM clip_submissions WHERE user_id = ? ORDER BY submitted_at DESC").all(userId);
}

export function getPendingClips() {
  return db.prepare("SELECT cs.*, u.discord_tag FROM clip_submissions cs JOIN users u ON cs.user_id = u.id WHERE cs.status = 'pending' ORDER BY cs.submitted_at ASC").all();
}

// ---- Earnings History ----

export function addEarning(userId: string, amount: number, source: string, clipId: string) {
  const id = `earn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  db.prepare(
    "INSERT INTO earnings_history (id, user_id, amount, source, clip_id) VALUES (?, ?, ?, ?, ?)"
  ).run(id, userId, amount, source, clipId);
  updateBalance(userId, amount);
}

export function getEarningsHistory(userId: string) {
  return db.prepare("SELECT * FROM earnings_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20").all(userId);
}

// ---- Leaderboard ----

export function getLeaderboard(limit: number = 10) {
  return db.prepare(
    "SELECT u.discord_id, u.discord_tag, u.id, SUM(cs.earnings) as total_earnings, SUM(cs.views) as total_views, COUNT(cs.id) as clips_count FROM users u LEFT JOIN clip_submissions cs ON u.id = cs.user_id WHERE cs.status = 'approved' GROUP BY u.id ORDER BY total_earnings DESC LIMIT ?"
  ).all(limit);
}

export function getClipperRank(discordId: string) {
  const leaderboard = getLeaderboard(100);
  const idx = leaderboard.findIndex((e: any) => e.discord_id === discordId);
  return idx >= 0 ? idx + 1 : null;
}

// ---- Notifications ----

export function addNotification(userId: string, type: string, message: string) {
  const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  db.prepare(
    "INSERT INTO notifications (id, user_id, type, message) VALUES (?, ?, ?, ?)"
  ).run(id, userId, type, message);
}

export function getUnreadNotifications(userId: string) {
  return db.prepare("SELECT * FROM notifications WHERE user_id = ? AND read = 0 ORDER BY created_at DESC").all(userId);
}

export function markNotificationsRead(userId: string) {
  db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(userId);
}

// ---- Campaign Operations ----

export function createCampaign(title: string, description: string, platforms: string[], audiences: string, payoutRate: string, minViews: number, rules: string, createdBy: string) {
  const id = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  db.prepare(
    "INSERT INTO campaigns (id, title, description, platforms, audiences, payout_rate, min_views, rules, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, title, description, platforms.join(","), audiences, payoutRate, minViews, rules, createdBy);
  return id;
}

export function getCampaign(campaignId: string) {
  return db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId);
}

export function getActiveCampaigns() {
  return db.prepare("SELECT * FROM campaigns WHERE status = 'active' ORDER BY created_at DESC").all();
}

export function updateCampaignDetails(campaignId: string, imageUrl: string, detailsJson: string) {
  db.prepare("UPDATE campaigns SET image_url = ?, details_json = ? WHERE id = ?").run(imageUrl, detailsJson, campaignId);
}

export function joinCampaign(campaignId: string, userId: string) {
  const id = `cmem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  db.prepare(
    "INSERT OR IGNORE INTO campaign_members (id, campaign_id, user_id) VALUES (?, ?, ?)"
  ).run(id, campaignId, userId);
}

export function getCampaignMembers(campaignId: string) {
  return db.prepare("SELECT cm.*, u.discord_tag, u.discord_id FROM campaign_members cm JOIN users u ON cm.user_id = u.id WHERE cm.campaign_id = ?").all(campaignId);
}

export function isCampaignMember(campaignId: string, userId: string) {
  return db.prepare("SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?").get(campaignId, userId);
}

export function getAllCampaigns() {
  return db.prepare("SELECT * FROM campaigns ORDER BY created_at DESC").all();
}

export function getUnpostedCampaigns() {
  return db.prepare("SELECT * FROM campaigns WHERE status = 'active' AND (posted_to_channel = 0 OR posted_to_channel IS NULL)").all();
}

export function markCampaignPosted(campaignId: string) {
  db.prepare("UPDATE campaigns SET posted_to_channel = 1 WHERE id = ?").run(campaignId);
}

export function endCampaign(campaignId: string) {
  db.prepare("UPDATE campaigns SET status = 'ended' WHERE id = ?").run(campaignId);
}

// ---- Campaign Post Operations ----

export function submitCampaignPost(campaignId: string, userId: string, postUrl: string, platform: string, platformUsername: string) {
  const id = `cpost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  db.prepare(
    "INSERT INTO campaign_posts (id, campaign_id, user_id, post_url, platform, platform_username) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, campaignId, userId, postUrl, platform, platformUsername);
  return id;
}

export function getCampaignPosts(campaignId: string) {
  return db.prepare(
    "SELECT cp.*, u.discord_tag, u.discord_id FROM campaign_posts cp JOIN users u ON cp.user_id = u.id WHERE cp.campaign_id = ? ORDER BY cp.submitted_at DESC"
  ).all(campaignId);
}

export function getCampaignPost(postId: string) {
  return db.prepare("SELECT * FROM campaign_posts WHERE id = ?").get(postId);
}

export function verifyCampaignPost(postId: string, views: number, earnings: number, verifiedBy: string) {
  db.prepare(
    "UPDATE campaign_posts SET status = 'verified', views = ?, earnings = ?, verified_by = ?, reviewed_at = datetime('now') WHERE id = ?"
  ).run(views, earnings, verifiedBy, postId);
}

export function rejectCampaignPost(postId: string, verifiedBy: string) {
  db.prepare(
    "UPDATE campaign_posts SET status = 'rejected', verified_by = ?, reviewed_at = datetime('now') WHERE id = ?"
  ).run(verifiedBy, postId);
}

export function creditCampaignPostEarnings(postId: string) {
  const post = db.prepare("SELECT * FROM campaign_posts WHERE id = ?").get(postId) as any;
  if (!post || post.status !== "verified" || post.credited) return false;
  db.prepare("UPDATE campaign_posts SET credited = 1 WHERE id = ?").run(postId);
  // Add earnings to user balance
  const payment = db.prepare("SELECT * FROM payments WHERE user_id = ?").get(post.user_id) as any;
  if (payment) {
    db.prepare("UPDATE payments SET balance = balance + ? WHERE user_id = ?").run(post.earnings, post.user_id);
  } else {
    const payId = `pay_${Date.now()}`;
    db.prepare("INSERT INTO payments (id, user_id, method, wallet_address, balance) VALUES (?, ?, 'NONE', '', ?)").run(payId, post.user_id, post.earnings);
  }
  // Log in earnings history
  const earnId = `earn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  db.prepare("INSERT INTO earnings_history (id, user_id, amount, source) VALUES (?, ?, ?, ?)").run(earnId, post.user_id, post.earnings, `campaign post verified`);
  return true;
}

export function creditAllVerifiedPosts(campaignId: string) {
  const posts = db.prepare("SELECT * FROM campaign_posts WHERE campaign_id = ? AND status = 'verified' AND credited = 0").all(campaignId) as any[];
  let count = 0;
  for (const post of posts) {
    if (creditCampaignPostEarnings(post.id)) count++;
  }
  return count;
}

export function getCampaignStats(campaignId: string) {
  const total = db.prepare("SELECT COUNT(*) as count FROM campaign_posts WHERE campaign_id = ?").get(campaignId) as any;
  const verified = db.prepare("SELECT COUNT(*) as count FROM campaign_posts WHERE campaign_id = ? AND status = 'verified'").get(campaignId) as any;
  const pending = db.prepare("SELECT COUNT(*) as count FROM campaign_posts WHERE campaign_id = ? AND status = 'pending'").get(campaignId) as any;
  const rejected = db.prepare("SELECT COUNT(*) as count FROM campaign_posts WHERE campaign_id = ? AND status = 'rejected'").get(campaignId) as any;
  const totalViews = db.prepare("SELECT COALESCE(SUM(views), 0) as total FROM campaign_posts WHERE campaign_id = ? AND status = 'verified'").get(campaignId) as any;
  const totalEarnings = db.prepare("SELECT COALESCE(SUM(earnings), 0) as total FROM campaign_posts WHERE campaign_id = ? AND status = 'verified'").get(campaignId) as any;
  const totalCredited = db.prepare("SELECT COUNT(*) as count FROM campaign_posts WHERE campaign_id = ? AND credited = 1").get(campaignId) as any;
  return {
    totalPosts: total?.count || 0,
    verifiedPosts: verified?.count || 0,
    pendingPosts: pending?.count || 0,
    rejectedPosts: rejected?.count || 0,
    totalViews: totalViews?.total || 0,
    totalEarnings: totalEarnings?.total || 0,
    totalCredited: totalCredited?.count || 0,
  };
}

export function hasUserPostedInCampaign(campaignId: string, userId: string): boolean {
  const post = db.prepare("SELECT * FROM campaign_posts WHERE campaign_id = ? AND user_id = ?").get(campaignId, userId);
  return !!post;
}

export default db;
