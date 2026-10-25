import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./schemaTypes/index.js";

export default defineConfig({
  name: "swagramam", title: "Swagramam Menu",
  projectId: "jgy72m9e", dataset: "production",
  plugins: [structureTool({ structure: S => S.list().title("Swagramam").items([
    S.documentTypeListItem("dish").title("Dishes"),
    S.documentTypeListItem("category").title("Categories"),
    S.documentTypeListItem("announcement").title("What's new (home page)"),
    S.listItem().title("Contact, address and hours").id("siteSettings").child(S.document().schemaType("siteSettings").documentId("siteSettings")) ]) })],
  schema: { types: schemaTypes, templates: t => t.filter(x => x.schemaType !== "siteSettings") },
  document: { actions: (prev, ctx) => ctx.schemaType === "siteSettings" ? prev.filter(a => ["publish", "discardChanges", "restore"].includes(a.action)) : prev },
});
