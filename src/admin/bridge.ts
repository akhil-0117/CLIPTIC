// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN ↔ BOT BRIDGE
// Shares the running Discord client with the admin API so website actions
// (create campaign, DM a user) reach Discord immediately.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import type { Client } from "discord.js";

let discordClient: Client | null = null;

export function setClient(client: Client) {
  discordClient = client;
}

export function getClient(): Client | null {
  return discordClient;
}
