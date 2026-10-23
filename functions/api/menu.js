import { json } from "../_lib/util.js";
import { flags, ready } from "../_lib/flags.js";
import { publicMenu, CATS } from "../_lib/menu.js";
import { TIP_OPTIONS, TIP_DEFAULT } from "../_lib/pricing.js";
export async function onRequestGet({ env }) {
  const f = flags(env);
  return json({ ok: true, live: ready(env) && !!env.DB && !!env.KV, cats: CATS, items: publicMenu(), gstPct: f.gstBp / 100, gstAssumed: !f.gstConfirmed, codMaxMinor: f.codMaxMinor, codLive: f.codLive, tip: { defaultPct: TIP_DEFAULT, options: TIP_OPTIONS }, offersStack: false, mock: f.payment === "mock" || f.otp === "mock" });
}
