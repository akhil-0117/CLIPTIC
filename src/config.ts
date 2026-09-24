import dotenv from "dotenv";
dotenv.config();

export const config = {
  token: process.env.DISCORD_TOKEN || "",
  clientId: process.env.CLIENT_ID || "",
  guildId: process.env.GUILD_ID || "",

  channels: {
    welcome: process.env.CHANNEL_WELCOME || "",
    verification: process.env.CHANNEL_VERIFICATION || "",
    accountVerify: process.env.CHANNEL_ACCOUNT_VERIFY || "",
    connectAccount: process.env.CHANNEL_CONNECT_ACCOUNT || "",
    accountDashboard: process.env.CHANNEL_ACCOUNT_DASHBOARD || "",
    paymentDashboard: process.env.CHANNEL_PAYMENT_DASHBOARD || "",
    helpTickets: process.env.CHANNEL_HELP_TICKETS || "1548718639497220136",
    reports: process.env.CHANNEL_REPORTS || "1548718568965677106",
  },

  categories: {
    tickets: process.env.CATEGORY_TICKETS || "",
  },

  roles: {
    verified: process.env.ROLE_VERIFIED || "VERIFIED",
    clipper: process.env.ROLE_CLIPPER || "CLIPPER",
    president: process.env.ROLE_PRESIDENT || "PRESIDENT",
  },

  roleIds: {
    verified: process.env.ROLE_ID_VERIFIED || "",
    clipper: process.env.ROLE_ID_CLIPPER || "",
    president: process.env.ROLE_ID_PRESIDENT || "",
  },

  verification: {
    minFollowers: parseInt(process.env.MIN_FOLLOWERS || "50"),
    minAvgViews: parseInt(process.env.MIN_AVG_VIEWS || "250"),
  },

  payment: {
    minPayoutThreshold: parseFloat(process.env.MIN_PAYOUT_THRESHOLD || "10.0"),
  },

  campaignChannelId: process.env.CAMPAIGN_CHANNEL_ID || "1548734121272938516",
  adminPort: parseInt(process.env.ADMIN_PORT || "3001", 10),

  // Web app + authentication (Better Auth)
  web: {
    // Public origin of the site — used for OAuth redirect URLs.
    // When empty, derived per-request from the incoming host.
    url: process.env.APP_URL || "",
    authSecret: process.env.BETTER_AUTH_SECRET || "",
    discordClientId: process.env.DISCORD_CLIENT_ID || "",
    discordClientSecret: process.env.DISCORD_CLIENT_SECRET || "",
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    // Invite code required to register additional admins
    // (the very first admin can always self-register as bootstrap).
    adminSignupCode: process.env.ADMIN_SIGNUP_CODE || "",
  },
};
