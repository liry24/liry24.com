<script setup lang="ts">
const { signOut, user } = useUserSession()
const sidebarCollapsed = ref(false)
const links = Object.entries(adminModels).map(([name, model]) => ({
    label: model.label,
    icon: model.icon,
    to: `/admin/${name}`,
}))
const extraLinks = [
    {
        to: 'https://github.com/Liry24/liry24.com',
        target: '_blank',
        icon: 'mingcute:github-fill',
        label: 'GitHub',
    },
    { to: '/', icon: 'mingcute:arrow-left-line', label: 'Back to site' },
]
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
                    <AdminNav
                        :links="links.filter((link) => link.to !== '/admin/posts')"
                        :collapsed
                    />
                    <AdminNavSection title="Blogs" icon="mingcute:book-3-fill" :collapsed>
                        <AdminNav
                            :links="links.filter((link) => link.to === '/admin/posts')"
                            :collapsed
                        />
                    </AdminNavSection>
                    <AdminNav :links="extraLinks" :collapsed class="mt-auto" />
                </template>
                <template #footer="{ collapsed }">
                    <UDropdownMenu
                        :content="{ align: 'start', side: 'right' }"
                        :items="[
                            {
                                to: '/admin/settings',
                                label: 'Settings',
                                icon: 'mingcute:settings-1-fill',
                            },
                            {
                                label: 'Logout',
                                icon: 'mingcute:exit-fill',
                                onClick: () => signOut(),
                            },
                        ]"
                    >
                        <button
                            type="button"
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
                        </button>
                    </UDropdownMenu>
                </template>
            </UDashboardSidebar>
            <main class="h-full min-w-0 flex-1 overflow-hidden"><slot /></main>
        </UDashboardGroup>
    </div>
</template>
