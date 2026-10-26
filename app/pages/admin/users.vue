<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'

const scope = useAdminUserScope()
const page = ref(1)
const { data, status, error, refresh } = await useFetch('/api/admin/users', {
    key: computed(() => `admin-users:${scope.value}:list`),
    query: { limit: 20, offset: computed(() => (page.value - 1) * 20) },
})

type User = NonNullable<typeof data.value>['items'][number]
const columns: TableColumn<User>[] = [
    { accessorKey: 'name', header: 'Name' },
    {
        accessorKey: 'username',
        header: 'Username',
        cell: ({ row }) => (row.original.username ? `@${row.original.username}` : 'Pending'),
    },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'role', header: 'Role' },
    {
        accessorKey: 'createdAt',
        header: 'Joined',
    },
]

const adminUserPath = (user: { id: string; username?: string | null }) =>
    `/admin/@${encodeURIComponent(user.username || `~${user.id}`)}`

function select(_event: Event, row: TableRow<User>) {
    void navigateTo(adminUserPath(row.original))
}

useHead({ title: 'Users' })
</script>

<template>
    <div class="h-full min-w-0">
        <UDashboardPanel
            id="users"
            :ui="{ root: 'h-full min-h-0', body: 'gap-4 p-4 sm:gap-4 sm:p-6 *:shrink-0' }"
        >
            <template #body>
                <UAlert
                    v-if="error"
                    :title="error.message"
                    color="error"
                    :actions="[{ label: 'Retry', onClick: () => refresh() }]"
                />
                <UTable
                    :data="data?.items ?? []"
                    :columns
                    :loading="status === 'pending'"
                    class="w-full"
                    :ui="{ tr: 'cursor-pointer hover:bg-muted/60' }"
                    @select="select"
                >
                    <template #name-cell="{ row }">
                        <NuxtLink
                            :to="adminUserPath(row.original)"
                            class="focus-visible:outline-primary inline-flex rounded focus-visible:outline-2"
                        >
                            <UUser
                                :name="row.original.name"
                                :avatar="{
                                    src: row.original.image || undefined,
                                    alt: row.original.name,
                                    icon: 'mingcute:user-3-fill',
                                }"
                            />
                        </NuxtLink>
                    </template>
                    <template #createdAt-cell="{ row }">
                        <NuxtTime :datetime="row.original.createdAt" date-style="medium" />
                    </template>
                    <template #empty>No registered users.</template>
                </UTable>
                <UPagination
                    v-if="(data?.total ?? 0) > 20"
                    v-model:page="page"
                    :total="data?.total"
                    :items-per-page="20"
                    :disabled="status === 'pending'"
                    aria-label="User pages"
                />
            </template>
        </UDashboardPanel>
    </div>
</template>
