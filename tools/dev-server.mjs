// Local test server: serves the site and runs functions/api/* on an in-memory database. Run: node --no-warnings tools/dev-server.mjs [port]
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { makeEnv } from "./test/d1shim.mjs";
const root = path.resolve(new URL("..", import.meta.url).pathname), port = +process.argv[2] || 8787;
const env = makeEnv({ TEST_NOW_MS: process.env.TEST_NOW_MS || "" }); if (!process.env.TEST_NOW_MS) delete env.TEST_NOW_MS; if (process.env.ADMIN_KEY) env.ADMIN_KEY = process.env.ADMIN_KEY; if (process.env.BOARD_PIN) env.BOARD_PIN = process.env.BOARD_PIN;
// Demo member for browser tests: SEED_MEMBER=9876500022:1000 (phone:points)
if (process.env.SEED_MEMBER) { const [ph, pt] = process.env.SEED_MEMBER.split(":"); env.raw.prepare("INSERT OR REPLACE INTO customers(phone,name,member,points,created_at,updated_at) VALUES(?,?,1,?,0,0)").run(ph, "Demo Member", +pt || 0); }
const routes = new Map();
async function load(p) { if (!routes.has(p)) routes.set(p, await import(path.join(root, "functions", p + ".js"))); return routes.get(p); }
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".woff2": "font/woff2", ".ico": "image/x-icon", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".json": "application/json", ".webmanifest": "application/json", ".svg": "image/svg+xml", ".txt": "text/plain" };
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost:" + port);
  try {
    if (u.pathname.startsWith("/api/")) {
      const mod = await load(u.pathname.slice(1)).catch(() => null); const mw = await load("api/_middleware");
      const h = mod && mod["onRequest" + req.method[0] + req.method.slice(1).toLowerCase()];
      const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks);
      const request = new Request(u, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body, duplex: "half" });
      const r = await mw.onRequest({ request, env, next: async () => (h ? h({ request, env }) : new Response(JSON.stringify({ ok: false, error: "not_found" }), { status: 404, headers: { "content-type": "application/json" } })) });
      res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
    }
    let f = path.join(root, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname)); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("404"); }
    res.writeHead(200, { "content-type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  } catch (e) { console.error(e); res.writeHead(500); res.end("err"); }
}).listen(port, () => console.log("dev server http://localhost:" + port));
