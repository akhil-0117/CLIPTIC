import { Client, Events, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, Message, AttachmentBuilder } from "discord.js";
import { config } from "../config";
import { renderHtmlToImage } from "../utils/imageGenerator";
import { verificationPanelHtml, accountVerifyPanelHtml, connectAccountPanelHtml, accountDashboardPanelHtml, paymentDashboardPanelHtml, helpTicketPanelHtml, reportUserPanelHtml } from "../utils/imageTemplates";

const IMG_W = 1600;
const IMG_H = 960;

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    console.log(`✅ CLIPTIC Bot is online as ${client.user?.tag}`);
    console.log(`📡 Serving ${client.guilds.cache.size} guild(s)`);
    // NOTE: Database is NEVER reset on boot — user data, balances, and
    // campaigns must survive restarts. Run `npm run reset-db` manually if needed.
    for (const [, guild] of client.guilds.cache) {
      console.log(`\nSetting up panels for: ${guild.name}`);

      // 1. Verification Panel
      await clearAndPost(guild, config.channels.verification, async (channel) => {
        const buffer = await renderHtmlToImage(verificationPanelHtml(), IMG_W, IMG_H);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("verify_start").setLabel("Authorize & Verify").setStyle(ButtonStyle.Primary));
        if (buffer) await channel.send({ files: [new AttachmentBuilder(buffer, { name: "verification-panel.png" })], components: [row] });
        console.log("  ✓ Verification panel posted");
      });

      // 2. Account Verify Panel
      await clearAndPost(guild, config.channels.accountVerify, async (channel) => {
        const buffer = await renderHtmlToImage(accountVerifyPanelHtml(), IMG_W, IMG_H);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("account_verify_start").setLabel("Start Verification").setStyle(ButtonStyle.Success));
        if (buffer) await channel.send({ files: [new AttachmentBuilder(buffer, { name: "account-verify-panel.png" })], components: [row] });
        console.log("  ✓ Account verify panel posted");
      });

      // 3. Connect Account Panel
      await clearAndPost(guild, config.channels.connectAccount, async (channel) => {
        const buffer = await renderHtmlToImage(connectAccountPanelHtml(), IMG_W, IMG_H);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("connect_social").setLabel("Connect Account").setStyle(ButtonStyle.Primary));
        if (buffer) await channel.send({ files: [new AttachmentBuilder(buffer, { name: "connect-panel.png" })], components: [row] });
        console.log("  ✓ Connect account panel posted");
      });

      // 4. Account Dashboard (informational panel — no user data)
      await clearAndPost(guild, config.channels.accountDashboard, async (channel) => {
        const buffer = await renderHtmlToImage(accountDashboardPanelHtml(), IMG_W, IMG_H);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("view_dashboard").setLabel("View My Dashboard").setStyle(ButtonStyle.Primary));
        if (buffer) await channel.send({ files: [new AttachmentBuilder(buffer, { name: "dashboard-panel.png" })], components: [row] });
        console.log("  ✓ Account dashboard posted");
      });

      // 5. Payment Dashboard (informational panel — no user data)
      await clearAndPost(guild, config.channels.paymentDashboard, async (channel) => {
        const buffer = await renderHtmlToImage(paymentDashboardPanelHtml(), IMG_W, IMG_H);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("add_payment_method").setLabel("Add Payment Method").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("withdraw").setLabel("Withdraw").setStyle(ButtonStyle.Success)
        );
        if (buffer) await channel.send({ files: [new AttachmentBuilder(buffer, { name: "payment-panel.png" })], components: [row] });
        console.log("  ✓ Payment dashboard posted");
      });

      // 6. Help Ticket Panel
      await clearAndPost(guild, config.channels.helpTickets, async (channel) => {
        const buffer = await renderHtmlToImage(helpTicketPanelHtml(), IMG_W, IMG_H);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("create_ticket").setLabel("Create Ticket").setStyle(ButtonStyle.Primary));
        if (buffer) await channel.send({ files: [new AttachmentBuilder(buffer, { name: "help-ticket-panel.png" })], components: [row] });
        console.log("  ✓ Help ticket panel posted");
      });

      // 7. Report User Panel
      await clearAndPost(guild, config.channels.reports, async (channel) => {
        const buffer = await renderHtmlToImage(reportUserPanelHtml(), IMG_W, IMG_H);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("report_user_start").setLabel("Report a User").setStyle(ButtonStyle.Danger));
        if (buffer) await channel.send({ files: [new AttachmentBuilder(buffer, { name: "report-panel.png" })], components: [row] });
        console.log("  ✓ Report user panel posted");
      });

      console.log(`\nAll panels deployed for ${guild.name}`);

      // Post any campaigns created while the bot was offline
      const { postPendingCampaigns } = await import("./campaignPoster");
      await postPendingCampaigns(client);
    }
  },
};

async function clearAndPost(guild: any, channelId: string, poster: (channel: TextChannel) => Promise<void>) {
  try {
    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel) { console.error(`  ✗ Channel ${channelId} not found`); return; }
    const botMember = guild.members.cache.get(guild.members.me.id);
    if (!channel.permissionsFor(botMember)?.has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks, PermissionsBitField.Flags.ManageMessages])) {
      console.error(`  ✗ Missing permissions in ${channel.name}`); return;
    }
    try {
      const messages = await channel.messages.fetch({ limit: 100 });
      const botMessages = messages.filter((msg: Message) => msg.author.id === guild.members.me.id);
      for (const [, msg] of botMessages) await msg.delete().catch(() => {});
      if (botMessages.size > 0) console.log(`  Cleared ${botMessages.size} old bot message(s)`);
    } catch {}
    await poster(channel);
  } catch (error) { console.error(`  ✗ Error posting panel:`, error); }
}
