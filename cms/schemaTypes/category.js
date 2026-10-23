import { defineType, defineField } from "sanity";
// Category = a menu section (Soups, Starters ...). Code is fixed for ever; the client renames or reorders only.
export default defineType({
  name: "category", title: "Category", type: "document",
  fields: [
    defineField({ name: "code", title: "Code (never change)", type: "string", readOnly: true, validation: R => R.required() }),
    defineField({ name: "nameEn", title: "Name (English)", type: "string", validation: R => R.required().max(30) }),
    defineField({ name: "nameTe", title: "Name (Telugu, written in English letters)", type: "string", validation: R => R.required().max(40) }),
    defineField({ name: "icon", title: "Icon number (1 to 6)", type: "number", validation: R => R.required().integer().min(1).max(6) }),
    defineField({ name: "order", title: "Position in the list", type: "number", validation: R => R.required() }),
    defineField({ name: "showLunch", title: "Show on lunch menu", type: "boolean", initialValue: true }),
    defineField({ name: "orderLunch", title: "Position on lunch menu", type: "number", hidden: ({ parent }) => !parent?.showLunch }),
    defineField({ name: "showDinner", title: "Show on dinner menu", type: "boolean", initialValue: true }),
    defineField({ name: "orderDinner", title: "Position on dinner menu", type: "number", hidden: ({ parent }) => !parent?.showDinner }),
  ],
  orderings: [{ title: "Position", name: "pos", by: [{ field: "order", direction: "asc" }] }],
  preview: { select: { title: "nameEn", subtitle: "nameTe" } },
});
