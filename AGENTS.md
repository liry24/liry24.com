# Repository guidelines

## Stack & runtime architecture

- **Framework & SDK**: `nuxt@4.7.0` with `future: { compatibilityVersion: 5 }`, `@nuxt/nitro-v3-server@4.7.0` (Nitro 3), `vite-hub@0.6.1`, `@nuxt/ui` (primary UI) + `@vite-hub/ui` (`Chat` / `PromptInput` for `/admin` assistant).
- **Platform packages**: `@vite-hub/auth`, `@vite-hub/blob`, `@vite-hub/cms`, `@vite-hub/content`, `@vite-hub/database`, `@vite-hub/forms`, `@vite-hub/schedule`, `@vite-hub/workspace`. Use `vite-hub/*` public subpaths and generated `.nuxt` / `.vitehub` types.
- **Database & storage**: Single Cloudflare D1 binding (`DB`) and single public R2 binding (`STORAGE` served at `/media`) shared between `@vite-hub/cms` media and `@vite-hub/content` workspace storage (unpublished draft/revision blobs are not isolated in a separate private bucket). Published, scheduled, and current draft revisions remain separate.
- **Scheduled publishing**: `server/schedules/content-publish.ts` runs `content.publishDue()` on `* * * * *` via `@vite-hub/schedule` (Nitro `providerOutput: 'nitro'`, disabled during CI test builds with `LIRY24_DISABLE_CRON=true`).
- **Observability**: `@vite-hub/observability` with cost-controlled `evlog` (`browserErrors: false`, static/media routes excluded, `info` sampled at `1%`, `warn`/`error` at `100%`, tail-sampling keeps `status >= 500`, `duration >= 2000`, `/api/admin/**`, and `/_vitehub/agents/**`) paired with Cloudflare Wrangler `observability` (`invocation_logs: false`, `redact_query_string: true`, `traces.enabled: false`, `issues.enabled: false`).

## Authentication & secrets

- **Single-owner Pocket ID OIDC**: Configured in `server/auth.ts` with `better-auth@1.7.28` (`admin`, `genericOAuth`, `providerId: 'pocket-id'`, PKCE, `requireIdTokenVerification: true`), callback path `/api/auth/callback/pocket-id`, cookie prefix `liry24-pocket`, and owner gates `POCKET_ID_ADMIN_EMAIL` / `POCKET_ID_ADMIN_SUB` + `account` (`providerId`, `accountId`, `issuer`) enforcement. Passwordless/username/link-account endpoints and legacy providers stay disabled.
- **Origin handling**: `server/auth.ts` uses an explicit allowlist (`https://liry24.com`, `https://dev-liry24-com.liry.workers.dev`, `*.workers.dev` when non-production, and loopback HTTP for synthetic Worker tests). In `bun dev`, local administrator sessions also require `import.meta.dev` and a request origin matching the loopback listener captured by Nuxt's `listen` hook.
- **Local admin**: Apply existing migrations with `bun x vitehub database migrate` when setting up local SQLite. Open `/admin` on the loopback URL shown by `bun dev` to sign in automatically. On hosted environments, `/admin` starts Pocket ID sign-in.
- **Drizzle v1 compatibility**: `patches/@vite-hub%2Fauth@0.6.1.patch` switches `@vite-hub/auth`'s `authDatabase()` to `@better-auth/drizzle-adapter/relations-v2` and contributes Drizzle v1 `defineRelationsPart` relations (`authSqliteRelations` / `authPostgresRelations`), enabling `advanced.database.joins: true` in `server/auth.ts` with `drizzle-orm@1.0.0-rc.6`. Re-verify `tests/auth.test.ts` and `tests/worker/pocket-id.test.ts` on `@vite-hub/auth` upgrades until upstream ships this change.
- **Secret unsealing**: Always declare server env keys in `env.ts` (never add test-only flags there) and unseal `{ secret: true }` values with `readSecretValue` from `server/utils/secret.ts` (because ViteHub wraps runtime secrets in `SecretEnv`).

## Editorial assistant & integrations

