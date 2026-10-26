<script setup lang="ts">
definePageMeta({
    title: 'User',
    key: (route) => ('username' in route.params ? String(route.params.username) : route.path),
})

const route = useRoute()
const username = String(route.params.username ?? '')
const scope = useAdminUserScope()
const base = `/api/admin/users/${encodeURIComponent(username)}` as const
const { data, error, refresh } = await useFetch(base, {
    key: computed(() => `admin-users:${scope.value}:${username}`),
})

useHead(() => ({ title: data.value?.user.name || username }))
</script>

<template>
    <div class="h-full min-w-0">
        <UDashboardPanel
            id="user"
            :ui="{ root: 'h-full min-h-0', body: 'gap-8 p-4 sm:p-6 *:shrink-0' }"
        >
            <template #header>
                <UDashboardNavbar
                    ><template #left
                        ><UBreadcrumb
                            :items="[
                                { label: 'Users', to: '/admin/users' },
                                { label: data?.user.name || username },
                            ]" /></template
                ></UDashboardNavbar>
            </template>
            <template #body>
                <UAlert
                    v-if="error"
                    :title="error.message"
                    color="error"
                    :actions="[{ label: 'Retry', onClick: () => refresh() }]"
                />
                <template v-if="data">
                    <UUser
                        :name="data.user.name"
                        :description="
                            data.user.username ? `@${data.user.username}` : 'Username pending'
                        "
                        :avatar="{
                            src: data.user.image || undefined,
                            alt: data.user.name,
                            icon: 'mingcute:user-3-fill',
                        }"
                        size="3xl"
                    />
                    <div class="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
                        <AdminActivity :key="username" :username="username" />
                        <aside
                            class="border-muted border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8"
                            aria-label="User details"
                        >
                            <h2 class="mb-6 font-semibold">Details</h2>
                            <dl class="space-y-5 text-sm">
                                <div>
                                    <dt class="text-muted text-xs">Username</dt>
                                    <dd class="mt-1 break-all">
                                        {{
                                            data.user.displayUsername ||
                                            data.user.username ||
                                            'Pending'
                                        }}
                                    </dd>
                                </div>
                                <div>
                                    <dt class="text-muted text-xs">Email</dt>
                                    <dd class="mt-1 break-all">
                                        {{ data.user.email }}
                                        <UBadge
                                            :label="
                                                data.user.emailVerified ? 'Verified' : 'Unverified'
                                            "
                                            :color="data.user.emailVerified ? 'success' : 'neutral'"
                                            variant="subtle"
                                            size="sm"
                                        />
                                    </dd>
                                </div>
                                <div>
                                    <dt class="text-muted text-xs">Role</dt>
                                    <dd class="mt-1">
                                        {{ data.user.role || 'user'
                                        }}<UBadge
                                            v-if="data.user.banned"
                                            label="Banned"
                                            color="error"
                                            class="ml-2"
                                        />
                                    </dd>
                                </div>
                                <div>
                                    <dt class="text-muted text-xs">Joined</dt>
                                    <dd class="mt-1">
                                        <NuxtTime
                                            :datetime="data.user.createdAt"
                                            year="numeric"
                                            month="long"
                                            day="numeric"
                                        />
                                    </dd>
                                </div>
                                <div>
                                    <dt class="text-muted text-xs">Linked services</dt>
                                    <dd class="mt-2 flex flex-wrap gap-2">
                                        <UBadge
                                            v-for="provider in data.providers"
                                            :key="provider"
                                            :label="provider"
                                            variant="subtle"
                                            color="neutral"
                                        /><span v-if="!data.providers.length">None</span>
                                    </dd>
                                </div>
                            </dl>
                        </aside>
                    </div>
                </template>
            </template>
        </UDashboardPanel>
    </div>
</template>
