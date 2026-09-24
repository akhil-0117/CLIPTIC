import {
  Events,
  Interaction,
  ButtonInteraction,
  ModalSubmitInteraction,
  ChatInputCommandInteraction,
  PermissionsBitField,
  ChannelType,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  AttachmentBuilder,
} from "discord.js";
import { config } from "../config";
import {
  getOrCreateUser,
  setUserVerified,
  createTicket,
  closeTicket,
  addSocialAccount,
  verifySocialAccount,
  removeSocialAccount,
  getSocialAccounts,
  getSocialAccountByPlatform,
  updateSocialMetrics,
  addPaymentMethod,
  createPayoutRequest,
  getPayment,
  getLeaderboard,
  getClipperRank,
  getClipsByUser,
  getPendingClips,
  getUnreadNotifications,
  markNotificationsRead,
  addNotification,
  submitClip,
  getEarningsHistory,
  getActiveCampaigns,
} from "../database";
import { generateVerificationCode, verifyBio, extractUsernameFromUrl, fetchPlatformStats, fetchFollowerCount } from "../utils/bioScraper";
import { renderHtmlToImage } from "../utils/imageGenerator";
import {
  successCardHtml,
  errorCardHtml,
  bioCodeCardHtml,
  ticketCardHtml,
  accountDashboardHtml,
  adminVerifiedCardHtml,
  adminDeniedCardHtml,
  deniedCardHtml,
  leaderboardHtml,
  clipSubmissionHtml,
  earningsHtml,
  notificationsHtml,
  serverStatsHtml,
  accountVerifyPanelHtml,
  connectAccountPanelHtml,
  campaignCardHtml,
} from "../utils/imageTemplates";

const IMG_W = 1600;
const IMG_H = 960;

const pendingVerifications = new Map<
  string,
  { platform: string; username: string; code: string; step: "code_given" | "url_submitted" }
>();

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function sendImage(
  interaction: any,
  html: string,
  w: number = IMG_W,
  h: number = IMG_H,
  name: string = "card.png",
  ephemeral: boolean = false,
  components?: any[]
) {
  // CRITICAL: ACK the interaction IMMEDIATELY — Discord kills interactions
  // after 3 seconds, and image rendering takes 3-8s. Defer first, render second.
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: ephemeral ? 64 : undefined }).catch(() => {});
  }
  const buffer = await renderHtmlToImage(html, w, h);
  if (buffer) {
    const payload: any = { files: [new AttachmentBuilder(buffer, { name })] };
    if (components) payload.components = components;
    if (interaction.deferred) {
      await interaction.editReply(payload);
    } else if (interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } else {
    const fallback = "[Image generation failed — try again]";
    if (interaction.deferred) await interaction.editReply({ content: fallback });
    else if (interaction.replied) await interaction.followUp({ content: fallback, flags: 64 });
    else await interaction.reply({ content: fallback, flags: 64 });
  }
}

async function sendImageToChannel(channel: TextChannel, html: string, w: number, h: number, name: string, components?: any[], content?: string) {
  const buffer = await renderHtmlToImage(html, w, h);
  if (buffer) {
    const payload: any = { files: [new AttachmentBuilder(buffer, { name })] };
    if (components) payload.components = components;
    if (content) payload.content = content;
    await channel.send(payload);
  } else {
    await channel.send({ content: content || "[Image failed]", components });
  }
}

async function dmUser(user: any, html: string, name: string = "dm.png") {
  try {
    const dm = await user.createDM();
    const buffer = await renderHtmlToImage(html, IMG_W, IMG_H);
    if (buffer) await dm.send({ files: [new AttachmentBuilder(buffer, { name })] });
  } catch {}
}

async function dmUserText(user: any, text: string) {
  try {
    const dm = await user.createDM();
    await dm.send({ content: text });
  } catch {}
}

/**
 * Store a notification in the DB AND send it as a Discord DM.
 * This is the single entry-point for all user notifications — ensures
 * the /notifications command shows them AND users get DMs.
 */
async function notifyUser(discordUser: any, userData: any, type: string, message: string, html?: string) {
  try {
    addNotification(userData.id, type, message);
  } catch {}
  try {
    if (html) {
      await dmUser(discordUser, html);
    } else {
      await dmUserText(discordUser, `**CLIPTIC** — ${message}`);
    }
  } catch {}
}

