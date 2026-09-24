// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BIO SCRAPER — curl-based HTTP client
// Handles Instagram, TikTok, YouTube
//
// WHY CURL: Instagram/TikTok block Node's TLS fingerprint (undici) with 429s
// and empty bodies, while the same requests succeed through the system curl
// binary. All fetching therefore goes through curl via execFile, with a
// plain fetch() fallback if curl is unavailable.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { execFile } from "child_process";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IG_APP_UA =
  "Instagram 275.0.0.27.98 (iPhone13,3; iOS 17_5; en_US; en-US; scale=3.00; 1170x2532; 458229258) Instagram/275.0.0.27.98";
const IG_APP_ID = "936619743392459";

function esc(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

/**
 * Extract username from a profile URL.
 * Handles ALL formats:
 *   https://www.instagram.com/itznex17?utm_source=qr&stkn=...
 *   https://www.tiktok.com/@username/video/123
 *   https://www.youtube.com/@username
 *   @username
 *   just a plain username
 */
export function extractUsernameFromUrl(input: string, platform: string): string {
  const trimmed = input.trim();

  // Plain username (no URL)
  if (!trimmed.includes("http") && !trimmed.includes("/") && !trimmed.includes(".")) {
    return trimmed.replace(/^@/, "");
  }

  // Try URL parsing
  try {
    let urlStr = trimmed;
    if (!urlStr.startsWith("http")) {
      urlStr = "https://" + urlStr;
    }
    const url = new URL(urlStr);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 1) {
      const username = parts[0].replace(/^@/, "");
      if (/^[\w.]+$/.test(username) && username.length > 0) {
        return username;
      }
    }
  } catch {}

  // Regex fallback for broken URLs
  const patterns = [
    /instagram\.com\/([\w.]+)/i,
    /tiktok\.com\/@([\w.]+)/i,
    /youtube\.com\/@([\w.]+)/i,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1].replace(/^@/, "");
  }

  return trimmed.replace(/^@/, "");
}

