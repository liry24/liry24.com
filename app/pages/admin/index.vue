<script setup lang="ts">
const { data: postOverview } = await useFetch('/api/admin/content/posts', {
    key: 'admin-posts-overview',
})

const totalPosts = computed(() => postOverview.value?.items.length ?? 0)
const draftPosts = computed(
    () =>
        postOverview.value?.items.filter(
            (item) => item.status?.state === 'draft' || item.status?.state === 'changed',
        ).length ?? 0,
)

useHead({ title: 'Dashboard' })
</script>

<template>
    <UDashboardPanel
        id="home"
        :ui="{
            root: 'h-full min-h-0',
            body: 'gap-6 p-4 sm:p-6 overflow-y-auto',
        }"
    >
        <template #header>
            <UDashboardNavbar title="Dashboard" icon="mingcute:chart-bar-fill">
                <template #right>
                    <UButton
                        to="/admin/posts/new"
                        label="New post"
                        icon="mingcute:add-line"
                        size="sm"
                    />
                    <UButton
                        to="/admin/assistant"
                        label="Assistant"
                        icon="mingcute:sparkles-2-fill"
                        variant="outline"
                        color="neutral"
                        size="sm"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <div class="grid gap-4 sm:grid-cols-3">
                <UCard>
                    <p class="text-muted text-xs tracking-wider uppercase">Collections</p>
                    <p class="mt-2 text-3xl font-light">{{ contentCollectionNames.length }}</p>
                </UCard>
                <UCard>
                    <p class="text-muted text-xs tracking-wider uppercase">Posts</p>
                    <p class="mt-2 text-3xl font-light">{{ totalPosts }}</p>
                </UCard>
                <UCard>
                    <p class="text-muted text-xs tracking-wider uppercase">Pending Drafts</p>
                    <p class="mt-2 text-3xl font-light">{{ draftPosts }}</p>
                </UCard>
            </div>

            <section class="flex flex-col gap-3">
                <h2 class="text-muted text-sm font-medium">Content Collections</h2>
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <UCard
                        v-for="item in adminCollectionLinks"
                        :key="item.name"
                        class="hover:bg-elevated/40 transition-colors"
                    >
                        <div class="flex items-center justify-between gap-3">
                            <div class="flex items-center gap-2.5">
                                <UIcon :name="item.icon" class="text-muted size-5" />
                                <span class="font-medium">{{ item.label }}</span>
                            </div>
                            <UButton
                                :to="item.to"
                                label="Open"
                                variant="ghost"
                                color="neutral"
                                size="xs"
                                trailing-icon="mingcute:arrow-right-line"
                            />
                        </div>
                    </UCard>
                </div>
            </section>
        </template>
    </UDashboardPanel>
</template>
