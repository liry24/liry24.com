<script setup lang="ts">
const { open } = useAdminComposer()
useHead({ title: 'Admin' })
</script>

<template>
    <AdminResourcePage title="Home" icon="mingcute:sparkles-line">
        <div class="flex min-h-[60svh] items-start py-8 sm:items-center sm:py-12">
            <ClientOnly>
                <Suspense>
                    <AdminComposerPanel v-if="!open" />
                    <template #fallback
                        ><USkeleton class="mx-auto h-44 w-full max-w-2xl rounded-2xl"
                    /></template>
                </Suspense>
            </ClientOnly>
        </div>
    </AdminResourcePage>
</template>