export function generateVerificationCode(): string {
  const code = Math.floor(1000 + Math.random() * 9000);
  return `VERIFY-CLIP-${code}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FETCH VIA CURL (bypasses TLS fingerprint blocks)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function curlGet(url: string, headers: Record<string, string>, timeoutMs = 15000): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const args = ["-s", "-m", String(Math.ceil(timeoutMs / 1000)), "-w", "\n__CURL_STATUS__%{http_code}", "-L"];
    for (const [k, v] of Object.entries(headers)) args.push("-H", `${k}: ${v}`);
    args.push(url);

    execFile("curl", args, { maxBuffer: 20 * 1024 * 1024, timeout: timeoutMs + 5000 }, (err, stdout) => {
      if (err && !stdout) {
        resolve({ status: 0, body: "" });
        return;
      }
      const idx = stdout.lastIndexOf("__CURL_STATUS__");
      const body = idx >= 0 ? stdout.slice(0, idx) : stdout;
      const status = idx >= 0 ? parseInt(stdout.slice(idx + "__CURL_STATUS__".length).trim(), 10) || 0 : 0;
      resolve({ status, body });
    });
  });
}

/** curl-first fetch with native fetch fallback. */
async function fetchHtml(url: string, headers: Record<string, string>): Promise<string> {
  const { status, body } = await curlGet(url, headers);
  if (status === 200 && body.length > 0) return body;
  if (status === 429 || status === 403) {
    console.log(`[BioCheck] ${new URL(url).hostname} returned ${status} via curl`);
    return "";
  }
  // curl unavailable or network error — try native fetch as fallback
  try {
    const res = await fetch(url, { headers, redirect: "follow" });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

/**
 * Fetch an Instagram profile via the internal app API.
 * Returns { bio, followers } or null when unavailable.
 */
async function instagramApiProfile(username: string): Promise<{ bio: string; followers: number } | null> {
  const full = await fetchInstagramProfileFull(username);
  return full ? { bio: full.bio, followers: full.followers } : null;
}

/**
 * Full Instagram profile via the internal app API — followers, bio, and
 * per-post view counts (video_views / play_count) summed across recent posts.
 */
export async function fetchInstagramProfileFull(
  username: string
): Promise<{ followers: number; avgViews: number; bio: string } | null> {
  const { status, body } = await curlGet(
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    {
      "User-Agent": IG_APP_UA,
      "X-IG-App-ID": IG_APP_ID,
      "X-Requested-With": "XMLHttpRequest",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
    }
  );
  if (status !== 200 || !body) {
    console.log(`[BioCheck] Instagram i.api status=${status}`);
    return null;
  }
  try {
    const json = JSON.parse(body);
    const user = json?.data?.user;
    if (!user) return null;

    const followers = Number(user?.edge_followed_by?.count ?? 0);

    // Sum REAL view counts across recent posts. Instagram exposes
    // video_views per post; for image posts view_count/play_count may be 0,
    // in which case fall back to like+comment engagement.
    const edges: any[] = user?.edge_owner_to_timeline_media?.edges || [];
    const viewCounts: number[] = [];
    for (const e of edges) {
      const node = e?.node || {};
      const views = Number(node.video_views ?? node.view_count ?? node.play_count ?? 0);
      if (views > 0) {
        viewCounts.push(views);
      } else {
        const likes = Number(node.edge_liked_by?.count ?? node.edge_media_to_like?.count ?? 0);
        const comments = Number(node.edge_media_to_comment?.count ?? 0);
        if (likes + comments > 0) viewCounts.push(likes + comments);
      }
    }
    const avgViews = viewCounts.length > 0 ? Math.round(viewCounts.reduce((s, v) => s + v, 0) / viewCounts.length) : 0;

    console.log(
      `[BioCheck] Instagram profile @${username}: ${followers} followers, ${viewCounts.length} posts sampled, avg views ${avgViews}`
    );

    return { followers, avgViews, bio: String(user.biography || "") };
  } catch (err: any) {
    console.error("[BioCheck] Instagram profile parse failed:", err?.message);
    return null;
  }
}

/**
 * TikTok profile via the web embed page — followers + per-video view counts.
 */
export async function fetchTikTokProfileFull(
  username: string
): Promise<{ followers: number; avgViews: number } | null> {
  const html = await fetchHtml(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
    "User-Agent": DESKTOP_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  });
  if (!html) return null;

  let followers = 0;
  const fm = html.match(/"followerCount"\s*:\s*(\d+)/);
  if (fm) followers = parseInt(fm[1], 10);

  const viewCounts: number[] = [];
  const re = /"playCount"\s*:\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    viewCounts.push(parseInt(m[1], 10));
    if (viewCounts.length >= 12) break;
  }
  const avgViews = viewCounts.length > 0 ? Math.round(viewCounts.reduce((s, v) => s + v, 0) / viewCounts.length) : 0;

  if (followers === 0 && viewCounts.length === 0) return null;
  console.log(`[BioCheck] TikTok profile @${username}: ${followers} followers, ${viewCounts.length} videos, avg views ${avgViews}`);
  return { followers, avgViews };
}

/**
 * YouTube channel via the channel page — subscriber count + per-video views.
 * Subscriber text like "1.2K" is expanded to a real number; view counts are
 * parsed from the videos tab JSON ("viewCount":{"simpleText":"1,234 views"}).
 */
export async function fetchYouTubeProfileFull(
  username: string
): Promise<{ followers: number; avgViews: number } | null> {
  const headers = { "User-Agent": DESKTOP_UA, "Accept-Language": "en-US,en;q=0.9" };

  const aboutHtml = await fetchHtml(`https://www.youtube.com/@${encodeURIComponent(username)}/about`, headers);
  let followers = 0;
  const sm = aboutHtml.match(/"subscriberCountText"[^}]*?"simpleText"\s*:\s*"([\d.,KM]+)\s*(subscribers?)?"/i)
    || aboutHtml.match(/([\d.,]+[KM]?)\s*subscribers/i);
  if (sm) followers = parseCountToken(sm[1]);

  const videosHtml = await fetchHtml(`https://www.youtube.com/@${encodeURIComponent(username)}/videos`, headers);
  const viewCounts: number[] = [];
  const re = /"viewCountText"[^}]*?"simpleText"\s*:\s*"([\d.,KM]+)\s*views?"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(videosHtml)) !== null) {
    viewCounts.push(parseCountToken(m[1]));
    if (viewCounts.length >= 12) break;
  }
  const avgViews = viewCounts.length > 0 ? Math.round(viewCounts.reduce((s, v) => s + v, 0) / viewCounts.length) : 0;

  if (followers === 0 && viewCounts.length === 0) return null;
  console.log(`[BioCheck] YouTube profile @${username}: ${followers} subscribers, ${viewCounts.length} videos, avg views ${avgViews}`);
  return { followers, avgViews };
}

