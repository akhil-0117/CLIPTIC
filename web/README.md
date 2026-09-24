# CLIPTIC Website (swappable UI)

This folder is the **public frontend** of CLIPTIC. It is served statically by the
Express server (`src/admin/server.ts`) from `web/public/*`.

## Swap the UI

Your designer can replace everything inside `web/public/` without touching any
TypeScript — the JSON API is stable:

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/api/web/config` | — | Providers, verification & payout config |
| GET | `/api/web/stats` | — | Landing-page counters (real data) |
| GET | `/api/web/campaigns` | — | Active campaigns |
| GET | `/api/web/campaigns/:id` | optional | Campaign detail + stats + your post |
| GET | `/api/web/leaderboard` | — | Top earners |
| POST | `/api/web/auth/register-admin` | invite code* | Admin registration |
| GET | `/api/web/me` | session | Profile, balance, accounts, unread |
| POST | `/api/web/accounts` | session | Connect social account → returns bio code |
| POST | `/api/web/accounts/:platform/verify` | session | Check bio + pull live stats |
| POST | `/api/web/accounts/:platform/sync` | session | Refresh followers/avg views |
| DELETE | `/api/web/accounts/:platform` | session | Disconnect |
| GET | `/api/web/posts` | session | My campaign posts |
| POST | `/api/web/campaigns/:id/posts` | session | Submit a clip URL |
| GET | `/api/web/earnings` | session | Balance + ledger |
| GET / POST | `/api/web/payouts` | session | Withdrawal history / request |
| GET / POST | `/api/web/notifications` | session | Notifications / mark read |

Auth (Better Auth) lives under `/api/auth/*`:

- `POST /api/auth/sign-up/email` `{name,email,password}`
- `POST /api/auth/sign-in/email` `{email,password}`
- `GET  /api/auth/sign-in/social?provider=discord|google&callbackURL=/dashboard`
- `POST /api/auth/sign-out`
- `GET  /api/auth/get-session`

All requests are same-origin cookie sessions — no tokens to manage.

\* the first admin can always self-register; later ones need `ADMIN_SIGNUP_CODE`.

## Environment variables (Settings → Environment)

| Key | Needed for |
|---|---|
| `BETTER_AUTH_SECRET` | Session signing (`openssl rand -base64 32`) |
| `APP_URL` | Public site origin for OAuth redirects |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord sign-in (redirect: `APP_URL/api/auth/callback/discord`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in (redirect: `APP_URL/api/auth/callback/google`) |
| `ADMIN_SIGNUP_CODE` | Invite code for additional admin accounts |

Without OAuth keys the buttons show “not configured” and email/password auth
still works.
