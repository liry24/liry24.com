<script setup lang="ts">
const route = useRoute('admin-model')
const model = String(route.params.model)
const { data, error, execute } = await useLitiModels()
if (!data.value) await execute({ dedupe: 'defer' })
if (error.value) throw error.value
if (!data.value || !Object.hasOwn(data.value, model))
    throw createError({ status: 404, statusText: 'Model not found' })
await navigateTo({ path: '/admin/data', query: { ...route.query, model } }, { replace: true })
</script>

<template><div /></template>
