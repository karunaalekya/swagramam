// Prints click-to-WhatsApp links, one per placement. wa.me has no UTM, so each placement has its own opening text.
//   node tools/wa-links.mjs [number91]
const num = (process.argv[2] || "917659858999").replace(/\D/g, "");
export const PLACEMENTS = {
  website: "Hi Swagramam, I would like to order take away.",
  google: "Hi Swagramam, I found you on Google. I would like to reserve a table.",
  instagram: "Hi Swagramam, I came from Instagram.",
  email_maps: "Hi Swagramam, I would like to know more.",
};
export const link = (text, n = num) => "https://wa.me/" + n + "?text=" + encodeURIComponent(text);
if (import.meta.url === "file://" + process.argv[1]) for (const [k, t] of Object.entries(PLACEMENTS)) console.log(k.padEnd(12), link(t));
