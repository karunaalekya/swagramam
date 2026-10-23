import { defineType, defineField } from "sanity";
// One card in "What's new at Swagramam" on the home page. Newest first (lowest Order number shows first). Keep 3 to 4 live.
const plain = (max) => R => R.required().max(max).regex(/^[^<>"\\]+$/, { name: "plain" }).error('Do not use < > " or \\');
export default defineType({
  name: "announcement", title: "Announcement", type: "document",
  orderings: [{ title: "Order on the site", name: "orderAsc", by: [{ field: "order", direction: "asc" }] }],
  fields: [
    defineField({ name: "title", title: "Title", description: "Short heading, up to 60 characters.", type: "string", validation: plain(60) }),
    defineField({ name: "text", title: "Text", description: "One or two sentences, up to 160 characters.", type: "text", rows: 3, validation: plain(160) }),
    defineField({ name: "tag", title: "Small label above the title", description: "For example: New · Oct 2026, Catering, Special days. Use the dot with spaces around it if you want one.", type: "string", validation: plain(30) }),
    defineField({ name: "icon", title: "Icon", type: "string", options: { list: [{ title: "Gift (offers, rewards)", value: "gift" }, { title: "Cutlery (food, menu)", value: "cutlery" }, { title: "Calendar (events, catering)", value: "calendar" }], layout: "radio" }, initialValue: "calendar", validation: R => R.required() }),
    defineField({ name: "linkUrl", title: "Link (optional)", description: "A page such as menu.html or catering.html, a section such as #rewards, or a full https:// address.", type: "string", validation: R => R.regex(/^(https:\/\/[^\s"<>]+|[a-z0-9\-/.]*\.html(#[a-z0-9-]+)?|#[a-z0-9-]+)$/, { name: "link" }).error("Use menu.html, #rewards or https://...") }),
    defineField({ name: "linkLabel", title: "Link text", description: "For example: See menu. The arrow is added by the site.", type: "string", validation: R => R.max(24).custom((v, c) => (c.document?.linkUrl && !v ? "Write the link text" : true)) }),
    defineField({ name: "expire", title: "Hide after (optional)", description: "Last day it shows. After this date the card disappears on its own.", type: "date" }),
    defineField({ name: "order", title: "Order", description: "10 shows first, then 20, 30. Leave gaps so you can slot one in.", type: "number", validation: R => R.required().integer().min(0) }),
    defineField({ name: "hidden", title: "Hide without deleting", type: "boolean", initialValue: false }),
  ],
  preview: { select: { title: "title", subtitle: "tag", hidden: "hidden" }, prepare: ({ title, subtitle, hidden }) => ({ title: (hidden ? "[hidden] " : "") + title, subtitle }) },
});
