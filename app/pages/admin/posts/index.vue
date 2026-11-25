<script setup lang="ts">
import type { ContentDocumentStatus, ContentSchedule } from '@vite-hub/content'

useHead({ title: 'Posts' })

interface PostListItem {
    id: string
    title: string
    data: {
        title?: string
        plainTitle?: string
        slug?: string
        authoredAt?: string
    }
    status: ContentDocumentStatus | null
    schedule: ContentSchedule | null
}

const toast = useToast()
const busyId = ref<string | null>(null)
const scheduleTarget = ref<PostListItem | null>(null)
const scheduleInput = ref('')

const { data, pending, error, refresh } = await useFetch<{
    items: Array<PostListItem>
    schedules: Array<ContentSchedule>
}>('/api/admin/content/posts')

const posts = computed(() => data.value?.items ?? [])

const stateColor = (state: string | undefined) => {
    if (state === 'published') {
        return 'success'
    }
    if (state === 'changed' || state === 'draft') {
        return 'warning'
    }
    if (state === 'deleted') {
        return 'error'
    }
    return 'neutral'
}

const stateContrastClass = (state: string | undefined) => {
    if (state === 'published') {
        return 'text-green-800 dark:text-green-300'
    }
    if (state === 'changed' || state === 'draft') {
        return 'text-amber-800 dark:text-amber-300'
    }
    if (state === 'deleted') {
        return 'text-red-700 dark:text-red-400'
    }
    return ''
}

const publishPost = async (item: PostListItem) => {
    busyId.value = item.id
    try {
        await $fetch('/api/admin/content/publish', {
            method: 'POST',
            body: {
                action: 'publish',
                collection: 'posts',
                id: item.id,
                digest: item.status?.draft ?? null,
            },
        })
        toast.add({ title: 'Published post', color: 'success' })
        await refresh()
    } catch (error_) {
        toast.add({
            title: 'Publish failed',
            description: adminErrorMessage(error_, 'Could not publish post.'),
            color: 'error',
        })
    } finally {
        busyId.value = null
    }
}

const openSchedule = (item: PostListItem) => {
    scheduleTarget.value = item
    const nextHour = new Date(Date.now() + 60 * 60 * 1000)
    const offset = nextHour.getTimezoneOffset() * 60 * 1000
    scheduleInput.value = new Date(nextHour.getTime() - offset).toISOString().slice(0, 16)
}

const confirmSchedule = async () => {
    if (!scheduleTarget.value || !scheduleInput.value) {
        return
    }
    busyId.value = scheduleTarget.value.id
    try {
        const at = new Date(scheduleInput.value).toISOString()
        await $fetch('/api/admin/content/publish', {
            method: 'POST',
            body: {
                action: 'schedule',
                collection: 'posts',
                id: scheduleTarget.value.id,
                digest: scheduleTarget.value.status?.draft ?? null,
                at,
            },
        })
        toast.add({ title: 'Scheduled publish', color: 'success' })
        scheduleTarget.value = null
        await refresh()
    } catch (error_) {
        toast.add({
            title: 'Schedule failed',
            description: adminErrorMessage(error_, 'Could not schedule post.'),
            color: 'error',
        })
    } finally {
        busyId.value = null
    }
}

const unschedulePost = async (scheduleId: string, itemId: string) => {
    busyId.value = itemId
    try {
        await $fetch('/api/admin/content/publish', {
            method: 'POST',
            body: {
                action: 'unschedule',
                scheduleId,
            },
        })
        toast.add({ title: 'Cancelled schedule', color: 'neutral' })
        await refresh()
    } catch (error_) {
        toast.add({
            title: 'Unschedule failed',
            description: adminErrorMessage(error_, 'Could not cancel schedule.'),
            color: 'error',
        })
    } finally {
        busyId.value = null
    }
}

const deletePost = async (item: PostListItem) => {
    busyId.value = item.id
    try {
        await $fetch(`/api/admin/content/posts/${encodeURIComponent(item.id)}`, {
            method: 'DELETE',
            query: { publish: 'true' },
        })
        toast.add({ title: 'Deleted post', color: 'neutral' })
        await refresh()
    } catch (error_) {
        toast.add({
            title: 'Delete failed',
            description: adminErrorMessage(error_, 'Could not delete post.'),
            color: 'error',
        })
    } finally {
        busyId.value = null
    }
}
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
                :ui="{ title: 'text-red-700 dark:text-red-400' }"
            />

            <div
                v-if="!pending && !error && posts.length === 0"
                class="mx-auto flex w-full max-w-sm flex-col items-center gap-3 py-8 text-center"
            >
                <AdminHairlineDrawer label="No posts" class="max-w-xs" />
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
                                    :class="stateContrastClass(item.status.state)"
                                    variant="subtle"
                                    size="sm"
                                />
                                <UBadge
                                    v-if="item.schedule"
                                    :label="`Scheduled ${item.schedule.at}`"
                                    color="info"
                                    class="text-blue-800 dark:text-blue-300"
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
                                @click="publishPost(item)"
                            />
                            <UButton
                                v-if="!item.schedule && item.status?.draft"
                                label="Schedule"
                                size="xs"
                                variant="soft"
                                color="neutral"
                                :loading="busyId === item.id"
                                @click="openSchedule(item)"
                            />
                            <UButton
                                v-else-if="item.schedule"
                                label="Cancel schedule"
                                size="xs"
                                variant="soft"
                                color="warning"
                                class="text-amber-800 dark:text-amber-300"
                                :loading="busyId === item.id"
                                @click="unschedulePost(item.schedule.id, item.id)"
                            />
                            <UButton
                                label="Delete"
                                size="xs"
                                variant="ghost"
                                color="error"
                                class="text-red-700 dark:text-red-400"
                                :loading="busyId === item.id"
                                @click="deletePost(item)"
                            />
                        </div>
                    </div>
                </UCard>
            </div>

            <UModal
                :open="Boolean(scheduleTarget)"
                title="Schedule publish"
                @update:open="(value) => (!value ? (scheduleTarget = null) : undefined)"
            >
                <template #body>
                    <div class="flex flex-col gap-4">
                        <UFormField label="Publish at (local time)">
                            <UInput v-model="scheduleInput" type="datetime-local" class="w-full" />
                        </UFormField>
                        <div class="flex justify-end gap-2">
                            <UButton
                                label="Cancel"
                                variant="ghost"
                                color="neutral"
                                @click="scheduleTarget = null"
                            />
                            <UButton
                                label="Confirm schedule"
                                :loading="busyId !== null"
                                @click="confirmSchedule"
                            />
                        </div>
                    </div>
                </template>
            </UModal>
        </template>
    </UDashboardPanel>
</template>
