<script setup lang="ts">
import {
    siteAdminManagementClientOptions,
    useSiteAdminAuthScope,
    useSiteAdminModels,
} from '#build/site-admin/client'

const { user } = useUserSession()
const { open, busy } = useAdminComposer()
const connection = siteAdminManagementClientOptions()
const auth = useSiteAdminAuthScope(undefined, connection)
const models = useSiteAdminModels(connection, auth, false)

const sidebarCollapsed = ref(false)

onMounted(() => {
    if (!models.data.value) void models.execute({ dedupe: 'defer' })
})

defineShortcuts({
    meta_k: {
        usingInput: true,
        handler: () => {
            if (!busy.value) open.value = !open.value
        },
    },
})

useHead({ titleTemplate: '%s | Liry24 Admin' })
</script>

<template>
    <div class="bg-elevated/70 fixed inset-0">
        <UDashboardGroup unit="rem" class="bg-default m-1 rounded-lg">
            <UDashboardSidebar
                id="admin"
                v-model:collapsed="sidebarCollapsed"
                collapsible
                resizable
                :collapsed-size="4"
                :menu="{
                    title: 'Admin navigation',
                    description: 'Manage site content and settings.',
                }"
                :ui="{
                    root: 'min-h-[calc(100svh-0.5rem)]',
                    footer: 'lg:border-t lg:border-default p-1',
                }"
            >
                <template #header="{ collapsed }">
                    <div
                        :class="
                            cn(
                                'flex w-full items-center gap-2 pl-2',
                                collapsed && 'my-8 flex-col pl-0',
                            )
                        "
                    >
                        <UButton
                            to="/admin"
                            icon="liria:liria"
                            :label="collapsed ? undefined : 'Admin'"
                            aria-label="Admin home"
                            variant="link"
                            color="neutral"
                            size="sm"
                            class="text-highlighted gap-1.5 p-0 text-base font-extralight"
                        />
                        <UButton
                            aria-label="Toggle sidebar"
                            :icon="
                                collapsed
                                    ? 'mingcute:layout-leftbar-open-fill'
                                    : 'mingcute:layout-leftbar-close-fill'
                            "
                            variant="ghost"
                            size="sm"
                            :class="cn(!collapsed && 'ml-auto')"
                            @click="sidebarCollapsed = !sidebarCollapsed"
                        />
                    </div>
                </template>

                <template #default="{ collapsed }">
                    <UNavigationMenu
                        :collapsed
                        :items="[
                            [
                                {
                                    label: 'Dashboard',
                                    icon: 'mingcute:chart-bar-fill',
                                    to: '/admin',
                                },
                                {
                                    label: 'Data',
                                    icon: 'mingcute:storage-fill',
                                    to: '/admin/data',
                                },
                            ],
                            [
                                {
                                    label: 'Users',
                                    icon: 'mingcute:group-2-fill',
                                    to: '/admin/users',
                                },
                                {
                                    label: 'Settings',
                                    icon: 'mingcute:settings-1-fill',
                                    to: '/admin/settings',
                                },
                            ],
                            [
                                {
                                    label: 'GitHub',
                                    icon: 'mingcute:github-fill',
                                    to: 'https://github.com/Liry24/liry24.com',
                                    target: '_blank',
                                },
                                {
                                    label: 'Back to site',
                                    icon: 'mingcute:arrow-left-line',
                                    to: '/',
                                },
                            ],
                        ]"
                        orientation="vertical"
                        tooltip
                        popover
                        color="neutral"
                        :ui="{
                            link: 'gap-2.5',
                            linkLeadingIcon: 'text-dimmed group-hover:text-dimmed',
                        }"
                    />
                </template>

                <template #footer="{ collapsed }">
                    <div
                        aria-label="Account menu"
                        class="hover:bg-muted w-full cursor-pointer rounded-lg p-2"
                    >
                        <UAvatar
                            v-if="collapsed"
                            :src="user?.image || undefined"
                            :alt="user?.name"
                            icon="mingcute:user-3-fill"
                            size="sm"
                        />
                        <UUser
                            v-else
                            :name="user?.name"
                            :description="user?.email"
                            :avatar="{
                                src: user?.image || undefined,
                                alt: user?.name,
                                icon: 'mingcute:user-3-fill',
                            }"
                            size="sm"
                            class="text-left"
                        />
                    </div>
                </template>
            </UDashboardSidebar>

            <main class="h-full min-w-0 flex-1 overflow-hidden">
                <slot />
            </main>
        </UDashboardGroup>

        <UModal
            v-model:open="open"
            :dismissible="!busy"
            :close="!busy"
            title="Compose content"
            :ui="{ content: 'sm:max-w-3xl', body: 'bg-elevated/40' }"
        >
            <template #content>
                <div class="p-6"><AdminComposerPanel v-if="open" /></div>
            </template>
        </UModal>
    </div>
</template>
