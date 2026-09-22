# mPanel schema map — 2026-09-22\n\nmPanel is organized as a Supabase-backed CMS, website builder, SEO manager and GitHub deployment manager. Analytics is now included as a privacy-conscious first-party analytics layer.\n\n## Migration sequence\n\n| Migration | Responsibility |\n|---|---|\n| 001 | profiles, sites, domains, SEO checklist, ownership and free-plan guard |\n| 002 | monitoring events and audit log |\n| 003 | website workspace files and file versions |\n| 004 | posts, pages, categories, tags and taxonomy relations |\n| 005 | layout sections, widgets, menus, menu items and theme settings |\n| 006 | advanced site SEO, revisions, integrations and deployments |\n| 007 | media metadata, builder templates/blocks, redirects, domain verification, security, performance, health checks and cross-table hardening |
| 008 | backfill platform defaults and domain integrity validation |
| 009 | first-party analytics settings/events and secure ingestion RPC |
| 010 | real Supabase media storage bucket/policies and media storage integrity |\n| 011 | safe file archive/recovery, deployment verification metadata and archive/404 template defaults |\n\n## Logical product sequence\n\n1. System hardening and ownership integrity\n2. Content editor and revisions\n3. Media library\n4. Website builder\n5. Theme/layout/widgets/navigation\n6. Advanced SEO\n7. Publishing and atomic GitHub deployment\n8. Domain verification\n9. Security and permissions\n10. Performance and production controls\n11. Analytics and traffic reporting
12. Final preflight/QA\n\n## Core relations\n\n- sites.user_id -> auth.users.id\n- All site-scoped tables carry both user_id and site_id.\n- posts -> post_categories -> categories\n- posts -> post_tags -> tags\n- menus -> menu_items\n- builder_templates -> builder_blocks\n- domains -> domain_verifications\n- site_files -> site_file_versions\n- site_seo_settings, site_integrations, deployments, site_security_settings, site_performance_settings are configuration/history layers.\n\n## Security model\n\nEvery new table in 007 has RLS and owner policies. Ownership columns are locked on update. Cross-site relations are checked by database triggers for menu items, post taxonomy and builder blocks.\n\n## Deployment model\n\nThe browser builds generated site files, then the GitHub integration performs an atomic Git tree/commit/ref update. GitHub credentials are session/OAuth based and are not stored in the Supabase database.\n\n## Important operational note\n\nThe repository contains the migrations, but Supabase SQL execution is a separate database operation. The GitHub connector available in this environment can modify the repository; it does not expose a Supabase SQL execution action. Therefore this migration must be run in the Supabase SQL editor before the new Platform Center can use its new tables.

## Analytics

Migration 009 adds `site_analytics_settings` and `analytics_events`. Anonymous page views are ingested through `record_analytics_event(...)` using a per-site public key; dashboard reads remain protected by RLS. The tracker intentionally does not send IP addresses, email addresses, or account IDs. Retention is configurable from 7 to 730 days.

## Platform implementation status

- **Builder:** real template/block CRUD is available in the Builder workspace. Generated output consumes default templates/blocks when present and falls back to the CMS layout when not.
- **Media Library:** binary image uploads use the mpanel-media Supabase Storage bucket after migration 010. External URLs remain supported.
- **Redirect Manager:** redirects are stored in seo_redirects; publishing emits a _redirects manifest for hosts that support it. GitHub Pages itself does not execute server-side redirect rules.
- **Domain Verification:** DNS TXT/CNAME checks use a public DNS resolver from the browser. HTML-file/meta-tag methods provide instructions but are not falsely marked verified without an external reachability check.
- **Production Health:** preflight checks cover site access, SEO, security, performance, media storage/library, builder, redirects, domain records, GitHub integration, analytics and build readiness.

**Operational requirement:** migration 010 must be executed in Supabase before binary Media Library uploads are available. Migration 009 must also be executed before Analytics ingestion/dashboard settings are available. Migration 011 must be executed before safe file recovery and deployment verification metadata are available.


## Builder and deployment completion

- **Builder publishing:** Builder now exposes a direct Publish action and uses the same atomic GitHub publishing pipeline as the Publishing view.
- **Archive / 404:** generated sites include `archive.html` and `404.html`; GitHub Pages supports a repository-root `404.html` custom error page. citeturn0search0
- **SEO / Schema:** generated posts/pages emit page-specific canonical URLs and JSON-LD schema; Advanced SEO also accepts a custom JSON-LD object.
- **Theme Presets:** reusable user presets can be saved, applied and deleted from Theme and Builder.
- **File safety:** workspace file deletion is an archive operation after migration 011; archived files can be restored without destroying their version history.
- **Production verification:** publishing verifies the target branch ref, mPanel manifest and `index.html` after the atomic commit. Deployment history records verification status and commit metadata.
- **Static GitHub Pages:** generated output includes `.nojekyll` so the static build can be served without Jekyll processing; GitHub Pages requires a top-level `index.html` for branch-based publishing. citeturn0search5turn0search2
