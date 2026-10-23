import { defineCliConfig } from "sanity/cli";
// Replace YOUR_PROJECT_ID after running: npm create sanity@latest (or sanity.io/manage)
export default defineCliConfig({ api: { projectId: "YOUR_PROJECT_ID", dataset: "production" } });
