// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLIPTIC NETWORK — PREMIUM CARDS v5
// 1600×960 viewport, matching the user's exact HTML/CSS design system
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString();
}

function timeAgo(date: string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

import { LOGO_DATA_URI } from "./logo";
const AVATAR = LOGO_DATA_URI;

// ━━ CSS Variables (matching user's :root) ━━
const C = {
  bg: "#030207",
  green: "#a4ffd4",
  greenBg: "rgba(84,255,178,.13)",
  greenBorder: "rgba(84,255,178,.35)",
  yellow: "#ffe49a",
  yellowBg: "rgba(255,208,82,.13)",
  yellowBorder: "rgba(255,208,82,.35)",
  red: "#ffb2c4",
  redBg: "rgba(255,76,112,.12)",
  redBorder: "rgba(255,76,112,.36)",
  purple: "#9c6cff",
  purpleBg: "rgba(157,108,255,.14)",
  purpleBorder: "rgba(157,108,255,.32)",
  purpleText: "#d5c1ff",
};

// ━━ CARD WRAPPER — user's exact .frame > .card structure ━━
function cardWrap(inner: string, variant: "default" | "success" | "error" = "default"): string {
  const cardBorder = variant === "success"
    ? "rgba(84,255,178,.25)"
    : variant === "error"
    ? "rgba(255,76,112,.25)"
    : "rgba(255,255,255,.08)";

  const cardShadow = variant === "success"
    ? "inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 80px rgba(50,255,160,.025), 0 0 60px rgba(54,255,165,.04)"
    : variant === "error"
    ? "inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 80px rgba(255,60,100,.025), 0 0 60px rgba(255,60,100,.04)"
    : "inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 80px rgba(90,48,180,.05)";

  const glowColor = variant === "success"
    ? "rgba(93,255,195,.23),rgba(100,255,190,.08) 35%,transparent 72%"
    : variant === "error"
    ? "rgba(255,75,115,.15),transparent 70%"
    : "rgba(181,145,255,.35),rgba(125,77,240,.16) 35%,transparent 72%";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;width:1600px;height:960px;overflow:hidden;background:#030207;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif;color:#fff">
<!-- Stage: centering + ambient glow -->
<div style="width:1600px;height:960px;position:relative;display:flex;align-items:center;justify-content:center;background:radial-gradient(900px 500px at 50% -100px,rgba(108,65,220,.17),transparent 70%),radial-gradient(700px 500px at 0% 50%,rgba(72,42,150,.10),transparent 70%),#030207">
<!-- Ambient dots -->
<div style="position:absolute;inset:0;pointer-events:none;opacity:.20;background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1px);background-size:4px 4px;mask-image:linear-gradient(to bottom,transparent,black 15%,black 85%,transparent)"></div>
<!-- Frame (outer bezel with gradient border) -->
<div style="width:92%;height:88%;position:relative;padding:12px;border-radius:46px;background:linear-gradient(145deg,rgba(255,255,255,.17),rgba(255,255,255,.045) 28%,rgba(101,67,172,.17) 65%,rgba(255,255,255,.04));box-shadow:0 60px 130px rgba(0,0,0,.65),0 25px 80px rgba(107,64,226,.22),0 0 0 1px rgba(255,255,255,.08),inset 0 1px 0 rgba(255,255,255,.18)">
<!-- Frame inner shimmer -->
<div style="position:absolute;inset:1px;border-radius:45px;pointer-events:none;background:linear-gradient(120deg,rgba(255,255,255,.13),transparent 18%,transparent 80%,rgba(255,255,255,.04))"></div>
<!-- Card (main content area) -->
<div style="width:100%;height:100%;position:relative;overflow:hidden;border-radius:36px;padding:40px 48px 34px;display:flex;flex-direction:column;justify-content:space-between;background:radial-gradient(90% 70% at 50% -20%,rgba(132,83,255,.19),transparent 68%),radial-gradient(65% 55% at 100% 100%,rgba(106,65,210,.12),transparent 75%),linear-gradient(155deg,#171027 0%,#0d0917 50%,#08060d 100%);border:1px solid ${cardBorder};box-shadow:${cardShadow}">
<!-- Bottom glow -->
<div style="position:absolute;width:70%;height:55%;left:15%;bottom:-38%;background:radial-gradient(ellipse,${glowColor});filter:blur(35px);pointer-events:none;z-index:1"></div>
<!-- Top shine line -->
<div style="position:absolute;left:5%;right:5%;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.24),transparent);pointer-events:none;z-index:1"></div>
${inner}
</div></div></div></body></html>`;
}

// ━━ TOPBAR — user's exact .topbar > .identity > .logo + .brand-block + badge ━━
function topbar(title: string, badge: string, badgeColor: "green" | "yellow" | "red" | "purple", num: string): string {
  const bc = badgeColor === "green"
    ? `color:${C.green};background:${C.greenBg};border:1px solid ${C.greenBorder};box-shadow:0 0 25px rgba(84,255,178,.06)`
    : badgeColor === "yellow"
    ? `color:${C.yellow};background:${C.yellowBg};border:1px solid ${C.yellowBorder}`
    : badgeColor === "red"
    ? `color:${C.red};background:${C.redBg};border:1px solid ${C.redBorder};box-shadow:0 0 25px rgba(255,76,112,.07)`
    : `color:${C.purpleText};background:${C.purpleBg};border:1px solid ${C.purpleBorder}`;

  return `<header style="display:flex;align-items:center;justify-content:space-between;gap:30px;position:relative;z-index:2">
<div style="display:flex;align-items:center;gap:15px">
<div style="width:50px;height:50px;border-radius:12px;overflow:hidden;flex-shrink:0;background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.25),transparent 45%),linear-gradient(145deg,#442b83,#130b2a);border:1px solid rgba(213,190,255,.45);box-shadow:0 0 0 4px rgba(151,107,255,.07),0 10px 30px rgba(104,61,220,.25)"><img src="${AVATAR}" style="width:100%;height:100%;display:block;object-fit:cover" alt=""/></div>
<div style="display:flex;flex-direction:column;gap:3px"><div style="color:#cdb9ff;font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase">CLIPTIC NETWORK</div><div style="color:#fff;font-size:16px;font-weight:600;letter-spacing:-.01em">${esc(title)}</div></div>
</div>
<span style="min-width:95px;padding:7px 14px;display:inline-flex;justify-content:center;align-items:center;border-radius:999px;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;${bc}">${esc(badge)}</span>
</header>`;
}

// ━━ FOOTER ━━
function footer(left: string, right: string): string {
  return `<footer style="display:flex;align-items:center;justify-content:space-between;gap:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.085);position:relative;z-index:2"><span style="color:rgba(255,255,255,.43);font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase">${esc(left)}</span><span style="color:#fff;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase">${esc(right)}</span></footer>`;
}

// ━━ SHARED COMPONENTS ━━

function platformPill(name: string): string {
  return `<span style="padding:10px 16px;border-radius:999px;background:linear-gradient(145deg,rgba(255,255,255,.12),rgba(255,255,255,.045));border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.88);font-size:12px;font-weight:500;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)">${esc(name)}</span>`;
}

function metricCard(label: string, value: string, small?: boolean): string {
  return `<div style="min-width:0;padding:16px;border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.105),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.105);box-shadow:inset 0 1px 0 rgba(255,255,255,.07)"><span style="display:block;color:#bca4ff;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px">${esc(label)}</span><div style="color:#fff;font-size:${small ? 18 : 22}px;font-weight:600;letter-spacing:-.02em">${esc(value)}</div></div>`;
}

function listRow(left: string, right: string, rightColor = "#cdb8ff"): string {
  return `<div style="min-height:44px;padding:11px 16px;display:flex;align-items:center;justify-content:space-between;gap:20px;border-radius:12px;background:linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.10);color:rgba(255,255,255,.86);font-size:13px;font-weight:500"><span>${esc(left)}</span><span style="color:${rightColor};font-size:10px;font-weight:600;letter-spacing:.1em;white-space:uppercase">${esc(right)}</span></div>`;
}

function statusBox(text: string, type: "success" | "error"): string {
  const c = type === "success"
    ? "color:#d2ffea;background:rgba(84,255,178,.09);border:1px solid rgba(84,255,178,.28)"
    : "color:#ffd9e2;background:rgba(255,76,112,.09);border:1px solid rgba(255,76,112,.28)";
  return `<div style="max-width:900px;padding:18px;border-radius:15px;font-size:13px;line-height:1.5;font-weight:400;${c}">${text}</div>`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 01 — WELCOME
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function welcomeCardHtml(username: string): string {
  return cardWrap(`
    ${topbar(username, "ACTIVE", "green", "01 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <div style="color:#c6adff;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;margin-bottom:12px">WELCOME TO CLIPTIC NETWORK</div>
      <h2 style="color:#fff;font-size:40px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">Hello, ${esc(username)}</h2>
      <p style="max-width:850px;color:rgba(255,255,255,.68);font-size:15px;line-height:1.55;font-weight:400">The professional network for top-tier clip creators. Track, verify and scale your creator performance across supported publishing platforms.</p>
    </main>
    ${footer("AUTHENTICATED CREATOR SESSION", "SECURE")}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 02 — SERVER VERIFICATION GATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function verificationPanelHtml(): string {
  return cardWrap(`
    ${topbar("Server Verification", "GET STARTED", "green", "02 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#fff;font-size:34px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">Welcome to CLIPTIC</h2>
      <p style="max-width:850px;color:rgba(255,255,255,.68);font-size:15px;line-height:1.55;font-weight:400">Click the button below to verify your account and gain access to the server. Once verified, you can connect your social media accounts and start earning as a clip creator.</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:25px">
        ${platformPill("TikTok")}
        ${platformPill("Instagram Reels")}
        ${platformPill("YouTube Shorts")}
      </div>
    </main>
    ${footer("CLICK BELOW TO GET STARTED", "CLIPTIC NETWORK")}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 03 — CLIPPER VERIFICATION WORKFLOW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function accountVerifyPanelHtml(): string {
  return cardWrap(`
    ${topbar("Verification Workflow", "PROCESS", "yellow", "03 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#fff;font-size:34px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">Clipper Verification</h2>
      <div style="display:flex;flex-direction:column;gap:8px;max-width:980px;margin-top:15px">
        ${listRow("Select a connected social profile", "STEP 1")}
        ${listRow("We pull your live stats from the platform", "STEP 2")}
        ${listRow("Follower count and average views checked instantly", "STEP 3")}
        ${listRow("Requirements met \u2014 CLIPPER role granted automatically", "STEP 4")}
      </div>
      <p style="margin-top:14px;font-size:13px;color:rgba(255,255,255,.5)">Requirements: Minimum 50 followers \u00b7 250+ avg views \u00b7 Public profile</p>
    </main>
    ${footer("DISCORD WORKFLOW PIPELINE", "SECURE")}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 04 — CONNECT SOCIAL MEDIA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function connectAccountPanelHtml(): string {
  return cardWrap(`
    ${topbar("Social Integrations", "OAUTH READY", "green", "04 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#fff;font-size:40px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">Connect Social Media</h2>
      <p style="max-width:850px;color:rgba(255,255,255,.68);font-size:15px;line-height:1.55;font-weight:400">Link your core distribution channels to enable automated tracking, performance metrics and verified payout calculations.</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:25px">
        ${platformPill("TikTok")}
        ${platformPill("Instagram Reels")}
        ${platformPill("YouTube Shorts")}
      </div>
    </main>
    ${footer("PLATFORM AUTHORIZATION", "API SYNC")}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 05a — ACCOUNT DASHBOARD PANEL (informational)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function accountDashboardPanelHtml(): string {
  return cardWrap(`
    ${topbar("Account Dashboard", "STATS", "purple", "05 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#fff;font-size:40px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">Account Dashboard</h2>
      <p style="max-width:850px;color:rgba(255,255,255,.68);font-size:15px;line-height:1.55;font-weight:400">View your personal stats, connected platforms, follower counts, view metrics, server rank, and earnings balance.</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:25px">
        ${platformPill("Total Views")}
        ${platformPill("Followers")}
        ${platformPill("Balance")}
        ${platformPill("Server Rank")}
        ${platformPill("Connected Platforms")}
      </div>
    </main>
    ${footer("CLICK BELOW TO VIEW YOUR DASHBOARD", "PERSONAL STATS")}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 05b — ACCOUNT DASHBOARD (personal data)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function accountDashboardHtml(username: string, accounts: any[], payment: any, rank?: number | null): string {
  const totalViews = accounts.reduce((s: number, a: any) => s + (a.avg_views || 0) * 10, 0);
  const totalFollowers = accounts.reduce((s: number, a: any) => s + (a.follower_count || 0), 0);
  const balance = payment?.balance || 0;
  const totalPaid = payment?.total_paid || 0;
  const rankText = rank ? `#${rank}` : "\u2014";

  const accountRows = accounts.length > 0
    ? accounts.map((a: any) => {
        const label = a.platform === "tiktok" ? "TikTok" : a.platform === "instagram" ? "Instagram" : "YouTube";
        return listRow(`${label} \u00b7 @${esc(a.username)}`, `${fmt(a.follower_count || 0)} followers \u00b7 ${fmt((a.avg_views || 0) * 10)} views`);
      }).join("")
    : `<div style="padding:18px;border-radius:15px;background:linear-gradient(145deg,rgba(255,255,255,.085),rgba(255,255,255,.035));border:1px solid rgba(201,177,255,.13);color:rgba(255,255,255,.5);font-size:13px;text-align:center">No connected accounts \u2014 head to Connect Account to link your platforms</div>`;

  return cardWrap(`
    ${topbar(username, `RANK ${rankText}`, "green", "05 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        ${metricCard("Total Views", fmt(totalViews))}
        ${metricCard("Followers", fmt(totalFollowers))}
        ${metricCard("Balance", "$" + balance.toFixed(2))}
        ${metricCard("Paid Out", "$" + fmt(totalPaid))}
        ${metricCard("Server Rank", rankText)}
        ${metricCard("Platforms", String(accounts.length) + "/3")}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">${accountRows}</div>
    </main>
    ${footer(`${accounts.length} CONNECTED PLATFORM${accounts.length !== 1 ? "S" : ""} ACTIVE`, "DASHBOARD")}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 06a — PAYMENT DASHBOARD PANEL (informational)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function paymentDashboardPanelHtml(): string {
  return cardWrap(`
    ${topbar("Payment Dashboard", "PAYOUTS", "purple", "06 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#fff;font-size:40px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">Payment Dashboard</h2>
      <p style="max-width:850px;color:rgba(255,255,255,.68);font-size:15px;line-height:1.55;font-weight:400">Manage your payout methods, track earnings balance, request withdrawals, and view payment history.</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px">
        ${metricCard("Supported Methods", "USDT \u00b7 BTC \u00b7 LTC")}
        ${metricCard("Min Payout", "$10.00")}
        ${metricCard("Payout Cycle", "Weekly")}
      </div>
    </main>
    ${footer("ADD PAYMENT METHOD OR WITHDRAW BELOW", "ESCROW SECURED")}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 06b — PAYMENT DASHBOARD (personal data)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function paymentDashboardHtml(username: string, payment: any): string {
  const balance = payment?.balance || 0;
  const totalPaid = payment?.total_paid || 0;
  const method = payment?.method || "NONE";
  const wallet = payment?.wallet_address || "";
  const clipped = wallet ? wallet.substring(0, 6) + "..." + wallet.substring(wallet.length - 4) : "N/A";
  const badgeText = method !== "NONE" ? method.replace("-", " \u00b7 ") : "NO METHOD";

  return cardWrap(`
    ${topbar("Payment Dashboard", badgeText, method !== "NONE" ? "green" : "yellow", "06 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <div style="padding:18px 20px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.105),rgba(255,255,255,.035));border:1px solid rgba(200,175,255,.18);box-shadow:inset 0 1px rgba(255,255,255,.07)">
        <div><div style="color:rgba(255,255,255,.7);font-size:8px;font-weight:800;letter-spacing:.20em;text-transform:uppercase">UNPAID EARNINGS BALANCE</div><div style="margin-top:6px;color:#fff;font-size:40px;line-height:.95;font-weight:850;letter-spacing:-.065em">$${balance.toFixed(2)} <small style="font-size:14px;color:rgba(255,255,255,.6);letter-spacing:0">USD</small></div></div>
        <div style="text-align:right"><strong style="color:#a1ffd2;font-size:12px;font-weight:850">${balance > 0 ? "READY FOR PAYOUT" : "PENDING"}</strong><span style="display:block;margin-top:4px;color:rgba(255,255,255,.6);font-size:9px">Minimum threshold \u00b7 $10.00</span></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px">
        ${metricCard("Total Paid Out", "$" + fmt(totalPaid))}
        ${metricCard("Payout Wallet", clipped, true)}
        ${metricCard("Method", method !== "NONE" ? method : "None")}
      </div>
    </main>
    ${footer("WEEKLY PAYOUT PROCESSING", "ESCROW SECURED")}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 07 — TICKET
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function ticketCardHtml(userId: string): string {
  return cardWrap(`
    ${topbar("Verification Ticket", "OPEN TICKET", "yellow", "07 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#fff;font-size:34px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">Verification Review</h2>
      <div style="max-width:1000px;padding:18px 20px;border-radius:16px;background:rgba(0,0,0,.32);border:1px dashed rgba(188,153,255,.34);color:rgba(255,255,255,.76);font-size:13px;line-height:1.5">
        Upload a clear screen recording demonstrating follower count and recent view metrics from your social media insights.
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:25px">
        ${platformPill("Follower Count")}
        ${platformPill("View Metrics")}
        ${platformPill("Recent Content")}
      </div>
    </main>
    ${footer("MEDIA EVIDENCE SUBMISSION", "TICKET")}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 08 — LEADERBOARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function leaderboardHtml(entries: any[]): string {
  const medals = ["\ud83e\udd47", "\ud83e\udd48", "\ud83e\udd49"];
  const rows = entries.length > 0
    ? entries.slice(0, 10).map((e: any, i: number) =>
        `<div style="display:grid;grid-template-columns:1.4fr 1fr auto;align-items:center;gap:20px;padding:11px 16px;border-radius:12px;background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.09);font-size:13px"><span style="font-weight:550">${medals[i] || "#" + (i + 1)} \u00b7 @${esc(e.discord_tag || "unknown")}</span><span style="color:rgba(255,255,255,.52)">${fmt(e.total_views || 0)} views</span><span style="color:${C.green};font-weight:600">$${(e.total_earnings || 0).toFixed(2)}</span></div>`
      ).join("")
    : `<div style="padding:18px;border-radius:15px;background:linear-gradient(145deg,rgba(255,255,255,.085),rgba(255,255,255,.035));border:1px solid rgba(201,177,255,.13);color:rgba(255,255,255,.5);font-size:13px;text-align:center">No clips submitted yet \u2014 be the first!</div>`;

  return cardWrap(`
    ${topbar("Top Clippers", "SEASON 03", "green", "08 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#fff;font-size:40px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">Global Leaderboard</h2>
      <div style="display:flex;flex-direction:column;gap:8px;max-width:1050px">${rows}</div>
    </main>
    ${footer("LEADERBOARD STATS UPDATED HOURLY", "GLOBAL RANK")}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 09 — CLIP SUBMISSION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function clipSubmissionHtml(platform: string, url: string, description: string, status: string): string {
  const badgeColor = status === "approved" ? "green" as const : status === "rejected" ? "red" as const : "yellow" as const;
  return cardWrap(`
    ${topbar("Clip Submission Status", status.toUpperCase(), badgeColor, "09 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#fff;font-size:34px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">${esc(description || "Clip Submission")}</h2>
      <p style="max-width:850px;color:rgba(255,255,255,.68);font-size:15px;line-height:1.55;font-weight:400">Publishing Platform: <strong style="color:#fff">${esc(platform)}</strong></p>
      <div style="max-width:1000px;padding:15px 18px;border-radius:14px;border:1px dashed rgba(183,151,255,.38);background:rgba(0,0,0,.35);color:rgba(255,255,255,.82);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:18px">${esc(url)}</div>
    </main>
    ${footer(status === "approved" ? "VIEWS CREDITED TO BALANCE" : "AWAITING REVIEW", status.toUpperCase())}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 10 — EARNINGS LEDGER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function earningsHtml(username: string, payment: any, history: any[]): string {
  const balance = payment?.balance || 0;
  const totalPaid = payment?.total_paid || 0;
  const rows = history.length > 0
    ? history.slice(0, 6).map((h: any) =>
        `<div style="display:flex;align-items:center;justify-content:space-between;gap:20px;padding:11px 16px;border-radius:12px;background:rgba(255,255,255,.065);border:1px solid rgba(255,255,255,.085);color:rgba(255,255,255,.84);font-size:13px"><span>${esc(h.source)} \u00b7 ${timeAgo(h.created_at)}</span><span style="color:${C.green};font-weight:600">+$${h.amount.toFixed(2)}</span></div>`
      ).join("")
    : `<div style="padding:18px;border-radius:15px;background:linear-gradient(145deg,rgba(255,255,255,.085),rgba(255,255,255,.035));border:1px solid rgba(201,177,255,.13);color:rgba(255,255,255,.5);font-size:13px;text-align:center">No earnings yet \u2014 submit clips to start earning!</div>`;

  return cardWrap(`
    ${topbar("Earnings Ledger", "ACTIVE", "green", "10 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        ${metricCard("Unpaid Balance", "$" + balance.toFixed(2))}
        ${metricCard("Total Earned", "$" + fmt(totalPaid))}
        ${metricCard("Payouts Received", "$" + fmt(totalPaid))}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">${rows}</div>
    </main>
    ${footer("FULL LEDGER TRANSACTION AUDIT", "LEDGER")}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 11 — NOTIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function notificationsHtml(notifs: any[]): string {
  const unread = notifs.filter((n: any) => !n.read).length;
  const rows = notifs.length > 0
    ? notifs.slice(0, 5).map((n: any) =>
        `<div style="display:flex;align-items:center;justify-content:space-between;gap:20px;padding:11px 16px;border-radius:12px;background:linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.10);color:rgba(255,255,255,.86);font-size:13px"><span>${esc(n.message)}</span><span style="color:rgba(255,255,255,.42);font-size:11px;white-space:nowrap">${timeAgo(n.created_at)}</span></div>`
      ).join("")
    : `<div style="padding:18px;border-radius:15px;background:linear-gradient(145deg,rgba(255,255,255,.085),rgba(255,255,255,.035));border:1px solid rgba(201,177,255,.13);color:rgba(255,255,255,.5);font-size:13px;text-align:center">No notifications</div>`;

  return cardWrap(`
    ${topbar("Notifications Center", `${unread} UNREAD`, unread > 0 ? "yellow" : "green", "11 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#fff;font-size:34px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">System Alerts</h2>
      <div style="display:flex;flex-direction:column;gap:8px;max-width:1050px">${rows}</div>
    </main>
    ${footer("MARK ALL NOTIFICATIONS AS READ", "ALERTS")}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 12 — SERVER STATS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function serverStatsHtml(stats: { totalMembers: number; totalClips: number; totalEarnings: number; totalPaid: number; activeClippers: number; topPlatform: string }): string {
  return cardWrap(`
    ${topbar("Server Statistics", "LIVE METRICS", "green", "12 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        ${metricCard("Members", fmt(stats.totalMembers))}
        ${metricCard("Total Clips", fmt(stats.totalClips))}
        ${metricCard("Volume", fmt(stats.totalEarnings) + " Views")}
        ${metricCard("Paid Out", "$" + fmt(stats.totalPaid))}
        ${metricCard("Active Clippers", fmt(stats.activeClippers))}
        ${metricCard("Top Platform", stats.topPlatform || "\u2014")}
      </div>
    </main>
    ${footer("GLOBAL NETWORK HEALTH MONITOR", "STATS")}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 13 — BIO CODE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function bioCodeCardHtml(platform: string, username: string, code: string): string {
  return cardWrap(`
    ${topbar("Bio Verification Code", "PENDING CHECK", "yellow", "13 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#fff;font-size:34px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:20px">Account Ownership Verification</h2>
      <div style="max-width:850px;padding:22px;border-radius:16px;background:rgba(0,0,0,.48);border:1px dashed rgba(181,145,255,.42);text-align:center">
        <div style="color:#fff;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:36px;font-weight:700;letter-spacing:.15em;text-shadow:0 0 22px rgba(170,125,255,.48)">${esc(code)}</div>
        <div style="margin-top:14px;color:rgba(255,255,255,.60);font-size:13px">Paste this code into your <strong style="color:#c8aaff">${esc(platform)}</strong> bio (@${esc(username)}), then click Submit Profile URL below.</div>
      </div>
    </main>
    ${footer("AUTOMATED SYSTEM SCANS EVERY 60S", "SECURE")}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 14 — SUCCESS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function successCardHtml(title: string, message: string): string {
  return cardWrap(`
    ${topbar("Action Completed", "SUCCESS", "green", "14 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#a4ffd4;font-size:40px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">${esc(title)}</h2>
      <p style="max-width:850px;color:rgba(255,255,255,.68);font-size:15px;line-height:1.55;font-weight:400">${message}</p>
    </main>
    ${footer("TRANSACTION VERIFIED", "VERIFIED")}
  `, "success");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 15 — ERROR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function errorCardHtml(title: string, message: string): string {
  return cardWrap(`
    ${topbar("System Error", "FAILED", "red", "15 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#ffb2c4;font-size:40px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">${esc(title)}</h2>
      <p style="max-width:850px;color:rgba(255,255,255,.68);font-size:15px;line-height:1.55;font-weight:400">${message}</p>
    </main>
    ${footer("ERROR CODE: SYSTEM", "ALERT")}
  `, "error");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 16 — DENIED
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function deniedCardHtml(reason: string): string {
  return cardWrap(`
    ${topbar("Verification Denied", "REJECTED", "red", "16 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#ffb2c4;font-size:34px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">Application Rejected</h2>
      ${statusBox(reason || "Your verification request has been denied. You may reapply after 7 days.", "error")}
    </main>
    ${footer("YOU CAN SUBMIT A NEW REQUEST IN 7 DAYS", "MODERATION")}
  `, "error");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 17 — ADMIN VERIFIED
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function adminVerifiedCardHtml(userTag: string): string {
  return cardWrap(`
    ${topbar("Administration Console", "APPROVED", "green", "17 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#a4ffd4;font-size:34px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">Account Verified &amp; Approved</h2>
      <p style="max-width:850px;color:rgba(255,255,255,.68);font-size:15px;line-height:1.55;font-weight:400"><strong style="color:#fff">${esc(userTag)}</strong> has been granted the <strong style="color:#a4ffd4">CLIPPER</strong> role via automatic verification.</p>
      ${statusBox("Verification approved. CLIPPER role assigned. All server channels unlocked.", "success")}
    </main>
    ${footer("LOGGED TO PERMANENT AUDIT TRAIL", "ADMIN CONSOLE")}
  `, "success");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 18 — ADMIN DENIED
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function adminDeniedCardHtml(userTag: string, reason: string): string {
  return cardWrap(`
    ${topbar("Administration Console", "REJECTED", "red", "18 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#ffb2c4;font-size:34px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">Application Rejected</h2>
      <p style="max-width:850px;color:rgba(255,255,255,.68);font-size:15px;line-height:1.55;font-weight:400"><strong style="color:#fff">${esc(userTag)}</strong>'s verification has been denied. The user has been notified via DM.</p>
      ${statusBox(esc(reason || "No reason provided."), "error")}
    </main>
    ${footer("LOGGED TO PERMANENT AUDIT TRAIL", "ADMIN CONSOLE")}
  `, "error");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 19 — CAMPAIGN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function campaignCardHtml(campaign: {
  title: string;
  description: string;
  platforms: string[];
  audiences: string;
  payoutRate: string;
  minViews: number;
  rules: string;
  status: string;
  createdBy: string;
}): string {
  const badgeColor = campaign.status === "active" ? "green" as const : campaign.status === "ended" ? "red" as const : "yellow" as const;
  const platformPills = campaign.platforms.map(p => platformPill(p)).join("");

  return cardWrap(`
    ${topbar("Campaign", campaign.status.toUpperCase(), badgeColor, "19 / 19")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#fff;font-size:40px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">${esc(campaign.title)}</h2>
      <p style="max-width:850px;color:rgba(255,255,255,.68);font-size:15px;line-height:1.55;font-weight:400">${esc(campaign.description)}</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:25px">${platformPills}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px">
        ${metricCard("Payout Rate", campaign.payoutRate)}
        ${metricCard("Min Views", fmt(campaign.minViews))}
        ${metricCard("Audience", campaign.audiences)}
      </div>
      ${campaign.rules ? `<div style="max-width:1000px;padding:15px 18px;border-radius:14px;background:rgba(255,70,100,.08);border:1px solid rgba(255,70,100,.25);color:#ffcbd6;font-size:13px;font-weight:500;margin-top:18px">\ud83d\udea8 ${esc(campaign.rules)}</div>` : ""}
    </main>
    ${footer("CREATED BY " + esc(campaign.createdBy), "JOIN CAMPAIGN")}
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 20 — CAMPAIGN JOIN SUCCESS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function campaignJoinSuccessHtml(campaignTitle: string, serverInvite: string): string {
  return cardWrap(`
    ${topbar("Campaign Joined", "WELCOME", "green", "20 / 20")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#a4ffd4;font-size:40px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">Welcome to ${esc(campaignTitle)}</h2>
      <p style="max-width:850px;color:rgba(255,255,255,.68);font-size:15px;line-height:1.55;font-weight:400">You have been accepted into the campaign. Use the invite link below to join the campaign server and start creating clips!</p>
      <div style="max-width:1000px;padding:15px 18px;border-radius:14px;border:1px dashed rgba(183,151,255,.38);background:rgba(0,0,0,.35);color:rgba(255,255,255,.82);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:18px">${esc(serverInvite)}</div>
    </main>
    ${footer("CAMPAIGN SERVER INVITE", "SECURE")}
  `, "success");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 21 — HELP TICKET PANEL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function helpTicketPanelHtml(): string {
  return cardWrap(`
    ${topbar("Support Center", "GET HELP", "purple", "21 / 22")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#fff;font-size:40px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">Need Help?</h2>
      <p style="max-width:850px;color:rgba(255,255,255,.68);font-size:15px;line-height:1.55;font-weight:400">Create a support ticket and our team will assist you. Choose a category below to get started.</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:25px">
        ${platformPill("Account Issues")}
        ${platformPill("Payment Support")}
        ${platformPill("Campaign Help")}
        ${platformPill("General Inquiry")}
      </div>
    </main>
    ${footer("CLICK BELOW TO CREATE A TICKET", "SUPPORT")}
  `, "default");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 22 — REPORT USER PANEL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function reportUserPanelHtml(): string {
  return cardWrap(`
    ${topbar("Report User", "SAFETY", "red", "22 / 22")}
    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <h2 style="color:#fff;font-size:40px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">Report a User</h2>
      <p style="max-width:850px;color:rgba(255,255,255,.68);font-size:15px;line-height:1.55;font-weight:400">If a user is violating community guidelines, submitting fake clips, or engaging in spam, select them from the dropdown below to file a report.</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:25px">
        ${platformPill("Fake Submissions")}
        ${platformPill("Spam / Abuse")}
        ${platformPill("Stolen Content")}
        ${platformPill("Other Violation")}
      </div>
    </main>
    ${footer("SELECT USER FROM DROPDOWN BELOW", "SAFETY")}
  `, "default");
}
