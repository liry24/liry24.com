import { defineConfig } from 'void/config'

const production = process.env.APP_ENV === 'production'
const localTest = process.env.LIRY24_TEST_LOCAL === 'true'
const name = production ? 'liry24-com' : 'liry24-com-dev'

export default defineConfig({
    inference: { bindings: { db: true, storage: true, ...(localTest ? { ai: false } : {}) } },
    cloudflare: {
        name,
        account_id: '422bd946004c77eb0d569ec489b40196',
        compatibility_date: '2026-10-13',
        compatibility_flags: [
            'nodejs_compat_v2',
            'nodejs_als',
            'enable_nodejs_process_v2',
            'nodejs_compat_populate_process_env',
        ],
        workers_dev: !production,
        preview_urls: false,
        ...(localTest ? {} : { ai: { binding: 'AI', remote: true } }),
        triggers: { crons: production ? ['* * * * *'] : [] },
        observability: { enabled: true, logs: { enabled: true, invocation_logs: true } },
        routes: production ? [{ pattern: 'liry24.com', custom_domain: true }] : [],
        d1_databases: [
            {
                binding: 'DB',
                database_name: name,
                migrations_dir: './db/migrations',
                ...(production ? { database_id: '227d818f-cd40-4fca-9710-b57273be94ca' } : {}),
            },
        ],
        r2_buckets: production ? [{ binding: 'STORAGE', bucket_name: name }] : [],
        vars: {
            APP_ENV: production ? 'production' : 'dev',
            NUXT_PUBLIC_PREVIEW: production ? 'false' : 'true',
            NUXT_PUBLIC_IMAGES_DOMAIN: production
                ? 'https://images.liry24.com'
                : 'https://liry24-com-dev.liry.workers.dev',
            R2_DOMAIN: production
                ? 'https://images.liry24.com'
                : 'https://liry24-com-dev.liry.workers.dev',
            NUXT_PUBLIC_SITE_URL: production
                ? 'https://liry24.com'
                : 'https://liry24-com-dev.liry.workers.dev',
        },
    },
})
