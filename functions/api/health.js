import { json } from "../_lib/util.js";
import { flags, problem, ready, warnings } from "../_lib/flags.js";
// Public. Tells the site whether online ordering is open (the order popup uses this to decide between checkout and the WhatsApp flow).
export async function onRequestGet({ env }) {
  const f = flags(env);
  return json({ ok: true, live: ready(env) && !!env.DB && !!env.KV, mock: f.payment === "mock" || f.otp === "mock", problem: f.prod ? undefined : problem(env), warnings: f.prod ? undefined : warnings(env) });
}
