import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { drizzle } from 'drizzle-orm/d1'
import { migrate } from 'drizzle-orm/d1/migrator'
import { getPlatformProxy } from 'wrangler'

assert(!/"remote"\s*:\s*true/.test(await readFile('wrangler.local.jsonc', 'utf8')))
const proxy = await getPlatformProxy({
    remoteBindings: false,
    configPath: 'wrangler.local.jsonc',
    persist: { path: resolve('.data/unified') },
})
try {
    await migrate(drizzle(proxy.env.DB), { migrationsFolder: 'drizzle' })
    console.log('Applied application migrations to the unified local DB only.')
} finally {
    await proxy.dispose()
}