/** Expand "1.2K" / "3,4M" style tokens to a real number. */
function parseCountToken(token: string): number {
  const t = token.trim().replace(/,/g, "");
  const num = parseFloat(t);
  if (isNaN(num)) return 0;
  if (/K/i.test(t)) return Math.round(num * 1_000);
  if (/M/i.test(t)) return Math.round(num * 1_000_000);
  return Math.round(num);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INSTAGRAM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function checkInstagramBio(username: string, code: string): Promise<boolean> {
  console.log(`[BioCheck] Instagram @${username} — checking for code: ${code}`);

  // Strategy 1: internal app API (most reliable — returns JSON bio)
  const api = await instagramApiProfile(username);
  if (api) {
    console.log(`[BioCheck] Instagram i.api bio: "${api.bio.substring(0, 120)}" (${api.followers} followers)`);
    if (api.bio.includes(code)) {
      console.log(`[BioCheck] Instagram: code FOUND via i.instagram.com API`);
      return true;
    }
  }

  // Strategy 2: desktop page scrape
  let html = await fetchHtml(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
    "User-Agent": DESKTOP_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
  });
  console.log(`[BioCheck] Instagram desktop page: ${html.length} chars`);

  // Strategy 3: mobile page (bypasses some login walls)
  if (html.length < 2000 || !html.includes("biography")) {
    html = await fetchHtml(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
      "User-Agent": MOBILE_UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    });
    console.log(`[BioCheck] Instagram mobile page: ${html.length} chars`);
  }

  if (html.length > 0) {
    // Method 1: meta description
    const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
    if (metaMatch && esc(metaMatch[1]).includes(code)) {
      console.log(`[BioCheck] Instagram: code FOUND in meta description`);
      return true;
    }

    // Method 2: og:description
    const ogMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/i);
    if (ogMatch && esc(ogMatch[1]).includes(code)) {
      console.log(`[BioCheck] Instagram: code FOUND in og:description`);
      return true;
    }

    // Method 3: JSON biography field
    const bioJsonMatch = html.match(/"biography"\s*:\s*"([^"]+)"/);
    if (bioJsonMatch && esc(bioJsonMatch[1]).includes(code)) {
      console.log(`[BioCheck] Instagram: code FOUND in JSON biography`);
      return true;
    }

    // Method 4: raw HTML
    if (html.includes(code)) {
      console.log(`[BioCheck] Instagram: code FOUND in raw HTML`);
      return true;
    }
  }

  console.log(`[BioCheck] Instagram: code NOT found in any source`);
  return false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TIKTOK — bio from meta description + JSON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function checkTikTokBio(username: string, code: string): Promise<boolean> {
  try {
    console.log(`[BioCheck] TikTok @${username} — HTTP scrape...`);
    const html = await fetchHtml(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
      "User-Agent": DESKTOP_UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    });
    console.log(`[BioCheck] TikTok page: ${html.length} chars`);

    if (html.length === 0) return false;

    const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
    if (metaMatch && esc(metaMatch[1]).includes(code)) {
      console.log(`[BioCheck] TikTok: code FOUND in meta description`);
      return true;
    }

    const ogMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/i);
    if (ogMatch && esc(ogMatch[1]).includes(code)) {
      console.log(`[BioCheck] TikTok: code FOUND in og:description`);
      return true;
    }

    const descMatch = html.match(/"description"\s*:\s*"([^"]+)"/);
    if (descMatch && esc(descMatch[1]).includes(code)) {
      console.log(`[BioCheck] TikTok: code FOUND in JSON description`);
      return true;
    }

    const bioMatch = html.match(/"bio"\s*:\s*"([^"]+)"/);
    if (bioMatch && esc(bioMatch[1]).includes(code)) {
      console.log(`[BioCheck] TikTok: code FOUND in JSON bio`);
      return true;
    }

    if (html.includes(code)) {
      console.log(`[BioCheck] TikTok: code FOUND in raw HTML`);
      return true;
    }

    console.log(`[BioCheck] TikTok: code NOT found`);
    return false;
  } catch (error) {
    console.error(`[BioCheck] TikTok error:`, error);
    return false;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// YOUTUBE — bio from meta description + JSON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function checkYouTubeBio(username: string, code: string): Promise<boolean> {
  try {
    console.log(`[BioCheck] YouTube @${username} — HTTP scrape...`);

    const headers = {
      "User-Agent": DESKTOP_UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };

    let html = await fetchHtml(`https://www.youtube.com/@${encodeURIComponent(username)}/about`, headers);
    console.log(`[BioCheck] YouTube about page: ${html.length} chars`);

    if (html.length < 1000) {
      html = await fetchHtml(`https://www.youtube.com/@${encodeURIComponent(username)}`, headers);
      console.log(`[BioCheck] YouTube main page: ${html.length} chars`);
    }

    if (html.length === 0) return false;

    const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
    if (metaMatch && esc(metaMatch[1]).includes(code)) {
      console.log(`[BioCheck] YouTube: code FOUND in meta description`);
      return true;
    }

    const ogMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/i);
    if (ogMatch && esc(ogMatch[1]).includes(code)) {
      console.log(`[BioCheck] YouTube: code FOUND in og:description`);
      return true;
    }

    const descMatch = html.match(/"description"\s*:\s*"([^"]+)"/);
    if (descMatch && esc(descMatch[1]).includes(code)) {
      console.log(`[BioCheck] YouTube: code FOUND in JSON description`);
      return true;
    }

    if (html.includes(code)) {
      console.log(`[BioCheck] YouTube: code FOUND in raw HTML`);
      return true;
    }

    console.log(`[BioCheck] YouTube: code NOT found`);
    return false;
  } catch (error) {
    console.error(`[BioCheck] YouTube error:`, error);
    return false;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN VERIFIER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function verifyBio(
  platform: string,
  username: string,
  code: string
): Promise<boolean> {
  console.log(`[BioCheck] Checking ${platform} @${username} for code: ${code}`);
  switch (platform.toLowerCase()) {
    case "instagram":
      return checkInstagramBio(username, code);
    case "tiktok":
      return checkTikTokBio(username, code);
    case "youtube":
      return checkYouTubeBio(username, code);
    default:
      console.log(`[BioCheck] Unknown platform: ${platform}`);
      return false;
  }
}

/**
 * Pull LIVE platform stats for a username: follower count + average views
 * across recent posts (views summed per post, never truncated).
 * Returns null when the platform can't be reached or the profile is private.
 */
export async function fetchPlatformStats(
  platform: string,
  username: string
): Promise<{ followers: number; avgViews: number } | null> {
  try {
    switch (platform.toLowerCase()) {
      case "instagram":
        return await fetchInstagramProfileFull(username);
      case "tiktok":
        return await fetchTikTokProfileFull(username);
      case "youtube":
        return await fetchYouTubeProfileFull(username);
      default:
        return null;
    }
  } catch (e: any) {
    console.error(`[VerifyStats] ${platform}@${username} failed:`, e?.message || e);
    return null;
  }
}

/**
 * Fetch the current follower count for a connected account (best-effort).
 * Returns null when the platform API is unavailable.
 */
export async function fetchFollowerCount(platform: string, username: string): Promise<number | null> {
  try {
    if (platform.toLowerCase() === "instagram") {
      const api = await instagramApiProfile(username);
      return api ? api.followers : null;
    }
    if (platform.toLowerCase() === "tiktok") {
      const html = await fetchHtml(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
        "User-Agent": DESKTOP_UA,
      });
      const m = html.match(/"followerCount"\s*:\s*(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    }
    if (platform.toLowerCase() === "youtube") {
      const html = await fetchHtml(`https://www.youtube.com/@${encodeURIComponent(username)}`, {
        "User-Agent": DESKTOP_UA,
      });
      const m = html.match(/"subscriberCountText"\s*:\s*\{\s*"simpleText"\s*:\s*"([\d.,KM]+)"/);
      if (!m) return null;
      const num = parseFloat(m[1].replace(/,/g, ""));
      if (isNaN(num)) return null;
      if (/K/i.test(m[1])) return Math.round(num * 1000);
      if (/M/i.test(m[1])) return Math.round(num * 1000000);
      return Math.round(num);
    }
  } catch {}
  return null;
}
