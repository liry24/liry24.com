<script setup lang="ts">
const { user, load, signOut } = useAppSession()
await load()

const sidebarCollapsed = ref(false)
const navigation = computed(() => [
    [
        {
            label: 'Dashboard',
            icon: 'mingcute:chart-bar-fill',
            to: '/admin',
        },
        {
            label: 'Posts',
            icon: 'mingcute:document-2-fill',
            to: '/admin/posts',
        },
        {
            label: 'Assistant',
            icon: 'mingcute:sparkles-2-fill',
            to: '/admin/assistant',
        },
    ],
    [
        {
            label: 'Works',
            icon: 'mingcute:briefcase-fill',
            to: '/admin/works',
        },
        {
            label: 'Arts',
            icon: 'mingcute:palette-fill',
            to: '/admin/arts',
        },
        {
            label: 'Careers',
            icon: 'mingcute:building-2-fill',
            to: '/admin/careers',
        },
        {
            label: 'Skills',
            icon: 'mingcute:tool-fill',
            to: '/admin/skills',
        },
        {
            label: 'Games',
            icon: 'mingcute:game-2-fill',
            to: '/admin/games',
        },
        {
            label: 'Game Stats',
            icon: 'mingcute:chart-line-fill',
            to: '/admin/gameStats',
        },
        {
            label: 'Ranks',
            icon: 'mingcute:trophy-fill',
            to: '/admin/ranks',
        },
        {
            label: 'Socials',
            icon: 'mingcute:link-2-fill',
            to: '/admin/socials',
        },
    ],
    [
        {
            label: 'Settings',
            icon: 'mingcute:settings-1-fill',
            to: '/admin/settings',
        },
        {
            label: 'Back to site',
            icon: 'mingcute:arrow-left-line',
            to: '/',
        },
    ],
])

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
                    footer: 'lg:border-t lg:border-default p-2',
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

                <template #default="sidebar">
                    <UNavigationMenu
                        :collapsed="sidebar.collapsed"
                        :items="navigation"
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
                    <div class="flex w-full items-center justify-between gap-2">
                        <UAvatar
                            v-if="collapsed"
                            :src="user?.image || undefined"
                            :alt="user?.name || 'Admin'"
                            icon="mingcute:user-3-fill"
                            size="sm"
                        />
                        <template v-else>
                            <UUser
                                :name="user?.name || 'Admin'"
                                :description="user?.email || ''"
                                :avatar="{
                                    src: user?.image || undefined,
                                    alt: user?.name || 'Admin',
                                    icon: 'mingcute:user-3-fill',
                                }"
                                size="sm"
                                class="min-w-0 flex-1 text-left"
                            />
                            <UButton
                                icon="mingcute:exit-line"
                                aria-label="Sign out"
                                variant="ghost"
                                color="neutral"
                                size="sm"
                                @click="signOut()"
                            />
                        </template>
                    </div>
                </template>
            </UDashboardSidebar>

            <main class="h-full min-w-0 flex-1 overflow-hidden">
                <slot />
            </main>
        </UDashboardGroup>
    </div>
</template>
