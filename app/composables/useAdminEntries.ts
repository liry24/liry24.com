import type { MaybeRefOrGetter } from 'vue'

export function useAdminEntries(
    model: string,
    options: {
        q?: MaybeRefOrGetter<string>
        limit?: number
        offset?: MaybeRefOrGetter<number>
        immediate?: boolean
    } = {},
) {
    const scope = useAdminUserScope()
    const query = computed(() => ({
        model,
        q: toValue(options.q) || undefined,
        limit: options.limit ?? 1000,
        offset: toValue(options.offset) ?? 0,
    }))
    const request = useRequestFetch()
    const key = computed(() => `admin-entries:${scope.value}:${JSON.stringify(query.value)}`)
    const resource = useAsyncData(
        key,
        async (_app, { signal }) => {
            const requestedKey = key.value
            const page = await request<{
                items: AdminEntry[]
                total: number
                revision: string | null
            }>('/api/admin/entries', { query: query.value, signal })
            return { ...page, requestedKey }
        },
        { immediate: options.immediate ?? true },
    )
    const current = computed(() =>
        resource.data.value?.requestedKey === key.value ? resource.data.value : undefined,
    )
    const handle = {
        status: resource.status,
        pending: resource.pending,
        error: resource.error,
        refresh: resource.refresh,
        execute: resource.execute,
        data: computed(() => current.value?.items ?? []),
        total: computed(() => current.value?.total ?? 0),
        revision: computed(() => current.value?.revision ?? null),
    }
    return Object.assign(
        resource.then(() => handle),
        handle,
    )
}
