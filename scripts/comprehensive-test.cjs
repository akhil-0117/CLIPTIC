#!/usr/bin/env node
// Comprehensive test suite for CLIPTIC bot
(async () => {
const path = require('path');
const base = path.join(__dirname, '..', 'dist');
const fs = require('fs');

let passed = 0;
let failed = 0;
let errors = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    failed++;
    errors.push({ name, error: err.message });
    console.log(`  \u2717 ${name}: ${err.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    failed++;
    errors.push({ name, error: err.message });
    console.log(`  \u2717 ${name}: ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}
function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(msg || `Expected ${expected}, got ${actual}`);
}
function assertNotNull(val, msg) {
  if (val === null || val === undefined) throw new Error(msg || 'Expected non-null value');
}

// ━━━ DATABASE ━━━
console.log('\n\u2501\u2501\u2501 Database Operations \u2501\u2501\u2501');
const db = require(path.join(base, 'database'));

test('getOrCreateUser creates new user', () => {
  const user = db.getOrCreateUser('test_discord_999', 'TestUser#9999');
  assertNotNull(user);
  assertEqual(user.discord_id, 'test_discord_999');
});
test('getOrCreateUser returns existing user', () => {
  const u1 = db.getOrCreateUser('test_discord_999', 'TestUser#9999');
  const u2 = db.getOrCreateUser('test_discord_999', 'TestUser#9999');
  assertEqual(u1.id, u2.id);
});
test('setUserVerified works', () => {
  db.setUserVerified('test_discord_999');
  assert(db.isUserVerified('test_discord_999'));
});
test('addSocialAccount creates account', () => {
  const user = db.getOrCreateUser('test_discord_999', 'TestUser#9999');
  db.addSocialAccount(user.id, 'tiktok', 'testuser', 'VERIFY-CLIP-1234', 'https://tiktok.com/@testuser');
  const acc = db.getSocialAccountByPlatform(user.id, 'tiktok');
  assertNotNull(acc);
  assertEqual(acc.username, 'testuser');
});
test('updateSocialMetrics works', () => {
  const user = db.getOrCreateUser('test_discord_999', 'TestUser#9999');
  db.updateSocialMetrics(user.id, 'tiktok', 5000, 250);
  const acc = db.getSocialAccountByPlatform(user.id, 'tiktok');
  assertEqual(acc.follower_count, 5000);
  assertEqual(acc.avg_views, 250);
});
test('removeSocialAccount works', () => {
  const user = db.getOrCreateUser('test_discord_999', 'TestUser#9999');
  db.removeSocialAccount(user.id, 'tiktok');
  const acc = db.getSocialAccountByPlatform(user.id, 'tiktok');
  assertEqual(acc, undefined);
});
test('addPaymentMethod works', () => {
  const user = db.getOrCreateUser('test_discord_999', 'TestUser#9999');
  db.addPaymentMethod(user.id, 'USDT-TRC20', 'TXyz1234');
  const payment = db.getPayment(user.id);
  assertNotNull(payment);
  assertEqual(payment.method, 'USDT-TRC20');
});
test('updateBalance works', () => {
  const user = db.getOrCreateUser('test_discord_999', 'TestUser#9999');
  db.updateBalance(user.id, 50.00);
  const payment = db.getPayment(user.id);
  assert(payment.balance >= 50);
});
test('addNotification works', () => {
  const user = db.getOrCreateUser('test_discord_999', 'TestUser#9999');
  db.addNotification(user.id, 'test', 'Test notification');
  const notifs = db.getUnreadNotifications(user.id);
  assert(notifs.length >= 1);
});
test('markNotificationsRead works', () => {
  const user = db.getOrCreateUser('test_discord_999', 'TestUser#9999');
  db.markNotificationsRead(user.id);
  const notifs = db.getUnreadNotifications(user.id);
  assertEqual(notifs.length, 0);
});
test('submitClip works', () => {
  const user = db.getOrCreateUser('test_discord_999', 'TestUser#9999');
  const id = db.submitClip(user.id, 'tiktok', 'https://tiktok.com/@user/video/123', 'Test clip');
  assertNotNull(id);
});
test('createCampaign works', () => {
  const id = db.createCampaign('Test Campaign', 'Description', ['tiktok'], 'English', '$0.60/1K', 500, 'Rules', 'Admin');
  assertNotNull(id);
  const c = db.getCampaign(id);
  assertEqual(c.title, 'Test Campaign');
});
test('getActiveCampaigns returns campaigns', () => {
  assert(db.getActiveCampaigns().length >= 1);
});
test('submitCampaignPost works', () => {
  const user = db.getOrCreateUser('test_discord_888', 'TestUser3#8888');
  const c = db.getActiveCampaigns()[0];
  const postId = db.submitCampaignPost(c.id, user.id, 'https://tiktok.com/@user/video/999', 'tiktok');
  assertNotNull(postId);
});
test('getCampaignPosts returns posts', () => {
  const c = db.getActiveCampaigns()[0];
  assert(db.getCampaignPosts(c.id).length >= 1);
});
test('verifyCampaignPost works', () => {
  const c = db.getActiveCampaigns()[0];
  const post = db.getCampaignPosts(c.id).find(p => p.status === 'pending');
  if (post) {
    db.verifyCampaignPost(post.id, 15000, 12.00, 'admin');
    const updated = db.getCampaignPost(post.id);
    assertEqual(updated.status, 'verified');
  }
});
test('creditCampaignPostEarnings works', () => {
  const c = db.getActiveCampaigns()[0];
  const post = db.getCampaignPosts(c.id).find(p => p.status === 'verified');
  if (post) {
    db.creditCampaignPostEarnings(post.id);
    const updated = db.getCampaignPost(post.id);
    assertEqual(updated.credited, 1);
  }
});
test('getCampaignStats works', () => {
  const c = db.getActiveCampaigns()[0];
  const stats = db.getCampaignStats(c.id);
  assertNotNull(stats.totalPosts);
});
test('hasUserPostedInCampaign works', () => {
  const user = db.getOrCreateUser('test_discord_888', 'TestUser3#8888');
  const c = db.getActiveCampaigns()[0];
  assert(db.hasUserPostedInCampaign(c.id, user.id));
});
test('getLeaderboard works', () => {
  assert(Array.isArray(db.getLeaderboard(10)));
});
test('getEarningsHistory works', () => {
  const user = db.getOrCreateUser('test_discord_999', 'TestUser#9999');
  assert(Array.isArray(db.getEarningsHistory(user.id)));
});

// ━━━ CARD TEMPLATES ━━━
console.log('\n\u2501\u2501\u2501 Card Templates \u2501\u2501\u2501');
const t = require(path.join(base, 'utils', 'imageTemplates'));
const { renderHtmlToImage } = require(path.join(base, 'utils', 'imageGenerator'));

const templates = [
  ['welcomeCardHtml', () => t.welcomeCardHtml('TestUser#1337')],
  ['verificationPanelHtml', () => t.verificationPanelHtml()],
  ['accountVerifyPanelHtml', () => t.accountVerifyPanelHtml()],
  ['connectAccountPanelHtml', () => t.connectAccountPanelHtml()],
  ['accountDashboardPanelHtml', () => t.accountDashboardPanelHtml()],
  ['accountDashboardHtml', () => t.accountDashboardHtml('TestUser', [{platform:'tiktok',username:'test',follower_count:1200,avg_views:450}], {balance:42.5,total_paid:285}, 3)],
  ['paymentDashboardPanelHtml', () => t.paymentDashboardPanelHtml()],
  ['paymentDashboardHtml', () => t.paymentDashboardHtml('TestUser', {balance:42.5,total_paid:285,method:'USDT-TRC20',wallet_address:'TXyz1234'})],
  ['ticketCardHtml', () => t.ticketCardHtml('123456789')],
  ['leaderboardHtml', () => t.leaderboardHtml([{discord_tag:'User1',total_views:12500,total_earnings:45}])],
  ['clipSubmissionHtml', () => t.clipSubmissionHtml('tiktok','https://tiktok.com/@user/video/123','My Clip','pending')],
  ['earningsHtml', () => t.earningsHtml('TestUser',{balance:42.5,total_paid:285},[{source:'clip',amount:5.4,created_at:'2026-09-20T10:00:00'}])],
  ['notificationsHtml', () => t.notificationsHtml([{type:'success',message:'Clip approved',read:0,created_at:new Date().toISOString()}])],
  ['serverStatsHtml', () => t.serverStatsHtml({totalMembers:14280,totalClips:89410,totalEarnings:12400,totalPaid:48920,activeClippers:1420,topPlatform:'TikTok'})],
  ['bioCodeCardHtml', () => t.bioCodeCardHtml('tiktok','testuser','VERIFY-CLIP-8492')],
  ['successCardHtml', () => t.successCardHtml('Account Connected','Your account has been linked.')],
  ['errorCardHtml', () => t.errorCardHtml('Verification Failed','Could not find code.')],
  ['deniedCardHtml', () => t.deniedCardHtml('Insufficient followers.')],
  ['adminVerifiedCardHtml', () => t.adminVerifiedCardHtml('TestUser#1234')],
  ['adminDeniedCardHtml', () => t.adminDeniedCardHtml('TestUser#1234','Low followers')],
  ['campaignCardHtml', () => t.campaignCardHtml({title:'Q3 Sprint',description:'Grow',platforms:['TikTok'],audiences:'English',payoutRate:'$0.60/1K',minViews:500,rules:'Use audio',status:'active',createdBy:'Admin'})],
  ['campaignJoinSuccessHtml', () => t.campaignJoinSuccessHtml('Q3 Sprint','https://discord.gg/abc')],
];

for (const [name, fn] of templates) {
  test(`Template ${name} valid HTML`, () => {
    const html = fn();
    assert(typeof html === 'string');
    assert(html.length > 1000, `Got ${html.length} chars`);
    assert(html.includes('CLIPTIC'));
    assert(html.includes('1600px'));
    assert(html.includes('960px'));
  });
}

// ━━━ WALLET & PROFILE CARDS ━━━
console.log('\n\u2501\u2501\u2501 Wallet & Profile Cards \u2501\u2501\u2501');
const { generateWalletCardImage, generateProfileCardImage } = require(path.join(base, 'utils', 'walletCardTemplate'));

await testAsync('Wallet card renders', async () => {
  const buf = await generateWalletCardImage({
    username: 'TestUser', balance: 42.50, totalPaid: 285.00, totalViews: 125000,
    clipsApproved: 3, rank: '#5', paymentMethod: 'USDT-TRC20',
    walletAddress: 'TXyz1234abcd5678', socialAccounts: [{platform:'tiktok',username:'testuser',follower_count:1200,avg_views:450}]
  });
  assertNotNull(buf);
  assert(buf.length > 100000, `Got ${buf.length} bytes`);
});

await testAsync('Profile card renders', async () => {
  const buf = await generateProfileCardImage({
    username: 'TestUser', lastSync: 'Just now',
    socialAccounts: [{platform:'tiktok',username:'testuser',follower_count:1200,avg_views:450,verified:1}]
  });
  assertNotNull(buf);
  assert(buf.length > 100000, `Got ${buf.length} bytes`);
});

// ━━━ IMAGE RENDERING ━━━
console.log('\n\u2501\u2501\u2501 Image Rendering \u2501\u2501\u2501');
await testAsync('All 22 templates render to PNG', async () => {
  let ok = 0;
  for (const [name, fn] of templates) {
    const buf = await renderHtmlToImage(fn(), 1600, 960);
    if (buf && buf.length > 10000) ok++;
    else throw new Error(`${name} failed: ${buf ? buf.length : 0} bytes`);
  }
  assertEqual(ok, templates.length);
});

// ━━━ BIO SCRAPER ━━━
console.log('\n\u2501\u2501\u2501 Bio Scraper \u2501\u2501\u2501');
const bio = require(path.join(base, 'utils', 'bioScraper'));

test('extractUsernameFromUrl - TikTok', () => {
  assertEqual(bio.extractUsernameFromUrl('https://tiktok.com/@user/video/123', 'tiktok'), 'user');
  assertEqual(bio.extractUsernameFromUrl('@user', 'tiktok'), 'user');
  assertEqual(bio.extractUsernameFromUrl('user', 'tiktok'), 'user');
});
test('extractUsernameFromUrl - Instagram', () => {
  assertEqual(bio.extractUsernameFromUrl('https://www.instagram.com/itznex17?utm_source=qr', 'instagram'), 'itznex17');
});
test('extractUsernameFromUrl - YouTube', () => {
  assertEqual(bio.extractUsernameFromUrl('https://www.youtube.com/@channel', 'youtube'), 'channel');
});
test('generateVerificationCode format', () => {
  const code = bio.generateVerificationCode();
  assert(code.startsWith('VERIFY-CLIP-'));
  assertEqual(code.length, 16);
});

// ━━━ CONFIG ━━━
console.log('\n\u2501\u2501\u2501 Configuration \u2501\u2501\u2501');
const { config } = require(path.join(base, 'config'));

test('Config token set', () => assertNotNull(config.token));
test('Config channels set', () => {
  assertNotNull(config.channels.verification);
  assertNotNull(config.channels.accountVerify);
  assertNotNull(config.channels.connectAccount);
  assertNotNull(config.channels.accountDashboard);
  assertNotNull(config.channels.paymentDashboard);
});
test('Config roles correct', () => {
  assertEqual(config.roles.verified, 'VERIFIED');
  assertEqual(config.roles.clipper, 'CLIPPER');
  assertEqual(config.roles.president, 'PRESIDENT');
});
test('Config thresholds', () => {
  assert(config.verification.minFollowers > 0);
  assert(config.verification.minAvgViews > 0);
  assert(config.payment.minPayoutThreshold > 0);
});
test('Config campaign channel', () => assertNotNull(config.campaignChannelId));

// ━━━ LOGO ━━━
console.log('\n\u2501\u2501\u2501 Logo \u2501\u2501\u2501');
const { LOGO_DATA_URI } = require(path.join(base, 'utils', 'logo'));
test('Logo is valid data URI', () => {
  assertNotNull(LOGO_DATA_URI);
  assert(LOGO_DATA_URI.startsWith('data:image/'));
  assert(LOGO_DATA_URI.length > 100);
});

// ━━━ COMMAND DEFINITIONS ━━━
console.log('\n\u2501\u2501\u2501 Commands \u2501\u2501\u2501');
const { commandDefinitions } = require(path.join(base, 'commands', 'commandDefinitions'));
test('Commands array populated', () => {
  assert(Array.isArray(commandDefinitions));
  assert(commandDefinitions.length > 0);
});
test('Required commands exist', () => {
  const names = commandDefinitions.map(c => c.name);
  for (const cmd of ['account','profile','leaderboard','earnings','notifications','stats','campaigns','remove-connection']) {
    assert(names.includes(cmd), `Missing /${cmd}`);
  }
});

// ━━━ ADMIN SERVER ━━━
console.log('\n\u2501\u2501\u2501 Admin Server \u2501\u2501\u2501');
const http = require('http');

await testAsync('Admin serves HTML', async () => {
  return new Promise((resolve, reject) => {
    require(path.join(base, 'admin', 'server'));
    setTimeout(() => {
      http.get('http://localhost:3001/', (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          try {
            assertEqual(res.statusCode, 200);
            assert(d.includes('CLIPTIC'));
            assert(d.includes('viewCampaignPosts'));
            assert(d.includes('verifyPost'));
            assert(d.includes('creditAllVerified'));
            resolve();
          } catch(e) { reject(e); }
        });
      }).on('error', reject);
    }, 2000);
  });
});

