// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CAMPAIGN CHANNEL POSTER
// Auto-posts new campaigns as premium image cards into the campaign
// channel with a Join button — on boot (catch-up) and whenever the
// admin website creates one.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Client, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from "discord.js";
import { config } from "../config";
import { getUnpostedCampaigns, markCampaignPosted } from "../database";
import { renderHtmlToImage } from "../utils/imageGenerator";
import { campaignCardHtml } from "../utils/imageTemplates";

const IMG_W = 1600;
const IMG_H = 960;

/**
 * Post a single campaign card to the campaign channel. Used by the admin
 * API right after a campaign is created.
 */
export async function postCampaignToChannel(client: Client, campaignId: string): Promise<boolean> {
  const { getCampaign } = await import("../database");
  const campaign = getCampaign(campaignId) as any;
  if (!campaign) return false;

  for (const [, guild] of client.guilds.cache) {
    const channel = guild.channels.cache.get(config.campaignChannelId) as TextChannel;
    if (!channel) {
      console.error(`[CampaignPoster] Campaign channel ${config.campaignChannelId} not found in ${guild.name}`);
      continue;
    }
    try {
      const buffer = await renderHtmlToImage(
        campaignCardHtml({
          title: campaign.title,
          description: campaign.description,
          platforms: campaign.platforms.split(","),
          audiences: campaign.audiences,
          payoutRate: campaign.payout_rate,
          minViews: campaign.min_views,
          rules: campaign.rules,
          status: campaign.status,
          createdBy: campaign.created_by,
        }),
        IMG_W,
        IMG_H
      );
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`upload_post_${campaign.id}`).setLabel("Upload Post").setStyle(ButtonStyle.Success)
      );
      const payload: any = { components: [row] };
      if (buffer) {
        payload.files = [new AttachmentBuilder(buffer, { name: `campaign-${campaign.id}.png` })];
      } else {
        payload.content = `📢 **${campaign.title}** — ${campaign.description}\nPayout: ${campaign.payout_rate} · Min views: ${campaign.min_views}`;
      }
      await channel.send(payload);
      markCampaignPosted(campaign.id);
      console.log(`[CampaignPoster] Posted campaign "${campaign.title}" to #${channel.name}`);
    } catch (err: any) {
      console.error(`[CampaignPoster] Failed to post campaign:`, err?.message || err);
      return false;
    }
  }
  return true;
}

/**
 * Find and delete a campaign's message in the Discord campaign channel.
 * Searches for messages with the campaign's Upload Post button.
 */
export async function deleteCampaignFromChannel(client: Client, campaignId: string): Promise<boolean> {
  for (const [, guild] of client.guilds.cache) {
    const channel = guild.channels.cache.get(config.campaignChannelId) as TextChannel;
    if (!channel) continue;
    try {
      const messages = await channel.messages.fetch({ limit: 100 });
      for (const [, msg] of messages) {
        if (msg.components.length > 0) {
          for (const row of msg.components) {
            if ((row as any).components?.some((b: any) => b.customId === `upload_post_${campaignId}`)) {
              await msg.delete();
              console.log(`[CampaignPoster] Deleted campaign ${campaignId} from #${channel.name}`);
              return true;
            }
          }
        }
      }
    } catch (err: any) {
      console.error(`[CampaignPoster] Failed to delete campaign message:`, err?.message || err);
    }
  }
  return false;
}

/**
 * Repost a campaign: delete old message, then post updated card.
 */
export async function repostCampaignToChannel(client: Client, campaignId: string): Promise<boolean> {
  await deleteCampaignFromChannel(client, campaignId);
  return postCampaignToChannel(client, campaignId);
}

/**
 * Catch-up: post any active campaigns that were created (e.g. via the admin
 * website while the bot was offline) but never posted to the channel.
 */
export async function postPendingCampaigns(client: Client): Promise<void> {
  try {
    const pending = getUnpostedCampaigns() as any[];
    if (pending.length === 0) return;
    console.log(`[CampaignPoster] ${pending.length} campaign(s) pending channel post`);
    for (const c of pending) {
      await postCampaignToChannel(client, c.id);
    }
  } catch (err: any) {
    console.error("[CampaignPoster] Catch-up failed:", err?.message || err);
  }
}
