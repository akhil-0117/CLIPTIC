import { EmbedBuilder, ColorResolvable } from "discord.js";

// Professional dark purple palette matching the CLIPTIC wallet card
const COLORS = {
  primary: 0x7c4dff as ColorResolvable,    // Purple accent
  dark: 0x0e0a22 as ColorResolvable,        // Deep background
  gold: 0xf5a623 as ColorResolvable,        // Gold accent
  green: 0x7dffc0 as ColorResolvable,       // Success
  red: 0xff3b30 as ColorResolvable,         // Error
  muted: 0x9a8ac9 as ColorResolvable,       // Muted text
};

const BRANDING = {
  footer: "CLIPTIC NETWORK",
  header: "CLIPTIC",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WELCOME
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function welcomeEmbed(username: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("CLIPTIC NETWORK")
    .setDescription(
      `**${username}**, welcome to **CLIPTIC**.\n\n` +
      `The network for professional clip creators.\n\n` +
      `**Getting Started**\n` +
      `1. Verify your account in the verification channel\n` +
      `2. Connect your social media accounts\n` +
      `3. Begin creating and earning`
    )
    .setColor(COLORS.primary)
    .setFooter({ text: BRANDING.footer })
    .setTimestamp();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VERIFICATION — General server access
// Gives: VERIFIED role
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function verificationPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("SERVER VERIFICATION")
    .setDescription(
      "Verify your account to access the server.\n\n" +
      "**Steps**\n" +
      "1. Click **Authorize & Verify** below\n" +
      "2. Confirm you agree to the server rules\n" +
      "3. You will receive the **VERIFIED** role\n\n" +
      "This grants access to all server channels."
    )
    .setColor(COLORS.primary)
    .setFooter({ text: BRANDING.footer })
    .setTimestamp();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLIPPER VERIFICATION — Requires proof
// Gives: CLIPPER role
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function accountVerifyEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("CLIPPER VERIFICATION")
    .setDescription(
      "Obtain the **CLIPPER** role by verifying your social media presence.\n\n" +
      "**Requirements**\n" +
      "• Minimum **50 followers** on your social media account\n" +
      "• **250+ average views** on recent content\n" +
      "• Account must be set to **PUBLIC**\n\n" +
      "**Process**\n" +
      "1. Select a connected account from the dropdown\n" +
      "2. A private ticket channel will be created\n" +
      "3. Upload a screen recording of your social media insights\n" +
      "4. Recording must show follower count and view metrics\n" +
      "5. A staff member will review and verify you"
    )
    .setColor(COLORS.primary)
    .setFooter({ text: BRANDING.footer })
    .setTimestamp();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONNECT SOCIAL MEDIA
// Bio verification flow
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function connectAccountEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("CONNECT SOCIAL MEDIA")
    .setDescription(
      "Link your social media accounts to your CLIPTIC profile.\n\n" +
      "**Supported Platforms**\n" +
      "TikTok — instagram — YouTube\n\n" +
      "**Process**\n" +
      "1. Select a platform from the dropdown\n" +
      "2. Enter your profile URL or username\n" +
      "3. A unique verification code will be generated\n" +
      "4. Paste the code in your public profile bio\n" +
      "5. Click **Scan Profile** to complete verification"
    )
    .setColor(COLORS.primary)
    .setFooter({ text: BRANDING.footer })
    .setTimestamp();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TICKET — Clipper proof review
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function ticketEmbed(userId: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("CLIPPER VERIFICATION TICKET")
    .setDescription(
      `<@${userId}>\n\n` +
      "Your verification ticket has been created. Follow these steps:\n\n" +
      "**Step 1:** Upload a screen recording of your social media account insights.\n" +
      "**Step 2:** The recording must clearly show:\n" +
      "• Your follower count\n" +
      "• Your view metrics / analytics\n\n" +
      "This verifies ownership and authenticity.\n\n" +
      "A staff member will review your submission and notify you once verified."
    )
    .setColor(COLORS.primary)
    .setFooter({ text: BRANDING.footer })
    .setTimestamp();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACCOUNT DASHBOARD — Personal view
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function accountDashboardEmbed(
  userId: string,
  socialAccounts: any[]
): EmbedBuilder {
  let accountsList = "No accounts connected.";
  if (socialAccounts.length > 0) {
    accountsList = socialAccounts
      .map(
        (acc) =>
          `**${acc.platform}** — @${acc.username}\n` +
          `Followers: ${acc.follower_count.toLocaleString()} | Avg Views: ${acc.avg_views.toLocaleString()}`
      )
      .join("\n\n");
  }

  return new EmbedBuilder()
    .setTitle("ACCOUNT DASHBOARD")
    .setDescription(
      `Account overview for <@${userId}>\n\n` +
      `**Connected Accounts**\n\n${accountsList}`
    )
    .setColor(COLORS.primary)
    .setFooter({ text: BRANDING.footer })
    .setTimestamp();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WALLET CARD — /account command
// Matches the HTML wallet card design
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function walletCardEmbed(
  username: string,
  avatarLetter: string,
  balance: number,
  totalPaid: number,
  socialAccounts: any[],
  totalViews: number,
  rank: string,
  paymentMethod: string,
  walletAddress: string
): EmbedBuilder {
  const platformCounts = socialAccounts.reduce((acc: Record<string, number>, s: any) => {
    acc[s.platform] = (acc[s.platform] || 0) + 1;
    return acc;
  }, {});

  const connectedPlatforms = Object.entries(platformCounts)
    .map(([p, c]: [string, any]) => `${p} x${c}`)
    .join(" · ") || "None";

  const clippedWallet = walletAddress
    ? walletAddress.substring(0, 4) + "..." + walletAddress.substring(walletAddress.length - 4)
    : "N/A";

  const footerLines = socialAccounts.length > 0
    ? socialAccounts.map((acc: any) => `${acc.platform} · @${acc.username}`).join("\n")
    : "No connected accounts";

  return new EmbedBuilder()
    .setTitle("CLIPTIC NETWORK")
    .setDescription(
      `**Account** ${username}\n` +
      `**Tier** VERIFIED CLIPPER\n\n` +
      `**Unpaid Earnings**\n` +
      `\`\`\`\n$${balance.toFixed(2)} USD\n\`\`\`\n` +
      (paymentMethod !== "NONE"
        ? `**Payment** ${paymentMethod} — \`${clippedWallet}\`\n\n`
        : `**Payment** No method configured\n\n`) +
      `**Stats**\n` +
      `Total Views: ${formatNumber(totalViews)}\n` +
      `Clips Approved: ${socialAccounts.length}\n` +
      `Total Paid: $${totalPaid.toFixed(2)}\n` +
      `Server Rank: ${rank}\n\n` +
      `**Connected Accounts**\n` +
      `${footerLines}\n\n` +
      `**Status** ${totalPaid > 0 ? "READY" : "PENDING"}`
    )
    .setColor(COLORS.primary)
    .setFooter({ text: BRANDING.footer })
    .setTimestamp();
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAYMENT DASHBOARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function paymentDashboardEmbed(
  userId: string,
  payment: any
): EmbedBuilder {
  const balance = payment?.balance?.toFixed(2) || "0.00";
  const totalPaid = payment?.total_paid?.toFixed(2) || "0.00";
  const method = payment?.method || "None set";
  const wallet = payment?.wallet_address || "N/A";
  const clippedWallet = wallet !== "N/A"
    ? wallet.substring(0, 4) + "..." + wallet.substring(wallet.length - 4)
    : "N/A";

  return new EmbedBuilder()
    .setTitle("PAYMENT DASHBOARD")
    .setDescription(
      `Account overview for <@${userId}>\n\n` +
      `**Current Balance**\n` +
      `\`\`\`\n$${balance} USD\n\`\`\`\n` +
      (method !== "None set"
        ? `**Payment Method**\n${method} — \`${clippedWallet}\`\n\n`
        : `**Payment Method**\nNo method configured\n\n`) +
      `**Total Paid Out**\n$${totalPaid} USD\n\n` +
      `*Minimum payout threshold: $10.00*`
    )
    .setColor(COLORS.primary)
    .setFooter({ text: BRANDING.footer })
    .setTimestamp();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROFILE CARD — /profile command
// Matches the HTML profile card design
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

export function profileCardEmbed(
  username: string,
  socialAccounts: any[],
  lastSync: string
): EmbedBuilder {
  const totalFollowers = socialAccounts.reduce(
    (sum: number, a: any) => sum + (a.follower_count || 0),
    0
  );
  const totalViews = socialAccounts.reduce(
    (sum: number, a: any) => sum + (a.avg_views || 0) * 10,
    0
  );
  const clipsTracked = socialAccounts.length;

  // Build connected accounts section
  let accountsSection = "No connected accounts.";
  if (socialAccounts.length > 0) {
    accountsSection = socialAccounts
      .map((acc: any) => {
        const icon = PLATFORM_ICONS[acc.platform] || acc.platform;
        const viewCount = formatNumber((acc.avg_views || 0) * 10);
        return (
          `**${icon}** — @${acc.username}\n` +
          `Followers: ${formatNumber(acc.follower_count)} | Views: ${viewCount}`
        );
      })
      .join("\n\n");
  }

  // Build metrics section
  const metricsSection =
    `**Combined Views** — ${formatNumber(totalViews)}\n` +
    `**Total Followers** — ${formatNumber(totalFollowers)}\n` +
    `**Accounts Linked** — ${clipsTracked}\n` +
    `**Last Sync** — ${lastSync}`;

  return new EmbedBuilder()
    .setTitle(`${username} — Creator Profile`)
    .setDescription(
      `**CONNECTED ACCOUNTS**\n${socialAccounts.length} account(s)\n\n` +
      `${accountsSection}\n\n` +
      `───────────────────────\n\n` +
      `${metricsSection}`
    )
    .setColor(COLORS.primary)
    .setFooter({ text: "CLIPTIC NETWORK" })
    .setTimestamp();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITY EMBEDS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function successEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(COLORS.green)
    .setTimestamp();
}

export function errorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(COLORS.red)
    .setTimestamp();
}
