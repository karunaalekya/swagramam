// Money is integer paise everywhere. GST is rounded half-up to the paisa.
export const gstMinor = (subMinor, bp) => Math.floor((subMinor * bp + 5000) / 10000);
export const rupees = m => (m / 100).toFixed(2);                 // "1000.00" (PayU amount format)
export function minorFromAmount(s) { const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(String(s).trim()); return m ? +m[1] * 100 + +((m[2] || "0").padEnd(2, "0")) : null; }
export const pointsFor = subMinor => Math.floor(subMinor / 100);   // Rs 1 = 1 point on subtotal before tax
export const fmt = m => "Rs " + (m / 100).toLocaleString("en-IN", { minimumFractionDigits: m % 100 ? 2 : 0 });
