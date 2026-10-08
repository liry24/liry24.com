<script setup lang="ts">
import type { SiteAdminDescriptor } from '@liria24/site-admin'

definePageMeta({ middleware: 'admin', layout: 'admin' })
const { data } = await useFetch<SiteAdminDescriptor>('/api/site-admin/models')
const descriptor = data.value?.models.posts
if (!descriptor) throw createError({ statusCode: 404 })
const ai = usePostEditorAI()
</script>

<template>
    <AdminFormPostEditor :descriptor="descriptor!" :ai />
</template>
