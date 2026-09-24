# CLIPTIC Discord Bot

A custom Discord bot for the CLIPTIC clipping server, handling verification, social media connections, dashboards, and payments.

## Features

- 🎬 **Welcome System** — Automated welcome messages for new members
- 🛡️ **Verification Panel** — Simple account verification (VERIFIED role)
- 🔍 **Account Verification** — Proof-based verification with ticket workflow (CLIPPER role)
- 🔗 **Social Media Connection** — Bio-based verification for TikTok, Instagram, YouTube
- 📊 **Account Dashboard** — Track connected accounts and performance metrics
- 💳 **Payment Dashboard** — Balance tracking, payment methods, and withdrawal requests

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your Discord bot credentials:

```bash
cp .env.example .env
```

Required variables:
- `DISCORD_TOKEN` — Your bot token from the Discord Developer Portal
- `CLIENT_ID` — Your application's client ID
- `GUILD_ID` — (Optional) Your server ID for instant command deployment

Channel IDs (defaults provided, set different IDs for separate channels):
- `CHANNEL_WELCOME` — Welcome channel ID
- `CHANNEL_VERIFICATION` — Verification channel (gives **VERIFIED** role for server access)
- `CHANNEL_ACCOUNT_VERIFY` — Account verify channel (gives **CLIPPER** role after proof review)
- `CHANNEL_CONNECT_ACCOUNT` — Connect account channel (social media bio verification)
- `CHANNEL_ACCOUNT_DASHBOARD` — Account dashboard channel
- `CHANNEL_PAYMENT_DASHBOARD` — Payment dashboard channel
- `CATEGORY_TICKETS` — Tickets category ID

**Important:** Set different channel IDs for each channel so panels don't overlap!

### 3. Deploy Commands

```bash
npm run deploy-commands
```

### 4. Start the Bot

```bash
npm start
```

## Slash Commands

| Command | Permission | Description |
|---------|-----------|-------------|
| `/setup-welcome` | Admin | Post the welcome embed |
| `/setup-verification` | Admin | Post the verification panel |
| `/setup-dashboard` | Admin | Post the account dashboard |
| `/setup-payments` | Admin | Post the payment dashboard |
| `/balance` | Everyone | Check your current balance |

## How It Works

### Verification Flow
1. New member sees verification panel in #verification
2. Clicks "Authorize & Verify" and confirms they meet requirements
3. Bot creates a private ticket channel under the Tickets category
4. Member uploads screen recording proof
5. President clicks "Verify Member" to approve
6. Member gets VERIFIED role and ticket is closed

### Social Media Connection
1. User clicks "Connect Account" on dashboard
2. Enters platform and username
3. Bot generates a unique verification code
4. User pastes code into their public bio
5. User clicks "Scan Profile" to verify
6. Account is linked on success

### Payments
1. User adds a payment method (USDT/BTC/LTC/PayPal)
2. Balance is tracked automatically
3. User clicks "Withdraw" when balance exceeds $10 minimum
4. Admin processes the withdrawal request

## Database

The bot uses SQLite (via better-sqlite3) for local data storage. The database file `cliptic.db` is created automatically on first run.
