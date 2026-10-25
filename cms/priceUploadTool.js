// Swagramam Studio tool: download the price sheet, edit prices in Excel, upload the CSV, preview, apply.
// Matches rows by the locked dish Code (dishId) and, for dishes with sizes, by the size code (options[].key).
// Only prices change. Names, codes, sizes and everything else in the sheet are for reading only.
import React, { useState, useEffect, useCallback } from "react";
import { useClient } from "sanity";
import { Card, Stack, Flex, Box, Button, Text, Heading } from "@sanity/ui";

const h = React.createElement;
const API = "2024-01-01";

const DISHES_QUERY = `*[_type=="dish" && !(_id in path("drafts.**"))]|order(order asc){_id,dishId,name,price,"options":options[]{_key,key,label,price}}`;
const DRAFTS_QUERY = `*[_type=="dish" && _id in path("drafts.**")]._id`;

// ---------- CSV ----------
function parseCsv(text) {
  text = String(text).replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/, 1)[0] || "";
  const commas = (first.match(/,/g) || []).length;
  const semis = (first.match(/;/g) || []).length;
  const d = semis > commas ? ";" : ",";
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === d) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = ""; rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ""));
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function currentRows(dishes) {
  const out = [];
  for (const d of dishes) {
    if (d.options && d.options.length) {
      for (const o of d.options) out.push({ code: d.dishId, name: d.name, sizeCode: o.key, size: o.label, price: o.price });
    } else out.push({ code: d.dishId, name: d.name, sizeCode: "", size: "", price: d.price });
  }
  return out;
}

function downloadSheet(dishes) {
  const lines = [["code", "name", "size_code", "size", "price"].join(",")]
    .concat(currentRows(dishes).map(r => [r.code, r.name, r.sizeCode, r.size, r.price].map(csvCell).join(",")));
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "swagramam-prices.csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

// ---------- compare the uploaded sheet with the live data ----------
function makePlan(dishes, draftIds, rows) {
  const errors = [], changes = [];
  let unchanged = 0;
  if (!rows.length) return { errors: ["The file is empty."], changes, unchanged };
  const header = rows[0].map(x => String(x).trim().toLowerCase());
  const ix = n => header.indexOf(n);
  if (ix("code") < 0 || ix("price") < 0) {
    return { errors: ["The sheet needs columns named code and price. Please start from the downloaded sheet."], changes, unchanged };
  }
  const byCode = new Map(dishes.map(d => [d.dishId, d]));
  const seen = new Set();
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const code = String(r[ix("code")] || "").trim();
    const sizeCode = ix("size_code") >= 0 ? String(r[ix("size_code")] || "").trim() : "";
    const raw = String(r[ix("price")] == null ? "" : r[ix("price")]).replace(/[\u20B9,\s]|rs\.?/gi, "");
    const n = Number(raw);
    if (!code) { errors.push("Row " + line + ": code is empty"); return; }
    const d = byCode.get(code);
    if (!d) { errors.push("Row " + line + ": code \"" + code + "\" is not in the menu"); return; }
    const k = code + "|" + sizeCode;
    if (seen.has(k)) { errors.push("Row " + line + ": " + code + (sizeCode ? " / " + sizeCode : "") + " appears twice"); return; }
    seen.add(k);
    if (raw === "" || !Number.isInteger(n) || n <= 0) {
      errors.push("Row " + line + ": " + d.name + " price must be a whole number of rupees above 0 (found \"" + String(r[ix("price")] || "") + "\")");
      return;
    }
    let target;
    if (d.options && d.options.length) {
      const o = d.options.find(x => x.key === sizeCode);
      if (!o) { errors.push("Row " + line + ": " + d.name + " has sizes, but size_code \"" + sizeCode + "\" was not found"); return; }
      target = { path: 'options[_key=="' + o._key + '"].price', old: o.price, label: o.label };
    } else {
      if (sizeCode) { errors.push("Row " + line + ": " + d.name + " has a single price, leave size_code empty"); return; }
      target = { path: "price", old: d.price, label: "" };
    }
    if (n === target.old) { unchanged++; return; }
    changes.push({
      id: d._id, hasDraft: draftIds.has("drafts." + d._id), path: target.path,
      name: d.name, size: target.label, old: target.old, next: n,
      big: target.old > 0 && Math.abs(n - target.old) / target.old > 0.5
    });
  });
  return { errors, changes, unchanged };
}

