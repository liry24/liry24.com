import { readFile } from 'node:fs/promises'

import { expect, test } from 'vitest'
import { z } from 'zod'

const bindings = z.object({
    d1_databases: z.array(z.object({ binding: z.string(), database_id: z.string() })),
    r2_buckets: z.array(z.object({ binding: z.string(), bucket_name: z.string() })),
})
const wranglerConfig = bindings.extend({
    previews: bindings.extend({ vars: z.object({ APP_ENV: z.string() }) }),
    routes: z.array(z.object({ pattern: z.string(), previews_enabled: z.boolean().optional() })),
    observability: z.object({ redact_query_string: z.boolean() }),
})

test.runIf(process.env.LIRY24_TEST_BUILT_WORKER === 'true')(
    'the emitted Worker isolates previews and redacts logged queries',
    async () => {
        const config = wranglerConfig.parse(
            JSON.parse(await readFile('.output/server/wrangler.json', 'utf8')),
        )
        expect(config.d1_databases).toEqual([
            { binding: 'DB', database_id: '227d818f-cd40-4fca-9710-b57273be94ca' },
        ])
        expect(config.r2_buckets).toEqual([{ binding: 'STORAGE', bucket_name: 'liry24-com' }])
        expect(config.previews.d1_databases).toEqual([
            { binding: 'DB', database_id: '3c7c6179-12d0-4108-9eea-b3e20d394cef' },
        ])
        expect(config.previews.r2_buckets).toEqual([
            { binding: 'STORAGE', bucket_name: 'liry24-com-dev-storage' },
        ])
        expect(config.previews.vars.APP_ENV).toBe('dev')
        expect(config.routes).toEqual([{ pattern: 'liry24.com' }])
        expect(config.observability.redact_query_string).toBe(true)
    },
)
