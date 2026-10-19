<script setup lang="ts">
import {
    siteAdminManagementClientOptions,
    useSiteAdminAuthScope,
    useSiteAdminModels,
} from '#build/site-admin/client'

const route = useRoute('admin-model')
const model = String(route.params.model)
const connection = siteAdminManagementClientOptions()
const auth = useSiteAdminAuthScope(undefined, connection)
const { data, error, execute } = await useSiteAdminModels(connection, auth, false)
if (!data.value) await execute({ dedupe: 'defer' })
if (error.value) throw error.value
if (!data.value || !Object.hasOwn(data.value.models, model))
    throw createError({ statusCode: 404, statusMessage: 'Model not found' })
await navigateTo({ path: '/admin/data', query: { ...route.query, model } }, { replace: true })
</script>

<template><div /></template>
