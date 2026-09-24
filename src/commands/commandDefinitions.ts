import { SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("account")
    .setDescription("View your CLIPTIC wallet card with stats and connected accounts"),
  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View your connected social media profiles and creator metrics"),
  new SlashCommandBuilder()
    .setName("remove-connection")
    .setDescription("Remove a connected social media account"),
  new SlashCommandBuilder()
    .setName("submit-clip")
    .setDescription("Submit a clip for review and earning")
    .addStringOption((opt) =>
      opt.setName("platform").setDescription("Platform (tiktok/instagram/youtube)").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("url").setDescription("Clip URL").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("description").setDescription("Brief description of the clip").setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the top clippers leaderboard"),
  new SlashCommandBuilder()
    .setName("earnings")
    .setDescription("View your earnings history and stats"),
  new SlashCommandBuilder()
    .setName("my-clips")
    .setDescription("View all your submitted clips and their status"),
  new SlashCommandBuilder()
    .setName("notifications")
    .setDescription("Check your unread notifications"),
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("View server-wide statistics"),
  new SlashCommandBuilder()
    .setName("campaigns")
    .setDescription("View all active campaigns (sent to your DM)"),
].map((cmd) => cmd.toJSON());
