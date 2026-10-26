# sitegate kit - one gate for every website build

Files (keep all in ONE folder, or copy into the project root):
- sitegate.py                    the gate (run this)
- prelaunch_audit.py             static audit engine (SEO, links, images, schema, placeholders)
- mobile_check.py                real-phone rendering check (needs Playwright + Chromium)
- sitegate.config.template.json  copy to sitegate.config.json and fill per client
- launch-checklist.json          manual post-launch items (enforced by --launch)
- examples/                      filled restaurant config for reference

## Per project
1. cp sitegate.config.template.json sitegate.config.json   (fill business, phones, domain, required_pages, required_assets, socials)
   Restaurant: python3 sitegate.py init --profile restaurant   (sets Restaurant checks: hours, schema, menu)
2. python3 sitegate.py plan                 what the build must satisfy (give this to the builder/Claude first)
3. npm run build                            then:
   python3 sitegate.py check dist/ --mobile
4. Fix every BLOCKER. Exit code 1 = not shippable.
5. Before launch:  python3 sitegate.py check dist/ --mobile --launch --strict
   Live site:      python3 sitegate.py check dist/ --url https://yourdomain --crawl

## Useful flags
--fix --dry-run   preview auto-fixes     --gen-seo  generate robots/sitemap
--json            machine-readable       --external check outbound links

## One-time setup
pip install playwright --break-system-packages && playwright install chromium

## Tell the builder (Claude/dev)
"Run python3 sitegate.py plan first and build to satisfy it. Do not report done until
sitegate check dist/ --mobile exits 0."
