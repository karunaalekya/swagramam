import test from "node:test"; import assert from "node:assert/strict";
import { makeEnv } from "./d1shim.mjs";
import * as sendR from "../../functions/api/otp/send.js";
import * as verR from "../../functions/api/otp/verify.js";
import * as meR from "../../functions/api/rewards/me.js";
import * as outR from "../../functions/api/rewards/logout.js";
const body = (u, o, cookie) => new Request("https://t.test" + u, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(o) });
test("session cookie: set on verify, restores balance without OTP, tampered or cleared cookie refused", async () => {
  const env = await makeEnv(); env.OTP_PROVIDER = "mock"; const phone = "9" + String(Date.now()).slice(-9);
  const s = await (await sendR.onRequestPost({ env, request: body("/api/otp/send", { phone }) })).json();
  const v = await verR.onRequestPost({ env, request: body("/api/otp/verify", { phone, code: s.devCode }) }); const vj = await v.json(); assert.ok(vj.ok);
  const sc = v.headers.get("set-cookie"); assert.match(sc, /HttpOnly/); assert.match(sc, /SameSite=Lax/); assert.match(sc, /Secure/); assert.match(sc, /Max-Age=2592000/);
  const ck = sc.split(";")[0];
  const me = await (await meR.onRequestGet({ env, request: new Request("https://t.test/api/rewards/me", { headers: { cookie: ck } }) })).json();
  assert.ok(me.ok && me.phone === phone && me.token);
  const bad = await meR.onRequestGet({ env, request: new Request("https://t.test/api/rewards/me", { headers: { cookie: ck.slice(0, -3) + "abc" } }) }); assert.equal((await bad.json()).ok, false);
  assert.equal((await (await meR.onRequestGet({ env, request: new Request("https://t.test/api/rewards/me") })).json()).error, "no_session");
  const out = await outR.onRequestPost({ env, request: body("/api/rewards/logout", {}) }); assert.match(out.headers.get("set-cookie"), /Max-Age=0/);
});
