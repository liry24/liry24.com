<script setup lang="ts">
import type { LitiRuntime } from 'liti/server'

const {
    entry,
    features,
    title,
    busy: loading = false,
    posts = false,
} = defineProps<{
    entry: AdminEntry
    features: { publishing: boolean; scheduling: boolean; revisions: boolean }
    title: string
    busy?: boolean
    posts?: boolean
}>()
const emit = defineEmits<{ edit: []; changed: [] }>()
const request = useRequestFetch(),
    origin = useRequestURL().origin
const running = ref(false),
    error = ref(''),
    schedule = ref(''),
    selectedRevision = ref('')
const inspection = ref<Awaited<ReturnType<LitiRuntime['content']['inspect']>>>()
const busy = computed(() => loading || running.value)
watch(
    () => `${entry.model}:${entry.id}:${entry.digest ?? entry.version}`,
    () => {
        inspection.value = undefined
        selectedRevision.value = ''
        error.value = ''
    },
)
async function command<Value = unknown>(action: string, input: Record<string, unknown> = {}) {
    return await request<Value, '/api/_liti/manage', 'POST'>('/api/_liti/manage', {
        method: 'POST',
        headers: { origin },
        body: {
            action,
            model: entry.model,
            id: entry.id,
            ifDigest: entry.digest ?? null,
            ifVersion: entry.version,
            ...input,
        },
    })
}
async function run(task: () => Promise<unknown>, changed = true) {
    if (busy.value) return
    running.value = true
    error.value = ''
    const identity = `${entry.model}:${entry.id}`
    try {
        await task()
        if (changed && identity === `${entry.model}:${entry.id}`) {
            inspection.value = undefined
            emit('changed')
        }
    } catch (cause) {
        error.value = adminErrorMessage(cause, 'The operation failed.')
    } finally {
        running.value = false
    }
}
async function inspect() {
    const identity = `${entry.model}:${entry.id}`
    const result = await command<Awaited<ReturnType<LitiRuntime['content']['inspect']>>>('inspect')
    if (identity === `${entry.model}:${entry.id}`) inspection.value = result
}
</script>
<template>
    <div class="flex items-center gap-1">
        <UButton
            aria-label="Edit"
            icon="mingcute:edit-3-fill"
            variant="ghost"
            color="neutral"
            size="sm"
            :disabled="busy"
            @click="emit('edit')"
        />
        <UPopover
            @update:open="
                (open) => {
                    if (open && features.revisions) run(inspect, false)
                }
            "
        >
            <UButton
                aria-label="Entry actions"
                icon="mingcute:more-1-line"
                variant="ghost"
                color="neutral"
                size="sm"
            />
            <template #content
                ><div class="flex w-80 flex-col gap-3 p-4">
                    <p class="truncate text-sm font-medium">{{ title }}</p>
                    <UAlert v-if="error" :title="error" color="error" />
                    <template v-if="features.publishing">
                        <UButton
                            :label="posts ? 'Edit & Publish' : 'Publish reviewed draft'"
                            variant="soft"
                            color="neutral"
                            :disabled="busy || !entry.digest"
                            @click="
                                posts
                                    ? emit('edit')
                                    : run(() =>
                                          command('publish', {
                                              digests: { [entry.locale ?? 'und']: entry.digest },
                                          }),
                                      )
                            "
                        />
                        <UButton
                            v-if="inspection?.published"
                            label="Unpublish"
                            variant="ghost"
                            color="neutral"
                            :disabled="busy"
                            @click="
                                run(() =>
                                    command('unpublish', { ifHead: inspection?.publishedHead }),
                                )
                            "
                        />
                    </template>
                    <template v-if="features.scheduling && !posts"
                        ><UInput
                            v-model="schedule"
                            type="datetime-local"
                            aria-label="Schedule publish time" /><UButton
                            label="Schedule Publish"
                            variant="soft"
                            color="neutral"
                            :disabled="busy || !schedule || !entry.digest"
                            @click="
                                run(() =>
                                    command('schedule', {
                                        at: new Date(schedule).toISOString(),
                                        digests: { [entry.locale ?? 'und']: entry.digest },
                                    }),
                                )
                            "
                    /></template>
                    <div v-for="job in inspection?.schedules" :key="job.id" class="grid gap-1">
                        <p class="text-sm">Scheduled: {{ new Date(job.at).toLocaleString() }}</p>
                        <UButton
                            label="Cancel Schedule"
                            variant="ghost"
                            color="neutral"
                            :disabled="busy"
                            @click="run(() => command('cancelSchedule', { schedule: job.id }))"
                        />
                    </div>
                    <template v-if="features.revisions">
                        <UButton
                            label="Revision history"
                            icon="mingcute:history-line"
                            variant="ghost"
                            color="neutral"
                            :disabled="busy"
                            @click="run(inspect, false)"
                        />
                        <USelect
                            v-if="inspection"
                            v-model="selectedRevision"
                            aria-label="Revision to restore"
                            :items="
                                inspection.history.revisions.map((revision) => ({
                                    label: `${new Date(revision.createdAt).toLocaleString()} — ${revision.id}`,
                                    value: revision.id,
                                }))
                            "
                            placeholder="Select a revision"
                        />
                        <UButton
                            v-if="inspection"
                            label="Restore as draft"
                            variant="soft"
                            color="neutral"
                            :disabled="busy || !selectedRevision"
                            @click="run(() => command('restore', { revision: selectedRevision }))"
                        />
                    </template>
                    <USeparator />
                    <p v-if="inspection?.published" class="text-muted text-xs">
                        Deleting the draft keeps its public version. Unpublish first to remove the
                        public page.
                    </p>
                    <UButton
                        :label="features.publishing ? 'Delete draft' : 'Delete record'"
                        icon="mingcute:delete-2-line"
                        variant="ghost"
                        color="error"
                        :disabled="busy || (features.publishing && !entry.digest)"
                        @click="run(() => command('remove'))"
                    /></div
            ></template>
        </UPopover>
    </div>
</template>
