// MSG91 OTP sender (v5 /otp API, DLT template). We generate and verify the code ourselves; MSG91 only delivers the SMS.
// Secrets: MSG91_AUTHKEY, MSG91_TEMPLATE_ID. Optional: MSG91_OTP_VAR (template variable name, default "OTP"), MSG91_REALTIME=1.
export const msg91Missing = env => ["MSG91_AUTHKEY", "MSG91_TEMPLATE_ID"].filter(k => !env[k]);
export async function msg91Send(env, phone10, code, expiryMin = 5) {
  const miss = msg91Missing(env); if (miss.length) return { ok: false, error: "msg91_config", detail: "missing " + miss.join(",") };
  const q = new URLSearchParams({ template_id: env.MSG91_TEMPLATE_ID, mobile: "91" + phone10, otp: code, otp_length: String(code.length), otp_expiry: String(expiryMin), realTimeResponse: "1" });
  const body = { [env.MSG91_OTP_VAR || "OTP"]: code };
  let res; try { res = await fetch("https://control.msg91.com/api/v5/otp?" + q, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", authkey: env.MSG91_AUTHKEY }, body: JSON.stringify(body) }); }
  catch (e) { return { ok: false, error: "msg91_network", detail: String(e && e.message || e).slice(0, 120) }; }
  let j = null; try { j = await res.json(); } catch {}
  const okType = j && String(j.type || "").toLowerCase() === "success";
  if (res.ok && okType) return { ok: true, requestId: j.request_id || j.message || null };
  return { ok: false, error: "msg91_rejected", detail: ((j && (j.message || j.type)) || res.status) + "" };
}
