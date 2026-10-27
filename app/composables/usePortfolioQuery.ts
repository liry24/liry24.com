import type { Entry, ModelName, Page } from 'liti/types'

export function usePortfolioQuery<Name extends Exclude<ModelName, 'posts'>>(model: Name) {
    const request = useRequestFetch()
    return useAsyncData(`portfolio:${model}`, async (_app, { signal }) => {
        const entries: Entry<Name>[] = []
        for (let offset = 0; ; offset += 1000) {
            const page = await request<Page<Entry<Name>>>('/api/_liti', {
                query: { model, limit: 1000, offset },
                signal,
            })
            entries.push(...page.items)
            if (offset + page.items.length >= page.total) break
            if (!page.items.length)
                throw new Error('The portfolio page could not be read completely.')
        }
        const order = (entry: Entry<Name>) =>
            'order' in entry
                ? Number(entry.order)
                : 'order' in entry.data
                  ? Number(entry.data.order)
                  : 0
        return entries.sort((a, b) => order(a) - order(b) || a.id.localeCompare(b.id))
    })
}
