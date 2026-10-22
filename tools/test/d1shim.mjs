// Minimal D1 + KV stand-ins on node:sqlite so the API can be tested without Cloudflare.
import { DatabaseSync } from "node:sqlite"; import fs from "node:fs";
export function makeEnv(extra = {}) {
  const db = new DatabaseSync(":memory:"); db.exec(fs.readFileSync(new URL("../../db/schema.sql", import.meta.url), "utf8"));
  const stmt = (sql, args = []) => ({ bind: (...a) => stmt(sql, a),
    async run() { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
    async first() { return db.prepare(sql).get(...args) || null; },
    async all() { return { results: db.prepare(sql).all(...args) }; } });
  const DB = { prepare: sql => stmt(sql), async batch(list) { db.exec("BEGIN"); try { const out = []; for (const s of list) out.push(await s.run()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; } } };
  const m = new Map(); const KV = { async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); } };
  return { DB, KV, raw: db, kv: m, ENV: "staging", ...extra };
}