await testAsync('API /api/campaigns returns JSON', async () => {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3001/api/campaigns', (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          assertEqual(res.statusCode, 200);
          assert(res.headers['content-type'].includes('json'));
          assert(Array.isArray(JSON.parse(d)));
          resolve();
        } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
});

await testAsync('API /api/campaigns/:id/posts returns JSON', async () => {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3001/api/campaigns', (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        const cs = JSON.parse(d);
        if (cs.length === 0) return resolve();
        http.get('http://localhost:3001/api/campaigns/' + cs[0].id + '/posts', (r2) => {
          let d2 = ''; r2.on('data', c => d2 += c);
          r2.on('end', () => {
            try {
              assertEqual(r2.statusCode, 200);
              assert(Array.isArray(JSON.parse(d2)));
              resolve();
            } catch(e) { reject(e); }
          });
        });
      });
    });
  });
});

await testAsync('API /api/campaigns/:id/stats returns JSON', async () => {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3001/api/campaigns', (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        const cs = JSON.parse(d);
        if (cs.length === 0) return resolve();
        http.get('http://localhost:3001/api/campaigns/' + cs[0].id + '/stats', (r2) => {
          let d2 = ''; r2.on('data', c => d2 += c);
          r2.on('end', () => {
            try {
              assertEqual(r2.statusCode, 200);
              const stats = JSON.parse(d2);
              assertNotNull(stats.totalPosts);
              assertNotNull(stats.verifiedPosts);
              assertNotNull(stats.totalViews);
              assertNotNull(stats.totalEarnings);
              resolve();
            } catch(e) { reject(e); }
          });
        });
      });
    });
  });
});

