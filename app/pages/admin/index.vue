<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })
const { open } = useAdminComposer()
useHead({ title: 'Admin' })
</script>

<template>
    <AdminResourcePage title="Home" icon="mingcute:sparkles-line">
        <div class="flex min-h-[60svh] items-start py-8 sm:items-center sm:py-12">
            <AdminComposerPanel v-if="!open" />
        </div>
    </AdminResourcePage>
</template>