- **Assistant (`server/agents/assistant.ts`)**: `defineAgent` with `content()` capability and `webChat` channel, enforced admin-only at **both** `webChat.route.admission.authenticate` (before payload validation) and `defineAgent.invoker`. Uses direct `@ai-sdk/google` `'gemini-4-hydrogen'` with `google: { thinkingConfig: { thinkingLevel: 'low' } }` — do not reintroduce ChatGPT or Cloudflare AI Gateway fallbacks. Offline tests (`LIRY24_TEST_LOCAL=true`, `APP_ENV=test`, or unset API key) use `MockLanguageModelV4`.
- **IGDB (`server/utils/igdb.ts`)**: Uses `@liry24/igdb` (keep minor version pinned `~4.1.2`) with `createMemoryTokenCache()` reading `useServerEnv()` with `readSecretValue` (and `process.env` fallback), validating responses with Zod and returning safe 502/503 errors. In non-production (`bun dev` without credentials, or `LIRY24_IGDB_EMULATOR=true` under test runtimes), falls back to `@liry24/igdb/emulator` (`createIgdbEmulator`).
- **Domain helpers**: Shared Zod schemas live in `shared/utils/contentSchemas.ts` and their types in `shared/types/content.ts`. Markdown and game rules live in `shared/utils/` and `server/utils/gameValidation.ts`. Public SEO and OG image generation use Nuxt (`nuxt-og-image` and Takumi).

## Deployment, Previews & patches

- **Nitro-generated Wrangler config**: `nuxt.config.ts` emits `.output/server/wrangler.json` (and `.wrangler/deploy/config.json`) with production bindings (`DB` `227d818f-cd40-4fca-9710-b57273be94ca`, `STORAGE` `liry24-com`, route `liry24.com` production-only with `previews_enabled` omitted so `*.liry24.com` never intercepts `sso.liry24.com`, `memo.liry24.com`, or `images.liry24.com`) and Method B `previews` (`APP_ENV: 'dev'`, `NUXT_PUBLIC_SITE_URL: 'https://dev-liry24-com.liry.workers.dev'`, `NUXT_PUBLIC_IMAGES_DOMAIN: 'https://dev-liry24-com.liry.workers.dev'`, D1 `liry24-com-dev` `3c7c6179-12d0-4108-9eea-b3e20d394cef`, R2 `liry24-com-dev-storage`).
- **Root patches (`patchedDependencies`)**: Keep `patches/@vite-hub%2Fauth@0.6.1.patch`, `patches/@vite-hub%2Fdatabase@0.6.1.patch`, `patches/better-auth@1.7.28.patch`, and `patches/better-call@1.4.6.patch` (re-verify `tests/auth.test.ts` rate-limit counter bounding and Drizzle v1 `relations-v2` joins on every upgrade).
- **Production freeze**: Never modify `main`, production D1 (`227d818f-cd40-4fca-9710-b57273be94ca`), production R2 (`liry24-com`), or Cloudflare Workers Builds `production_settings` without explicit user approval after `https://dev-liry24-com.liry.workers.dev` verification.

## Verification commands

- Standard checks: `bun run format:check` (`vp fmt --check`), `bun run lint` (`vp lint`), `bun run lint:vue`, `bun run typecheck`, `bun run test`.
- `bun run typecheck` regenerates Nuxt and ViteHub types, then uses `tsconfig.vize.json` to check all projects (including `tsconfig.tests.json`) with tsrs and the Vize `.vue` content mapper. Formatting, Oxlint (with Nuxt auto-import enforcement), and Vue lint rules are configured in `vite.config.ts` via Vite+.
- Put app tests that rely on auto-imports in `tests/nuxt/`. `@nuxt/test-utils` applies the fixture's Nuxt transform there and supports `mockNuxtImport`. Node tests load their dependencies directly and use explicit imports.
- Optional Nuxt diagnostics: `bun run check:doctor`. Use `--changed` for local edits or `--since origin/dev` for branch changes.
- Built Worker checks (always run `bun run build` after `server/` edits first): `bun x wrangler deploy --dry-run --config .output/server/wrangler.json` and `LIRY24_TEST_BUILT_WORKER=true bun x vitest run tests/worker/` (always via Node/Vitest, never `bun test`).
