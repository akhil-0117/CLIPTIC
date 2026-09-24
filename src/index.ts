import { Client, GatewayIntentBits } from "discord.js";
import { config } from "./config";
import readyEvent from "./events/ready";
import guildMemberAddEvent from "./events/guildMemberAdd";
import interactionCreateEvent from "./events/interactionCreate";

// Validate configuration
if (!config.token) {
  console.error("DISCORD_TOKEN is not set. Create a .env file with your bot token.");
  process.exit(1);
}

// Create client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

// Register event handlers
client.once(readyEvent.name as any, (...args: any[]) => readyEvent.execute(client));
client.on(guildMemberAddEvent.name as any, (...args: any[]) => guildMemberAddEvent.execute(args[0]));
client.on(interactionCreateEvent.name as any, (...args: any[]) => interactionCreateEvent.execute(args[0]));

// Global error handlers to prevent crashes
process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

// Start admin dashboard (auto-runs with the bot — http://localhost:3001)
try {
  Promise.all([import("./admin/server"), import("./admin/bridge")]).then(async ([, bridge]) => {
    bridge.setClient(client);
    console.log(`[Admin] Dashboard running at http://localhost:${config.adminPort}`);
  }).catch((err) => {
    console.error("[Admin] Failed to start admin dashboard:", err?.message || err);
  });
} catch {}

// Login
console.log("Starting CLIPTIC Bot...");
client.login(config.token);
