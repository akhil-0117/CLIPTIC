import { REST, Routes } from "discord.js";
import { config } from "./config";
import { commands } from "./commands/commandDefinitions";

const rest = new REST({ version: "10" }).setToken(config.token);

async function deployCommands() {
  try {
    console.log("🔄 Deploying slash commands...");

    if (config.guildId) {
      // Guild-specific commands (instant, good for development)
      await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
        body: commands,
      });
      console.log(`✅ ${commands.length} commands deployed to guild ${config.guildId}`);
    } else {
      // Global commands (takes up to 1 hour to propagate)
      await rest.put(Routes.applicationCommands(config.clientId), {
        body: commands,
      });
      console.log(`✅ ${commands.length} commands deployed globally`);
    }
  } catch (error) {
    console.error("❌ Error deploying commands:", error);
  }
}

deployCommands();
