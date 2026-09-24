import { Events, GuildMember, TextChannel, AttachmentBuilder } from "discord.js";
import { config } from "../config";
import { renderHtmlToImage } from "../utils/imageGenerator";
import { welcomeCardHtml } from "../utils/imageTemplates";

export default {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member: GuildMember) {
    try {
      const channel = member.guild.channels.cache.get(config.channels.welcome) as TextChannel;
      if (!channel) { console.error(`Welcome channel not found`); return; }
      const buffer = await renderHtmlToImage(welcomeCardHtml(member.user.username), 1100, 660);
      if (buffer) {
        await channel.send({ content: `Welcome to the server, <@${member.id}>.`, files: [new AttachmentBuilder(buffer, { name: "welcome.png" })] });
      } else {
        await channel.send({ content: `Welcome to the server, <@${member.id}>! **CLIPTIC NETWORK**` });
      }
      console.log(`Sent welcome message for ${member.user.tag}`);
    } catch (error) { console.error("Error sending welcome message:", error); }
  },
};
