import { defineCapability } from 'vite-hub/agent'
import { z } from 'zod'

const searchInput = z.object({
    query: z.string().trim().min(2).max(80).describe('A short English keyword or brand name.'),
    prefix: z
        .string()
        .regex(/^[a-z0-9-]{1,40}$/u)
        .optional()
        .describe('Optional Iconify set, such as simple-icons for brand marks.'),
})

export const iconify = defineCapability({
    id: 'iconify',
    tools: {
        searchIcons: {
            name: 'searchIcons',
            title: 'Searched Iconify',
            icon: 'i-lucide-search',
            description: 'Find valid Iconify icon IDs for a work, skill, or social link.',
            inputSchema: searchInput,
            async execute(
                { query, prefix }: z.infer<typeof searchInput>,
                context?: {
                    abortSignal?: AbortSignal
                },
            ) {
                const timeout = AbortSignal.timeout(4000)
                const signal = context?.abortSignal
                    ? AbortSignal.any([context.abortSignal, timeout])
                    : timeout
                try {
                    const icons = await searchIconify(query.toLowerCase(), signal, prefix)
                    return { icons: icons.slice(0, 12) }
                } catch {
                    context?.abortSignal?.throwIfAborted()
                    return { error: 'Iconify search is temporarily unavailable.' }
                }
            },
        },
    },
})
