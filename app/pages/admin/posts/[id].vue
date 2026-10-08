<script setup lang="ts">
import type { SiteAdminDescriptor } from '@liria24/site-admin'
import type { EntryRecord } from '@liria24/site-admin/server'

definePageMeta({ middleware: 'admin', layout: 'admin', key: (route) => route.path })
const id = String(useRoute().params.id)
const request = useRequestFetch()
const { data } = await useAsyncData(`admin:post-editor:${id}`, async () => {
    const [models, entry] = await Promise.all([
        request<SiteAdminDescriptor>('/api/site-admin/models'),
        request<EntryRecord>(`/api/site-admin/entries/${encodeURIComponent(id)}`),
    ])
    return { descriptor: models.models.posts, entry }
})
if (!data.value?.descriptor || data.value.entry.model !== 'posts')
    throw createError({ statusCode: 404 })
const ai = usePostEditorAI()
</script>

<template>
    <AdminFormPostEditor
        v-if="data"
        :key="id"
        :descriptor="data.descriptor!"
        :entry="data.entry"
        :ai
    />
</template>