async function ensureClipperRole(guild: any) {
  let role = guild.roles.cache.find((r: any) => r.name.toUpperCase() === "CLIPPER");
  if (!role) {
    role = await guild.roles.create({ name: "CLIPPER", color: 0x8b5cff, reason: "Auto-created for verified clippers" });
    for (const [, ch] of guild.channels.cache) {
      if (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildVoice) {
        await ch.permissionOverwrites.edit(role, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
      }
    }
  }
  return role;
}

async function ensureVerifiedRole(guild: any) {
  let role = guild.roles.cache.find((r: any) => r.name.toUpperCase() === config.roles.verified.toUpperCase());
  if (!role) {
    role = await guild.roles.create({ name: config.roles.verified, color: 0x34c759, reason: "Auto-created for verified members" });
    for (const [, ch] of guild.channels.cache) {
      if (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildVoice) {
        await ch.permissionOverwrites.edit(role, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
      }
    }
  }
  return role;
}

function isPresident(member: any): boolean {
  return member.roles.cache.some((r: any) => r.name.toUpperCase() === config.roles.president.toUpperCase());
}

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: Interaction) {
    try {
      if (interaction.isButton()) await handleButton(interaction);
      else if (interaction.isStringSelectMenu()) await handleSelectMenu(interaction);
      else if (interaction.isModalSubmit()) await handleModal(interaction);
      else if (interaction.isChatInputCommand()) await handleSlashCommand(interaction);
    } catch (error) {
      console.error("[Interaction] Error:", error);
      try {
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await sendImage(interaction, errorCardHtml("Error", "An unexpected error occurred. Please try again."), IMG_W, IMG_H, "error.png", true);
        }
      } catch {}
    }
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUTTON HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleButton(interaction: ButtonInteraction) {
  const { customId, user } = interaction;

  // ── VERIFY START — give VERIFIED role ──
  if (customId === "verify_start") {      await interaction.deferReply({ flags: 64 });
    const guild = interaction.guild;
    if (!guild) return;
    try {
      getOrCreateUser(user.id, user.tag);
      const verifiedRole = await ensureVerifiedRole(guild);
      const member = await guild.members.fetch(user.id);
      await member.roles.add(verifiedRole);
      setUserVerified(user.id);
      await dmUser(user, successCardHtml("Verification Complete", "You have been granted the <strong style=\"color:#a4ffd4\">VERIFIED</strong> role. You now have access to all server channels. Head to <strong style=\"color:#a4ffd4\">Connect Account</strong> to link your social media."));
      await sendImage(interaction, successCardHtml("Verification Complete", "You have been granted the <strong style=\"color:#a4ffd4\">VERIFIED</strong> role. Check your DMs for next steps."), IMG_W, IMG_H, "verified.png", true);
    } catch (error) {
      console.error("Error verifying:", error);
      await sendImage(interaction, errorCardHtml("Error", "Failed to complete verification."), IMG_W, IMG_H, "error.png", true);
    }
    return;
  }

  // ── ACCOUNT VERIFY START — show account dropdown ──
  if (customId === "account_verify_start") {
    await interaction.deferReply({ flags: 64 });
    const userData = getOrCreateUser(user.id, user.tag);
    const accounts = getSocialAccounts(userData.id) as any[];
    if (accounts.length === 0) {
      await sendImage(interaction, errorCardHtml("No Connected Accounts", "Connect a social media account first in the <strong style=\"color:#8b5cff\">Connect Account</strong> channel."), IMG_W, IMG_H, "error.png", true);
      return;
    }
    const options = accounts.map((acc: any) => ({ label: `@${acc.username}`, description: `${acc.platform} · ${acc.follower_count.toLocaleString()} followers`, value: acc.id }));
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId("account_verify_select").setPlaceholder("Select an account to verify").addOptions(options));
    const buffer = await renderHtmlToImage(accountVerifyPanelHtml(), IMG_W, IMG_H);
    if (buffer) {
      await interaction.editReply({ files: [new AttachmentBuilder(buffer, { name: "verify-select.png" })], components: [row] });
    } else {
      await interaction.editReply({ content: "Select an account to verify:", components: [row] });
    }
    return;
  }

  // ── CONNECT SOCIAL — show platform dropdown ──
  if (customId === "connect_social") {      await interaction.deferReply({ flags: 64 });
    const userData = getOrCreateUser(user.id, user.tag);
    const existing = getSocialAccounts(userData.id) as any[];
    const connectedPlatforms = existing.map((a: any) => a.platform);
    const platforms = [
      { label: "TikTok", description: "Link your TikTok account", value: "tiktok" },
      { label: "Instagram", description: "Link your Instagram account", value: "instagram" },
      { label: "YouTube", description: "Link your YouTube account", value: "youtube" },
    ].filter((p) => !connectedPlatforms.includes(p.value));
    if (platforms.length === 0) {
      await sendImage(interaction, errorCardHtml("All Connected", "You already have one account linked for each platform. Use /remove-connection to disconnect one first."), IMG_W, IMG_H, "error.png");
      return;
    }
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId("connect_platform_select").setPlaceholder("Choose a platform").addOptions(platforms));
    const buffer = await renderHtmlToImage(connectAccountPanelHtml(), IMG_W, IMG_H);
    if (buffer) await interaction.editReply({ files: [new AttachmentBuilder(buffer, { name: "connect.png" })], components: [row] });
    return;
  }

  // ── SCAN PROFILE ──
  if (customId === "scan_profile") {      await interaction.deferReply({ flags: 64 });
    const pending = pendingVerifications.get(user.id);
    if (!pending) {
      await sendImage(interaction, errorCardHtml("No Pending Verification", "Start the connection process first."), IMG_W, IMG_H, "error.png");
      return;
    }
    const bioFound = await verifyBio(pending.platform, pending.username, pending.code);
    if (bioFound) {
      const userData = getOrCreateUser(user.id, user.tag);
      addSocialAccount(userData.id, pending.platform, pending.username, pending.code, "");
      verifySocialAccount(userData.id, pending.platform, pending.username);
      // Pull the real follower count right away so the dashboard is populated
      fetchFollowerCount(pending.platform, pending.username)
        .then((followers) => {
          if (followers !== null) updateSocialMetrics(userData.id, pending.platform, followers, 0);
        })
        .catch(() => {});
      pendingVerifications.delete(user.id);
      await notifyUser(user, userData, "success", `Your ${pending.platform} account @${pending.username} has been linked to CLIPTIC.`, successCardHtml("Account Connected", `Your <strong style="color:#8b5cff">${pending.platform}</strong> account @${pending.username} has been linked to CLIPTIC. Username verified. Bio code confirmed.`));
      await sendImage(interaction, successCardHtml("Account Connected", `Your <strong style="color:#8b5cff">${pending.platform}</strong> account @${pending.username} has been linked. Bio code confirmed.`), IMG_W, IMG_H, "connected.png");
    } else {
      pendingVerifications.delete(user.id);
      await sendImage(interaction, errorCardHtml("Verification Failed", `Could not find the code <strong style="color:#8b5cff">${pending.code}</strong> in your ${pending.platform} bio. Ensure your profile is public, the code is pasted exactly, and you saved the change.`), IMG_W, IMG_H, "error.png");
    }
    return;
  }

  // ── ADD PAYMENT METHOD ──
  if (customId === "add_payment_method") {
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId("payment_method_select").setPlaceholder("Choose payment method").addOptions([
      { label: "USDT (TRC-20)", description: "Tether on TRON network", value: "USDT-TRC20" },
      { label: "USDT (ERC-20)", description: "Tether on Ethereum network", value: "USDT-ERC20" },
      { label: "Bitcoin (BTC)", description: "Bitcoin wallet", value: "BTC" },
      { label: "Litecoin (LTC)", description: "Litecoin wallet", value: "LTC" },
      { label: "PayPal", description: "PayPal email address", value: "PayPal" },
    ]));
    await interaction.deferReply({ flags: 64 });
    const buffer = await renderHtmlToImage(successCardHtml("Add Payment Method", "Select your preferred payment method below, then enter your wallet address."), IMG_W, IMG_H);
    if (buffer) await interaction.editReply({ files: [new AttachmentBuilder(buffer, { name: "payment.png" })], components: [row] });
    else await interaction.editReply({ content: "Select your preferred payment method:", components: [row] });
    return;
  }

  // ── WITHDRAW ──
  if (customId === "withdraw") {      await interaction.deferReply({ flags: 64 });
    const userData = getOrCreateUser(user.id, user.tag);
    const payment = getPayment(userData.id) as any;
    if (!payment || payment.method === "NONE") {
      await sendImage(interaction, errorCardHtml("No Payment Method", "Add a payment method first."), IMG_W, IMG_H, "error.png");
      return;
    }
    if (payment.balance < config.payment.minPayoutThreshold) {
      await sendImage(interaction, errorCardHtml("Insufficient Balance", `Your balance is <strong style="color:#ffb2c4">$${payment.balance.toFixed(2)}</strong>. Minimum is <strong>$${config.payment.minPayoutThreshold.toFixed(2)}</strong>.`), IMG_W, IMG_H, "error.png");
      return;
    }
    const payoutId = createPayoutRequest(userData.id, payment.balance);
    const amount = payment.balance;
    await sendImage(interaction, successCardHtml("Withdrawal Requested", `<strong style="color:#a4ffd4">$${amount.toFixed(2)}</strong> withdrawal submitted. Method: <strong>${payment.method}</strong>. Wallet: <code>${payment.wallet_address}</code>.`), IMG_W, IMG_H, "withdrawal.png");
    await notifyUser(user, userData, "withdrawal", `$${amount.toFixed(2)} withdrawal requested via ${payment.method}.`, successCardHtml("Withdrawal Requested", `Your <strong style="color:#a4ffd4">$${amount.toFixed(2)}</strong> withdrawal request has been submitted for review.`));
    const adminChannel = interaction.guild?.channels.cache.get(config.channels.paymentDashboard) as TextChannel;
    if (adminChannel) {
      await sendImageToChannel(adminChannel, successCardHtml("New Withdrawal", `<strong>User:</strong> <@${user.id}><br/><strong>Amount:</strong> $${amount.toFixed(2)}<br/><strong>Method:</strong> ${payment.method}`), IMG_W, IMG_H, "withdrawal-notify.png");
    }
    return;
  }

  // ── SUBMIT PROFILE URL ──
  if (customId === "submit_profile_url") {
    const pending = pendingVerifications.get(user.id);
    if (!pending || pending.step !== "code_given") {
      await sendImage(interaction, errorCardHtml("No Pending Verification", "Start the connection process first."), IMG_W, IMG_H, "error.png", true);
      return;
    }
    const platformName = pending.platform.charAt(0).toUpperCase() + pending.platform.slice(1);
    await interaction.showModal(new ModalBuilder().setCustomId("submit_profile_url_modal").setTitle(`Submit ${platformName} Profile URL`).addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("profile_url").setLabel(`Your ${platformName} profile URL`).setPlaceholder(`https://www.${pending.platform}.com/username`).setStyle(TextInputStyle.Short).setRequired(true))));
    return;
  }

  // ── SYNC ACCOUNTS (re-scrape follower counts) ──
  if (customId === "sync_accounts") {      await interaction.deferReply({ flags: 64 });
    const userData = getOrCreateUser(user.id, user.tag);
    const accounts = getSocialAccounts(userData.id) as any[];
    if (accounts.length === 0) {
      await sendImage(interaction, errorCardHtml("No Connected Accounts", "Connect a social media account first."), IMG_W, IMG_H, "error.png");
      return;
    }
    // Re-scrape live follower counts for each connected account
    const { fetchFollowerCount } = await import("../utils/bioScraper");
    let synced = 0;
    const updated: string[] = [];
    for (const acc of accounts) {
      try {
        const followers = await fetchFollowerCount(acc.platform, acc.username);
        if (followers !== null) {
          updateSocialMetrics(userData.id, acc.platform, followers, acc.avg_views || 0);
          synced++;
          updated.push(`${acc.platform}: ${followers.toLocaleString()} followers`);
        }
      } catch {}
    }
    if (synced === 0) {
      await sendImage(interaction, errorCardHtml("Sync Unavailable", "Could not reach the platform APIs right now. Your follower counts were not changed — try again in a few minutes."), IMG_W, IMG_H, "error.png");
      return;
    }
    await sendImage(interaction, successCardHtml("Accounts Synced", `Updated <strong style="color:#8b5cff">${synced}</strong> account${synced !== 1 ? "s" : ""}:<br/>${updated.map((u) => "· " + u).join("<br/>")}`), IMG_W, IMG_H, "synced.png");
    return;
  }

  // ── VIEW DASHBOARD (from account dashboard panel) ──
  if (customId === "view_dashboard") {
    await interaction.deferReply({ flags: 64 });
    const userData = getOrCreateUser(user.id, user.tag);
    const payment = getPayment(userData.id) as any;
    const accounts = getSocialAccounts(userData.id) as any[];
    const rank = getClipperRank(user.id);
    const buffer = await renderHtmlToImage(accountDashboardHtml(user.username, accounts, payment, rank), IMG_W, IMG_H);
    if (buffer) await interaction.editReply({ files: [new AttachmentBuilder(buffer, { name: "dashboard.png" })] });
    else await interaction.editReply({ content: "Dashboard unavailable." });
    return;
  }

  // ── MARK ALL NOTIFICATIONS READ ──
  if (customId === "mark_read") {
    await interaction.deferReply({ flags: 64 });
    const userData = getOrCreateUser(user.id, user.tag);
    markNotificationsRead(userData.id);
    await sendImage(interaction, successCardHtml("Notifications Cleared", "All notifications have been marked as read."), IMG_W, IMG_H, "cleared.png");
    return;
  }

  // ── CREATE TICKET (from help ticket panel) ──
  if (customId === "create_ticket") {
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId("create_ticket_modal")
        .setTitle("Create Support Ticket")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("ticket_category").setLabel("Category").setPlaceholder("Account Issues / Payment Support / Campaign Help / General").setStyle(TextInputStyle.Short).setRequired(true)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("ticket_description").setLabel("Describe your issue").setPlaceholder("Tell us what's wrong...").setStyle(TextInputStyle.Paragraph).setRequired(true)
          )
        )
    );
    return;
  }

  // ── REPORT USER (from report panel) ──
  if (customId === "report_user_start") {
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId("report_user_modal")
        .setTitle("Report a User")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("report_target").setLabel("Username or Discord tag to report").setPlaceholder("@username or User#1234").setStyle(TextInputStyle.Short).setRequired(true)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("report_reason").setLabel("Reason for report").setPlaceholder("Fake submissions / Spam / Stolen content / Other").setStyle(TextInputStyle.Paragraph).setRequired(true)
          )
        )
    );
    return;
  }

  // ── UPLOAD POST (from campaign channel button) ──
  if (customId.startsWith("upload_post_")) {
    const campaignId = customId.replace("upload_post_", "");
    const { getCampaign, hasUserPostedInCampaign } = await import("../database");
    const campaign = getCampaign(campaignId) as any;
    if (!campaign) {
      await interaction.reply({ content: "This campaign no longer exists.", flags: 64 });
      return;
    }
    if (campaign.status !== "active") {
      await interaction.reply({ content: "This campaign is no longer active.", flags: 64 });
      return;
    }
    const userData = getOrCreateUser(user.id, user.tag);
    if (hasUserPostedInCampaign(campaignId, userData.id)) {
      await interaction.reply({ content: "You have already submitted a post for this campaign. Check your DMs for status updates.", flags: 64 });
      return;
    }
    // Show modal for reel URL
    const platformName = campaign.platforms.split(",")[0] || "TikTok";
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(`submit_post_modal_${campaignId}`)
        .setTitle(`Upload Post — ${campaign.title}`)
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("post_url")
              .setLabel(`Your ${platformName} reel/video URL`)
              .setPlaceholder(`https://www.${campaign.platforms.split(",")[0]}.com/@username/video/...`)
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        )
    );
    return;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SELECT MENU HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleSelectMenu(interaction: StringSelectMenuInteraction) {
  const { customId, user, values } = interaction;
  const value = values[0];

  if (customId === "connect_platform_select") {
    const platform = value;
    const userData = getOrCreateUser(user.id, user.tag);
    const existing = getSocialAccountByPlatform(userData.id, platform);
    if (existing) {
      await interaction.reply({ content: `You already have a ${platform} account connected. Use /remove-connection to remove it first.`, flags: 64 });
      return;
    }
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    await interaction.showModal(new ModalBuilder().setCustomId(`connect_username_modal_${platform}`).setTitle(`Connect ${platformName}`).addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("username").setLabel(`Your ${platformName} username`).setPlaceholder("@username").setStyle(TextInputStyle.Short).setRequired(true))));
    return;
  }

  // ── ACCOUNT VERIFY SELECT — automatic verification via live platform stats ──
  if (customId === "account_verify_select") {
    await interaction.deferReply({ flags: 64 });
    const accounts = getSocialAccounts(getOrCreateUser(user.id, user.tag).id) as any[];
    const selectedAccount = accounts.find((a: any) => a.id === value);
    if (!selectedAccount) {
      await sendImage(interaction, errorCardHtml("Error", "Account not found."), IMG_W, IMG_H, "error.png", true);
      return;
    }
    const guild = interaction.guild;
    if (!guild) return;
    try {
      // Pull LIVE stats from the platform (followers + total views on recent posts)
      const stats = await fetchPlatformStats(selectedAccount.platform, selectedAccount.username);
      if (!stats) {
        await sendImage(
          interaction,
          errorCardHtml(
            "Stats Unavailable",
            `Could not read live stats for <strong style="color:#8b5cff">@${selectedAccount.username}</strong> on ${selectedAccount.platform}. Make sure the profile is <strong>PUBLIC</strong> and try again in a minute.`
          ),
          IMG_W, IMG_H, "error.png", true
        );
        return;
      }

      // Persist the fresh numbers
      updateSocialMetrics(getOrCreateUser(user.id, user.tag).id, selectedAccount.platform, stats.followers, stats.avgViews);

      const followersOk = stats.followers >= config.verification.minFollowers;
      const viewsOk = stats.avgViews >= config.verification.minAvgViews;

      if (followersOk && viewsOk) {
        // REQUIREMENTS MET — grant CLIPPER + VERIFIED automatically
        const userData = getOrCreateUser(user.id, user.tag);
        const member = await guild.members.fetch(user.id);
        const clipperRole = await ensureClipperRole(guild);
        await member.roles.add(clipperRole);
        const verifiedRole = await ensureVerifiedRole(guild);
        await member.roles.add(verifiedRole);
        setUserVerified(user.id);
        await notifyUser(
          interaction.user, userData, "verification",
          `Verification approved! @${selectedAccount.username} met all requirements. CLIPPER role granted.`,
          successCardHtml(
            "Verification Approved",
            `Congratulations! Your <strong style="color:#8b5cff">${selectedAccount.platform}</strong> account <strong>@${selectedAccount.username}</strong> met all requirements and you are now a verified <strong style="color:#a4ffd4">CLIPPER</strong>.<br/><br/>Followers: ${stats.followers.toLocaleString()} · Avg Views: ${stats.avgViews.toLocaleString()}`
          )
        );
        await sendImage(
          interaction,
          successCardHtml(
            "Verification Approved",
            `<strong>@${selectedAccount.username}</strong> met all requirements automatically:<br/>Followers: <strong style="color:#a4ffd4">${stats.followers.toLocaleString()}</strong> / ${config.verification.minFollowers} required<br/>Avg Views: <strong style="color:#a4ffd4">${stats.avgViews.toLocaleString()}</strong> / ${config.verification.minAvgViews} required<br/><br/>CLIPPER role granted. Check your DMs!`
          ),
          IMG_W, IMG_H, "verified.png", true
        );
      } else {
        // REQUIREMENTS NOT MET — show exactly what failed
        await sendImage(
          interaction,
          errorCardHtml(
            "Requirements Not Met",
            `Live stats for <strong style="color:#8b5cff">@${selectedAccount.username}</strong>:<br/><br/>Followers: <strong>${stats.followers.toLocaleString()}</strong> — ${followersOk ? "<strong style='color:#a4ffd4'>PASS</strong>" : `<strong style='color:#ffb2c4'>FAIL</strong> (need ${config.verification.minFollowers})`}<br/>Avg Views: <strong>${stats.avgViews.toLocaleString()}</strong> — ${viewsOk ? "<strong style='color:#a4ffd4'>PASS</strong>" : `<strong style='color:#ffb2c4'>FAIL</strong> (need ${config.verification.minAvgViews})`}<br/><br/>Grow your account and try again. Stats are pulled live from your public profile.`
          ),
          IMG_W, IMG_H, "requirements.png", true
        );
      }
    } catch (error) {
      console.error("Error in auto verification:", error);
      await sendImage(interaction, errorCardHtml("Error", "Automatic verification failed. Try again in a minute."), IMG_W, IMG_H, "error.png", true);
    }
    return;
  }

  if (customId === "remove_account_select") {
    const userData = getOrCreateUser(user.id, user.tag);
    const accounts = getSocialAccounts(userData.id) as any[];
    const selectedAccount = accounts.find((a: any) => a.id === value);
    if (!selectedAccount) {
      await sendImage(interaction, errorCardHtml("Error", "Account not found."), IMG_W, IMG_H, "error.png", true);
      return;
    }
    removeSocialAccount(userData.id, selectedAccount.platform);
    await notifyUser(interaction.user, userData, "disconnect", `${selectedAccount.platform} account @${selectedAccount.username} has been disconnected from CLIPTIC.`, successCardHtml("Account Disconnected", `Your <strong style="color:#8b5cff">${selectedAccount.platform}</strong> account @${selectedAccount.username} has been unlinked.`));
    await sendImage(interaction, successCardHtml("Account Disconnected", `Your <strong style="color:#8b5cff">${selectedAccount.platform}</strong> account @${selectedAccount.username} has been unlinked.`), IMG_W, IMG_H, "disconnected.png", true);
    return;
  }

  if (customId === "payment_method_select") {
    const method = value;
    const methodLabel = method.replace("-", " ");
    await interaction.showModal(new ModalBuilder().setCustomId(`payment_wallet_modal_${method}`).setTitle(`Add ${methodLabel}`).addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("wallet_address").setLabel(method === "PayPal" ? "PayPal email address" : `${methodLabel} wallet address`).setPlaceholder(method === "PayPal" ? "your@email.com" : "your-wallet-address").setStyle(TextInputStyle.Short).setRequired(true))));
    return;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MODAL HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleModal(interaction: ModalSubmitInteraction) {
  const { customId, user } = interaction;

  if (customId.startsWith("connect_username_modal_")) {
    const platform = customId.replace("connect_username_modal_", "");
    const username = interaction.fields.getTextInputValue("username").replace(/^@/, "");
    const code = generateVerificationCode();
    pendingVerifications.set(user.id, { platform, username, code, step: "code_given" });
    // ACK FIRST — render takes seconds, Discord kills the interaction at 3s
    await interaction.deferReply({ flags: 64 });
    const buffer = await renderHtmlToImage(bioCodeCardHtml(platform, username, code), IMG_W, IMG_H);
    const submitBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("submit_profile_url").setLabel("Submit Profile URL").setStyle(ButtonStyle.Primary));
    if (buffer) {
      await interaction.editReply({ files: [new AttachmentBuilder(buffer, { name: "bio-code.png" })], components: [submitBtn] });
    } else {
      await interaction.editReply({ content: `Your verification code: \`${code}\`\nPaste this in your ${platform} bio, then click Submit Profile URL.`, components: [submitBtn] });
    }
    return;
  }

  if (customId === "submit_profile_url_modal") {
    const pending = pendingVerifications.get(user.id);
    if (!pending) {
      await sendImage(interaction, errorCardHtml("Error", "No pending verification found."), IMG_W, IMG_H, "error.png", true);
      return;
    }
    const profileUrl = interaction.fields.getTextInputValue("profile_url").trim();
    const urlUsername = extractUsernameFromUrl(profileUrl, pending.platform);
    if (urlUsername.toLowerCase() !== pending.username.toLowerCase()) {
      await sendImage(interaction, errorCardHtml("Username Mismatch", `The URL username <strong style="color:#8b5cff">@${urlUsername}</strong> does not match <strong>@${pending.username}</strong>.`), IMG_W, IMG_H, "error.png", true);
      return;
    }      await interaction.deferReply({ flags: 64 });
    const bioFound = await verifyBio(pending.platform, pending.username, pending.code);
    if (bioFound) {
      const userData = getOrCreateUser(user.id, user.tag);
      addSocialAccount(userData.id, pending.platform, pending.username, pending.code, profileUrl);
      verifySocialAccount(userData.id, pending.platform, pending.username);
      // Pull the real follower count right away so the dashboard is populated
      fetchFollowerCount(pending.platform, pending.username)
        .then((followers) => {
          if (followers !== null) updateSocialMetrics(userData.id, pending.platform, followers, 0);
        })
        .catch(() => {});
      pendingVerifications.delete(user.id);
      await dmUser(user, successCardHtml("Account Connected", `Your <strong style="color:#8b5cff">${pending.platform}</strong> account @${pending.username} has been linked to CLIPTIC.`));
      await sendImage(interaction, successCardHtml("Account Connected", `Your <strong style="color:#8b5cff">${pending.platform}</strong> account @${pending.username} has been linked.`), IMG_W, IMG_H, "connected.png");
    } else {
      pendingVerifications.delete(user.id);
      await sendImage(interaction, errorCardHtml("Verification Failed", `Could not find <strong style="color:#8b5cff">${pending.code}</strong> in your ${pending.platform} bio. Ensure your profile is public and the code is saved.`), IMG_W, IMG_H, "error.png");
    }
    return;
  }

  // ── CREATE TICKET MODAL ──
  if (customId === "create_ticket_modal") {
    const category = interaction.fields.getTextInputValue("ticket_category");
    const description = interaction.fields.getTextInputValue("ticket_description");
    const userData = getOrCreateUser(user.id, user.tag);

    // Create a private ticket channel
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: "Could not create ticket.", flags: 64 });
      return;
    }
    try {
      const ticketChannel = await guild.channels.create({
        name: `ticket-${user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
          { id: config.roles.president, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        ],
      });

      const { createTicket: dbCreateTicket } = await import("../database");
      dbCreateTicket(userData.id, ticketChannel.id);

      await ticketChannel.send({
        content: `<@${user.id}> | <@&${config.roles.president || ""}>\n\n**Ticket Created** — ${category}\n${description}`,
      });

      await interaction.reply({ content: `✅ Ticket created: <#${ticketChannel.id}>`, flags: 64 });
    } catch (err: any) {
      console.error("Ticket creation error:", err?.message);
      await interaction.reply({ content: "Failed to create ticket. Check channel permissions.", flags: 64 });
    }
    return;
  }

  // ── REPORT USER MODAL ──
  if (customId === "report_user_modal") {
    const target = interaction.fields.getTextInputValue("report_target");
    const reason = interaction.fields.getTextInputValue("report_reason");

    // Send report to the reports channel
    const guild = interaction.guild;
    if (guild) {
      const reportChannel = guild.channels.cache.get(config.channels.reports) as TextChannel;
      if (reportChannel) {
        await reportChannel.send({
          content: `**🚨 User Report**\n\n**Reported by:** <@${user.id}> (${user.tag})\n**Target:** ${esc(target)}\n**Reason:** ${esc(reason)}\n**Time:** ${new Date().toISOString()}`,
        });
      }
    }

    await interaction.reply({ content: `✅ Your report against **${esc(target)}** has been submitted. Our team will review it.`, flags: 64 });
    return;
  }

  if (customId.startsWith("payment_wallet_modal_")) {
    const method = customId.replace("payment_wallet_modal_", "");
    const walletAddress = interaction.fields.getTextInputValue("wallet_address");
    const userData = getOrCreateUser(user.id, user.tag);
    addPaymentMethod(userData.id, method, walletAddress);
    const clipped = walletAddress.substring(0, 6) + "..." + walletAddress.substring(walletAddress.length - 4);
    await sendImage(interaction, successCardHtml("Payment Method Added", `<strong style="color:#8b5cff">${method}</strong> saved. Wallet: <code>${clipped}</code>`), IMG_W, IMG_H, "payment-added.png", true);
    await notifyUser(user, userData, "payment", `${method} wallet added: ${clipped}`, successCardHtml("Payment Method Added", `Your ${method} wallet <code>${clipped}</code> has been saved.`));
    return;
  }

  // ── SUBMIT CAMPAIGN POST (modal from Upload Post button) ──
  if (customId.startsWith("submit_post_modal_")) {
    const campaignId = customId.replace("submit_post_modal_", "");
    const postUrl = interaction.fields.getTextInputValue("post_url").trim();
    const userData = getOrCreateUser(user.id, user.tag);
    const { getCampaign, submitCampaignPost, getSocialAccounts: dbGetAccounts } = await import("../database");
    const campaign = getCampaign(campaignId) as any;
    if (!campaign) {
      await interaction.reply({ content: "Campaign not found.", flags: 64 });
      return;
    }
    // Detect platform from URL
    let platform = campaign.platforms.split(",")[0] || "tiktok";
    if (postUrl.includes("instagram.com")) platform = "instagram";
    else if (postUrl.includes("tiktok.com")) platform = "tiktok";
    else if (postUrl.includes("youtube.com") || postUrl.includes("youtu.be")) platform = "youtube";

    // Validate: user must have a connected account for this platform
    const accounts = dbGetAccounts(userData.id) as any[];
    const matchingAccount = accounts.find((a: any) => a.platform === platform && a.verified);
    if (!matchingAccount) {
      await interaction.reply({
        content: `❌ You need a verified **${platform}** account connected to submit posts for this campaign. Connect one first using the Connect Account channel.`,
        flags: 64
      });
      return;
    }

    const postId = submitCampaignPost(campaignId, userData.id, postUrl, platform, matchingAccount.username);

    // Rich DM with campaign details
    const campaignDetails = campaign.details_json ? JSON.parse(campaign.details_json) : {};
    let detailText = `Campaign: **${campaign.title}**\nPlatform: ${platform}\nPost URL: ${postUrl}\n\nYour post has been submitted and is pending admin verification. You will be notified once it's reviewed. After approval, your earnings will be credited to your balance once the campaign ends.`;
    if (campaign.rules) detailText += `\n\nCampaign Rules: ${campaign.rules}`;
    if (campaignDetails.references) detailText += `\n\nReferences: ${campaignDetails.references}`;

    await notifyUser(
      user, userData, "campaign_post",
      `Your post for "${campaign.title}" has been submitted and is pending admin verification.`,
      successCardHtml(
        "Post Submitted",
        `Your <strong style="color:#8b5cff">${platform}</strong> post for <strong>${esc(campaign.title)}</strong> has been submitted successfully.<br/><br/>Post URL: <code style="font-size:11px">${esc(postUrl)}</code><br/>Account: <strong>@${esc(matchingAccount.username)}</strong><br/><br/>Our team will review your post and verify it. You will be notified once it's approved. After approval, your earnings will be credited to your balance once the campaign ends.`
      )
    );
    // Also send a plain text DM with full details
    await dmUserText(user, detailText);

    await interaction.reply({ content: `✅ Your post for **${campaign.title}** has been submitted and is pending verification. Check your DMs!`, flags: 64 });
    return;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLASH COMMANDS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
  const { commandName, user } = interaction;

  // ── /account — wallet card + Sync button only ──
  if (commandName === "account") {
    await interaction.deferReply(); // PUBLIC
    const userData = getOrCreateUser(user.id, user.tag);
    const payment = getPayment(userData.id) as any;
    const accounts = getSocialAccounts(userData.id) as any[];
    const rank = getClipperRank(user.id);
    const { generateWalletCardImage } = await import("../utils/walletCardTemplate");
    const imageBuffer = await generateWalletCardImage({
      username: user.username, balance: payment?.balance || 0, totalPaid: payment?.total_paid || 0,
      totalViews: accounts.reduce((s: number, a: any) => s + (a.avg_views || 0) * 10, 0),
      clipsApproved: accounts.length, rank: rank ? `#${rank}` : "—",
      paymentMethod: payment?.method || "NONE", walletAddress: payment?.wallet_address || "", socialAccounts: accounts,
    });
    if (imageBuffer) {
      const attachment = new AttachmentBuilder(imageBuffer, { name: "wallet-card.png" });
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("sync_accounts").setLabel("🔄 Sync").setStyle(ButtonStyle.Secondary)
      );
      await interaction.editReply({ files: [attachment], components: [row] });
    } else {
      await interaction.editReply({ content: `Balance: $${(payment?.balance || 0).toFixed(2)} | Paid: $${(payment?.total_paid || 0).toFixed(2)}` });
    }
  }

  // ── /profile — profile card + Sync button only ──
  if (commandName === "profile") {
    await interaction.deferReply(); // PUBLIC
    const userData = getOrCreateUser(user.id, user.tag);
    const accounts = getSocialAccounts(userData.id) as any[];
    const { generateProfileCardImage } = await import("../utils/walletCardTemplate");
    const imageBuffer = await generateProfileCardImage({ username: user.username, socialAccounts: accounts, lastSync: "Just now" });
    if (imageBuffer) {
      const attachment = new AttachmentBuilder(imageBuffer, { name: "profile-card.png" });
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("sync_accounts").setLabel("🔄 Sync").setStyle(ButtonStyle.Secondary)
      );
      await interaction.editReply({ files: [attachment], components: [row] });
    }
  }

  // ── /remove-connection — dropdown to choose which account to remove ──
  if (commandName === "remove-connection") {      await interaction.deferReply({ flags: 64 });
    const userData = getOrCreateUser(user.id, user.tag);
    const accounts = getSocialAccounts(userData.id) as any[];
    if (accounts.length === 0) {
      await sendImage(interaction, errorCardHtml("No Connected Accounts", "You don't have any connected social media accounts to remove."), IMG_W, IMG_H, "error.png");
      return;
    }
    const options = accounts.map((acc: any) => ({
      label: `@${acc.username}`,
      description: `${acc.platform} · ${acc.follower_count.toLocaleString()} followers · ${acc.verified ? "Verified" : "Unverified"}`,
      value: acc.id,
    }));
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("remove_account_select")
        .setPlaceholder("Choose an account to disconnect")
        .addOptions(options)
    );
    const buffer = await renderHtmlToImage(successCardHtml("Remove Connection", "Select the social media account you want to disconnect from CLIPTIC below."), IMG_W, IMG_H);
    if (buffer) await interaction.editReply({ files: [new AttachmentBuilder(buffer, { name: "remove.png" })], components: [row] });
    else await interaction.editReply({ content: "Select an account to disconnect:", components: [row] });
  }

  // ── /leaderboard — public ──
  if (commandName === "leaderboard") {
    await interaction.deferReply(); // PUBLIC
    const entries = getLeaderboard(10) as any[];
    const buffer = await renderHtmlToImage(leaderboardHtml(entries), IMG_W, IMG_H);
    if (buffer) await interaction.editReply({ files: [new AttachmentBuilder(buffer, { name: "leaderboard.png" })] });
    else await interaction.editReply({ content: "Leaderboard unavailable." });
  }

  // ── /earnings — private ──
  if (commandName === "earnings") {      await interaction.deferReply({ flags: 64 });
    const userData = getOrCreateUser(user.id, user.tag);
    const payment = getPayment(userData.id) as any;
    const history = getEarningsHistory(userData.id) as any[];
    const buffer = await renderHtmlToImage(earningsHtml(user.username, payment, history), IMG_W, IMG_H);
    if (buffer) await interaction.editReply({ files: [new AttachmentBuilder(buffer, { name: "earnings.png" })] });
  }

  // ── /my-clips — private ──
  if (commandName === "my-clips") {      await interaction.deferReply({ flags: 64 });
    const userData = getOrCreateUser(user.id, user.tag);
    const clips = getClipsByUser(userData.id) as any[];
    if (clips.length === 0) {
      await sendImage(interaction, successCardHtml("No Clips", "You haven't submitted any clips yet. Use /submit-clip to get started!"), IMG_W, IMG_H, "no-clips.png");
      return;
    }
    const buffer = await renderHtmlToImage(clipSubmissionHtml(clips[0].platform, clips[0].url, clips[0].description, clips[0].status), IMG_W, IMG_H);
    if (buffer) await interaction.editReply({ files: [new AttachmentBuilder(buffer, { name: "my-clips.png" })] });
  }

  // ── /notifications — private ──
  if (commandName === "notifications") {      await interaction.deferReply({ flags: 64 });
    const userData = getOrCreateUser(user.id, user.tag);
    const notifs = getUnreadNotifications(userData.id) as any[];
    const buffer = await renderHtmlToImage(notificationsHtml(notifs), IMG_W, IMG_H);
    if (buffer) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("mark_read").setLabel("Mark All Read").setStyle(ButtonStyle.Secondary));
      await interaction.editReply({ files: [new AttachmentBuilder(buffer, { name: "notifications.png" })], components: [row] });
    }
    markNotificationsRead(userData.id);
  }

  // ── /stats — public ──
  if (commandName === "stats") {
    await interaction.deferReply(); // PUBLIC
    const buffer = await renderHtmlToImage(serverStatsHtml({
      totalMembers: interaction.guild?.memberCount || 0,
      totalClips: 0, totalEarnings: 0, totalPaid: 0, activeClippers: 0, topPlatform: "TikTok",
    }), IMG_W, IMG_H);
    if (buffer) await interaction.editReply({ files: [new AttachmentBuilder(buffer, { name: "stats.png" })] });
  }

  // ── /campaigns — send to DM (ephemeral) ──
  if (commandName === "campaigns") {      await interaction.deferReply({ flags: 64 });
    const campaigns = getActiveCampaigns() as any[];
    if (campaigns.length === 0) {
      await sendImage(interaction, errorCardHtml("No Active Campaigns", "There are no active campaigns right now. Check back later!"), IMG_W, IMG_H, "error.png");
      return;
    }
    // Send each campaign card to DM
    try {
      const dm = await user.createDM();
      for (const c of campaigns) {
        const buffer = await renderHtmlToImage(campaignCardHtml({
          title: c.title, description: c.description, platforms: c.platforms.split(","),
          audiences: c.audiences, payoutRate: c.payout_rate, minViews: c.min_views,
          rules: c.rules, status: c.status, createdBy: c.created_by,
        }), IMG_W, IMG_H);
        if (buffer) {
          const joinRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`join_campaign_${c.id}`).setLabel("Join Campaign").setStyle(ButtonStyle.Success)
          );
          await dm.send({ files: [new AttachmentBuilder(buffer, { name: `campaign-${c.id}.png` })], components: [joinRow] });
        }
      }
      await interaction.editReply({ content: `📋 Sent ${campaigns.length} active campaign${campaigns.length !== 1 ? "s" : ""} to your DMs! Check your messages.` });
    } catch {
      await sendImage(interaction, errorCardHtml("DMs Closed", "Could not send campaigns to your DM. Please enable DMs from server members."), IMG_W, IMG_H, "error.png");
    }
  }
}
