<script setup lang="ts">
import type { ContentDocumentStatus, ContentSchedule } from '@vite-hub/content'

interface PostListItem {
    id: string
    data: {
        title?: string
        plainTitle?: string
        slug?: string
        authoredAt?: string
    }
    status: ContentDocumentStatus | null
    schedule: ContentSchedule | null
}

const scheduleTarget = ref<PostListItem | null>(null)
const scheduleOpen = computed({
    get: () => Boolean(scheduleTarget.value),
    set: (value: boolean) => {
        if (!value) scheduleTarget.value = null
    },
})

const { data, pending, error, refresh } = await useFetch<{
    items: Array<PostListItem>
    schedules: Array<ContentSchedule>
}>('/api/admin/content/posts', { key: 'admin-posts' })

const posts = computed(() => data.value?.items ?? [])
const { busyId, publishDocument, deleteDocument, scheduleDocument, unscheduleDocument } =
    useAdminContentActions('posts', refresh, 'post')

const stateColor = (state: string | undefined) => {
    if (state === 'published') return 'success'
    if (state === 'changed' || state === 'draft') return 'warning'
    if (state === 'deleted') return 'error'
    return 'neutral'
}

const confirmSchedule = async (at: string) => {
    if (!scheduleTarget.value) return
    const ok = await scheduleDocument(
        scheduleTarget.value.id,
        at,
        scheduleTarget.value.status?.draft,
    )
    if (ok) scheduleTarget.value = null
}

useHead({ title: 'Posts' })
</script>

<template>
    <UDashboardPanel
        id="posts"
        :ui="{
            root: 'h-full min-h-0',
            body: 'gap-4 p-4 sm:p-6 overflow-y-auto',
        }"
    >
        <template #header>
            <UDashboardNavbar title="Posts" icon="mingcute:document-2-fill">
                <template #right>
                    <UButton
                        icon="mingcute:refresh-2-line"
                        aria-label="Refresh posts"
                        variant="ghost"
                        color="neutral"
                        :loading="pending"
                        @click="refresh()"
                    />
                    <UButton to="/admin/posts/new" label="New post" icon="mingcute:add-line" />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <UAlert
                v-if="error"
                role="alert"
                :title="adminErrorMessage(error, 'Failed to load posts.')"
                color="error"
                variant="subtle"
            />

            <div
                v-if="!pending && !error && posts.length === 0"
                class="mx-auto flex w-full max-w-sm flex-col items-center gap-3 py-8 text-center"
            >
                <AdminHairlineFigure kind="drawer" label="No posts" class="max-w-xs" />
                <p class="text-muted text-sm">
                    No posts yet. Create one or ask the assistant to draft one.
                </p>
            </div>

            <div class="flex flex-col gap-3">
                <UCard v-for="item in posts" :key="item.id">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <NuxtLink
                                    :to="`/admin/posts/${encodeURIComponent(item.id)}`"
                                    class="font-medium hover:underline"
                                >
                                    {{ item.data.plainTitle || item.data.title || item.id }}
                                </NuxtLink>
                                <UBadge
                                    v-if="item.status?.state"
                                    :label="item.status.state"
                                    :color="stateColor(item.status.state)"
                                    variant="subtle"
                                    size="sm"
                                />
                                <UBadge
                                    v-if="item.schedule"
                                    :label="`Scheduled ${item.schedule.at}`"
                                    color="info"
                                    variant="subtle"
                                    size="sm"
                                />
                            </div>
                            <p class="text-muted mt-1 font-mono text-xs">
                                /posts/{{ item.data.slug || item.id }}
                            </p>
                        </div>

                        <div class="flex flex-wrap items-center gap-2">
                            <UButton
                                :to="`/admin/posts/${encodeURIComponent(item.id)}`"
                                label="Edit"
                                size="xs"
                                variant="outline"
                                color="neutral"
                            />
                            <UButton
                                v-if="item.status?.state !== 'published'"
                                label="Publish"
                                size="xs"
                                :loading="busyId === item.id"
                                @click="publishDocument(item.id, item.status?.draft)"
                            />
                            <UButton
                                v-if="!item.schedule && item.status?.draft"
                                label="Schedule"
                                size="xs"
                                variant="soft"
                                color="neutral"
                                :loading="busyId === item.id"
                                @click="scheduleTarget = item"
                            />
                            <UButton
                                v-else-if="item.schedule"
                                label="Cancel schedule"
                                size="xs"
                                variant="soft"
                                color="warning"
                                :loading="busyId === item.id"
                                @click="unscheduleDocument(item.schedule.id, item.id)"
                            />
                            <UButton
                                label="Delete"
                                size="xs"
                                variant="ghost"
                                color="error"
                                :loading="busyId === item.id"
                                @click="deleteDocument(item.id)"
                            />
                        </div>
                    </div>
                </UCard>
            </div>

            <AdminPostScheduleDialog
                v-model:open="scheduleOpen"
                :busy="busyId !== null"
                :saving="busyId !== null"
                @schedule="confirmSchedule"
            />
        </template>
    </UDashboardPanel>
</template>
