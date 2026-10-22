import { json } from "../_lib/util.js";
import { flags, ready } from "../_lib/flags.js";
import { publicMenu, CATS } from "../_lib/menu.js";
export async function onRequestGet({ env }) {
  const f = flags(env);
  return json({ ok: true, live: ready(env) && !!env.DB && !!env.KV, cats: CATS, items: publicMenu(), gstPct: f.gstBp / 100, gstAssumed: !f.gstConfirmed, codMaxMinor: f.codMaxMinor, codLive: f.codLive, mock: f.payment === "mock" || f.otp === "mock" });
}
