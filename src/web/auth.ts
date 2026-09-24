// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEB AUTHENTICATION — Better Auth
// - Clippers sign up with Discord or Google (or email/password fallback)
// - Admins sign up with their own password (invite code after first admin)
// - Sessions are cookie-based; a Better Auth user is linked 1:1 to a
//   CLIPTIC `users` row so the bot, admin dashboard and website all
//   share the same records (balance, accounts, campaigns, posts).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { betterAuth } from "better-auth";
import { toNodeHandler } from "better-auth/node";
import type { Request as ExpressRequest, Response, NextFunction } from "express";
import { config } from "../config";
import db, {
  getUserByAuthId,
  getUserByEmail,
  linkUserAuth,
  createWebUser,
  countAdmins,
} from "../database";

const discordEnabled = !!(config.web.discordClientId && config.web.discordClientSecret);
const googleEnabled = !!(config.web.googleClientId && config.web.googleClientSecret);

export const auth = betterAuth({
  // Same SQLite file as the bot — one source of truth.
  database: db as any,
  secret: config.web.authSecret || undefined,
  baseURL: config.web.url || undefined,
  basePath: "/api/auth",
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  socialProviders: {
    ...(discordEnabled
      ? {
          discord: {
            clientId: config.web.discordClientId,
            clientSecret: config.web.discordClientSecret,
            scope: ["identify", "email"],
          },
        }
      : {}),
    ...(googleEnabled
      ? {
          google: {
            clientId: config.web.googleClientId,
            clientSecret: config.web.googleClientSecret,
          },
        }
      : {}),
  },
  accountLinking: {
    enabled: true,
    trustedProviders: ["discord", "google"],
  },
  // CSRF: validate the browser's Origin against the host this request
  // arrived on (works on localhost, the preview proxy and production
  // without hardcoding domains — while still blocking cross-site posts).
  trustedOrigins: (async (request: any) => {
    if (!request?.headers?.get) return [];
    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || "http";
    const origins: string[] = [];
    if (host) {
      origins.push(`${proto}://${host}`);
      origins.push(`http://${host}`);
      origins.push(`https://${host}`);
    }
    if (config.web.url) origins.push(config.web.url);
    return origins.filter(Boolean);
  }) as any,
});

/** Mount point for Express — MUST be registered before express.json(). */
export const authHandler = toNodeHandler(auth);

export function discordConfigured() {
  return discordEnabled;
}
export function googleConfigured() {
  return googleEnabled;
}
export function adminSignupAllowed(): "open" | "code" | "closed" {
  if (countAdmins() === 0) return "open"; // first admin bootstraps freely
  return config.web.adminSignupCode ? "code" : "closed";
}

// ── Session resolution ────────────────────────────────────────────

type AuthUser = { id: string; name: string; email?: string | null; image?: string | null };

/**
 * Resolve the signed-in Better Auth user from an incoming request's headers.
 */
export async function getAuthUser(headers: Headers | NodeJS.Dict<string> | any): Promise<AuthUser | null> {
  try {
    const webHeaders = headers instanceof Headers ? headers : toWebHeaders(headers);
    const session = await auth.api.getSession({ headers: webHeaders });
    return (session?.user as AuthUser) || null;
  } catch {
    return null;
  }
}

export function toWebHeaders(raw: any): Headers {
  const headers = new Headers();
  if (!raw) return headers;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else headers.set(key, String(value));
  }
  return headers;
}

/**
 * Bridge a Better Auth user to the CLIPTIC `users` table.
 * Resolution order: auth_id → linked Discord account → email → create.
 * Safe to call on every request (all lookups are cheap indexed selects).
 */
export function ensureClipticUser(authUser: AuthUser): any {
  const existing = getUserByAuthId(authUser.id);
  if (existing) return existing;

  // Does this login carry a Discord identity?
  let discordId: string | null = null;
  try {
    const acct = db
      .prepare("SELECT * FROM account WHERE userId = ? AND providerId = 'discord' ORDER BY createdAt DESC")
      .get(authUser.id) as any;
    if (acct?.accountId) discordId = acct.accountId;
  } catch {}

  if (discordId) {
    const byDiscord = db.prepare("SELECT * FROM users WHERE discord_id = ?").get(discordId) as any;
    if (byDiscord) {
      linkUserAuth(byDiscord.id, authUser.id, authUser.email || undefined);
      return { ...byDiscord, auth_id: authUser.id };
    }
  }

  if (authUser.email) {
    const byEmail = getUserByEmail(authUser.email);
    if (byEmail) {
      linkUserAuth(byEmail.id, authUser.id, authUser.email);
      return { ...byEmail, auth_id: authUser.id };
    }
  }

  const fallbackId = discordId || `web_${authUser.id}`;
  const tag = authUser.name || authUser.email?.split("@")[0] || "Clipper";
  return createWebUser(authUser.id, fallbackId, tag, authUser.email || "", "user");
}

export type WebSession = { authUser: AuthUser; user: any };

/**
 * Returns the signed-in session (Better Auth user + CLIPTIC user), or null.
 */
export async function getSession(req: { headers: any }): Promise<WebSession | null> {
  const authUser = await getAuthUser(req.headers);
  if (!authUser) return null;
  const user = ensureClipticUser(authUser);
  if (!user) return null;
  return { authUser, user };
}

// ── Express guards ────────────────────────────────────────────────

export type AuthedRequest = ExpressRequest & { session?: WebSession };

/** Any signed-in user. Attaches req.session. */
export async function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: "Not signed in", code: "UNAUTHENTICATED" });
  req.session = session;
  next();
}

/** Signed-in admin (CLIPTIC role = admin). Attaches req.session. */
export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: "Not signed in", code: "UNAUTHENTICATED" });
  if (session.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required", code: "FORBIDDEN" });
  }
  req.session = session;
  next();
}
