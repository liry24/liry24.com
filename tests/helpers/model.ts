import type { EntryPrepareContext } from '@liria24/site-admin'
import type { SiteAdminEntry, SiteAdminManagementClient } from '@liria24/site-admin/internal/client'
import type { ModelDescriptor } from '@liria24/site-admin/internal/descriptor'
import { useEntryForm } from '@liria24/site-admin/internal/form'
import { createSiteAdminModel, type SiteAdminModelState } from '@liria24/site-admin/internal/model'
import { nextTick, ref, shallowRef } from 'vue'

import { prepareEntry } from '../../app/utils/prepareEntry'

export function createModelResource(options: {
    modelName: string
    descriptor: ModelDescriptor
    client: SiteAdminManagementClient
    prepare?: (context: EntryPrepareContext) => Promise<void>
    entry?: SiteAdminEntry
    loadEntry?: () => Promise<SiteAdminEntry>
}) {
    const id = ref(options.entry?.id ?? null)
    const state: SiteAdminModelState<Record<string, unknown>> = {
        data: shallowRef(options.entry ?? null),
        status: ref('success'),
        error: shallowRef(),
        refresh: async () => {
            if (id.value)
                state.data.value = options.loadEntry
                    ? await options.loadEntry()
                    : await options.client.getEntry(id.value)
            state.error.value = undefined
            await nextTick()
        },
    }
    return Object.assign(
        state,
        createSiteAdminModel(state, {
            model: options.modelName,
            descriptor: shallowRef(options.descriptor),
            id,
            identity: ref(options.modelName + ':' + (id.value ?? 'new')),
            defaultLocale: 'ja',
            locale: ref('ja'),
            drafts: {},
            prepare:
                options.prepare ??
                ((context) =>
                    prepareEntry(context, async () => {
                        throw new Error('No synthetic generation configured')
                    })),
            client: options.client as unknown as SiteAdminManagementClient<
                Record<string, Record<string, unknown>>
            >,
        }),
    )
}
export function createModelForm(
    options: Parameters<typeof createModelResource>[0] & {
        defaultValues?: Record<string, unknown>
        presentation?: boolean
    },
) {
    const resource = createModelResource(options)
    return Object.assign(
        useEntryForm(
            resource,
            options.defaultValues ? { defaultValues: options.defaultValues } : {},
        ),
        { resource },
    )
}
