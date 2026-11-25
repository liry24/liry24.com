# Repository guidelines

## Stack & runtime architecture

- **Framework & SDK**: `nuxt@4.7.0` with `future: { compatibilityVersion: 5 }`, `@nuxt/nitro-v3-server@4.7.0` (Nitro 3), `vite-hub@0.4.1`, `@nuxt/ui` (primary UI) + `@vite-hub/ui` (`Chat` / `PromptInput` for `/admin` assistant).
- **Platform packages**: `@vite-hub/auth`, `@vite-hub/blob`, `@vite-hub/cms`, `@vite-hub/content`, `@vite-hub/database`, `@vite-hub/forms`, `@vite-hub/schedule`, `@vite-hub/workspace`. Use `vite-hub/*` public subpaths and generated `.nuxt` / `.vitehub` types.
- **Database & storage**: Single Cloudflare D1 binding (`DB`) and single public R2 binding (`STORAGE` served at `/media`) shared between `@vite-hub/cms` media and `@vite-hub/content` workspace storage (unpublished draft/revision blobs are not isolated in a separate private bucket). Published, scheduled, and current draft revisions remain separate.
- **Scheduled publishing**: `server/schedules/content-publish.ts` runs `content.publishDue()` on `* * * * *` via `@vite-hub/schedule` (Nitro `providerOutput: 'nitro'`, disabled during CI test builds with `LIRY24_DISABLE_CRON=true`).
- **Observability**: `@vite-hub/observability` with cost-controlled `evlog` (`browserErrors: false`, static/media routes excluded, `info` sampled at `1%`, `warn`/`error` at `100%`, tail-sampling keeps `status >= 500`, `duration >= 2000`, `/api/admin/**`, and `/_vitehub/agents/**`) paired with Cloudflare Wrangler `observability` (`invocation_logs: false`, `redact_query_string: true`, `traces.enabled: false`, `issues.enabled: false`).

## Authentication & secrets

- **Single-owner Pocket ID OIDC**: Configured in `server/auth.ts` with `better-auth@1.7.27` (`admin`, `genericOAuth`, `providerId: 'pocket-id'`, PKCE, `requireIdTokenVerification: true`), callback path `/api/auth/callback/pocket-id`, cookie prefix `liry24-pocket`, and owner gates `POCKET_ID_ADMIN_EMAIL` / `POCKET_ID_ADMIN_SUB` + `account` (`providerId`, `accountId`, `issuer`) enforcement. Passwordless/username/link-account endpoints and legacy providers stay disabled.
- **Origin handling**: `resolveAuthBaseUrl` in `server/auth.ts` uses an explicit allowlist (`https://liry24.com`, `https://dev-liry24-com.liry.workers.dev`, `*.workers.dev` when non-production, and loopback HTTP only when `LIRY24_TEST_LOCAL=true` or `APP_ENV=test`) rather than `@vite-hub/runtime`'s build-time `publicUrl`.
- **Drizzle v1 compatibility**: Do NOT enable `advanced.database.joins` in `server/auth.ts`; `@better-auth/drizzle-adapter` default export targets Drizzle v0 relational filters while `@vite-hub/database` uses `drizzle-orm@1.0.0-rc.5` (`relationsFilterToSQL` throws on v0 `SQL` filters).
- **Secret unsealing**: Always declare server env keys in `env.ts` (never add test-only flags there) and unseal `{ secret: true }` values with `readSecretValue` from `server/utils/secret.ts` (because ViteHub wraps runtime secrets in `SecretEnv`).

## Editorial assistant & integrations

- **Assistant (`server/agents/assistant.ts`)**: `defineAgent` with `content()` capability and `webChat` channel, enforced admin-only at **both** `webChat.route.admission.authenticate` (before payload validation) and `defineAgent.invoker`. Uses direct `@ai-sdk/google` `'gemini-4-hydrogen'` with `google: { thinkingConfig: { thinkingLevel: 'low' } }` — do not reintroduce ChatGPT or Cloudflare AI Gateway fallbacks. Offline tests (`LIRY24_TEST_LOCAL=true`, `APP_ENV=test`, or unset API key) use `MockLanguageModelV4`.
- **IGDB (`server/utils/igdb.ts`)**: Uses `@liry24/igdb` (keep minor version pinned `~4.0.0`) reading `useServerEnv()` with `readSecretValue` (and `process.env` fallback), validating responses with Zod and returning safe 502/503 errors.
- **Domain helpers**: Shared Zod/content schemas live in `shared/schemas/content.ts`, Markdown/game rules in `shared/utils/` and `server/utils/gameValidation.ts`, and public SEO / OG image generation (`nuxt-og-image` + Takumi) stays Nuxt-owned.

## Deployment, Previews & patches

- **Nitro-generated Wrangler config**: `nuxt.config.ts` emits `.output/server/wrangler.json` (and `.wrangler/deploy/config.json`) with production bindings (`DB` `227d818f-cd40-4fca-9710-b57273be94ca`, `STORAGE` `liry24-com`, route `liry24.com` production-only with `previews_enabled` omitted so `*.liry24.com` never intercepts `sso.liry24.com`, `memo.liry24.com`, or `images.liry24.com`) and Method B `previews` (`APP_ENV: 'dev'`, `NUXT_PUBLIC_SITE_URL: 'https://dev-liry24-com.liry.workers.dev'`, `NUXT_PUBLIC_IMAGES_DOMAIN: 'https://dev-liry24-com.liry.workers.dev'`, D1 `liry24-com-dev` `3c7c6179-12d0-4108-9eea-b3e20d394cef`, R2 `liry24-com-dev-storage`).
- **Root patches (`patchedDependencies`)**: Keep `patches/vite-hub@0.4.1.patch`, `patches/better-auth@1.7.27.patch`, and `patches/better-call@1.4.6.patch` (re-verify `tests/worker/auth.test.ts` rate-limit counter bounding on every upgrade).
- **Production freeze**: Never modify `main`, production D1 (`227d818f-cd40-4fca-9710-b57273be94ca`), production R2 (`liry24-com`), or Cloudflare Workers Builds `production_settings` without explicit user approval after `https://dev-liry24-com.liry.workers.dev` verification.

## Verification commands

- Standard checks: `bun run format:check`, `bun run lint`, `bun run typecheck`, `bun x tsc --noEmit -p tsconfig.tests.json`, `bun run test`.
- Put app tests that rely on auto-imports in `tests/nuxt/`. `@nuxt/test-utils` applies the fixture's Nuxt transform there and supports `mockNuxtImport`. Node tests load their dependencies directly and use explicit imports.
- Optional Nuxt diagnostics: `bun run check:doctor`. Use `--changed` for local edits or `--since origin/dev` for branch changes.
- Built Worker checks (always run `bun run build` after `server/` edits first): `bun x wrangler deploy --dry-run --config .output/server/wrangler.json` and `LIRY24_TEST_BUILT_WORKER=true bun x vitest run tests/worker/` (always via Node/Vitest, never `bun test`).
