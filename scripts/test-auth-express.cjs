// Full probe: Better Auth + Express 5 + better-sqlite3 — sign-up, session, sign-in.
const express = require("express");
const Database = require("better-sqlite3");
const { betterAuth } = require("better-auth");
const { toNodeHandler } = require("better-auth/node");

(async () => {
  const dbPath = "/tmp/auth-probe2.db";
  require("fs").rmSync(dbPath, { force: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  const ORIGIN = "http://localhost:3999";

  // Trusted origins derived from request host (CSRF-safe: validates Origin === Host,
  // works on localhost + any preview/proxy host without hardcoding)
  const authCfg = {
    database: db,
    emailAndPassword: { enabled: true },
    secret: "x".repeat(40),
    basePath: "/api/auth",
    trustedOrigins: async (request) => {
      if (!request?.headers) return [];
      const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
      const proto = request.headers.get("x-forwarded-proto") || "http";
      const list = [];
      if (host) list.push(`${proto}://${host}`, `http://${host}`, `https://${host}`);
      return list;
    },
  };
  const auth = betterAuth(authCfg);
  await auth.$context;

  const app = express();
  // Mount auth BEFORE express.json (Better Auth reads the raw body stream)
  app.all("/api/auth/{*splat}", toNodeHandler(auth));
  app.use(express.json());

  app.get("/api/ping", (_req, res) => res.json({ pong: true }));

  const srv = app.listen(3999, async () => {
    try {
      // migrations
      await (await auth.$context).runMigrations();

      // 1) sign-up
      const r1 = await fetch("http://localhost:3999/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ email: "admin@test.com", password: "supersecret123", name: "Admin" }),
      });
      const j1 = await r1.json().catch(() => ({}));
      console.log("SIGN-UP:", r1.status, JSON.stringify(j1).slice(0, 300));
      const setCookie = r1.headers.get("set-cookie") || "";
      console.log("COOKIE SET:", /session_token|better-auth/.test(setCookie) ? "YES" : "NO -> " + setCookie.slice(0, 120));

      // 2) session check with cookie
      const cookie = setCookie.split(";")[0];
      const r2 = await fetch("http://localhost:3999/api/auth/get-session", { headers: { cookie } });
      const j2 = await r2.json().catch(() => ({}));
      console.log("SESSION:", r2.status, JSON.stringify(j2).slice(0, 300));

      // 3) sign-in
      const r3 = await fetch("http://localhost:3999/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ email: "admin@test.com", password: "supersecret123" }),
      });
      console.log("SIGN-IN:", r3.status);

      // 4) wrong password rejected
      const r4 = await fetch("http://localhost:3999/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ email: "admin@test.com", password: "wrongpassword" }),
      });
      console.log("WRONG PASSWORD (expect 401):", r4.status);

      // 5) normal route still works
      const r5 = await fetch("http://localhost:3999/api/ping");
      console.log("PING:", r5.status, await r5.text());

      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      console.log("TABLES:", tables.map((t) => t.name).join(", "));

      console.log(r1.status === 200 && r2.status === 200 && r3.status === 200 && r4.status === 401 && r5.status === 200 ? "\nALL PROBES PASSED" : "\nSOME PROBES FAILED");
      srv.close();
      process.exit(0);
    } catch (e) {
      console.error("PROBE ERROR:", e.message);
      srv.close();
      process.exit(1);
    }
  });
})();
