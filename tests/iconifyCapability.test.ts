import { afterEach, expect, test, vi } from 'vitest'

import { iconify } from '../server/capabilities/iconify'

const tool = iconify.tools.searchIcons

afterEach(() => vi.unstubAllGlobals())

test('searches the requested collection once and returns only bounded Iconify IDs', async () => {
    const input = tool.inputSchema.parse({ query: ' GitHub ', prefix: 'simple-icons' })
    const icons = Array.from({ length: 20 }, (_, i) => `simple-icons:result-${i}`)
    const fetchIconify = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ icons: [null, 'invalid', ...icons] }))
    vi.stubGlobal('fetch', fetchIconify)

    expect(await tool.execute(input)).toEqual({ icons: icons.slice(0, 12) })
    expect(fetchIconify).toHaveBeenCalledExactlyOnceWith(
        new URL('https://api.iconify.design/search?query=github&limit=32&prefix=simple-icons'),
        { signal: expect.any(AbortSignal), credentials: 'omit' },
    )
    expect(tool.inputSchema.safeParse({ query: 'github', prefix: '../' }).success).toBe(false)
})
