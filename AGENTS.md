# Development constraints

- Keep public pages, `/admin`, content APIs and Better Auth in the root Nuxt app and the single `liry24-com` Worker. Use the published `@liria24/site-admin` package, not a workspace copy.
- Build with Nuxt and deploy Nitro's standard generated configuration with Wrangler, including branch Previews. Adopt `cf` gradually for supported operations such as D1/R2 management; do not convert Wrangler output into cf Build Output. Recheck support when upgrading cf or Nitro.
- CLI local persistence is `.data/unified`; the CLI appends `v3`. Nitro's `getPlatformProxy` receives `.data/unified/v3` directly. Keep both paths aligned.
- Apply schema changes explicitly through migrations and the `d1_migrations` ledger. Never run DDL from HTTP requests or ordinary deployments. Back up existing databases and check schema compatibility before applying or aligning a baseline.
- Keep published, scheduled and current revisions separate. Production runs `publishDue()` every minute; Previews have no Cron. This application explicitly disables draft Blob separation, so an unpublished original remains accessible to anyone who knows its public R2 URL.
- Preserve the Better Auth patches that use the actual router matcher to bound rate-limit counters by registered route template and one shared unknown-path bucket. Retain route-specific limits.
- Production and Previews use separate authentication secrets and OAuth apps. Callbacks belong directly to each origin at `/api/auth/callback/<provider>`. Do not introduce an OAuth proxy or bake secrets from `.env` into build output.
- Branch Previews use isolated, initially empty D1/R2 resources, no production custom domains, and noindex responses. Never copy production content or authentication data into a Preview. Keep `previewUrls: true` on the parent Worker.
- Preview login requires the GitHub identity to match the current user's `admin` permission on `Liry24/liry24.com`; recheck permission at management APIs and fail closed on lookup errors. Only push trusted branch code because the Preview environment has deployment secrets.
- GitHub Environment `Preview` holds the Cloudflare token, Preview auth secret, OAuth credentials and repository permission lookup token. The current Cloudflare and permission lookup tokens expire on 2026-12-30; replace those Environment secrets before expiry. Keep secret values out of Git.
- Do not add `docs/` or a README for migration records. Keep temporary migration tools, exports and operational evidence outside tracked source; retain necessary development constraints here in English.
