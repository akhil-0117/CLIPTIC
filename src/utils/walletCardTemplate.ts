// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WALLET CARD & PROFILE CARD — 1600×960
// Using the CLIPTIC premium design system
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { renderHtmlToImage } from "./imageGenerator";
import { LOGO_DATA_URI } from "./logo";

const AVATAR = LOGO_DATA_URI;
const FONT = `-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif`;
const MONO = `ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace`;

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString();
}

// ━━ Shared frame wrapper (same as imageTemplates) ━━
function frameWrap(inner: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;width:1600px;height:960px;overflow:hidden;background:#030207;font-family:${FONT};color:#fff">
<div style="width:1600px;height:960px;position:relative;display:flex;align-items:center;justify-content:center;background:radial-gradient(900px 500px at 50% -100px,rgba(108,65,220,.17),transparent 70%),radial-gradient(700px 500px at 0% 50%,rgba(72,42,150,.10),transparent 70%),#030207">
<div style="position:absolute;inset:0;pointer-events:none;opacity:.20;background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1px);background-size:4px 4px;mask-image:linear-gradient(to bottom,transparent,black 15%,black 85%,transparent)"></div>
<div style="width:92%;height:88%;position:relative;padding:12px;border-radius:46px;background:linear-gradient(145deg,rgba(255,255,255,.17),rgba(255,255,255,.045) 28%,rgba(101,67,172,.17) 65%,rgba(255,255,255,.04));box-shadow:0 60px 130px rgba(0,0,0,.65),0 25px 80px rgba(107,64,226,.22),0 0 0 1px rgba(255,255,255,.08),inset 0 1px 0 rgba(255,255,255,.18)">
<div style="position:absolute;inset:1px;border-radius:45px;pointer-events:none;background:linear-gradient(120deg,rgba(255,255,255,.13),transparent 18%,transparent 80%,rgba(255,255,255,.04))"></div>
<div style="width:100%;height:100%;position:relative;overflow:hidden;border-radius:36px;padding:40px 48px 34px;display:flex;flex-direction:column;justify-content:space-between;background:radial-gradient(90% 70% at 50% -20%,rgba(132,83,255,.19),transparent 68%),radial-gradient(65% 55% at 100% 100%,rgba(106,65,210,.12),transparent 75%),linear-gradient(155deg,#171027 0%,#0d0917 50%,#08060d 100%);border:1px solid rgba(255,255,255,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.10),inset 0 0 80px rgba(90,48,180,.05)">
<div style="position:absolute;width:70%;height:55%;left:15%;bottom:-38%;background:radial-gradient(ellipse,rgba(181,145,255,.35),rgba(125,77,240,.16) 35%,transparent 72%);filter:blur(35px);pointer-events:none;z-index:1"></div>
<div style="position:absolute;left:5%;right:5%;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.24),transparent);pointer-events:none;z-index:1"></div>
${inner}
</div></div></div></body></html>`;
}

/**
 * Wallet card — 1600×960 premium design
 */
export async function generateWalletCardImage(params: {
  username: string;
  balance: number;
  totalPaid: number;
  totalViews: number;
  clipsApproved: number;
  rank: string;
  paymentMethod: string;
  walletAddress: string;
  socialAccounts: any[];
}): Promise<Buffer | null> {
  const clippedWallet = params.walletAddress
    ? params.walletAddress.substring(0, 6) + "..." + params.walletAddress.substring(params.walletAddress.length - 4)
    : "N/A";

  const accountRows = params.socialAccounts.length > 0
    ? params.socialAccounts.map((acc: any) => {
        const platformLabel = acc.platform === "tiktok" ? "TikTok" : acc.platform === "instagram" ? "Instagram" : "YouTube";
        const viewCount = fmt((acc.avg_views || 0) * 10);
        return `<div style="display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:12px;background:linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.10)">
          <div style="width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#d5c1ff;background:rgba(157,108,255,.14);border:1px solid rgba(157,108,255,.32)">${acc.platform === "tiktok" ? "T" : acc.platform === "instagram" ? "IG" : "YT"}</div>
          <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600;color:rgba(255,255,255,.9)">@${esc(acc.username)}</div><div style="font-size:10px;color:rgba(255,255,255,.45)">${platformLabel} \u00b7 ${fmt(acc.follower_count || 0)} followers</div></div>
          <div style="font-size:16px;font-weight:600;color:#a4ffd4">${viewCount} views</div>
        </div>`;
      }).join("")
    : `<div style="padding:18px;text-align:center;color:rgba(255,255,255,.45);font-size:13px;border-radius:14px;background:rgba(255,255,255,.05);border:1px dashed rgba(255,255,255,.1)">No connected accounts</div>`;

  const html = frameWrap(`
    <header style="display:flex;align-items:center;justify-content:space-between;gap:30px;position:relative;z-index:2">
      <div style="display:flex;align-items:center;gap:15px">
        <div style="width:50px;height:50px;border-radius:12px;overflow:hidden;flex-shrink:0;background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.25),transparent 45%),linear-gradient(145deg,#442b83,#130b2a);border:1px solid rgba(213,190,255,.45);box-shadow:0 0 0 4px rgba(151,107,255,.07),0 10px 30px rgba(104,61,220,.25)"><img src="${AVATAR}" style="width:100%;height:100%;display:block;object-fit:cover" alt=""/></div>
        <div style="display:flex;flex-direction:column;gap:3px"><div style="color:#cdb9ff;font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase">CLIPTIC NETWORK</div><div style="color:#fff;font-size:16px;font-weight:600">${esc(params.username)}</div></div>
      </div>
      <span style="min-width:95px;padding:7px 14px;display:inline-flex;justify-content:center;align-items:center;border-radius:999px;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#d5c1ff;background:rgba(157,108,255,.14);border:1px solid rgba(157,108,255,.32)">WALLET</span>
    </header>

    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <div style="padding:18px 20px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.105),rgba(255,255,255,.035));border:1px solid rgba(200,175,255,.18);box-shadow:inset 0 1px rgba(255,255,255,.07)">
        <div><div style="color:rgba(255,255,255,.7);font-size:8px;font-weight:800;letter-spacing:.20em;text-transform:uppercase">UNPAID EARNINGS BALANCE</div><div style="margin-top:6px;color:#fff;font-size:40px;line-height:.95;font-weight:850;letter-spacing:-.065em">$${params.balance.toFixed(2)} <small style="font-size:14px;color:rgba(255,255,255,.6)">USD</small></div></div>
        <div style="text-align:right"><strong style="color:#a4ffd4;font-size:12px;font-weight:850">${params.totalPaid > 0 ? "READY" : "PENDING"}</strong><div style="font-size:9px;color:rgba(255,255,255,.5);margin-top:4px">${esc(params.paymentMethod)} \u00b7 ${esc(clippedWallet)}</div></div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px">
        <div style="padding:14px;border-radius:14px;background:linear-gradient(145deg,rgba(255,255,255,.105),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.105)"><span style="display:block;color:#bca4ff;font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px">Total Views</span><div style="color:#fff;font-size:18px;font-weight:700">${fmt(params.totalViews)}</div></div>
        <div style="padding:14px;border-radius:14px;background:linear-gradient(145deg,rgba(255,255,255,.105),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.105)"><span style="display:block;color:#bca4ff;font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px">Clips Approved</span><div style="color:#fff;font-size:18px;font-weight:700">${params.clipsApproved}</div></div>
        <div style="padding:14px;border-radius:14px;background:linear-gradient(145deg,rgba(255,255,255,.105),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.105)"><span style="display:block;color:#bca4ff;font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px">Total Paid</span><div style="color:#fff;font-size:18px;font-weight:700">$${params.totalPaid.toFixed(2)}</div></div>
        <div style="padding:14px;border-radius:14px;background:linear-gradient(145deg,rgba(255,255,255,.105),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.105)"><span style="display:block;color:#bca4ff;font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px">Server Rank</span><div style="color:#fff;font-size:18px;font-weight:700">${esc(params.rank)}</div></div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">${accountRows}</div>
    </main>

    <footer style="display:flex;align-items:center;justify-content:space-between;gap:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.085);position:relative;z-index:2"><span style="color:rgba(255,255,255,.43);font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase">WALLET CARD</span><span style="color:#fff;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase">CLIPTIC</span></footer>
  `);

  return renderHtmlToImage(html, 1600, 960);
}

/**
 * Profile card — 1600×960 premium design
 */
export async function generateProfileCardImage(params: {
  username: string;
  socialAccounts: any[];
  lastSync: string;
}): Promise<Buffer | null> {
  const totalFollowers = params.socialAccounts.reduce((sum: number, a: any) => sum + (a.follower_count || 0), 0);
  const totalViews = params.socialAccounts.reduce((sum: number, a: any) => sum + (a.avg_views || 0) * 10, 0);

  const accountRows = params.socialAccounts.length > 0
    ? params.socialAccounts.map((acc: any) => {
        const platformLabel = acc.platform === "tiktok" ? "TikTok" : acc.platform === "instagram" ? "Instagram" : "YouTube";
        const viewCount = fmt((acc.avg_views || 0) * 10);
        return `<div style="display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:12px;background:linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.10)">
          <div style="width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#d5c1ff;background:rgba(157,108,255,.14);border:1px solid rgba(157,108,255,.32)">${acc.platform === "tiktok" ? "T" : acc.platform === "instagram" ? "IG" : "YT"}</div>
          <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600;color:rgba(255,255,255,.9)">@${esc(acc.username)}</div><div style="font-size:10px;color:rgba(255,255,255,.45)">${platformLabel} \u00b7 Connected \u00b7 ${acc.verified ? "Verified" : "Unverified"}</div></div>
          <div style="text-align:right"><div style="font-size:14px;font-weight:600;color:#a4ffd4">${fmt(acc.follower_count || 0)}</div><div style="font-size:10px;color:rgba(255,255,255,.45)">followers \u00b7 ${viewCount} views</div></div>
        </div>`;
      }).join("")
    : `<div style="padding:18px;text-align:center;color:rgba(255,255,255,.45);font-size:13px;border-radius:14px;background:rgba(255,255,255,.05);border:1px dashed rgba(255,255,255,.1)">No connected accounts. Use /connect to add one.</div>`;

  const html = frameWrap(`
    <header style="display:flex;align-items:center;justify-content:space-between;gap:30px;position:relative;z-index:2">
      <div style="display:flex;align-items:center;gap:15px">
        <div style="width:50px;height:50px;border-radius:12px;overflow:hidden;flex-shrink:0;background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.25),transparent 45%),linear-gradient(145deg,#442b83,#130b2a);border:1px solid rgba(213,190,255,.45);box-shadow:0 0 0 4px rgba(151,107,255,.07),0 10px 30px rgba(104,61,220,.25)"><img src="${AVATAR}" style="width:100%;height:100%;display:block;object-fit:cover" alt=""/></div>
        <div style="display:flex;flex-direction:column;gap:3px"><div style="color:#cdb9ff;font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase">CLIPTIC NETWORK</div><div style="color:#fff;font-size:16px;font-weight:600">${esc(params.username)}</div></div>
      </div>
      <span style="min-width:95px;padding:7px 14px;display:inline-flex;justify-content:center;align-items:center;border-radius:999px;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#d5c1ff;background:rgba(157,108,255,.14);border:1px solid rgba(157,108,255,.32)">PROFILE</span>
    </header>

    <main style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:1100px;padding-top:20px;position:relative;z-index:2">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
        <div style="padding:16px;border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.105),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.105)"><span style="display:block;color:#bca4ff;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px">Combined Views</span><div style="color:#fff;font-size:22px;font-weight:600">${fmt(totalViews)}</div></div>
        <div style="padding:16px;border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.105),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.105)"><span style="display:block;color:#bca4ff;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px">Total Followers</span><div style="color:#fff;font-size:22px;font-weight:600">${fmt(totalFollowers)}</div></div>
        <div style="padding:16px;border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.105),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.105)"><span style="display:block;color:#bca4ff;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px">Connected</span><div style="color:#fff;font-size:22px;font-weight:600">${params.socialAccounts.length} / 3</div></div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px">${accountRows}</div>
    </main>

    <footer style="display:flex;align-items:center;justify-content:space-between;gap:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.085);position:relative;z-index:2"><span style="color:rgba(255,255,255,.43);font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase">LAST SYNC: ${esc(params.lastSync)}</span><span style="color:#fff;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase">CLIPTIC</span></footer>
  `);

  return renderHtmlToImage(html, 1600, 960);
}
