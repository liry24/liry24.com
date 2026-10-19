<script setup lang="ts">
import {
    siteAdminManagementClientOptions,
    useSiteAdminAuthScope,
    useSiteAdminModels,
} from '#build/site-admin/client'

const { open } = useAdminComposer()
const { data: permissions } = await useAdminPermissions()
const connection = siteAdminManagementClientOptions()
const auth = useSiteAdminAuthScope(undefined, connection)
const { data: models, status, error, refresh } = useSiteAdminModels(connection, auth, false)
useHead({ title: 'Data' })
</script>

<template>
    <div class="h-full min-w-0">
        <UDashboardPanel
            id="data"
            :ui="{ root: 'h-full min-h-0', body: 'gap-4 p-4 sm:gap-4 sm:p-6 *:shrink-0' }"
        >
            <template #body>
                <div class="flex flex-col items-center gap-24 pt-[calc(50vh-6rem)]">
                    <div class="flex w-full flex-col items-center gap-8">
                        <AdminComposerPanel
                            v-if="permissions?.compose && !open"
                            class="mx-auto w-full max-w-xl"
                        />
                    </div>
                    <UContainer class="flex w-full min-w-0 flex-col gap-12 pt-12">
                        <UAlert
                            v-if="error"
                            :title="error.message"
                            color="error"
                            :actions="[{ label: 'Retry', onClick: () => refresh() }]"
                        />
                        <p v-else-if="status === 'pending' && !models" class="text-muted text-sm">
                            Loading models…
                        </p>
                        <AdminDataModelSection
                            v-for="name in Object.keys(models?.models ?? {})"
                            :key="name"
                            :model-name="name"
                        />
                    </UContainer>
                </div>
            </template>
        </UDashboardPanel>
    </div>
</template>