await testAsync('API /api/analytics returns data', async () => {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3001/api/analytics', (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          assertEqual(res.statusCode, 200);
          const a = JSON.parse(d);
          assertNotNull(a.totalUsers);
          assertNotNull(a.activeCampaigns);
          resolve();
        } catch(e) { reject(e); }
      });
    });
  });
});

await testAsync('API /api/users returns data', async () => {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3001/api/users', (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          assertEqual(res.statusCode, 200);
          assert(Array.isArray(JSON.parse(d)));
          resolve();
        } catch(e) { reject(e); }
      });
    });
  });
});

// ━━━ FILE STRUCTURE ━━━
console.log('\n\u2501\u2501\u2501 File Structure \u2501\u2501\u2501');
const srcFiles = [
  'src/index.ts','src/config.ts','src/database.ts',
  'src/events/ready.ts','src/events/interactionCreate.ts','src/events/guildMemberAdd.ts','src/events/campaignPoster.ts',
  'src/commands/commandDefinitions.ts',
  'src/utils/imageTemplates.ts','src/utils/imageGenerator.ts','src/utils/bioScraper.ts',
  'src/utils/walletCardTemplate.ts','src/utils/logo.ts',
  'src/admin/server.ts','src/admin/bridge.ts',
];
const distFiles = srcFiles.map(f => f.replace('src/', 'dist/').replace('.ts', '.js'));

for (const file of [...srcFiles, ...distFiles]) {
  test(`File: ${file}`, () => {
    assert(fs.existsSync(path.join(__dirname, '..', file)), `Missing: ${file}`);
  });
}

// ━━━ SUMMARY ━━━
console.log('\n' + '\u2550'.repeat(50));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('\u2550'.repeat(50));
if (failed > 0) {
  console.log('\nFailed:');
  for (const e of errors) console.log(`  \u2717 ${e.name}: ${e.error}`);
}
process.exit(failed > 0 ? 1 : 0);
})();
