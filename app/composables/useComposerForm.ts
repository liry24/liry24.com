import { useEntryForm, type UseEntryFormOptions } from '@liria24/site-admin/internal/form'
import {
    createSiteAdminModel,
    siteAdminModelContext,
    type SiteAdminModelState,
    type SiteAdminModelContext,
    type SiteAdminSessionDraft,
} from '@liria24/site-admin/internal/model'

import { useAdminEntry, useSiteAdminAuthScope } from '#build/site-admin/client'

// Composer instances share descriptors and clients, but never entry state or drafts.
export function useComposerForm<Data extends Record<string, unknown> = Record<string, unknown>>(
    model: string,
    instance: string,
    options: UseEntryFormOptions<Data> & { id?: string; editor?: boolean } = {},
) {
    const auth = useSiteAdminAuthScope()
    const id = ref<string | null>(options.id ?? null)
    const source = useAdminEntry(model, () => id.value)
    const context = source[siteAdminModelContext] as unknown as SiteAdminModelContext<Data>
    const drafts = options.editor
        ? useState<Record<string, SiteAdminSessionDraft>>(
              'admin-composer-editor-drafts',
              () => ({}),
          )
        : useAdminComposer().drafts
    const data: SiteAdminModelState<Data>['data'] = shallowRef(null)
    const status: SiteAdminModelState<Data>['status'] = ref('idle')
    const error: SiteAdminModelState<Data>['error'] = shallowRef()
    watch(
        [source.data, source.status, source.error],
        () => {
            const entry = source.data.value as typeof data.value
            data.value = entry && 'id' in entry && entry.id === id.value ? entry : null
            status.value = source.status.value
            error.value = source.error.value
        },
        { immediate: true },
    )
    const resource = createSiteAdminModel<Data>(
        {
            data,
            status,
            error,
            refresh: async () => {
                await source.refresh()
                data.value = source.data.value as typeof data.value
                error.value = source.error.value
                status.value = source.status.value
            },
        },
        {
            ...context,
            id,
            identity: computed(() =>
                JSON.stringify([auth.value, toValue(context.locale), model, instance]),
            ),
            drafts: drafts.value,
        },
    )
    const form = useEntryForm<Data>(resource, options)
    const result = { ...resource, ...form }
    return source.then(() => result)
}
