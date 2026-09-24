// Probe: can Better Auth take a better-sqlite3 Database directly?
const Database = require("better-sqlite3");
const { betterAuth } = require("better-auth");

(async () => {
  const db = new Database("/tmp/auth-probe.db");
  db.pragma("journal_mode = WAL");
  try {
    const auth = betterAuth({
      database: db,
      emailAndPassword: { enabled: true },
      secret: "probe-secret-do-not-use",
      baseURL: "http://localhost:3001",
    });
    console.log("AUTH INSTANCE OK");

    // Trigger table creation
    const ctx = await auth.$context;
    console.log("CONTEXT OK");

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log("TABLES:", tables.map((t) => t.name).join(", "));
    process.exit(0);
  } catch (e) {
    console.error("FAILED:", e.message);
    process.exit(1);
  }
})();