// ---------- screen ----------
function PriceUpload() {
  const client = useClient({ apiVersion: API });
  const [dishes, setDishes] = useState([]);
  const [draftIds, setDraftIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [plan, setPlan] = useState(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [fileKey, setFileKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setLoadErr("");
    try {
      const [ds, dr] = await Promise.all([client.fetch(DISHES_QUERY), client.fetch(DRAFTS_QUERY)]);
      setDishes(ds || []); setDraftIds(new Set(dr || []));
    } catch (e) { setLoadErr(String(e && e.message ? e.message : e)); }
    setLoading(false);
  }, [client]);

  useEffect(() => { load(); }, [load]);

  async function onFile(e) {
    const f = e.target.files && e.target.files[0];
    setMsg(""); setPlan(null);
    if (!f) return;
    setFileName(f.name);
    if (/\.xlsx?$/i.test(f.name)) {
      setPlan({ errors: ["This is an Excel file. In Excel choose File > Save As > CSV UTF-8, then upload that file."], changes: [], unchanged: 0 });
      return;
    }
    try { setPlan(makePlan(dishes, draftIds, parseCsv(await f.text()))); }
    catch (err) { setPlan({ errors: ["Could not read the file: " + (err && err.message ? err.message : err)], changes: [], unchanged: 0 }); }
  }

  async function apply() {
    if (!plan || plan.errors.length || !plan.changes.length) return;
    setBusy(true); setMsg("");
    try {
      const tx = client.transaction();
      for (const c of plan.changes) {
        tx.patch(c.id, { set: { [c.path]: c.next } });
        if (c.hasDraft) tx.patch("drafts." + c.id, { set: { [c.path]: c.next } });
      }
      await tx.commit();
      setMsg("Done. " + plan.changes.length + " price" + (plan.changes.length === 1 ? "" : "s") + " updated. The website updates in a minute or two.");
      setPlan(null); setFileName(""); setFileKey(k => k + 1);
      await load();
    } catch (err) {
      setMsg("Nothing was saved. " + (err && err.message ? err.message : err));
    }
    setBusy(false);
  }

  const th = { textAlign: "left", padding: "6px 10px", borderBottom: "1px solid #8884" };
  const td = { padding: "6px 10px", borderBottom: "1px solid #8882" };

  return h(Card, { padding: 4 },
    h(Stack, { space: 4, style: { maxWidth: 900 } },
      h(Heading, { as: "h1", size: 2 }, "Price upload"),
      h(Text, { size: 1, muted: true }, "1. Download the sheet. 2. Change prices in the price column in Excel and save as CSV. 3. Upload it here, check the preview, then press Apply."),
      loading ? h(Text, null, "Loading the menu...") : null,
      loadErr ? h(Card, { padding: 3, tone: "critical", radius: 2 }, h(Text, null, "Could not load the menu: " + loadErr)) : null,
      !loading && !loadErr ? h(Flex, { gap: 3, align: "center", wrap: "wrap" },
        h(Button, { text: "Download current prices (" + dishes.length + " dishes)", tone: "primary", onClick: () => downloadSheet(dishes) }),
        h("input", { key: fileKey, type: "file", accept: ".csv,text/csv", onChange: onFile })
      ) : null,
      msg ? h(Card, { padding: 3, radius: 2, tone: /^Done/.test(msg) ? "positive" : "critical" }, h(Text, null, msg)) : null,
      plan ? h(Stack, { space: 3 },
        h(Text, { weight: "semibold" }, (fileName ? fileName + ": " : "") + plan.changes.length + " to change, " + plan.unchanged + " unchanged" + (plan.errors.length ? ", " + plan.errors.length + " problem(s)" : "")),
        plan.errors.length ? h(Card, { padding: 3, radius: 2, tone: "critical" },
          h(Stack, { space: 2 },
            h(Text, { weight: "semibold" }, "Fix these in the sheet and upload again. Nothing is saved until there are no problems."),
            plan.errors.slice(0, 30).map((er, i) => h(Text, { key: i, size: 1 }, er)),
            plan.errors.length > 30 ? h(Text, { size: 1 }, "...and " + (plan.errors.length - 30) + " more") : null)) : null,
        plan.changes.length ? h("div", { style: { overflowX: "auto" } },
          h("table", { style: { borderCollapse: "collapse", fontSize: 14 } },
            h("thead", null, h("tr", null, ["Dish", "Size", "Old price", "New price", ""].map(t => h("th", { key: t, style: th }, t)))),
            h("tbody", null, plan.changes.map((c, i) => h("tr", { key: i },
              h("td", { style: td }, c.name), h("td", { style: td }, c.size),
              h("td", { style: td }, "Rs " + c.old),
              h("td", { style: { ...td, fontWeight: 600 } }, "Rs " + c.next),
              h("td", { style: { ...td, color: "#d33" } }, c.big ? "Big change, please check" : "")))))) : null,
        plan.changes.length && !plan.errors.length
          ? h(Flex, { gap: 3 }, h(Button, { text: busy ? "Saving..." : "Apply " + plan.changes.length + " change" + (plan.changes.length === 1 ? "" : "s"), tone: "positive", disabled: busy, onClick: apply }),
              h(Button, { text: "Cancel", mode: "ghost", disabled: busy, onClick: () => { setPlan(null); setFileName(""); setFileKey(k => k + 1); } }))
          : null
      ) : null
    )
  );
}

export const priceUploadTool = {
  name: "price-upload",
  title: "Price upload",
  icon: () => h("span", { style: { fontSize: 18 } }, "\u20B9"),
  component: PriceUpload
};
