<script setup lang="ts">
definePageMeta({
    title: 'User',
    key: (route) => ('username' in route.params ? String(route.params.username) : route.path),
})

const route = useRoute()
const username = String(route.params.username ?? '')
const request = useRequestFetch()
const scope = useAdminUserScope()
const base = `/api/admin/users/${encodeURIComponent(username)}` as const
const { data, error, refresh } = await useFetch(base, {
    key: computed(() => `admin-users:${scope.value}:${username}`),
})
const {
    data: activity,
    status,
    error: activityError,
    refresh: refreshActivity,
} = await useFetch(`${base}/activity`, {
    key: computed(() => `admin-users:${scope.value}:${username}:activity`),
    query: { limit: 20 },
})
type Activity = NonNullable<typeof activity.value>['items'][number]
const older = ref<Activity[]>([])
const cursor = ref<string | null>(null)
const pending = ref(false)
const failure = ref('')
const controller = new AbortController()
const groups = computed(() => {
    const days = new Map<string, Activity[]>()
    for (const item of [...(activity.value?.items ?? []), ...older.value]) {
        const day = new Date(item.createdAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
        const items = days.get(day) ?? []
        items.push(item)
        days.set(day, items)
    }
    return [...days].map(([date, items]) => ({ date, items }))
})
async function more() {
    if (pending.value || !cursor.value) return
    const owner = scope.value
    pending.value = true
    failure.value = ''
    try {
        const result = await request(`${base}/activity`, {
            query: { limit: 20, cursor: cursor.value },
            signal: controller.signal,
        })
        if (owner !== scope.value) return
        older.value.push(...result.items)
        cursor.value = result.nextCursor
    } catch {
        if (owner === scope.value && !controller.signal.aborted)
            failure.value = 'Could not load more activity.'
    } finally {
        pending.value = false
    }
}
const actionLabel = (action: string) => adminActivityLabels[action as AdminActivityAction] ?? action

onScopeDispose(() => controller.abort())
watch(
    activity,
    (value) => {
        older.value = []
        cursor.value = value?.nextCursor ?? null
    },
    { immediate: true },
)
watch(
    scope,
    () => {
        older.value = []
        cursor.value = null
        failure.value = ''
    },
    { flush: 'sync' },
)

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
                        <section class="min-w-0" aria-label="Activity">
                            <div class="mb-6 flex items-center justify-between">
                                <h2 class="text-lg font-semibold">Activity</h2>
                                <UButton
                                    icon="mingcute:refresh-2-line"
                                    aria-label="Refresh activity"
                                    variant="ghost"
                                    color="neutral"
                                    :loading="status === 'pending'"
                                    @click="refreshActivity()"
                                />
                            </div>

                            <UAlert
                                v-if="activityError || failure"
                                :title="activityError?.message || failure"
                                color="error"
                                class="mb-4"
                            />
                            <p v-if="status === 'pending' && !activity" class="text-muted text-sm">
                                Loading activity…
                            </p>
                            <div
                                v-else-if="!groups.length && !activityError"
                                class="text-muted text-dimmed mx-auto max-w-xl text-center text-sm"
                            >
                                <HairlineDrawer />
                                <p>No activity</p>
                            </div>

                            <section v-for="group in groups" :key="group.date" class="mb-8">
                                <h3 class="text-muted mb-4 text-xs font-medium">
                                    {{ group.date }}
                                </h3>
                                <ol class="border-muted ml-2 border-l">
                                    <li
                                        v-for="item in group.items"
                                        :key="item.id"
                                        class="relative pb-6 pl-6 last:pb-0"
                                    >
                                        <span
                                            class="bg-muted ring-default absolute top-1 -left-1.5 size-3 rounded-full ring-4"
                                        />
                                        <div
                                            class="flex flex-wrap items-baseline justify-between gap-2"
                                        >
                                            <p class="text-sm">
                                                <span class="font-medium">{{
                                                    actionLabel(item.action)
                                                }}</span
                                                ><span v-if="item.model" class="text-muted">
                                                    · {{ item.model }}</span
                                                >
                                            </p>
                                            <NuxtTime
                                                :datetime="item.createdAt"
                                                hour="2-digit"
                                                minute="2-digit"
                                                time-zone="Asia/Tokyo"
                                                class="text-dimmed text-xs"
                                            />
                                        </div>
                                        <p
                                            v-if="item.label"
                                            class="text-muted mt-1 text-sm break-words"
                                        >
                                            {{ item.label }}
                                        </p>
                                        <p
                                            v-else-if="item.model"
                                            class="text-dimmed mt-1 text-xs break-all"
                                        >
                                            {{ item.targetId }}
                                        </p>
                                    </li>
                                </ol>
                            </section>
                            <UButton
                                v-if="cursor"
                                label="Load more"
                                variant="soft"
                                color="neutral"
                                :loading="pending"
                                @click="more"
                            />
                        </section>
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
