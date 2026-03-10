<script setup lang="ts">
const { socials, changed, fetchSocials, reorderSocials, deleteSocial, modalSocial } = useSocial()

const location = useBrowserLocation()
const config = useRuntimeConfig()

defineShortcuts({
    n: () => {
        modalSocial.open()
    },
})
</script>

<template>
    <div class="px-6">
        <UDashboardPanel id="persona" resizable>
            <template #header>
                <UDashboardNavbar title="Persona" icon="mingcute:sparkles-fill">
                    <template #trailing>
                        <span class="text-muted ml-2 text-sm">
                            {{ socials?.length || 0 }} Links
                        </span>

                        <UButton
                            loading-auto
                            aria-label="Refresh"
                            icon="mingcute:refresh-2-line"
                            variant="ghost"
                            size="sm"
                            @click="fetchSocials()"
                        />
                    </template>

                    <template #right>
                        <UButton
                            v-if="changed"
                            loading-auto
                            icon="mingcute:check-line"
                            label="Save"
                            color="neutral"
                            @click="reorderSocials"
                        />

                        <AdminModalSocial @success="fetchSocials">
                            <UButton
                                icon="mingcute:add-line"
                                label="New Link"
                                variant="outline"
                                color="neutral"
                                :ui="{ leadingIcon: 'size-4.5' }"
                            >
                                <template #trailing>
                                    <UKbd value="n" />
                                </template>
                            </UButton>
                        </AdminModalSocial>
                    </template>
                </UDashboardNavbar>
            </template>

            <template #body>
                <UScrollArea class="h-[calc(100dvh-var(--ui-header-height))] p-6">
                    <ReorderGroup v-model:values="socials" axis="y" class="grid gap-2">
                        <ReorderItem v-for="social in socials" :key="social.id" :value="social">
                            <div
                                class="bg-muted/50 ring-muted flex cursor-grab items-center gap-3 rounded-lg p-4 ring select-none"
                            >
                                <Icon name="mingcute:dot-grid-fill" size="20" />

                                <Icon :name="social.icon" size="18" />
                                <span class="text-sm leading-none">{{ social.label }}</span>

                                <span class="text-muted max-w-64 truncate text-sm">
                                    {{ social.href.replace('https://', '') }}
                                </span>
                                <template v-if="social.alias">
                                    <Icon name="mingcute:arrow-right-line" />
                                    <span class="text-muted text-sm">
                                        {{
                                            `${config.public.homeDomain.replace('https://', '')}/${social.alias}`
                                        }}
                                    </span>
                                </template>

                                <div class="ml-auto flex items-center">
                                    <UButton
                                        aria-label="Edit"
                                        icon="mingcute:edit-3-fill"
                                        variant="ghost"
                                        size="sm"
                                        @click="modalSocial.open({ data: social })"
                                    />

                                    <UButton
                                        aria-label="Delete"
                                        icon="mingcute:close-line"
                                        variant="ghost"
                                        size="sm"
                                        @click="deleteSocial(social.id)"
                                    />
                                </div>
                            </div>
                        </ReorderItem>
                    </ReorderGroup>
                </UScrollArea>
            </template>
        </UDashboardPanel>
    </div>
</template>
