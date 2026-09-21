# mPanel

Free website-management control panel powered by Supabase and GitHub.

## Stack
- Static HTML/CSS/JavaScript ES modules
- Supabase Auth + PostgreSQL + Row Level Security
- Lucide Icons
- GitHub Pages compatible

## Included
Authentication, dashboard, website management, domains, SEO checklist, basic browser monitoring, settings, and a database-enforced Free plan limited to 3 sites.

## Open-source building blocks
- Supabase JS: https://github.com/supabase/supabase-js
- Lucide: https://github.com/lucide-icons/lucide
- Supabase: https://github.com/supabase/supabase

## Setup
1. Create a Supabase project.
2. Run supabase/migrations/001_initial_schema.sql, then supabase/migrations/002_monitoring_audit.sql.
3. In Supabase Dashboard → Authentication → Providers, enable Email. In Authentication → URL Configuration, add your GitHub Pages URL as the Site URL and add the same URL (plus any auth callback path you use) to Redirect URLs.\n4. Put your Supabase URL and publishable/anon key in assets/js/config.js.
5. Never expose the service_role/secret key.
6. Enable GitHub Pages from main/root.

Server-side scheduled monitoring can be added later with Supabase Edge Functions/pg_cron.
