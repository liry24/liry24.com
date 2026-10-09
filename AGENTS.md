# Development constraints

- Keep public pages, `/admin`, content APIs and Better Auth in the root Nuxt app and the single `liry24-com` Worker. Use the published `@liria24/site-admin` package, not a workspace copy.
- Build with Nuxt and deploy Nitro's standard generated configuration with Wrangler, including branch Previews. Adopt `cf` gradually for supported operations such as D1/R2 management; do not convert Wrangler output into cf Build Output. Recheck support when upgrading cf or Nitro.
- Keep deployment settings in `nitro.cloudflare.wrangler`; Nitro generates the Wrangler config and deploy redirect. Use `nodejs_compat_v2` with `enable_nodejs_process_v2` and `nodejs_compat_populate_process_env` so Nitro 2 does not add its v2 opt-out and native process stdio/runtime secrets work at the pinned date. Verify actual Worker execution when changing compatibility settings.
- Normal Nuxt development uses Node's SQLite driver at `.data/development/sqlite.db` and the existing fs files storage. Initialize and apply local migrations only during development startup, never an HTTP request or a production build/deployment. Keep the SQLite driver out of Worker bundles. Preserve old `.data/unified` data; switching databases does not copy it automatically.
- Use Vitest for all tests. Keep native D1/workerd integration tests isolated with synthetic bindings and no remote access; their temporary persistence is separate from the development SQLite database. The built-Worker preview uses `.data/worker-preview`, not old `.data/unified` data.
- Apply production and Preview schema changes explicitly through migrations and the `d1_migrations` ledger. Never run DDL from HTTP requests or ordinary deployments. Back up existing databases and check schema compatibility before applying or aligning a baseline.
- Keep published, scheduled and current revisions separate. Production runs `publishDue()` every minute; Previews have no Cron. This application explicitly disables draft Blob separation, so an unpublished original remains accessible to anyone who knows its public R2 URL.
- Preserve the Better Auth patches that use the actual router matcher to bound rate-limit counters by registered route template and one shared unknown-path bucket. Retain route-specific limits.
- Production and Previews use separate authentication secrets and OAuth apps. Callbacks belong directly to each origin at `/api/auth/callback/<provider>`. Do not introduce an OAuth proxy or bake secrets from `.env` into build output.
- Branch Previews use isolated, initially empty D1/R2 resources, no production custom domains, and noindex responses. Never copy production content or authentication data into a Preview. Keep `previewUrls: true` on the parent Worker.
- Preview login requires the GitHub identity to match the current user's `admin` permission on `Liry24/liry24.com`; recheck permission at management APIs and fail closed on lookup errors. Only push trusted branch code because the Preview environment has deployment secrets.
- GitHub Environment `Preview` holds the Cloudflare token, Preview auth secret, OAuth credentials and repository permission lookup token. The current Cloudflare and permission lookup tokens expire on 2026-12-30; replace those Environment secrets before expiry. Keep secret values out of Git.
- Do not add `docs/` or a README for migration records. Keep temporary migration tools, exports and operational evidence outside tracked source; retain necessary development constraints here in English.
- Renovate branches use `renovate/`, including onboarding and lock maintenance. Exclude them
  from Preview deployment and deletion; PR quality is secretless and uses the pinned frozen
  Bun install. Merge the Preview exclusions on both `dev` and default `main` before the owner
  enables the selected-repository Renovate App; delete events read the default-branch workflow.
  Default `main` must contain `renovate.json`, targeting `dev` with `useBaseBranchConfig: merge`.
  Updating patched packages requires patch rebase/retirement and regression checks. Preserve
  the Site Admin pkg.pr.new source until a separately reviewed migration.
