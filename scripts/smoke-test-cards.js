// Smoke test: render all card templates and verify they produce valid PNGs
const path = require("path");
const base = path.join(__dirname, "..", "dist");
const { renderHtmlToImage } = require(path.join(base, "utils", "imageGenerator"));
const t = require(path.join(base, "utils", "imageTemplates"));

const templates = [
  ["welcomeCardHtml", () => t.welcomeCardHtml("TestUser#1234")],
  ["verificationPanelHtml", () => t.verificationPanelHtml()],
  ["accountVerifyPanelHtml", () => t.accountVerifyPanelHtml()],
  ["connectAccountPanelHtml", () => t.connectAccountPanelHtml()],
  ["accountDashboardPanelHtml", () => t.accountDashboardPanelHtml()],
  ["accountDashboardHtml", () => t.accountDashboardHtml("TestUser", [{platform:"tiktok",username:"test",follower_count:1200,avg_views:450},{platform:"instagram",username:"testig",follower_count:800,avg_views:320}], {balance:42.5,total_paid:285}, 3)],
  ["paymentDashboardPanelHtml", () => t.paymentDashboardPanelHtml()],
  ["paymentDashboardHtml", () => t.paymentDashboardHtml("TestUser", {balance:42.5,total_paid:285,method:"USDT-TRC20",wallet_address:"TXyz1234abcd5678"})],
  ["ticketCardHtml", () => t.ticketCardHtml("123456789")],
  ["leaderboardHtml", () => t.leaderboardHtml([{discord_tag:"User1#1111",total_views:12500,total_earnings:45},{discord_tag:"User2#2222",total_views:10100,total_earnings:38.5}])],
  ["clipSubmissionHtml", () => t.clipSubmissionHtml("tiktok","https://tiktok.com/@user/video/123","My Clip","pending")],
  ["earningsHtml", () => t.earningsHtml("TestUser",{balance:42.5,total_paid:285},[{source:"clip verified",amount:5.4,created_at:"2026-09-20T10:00:00"},{source:"clip verified",amount:8.2,created_at:"2026-09-19T10:00:00"}])],
  ["notificationsHtml", () => t.notificationsHtml([{type:"success",message:"Your clip was approved",read:0,created_at:"2026-09-20T10:00:00"},{type:"info",message:"Weekly payout processed",read:1,created_at:"2026-09-17T10:00:00"}])],
  ["serverStatsHtml", () => t.serverStatsHtml({totalMembers:14280,totalClips:89410,totalEarnings:12400,totalPaid:48920,activeClippers:1420,topPlatform:"TikTok"})],
  ["bioCodeCardHtml", () => t.bioCodeCardHtml("tiktok","testuser","VERIFY-CLIP-8492")],
  ["successCardHtml", () => t.successCardHtml("Account Connected","Your TikTok account @testuser has been linked.")],
  ["errorCardHtml", () => t.errorCardHtml("Verification Failed","Could not find the code in your bio.")],
  ["deniedCardHtml", () => t.deniedCardHtml("Insufficient followers. Need 50+.")],
  ["adminVerifiedCardHtml", () => t.adminVerifiedCardHtml("TestUser#1234")],
  ["adminDeniedCardHtml", () => t.adminDeniedCardHtml("TestUser#1234","Low follower count")],
  ["campaignCardHtml", () => t.campaignCardHtml({title:"Q3 Growth Sprint",description:"Distribute clips for higher CPM",platforms:["TikTok","Instagram"],audiences:"English",payoutRate:"$0.60 / 1K",minViews:500,rules:"Must use official audio",status:"active",createdBy:"Admin"})],
  ["campaignJoinSuccessHtml", () => t.campaignJoinSuccessHtml("Q3 Growth Sprint","https://discord.gg/abc123")],
];

(async () => {
  let pass = 0, fail = 0;
  for (const [name, fn] of templates) {
    try {
      const html = fn();
      const buf = await renderHtmlToImage(html, 1600, 960);
      if (buf && buf.length > 10000) {
        console.log(`  ✓ ${name} — ${(buf.length/1024).toFixed(0)}KB`);
        pass++;
      } else {
        console.error(`  ✗ ${name} — buffer too small or null (${buf?.length || 0} bytes)`);
        fail++;
      }
    } catch (err) {
      console.error(`  ✗ ${name} — ERROR:`, err.message);
      fail++;
    }
  }
  console.log(`\n${pass}/${pass+fail} templates passed`);
  if (fail > 0) process.exit(1);
})();
