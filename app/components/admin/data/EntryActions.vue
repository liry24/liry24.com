<script setup lang="ts">
import type { Entry, Revision, EntryFeatures } from 'liti'
import { createLitiClient } from 'liti/client'

const {
    entry,
    features,
    title,
    busy: loading = false,
    posts = false,
} = defineProps<{
    entry: Entry
    features: EntryFeatures
    title: string
    busy?: boolean
    posts?: boolean
}>()
const emit = defineEmits<{ edit: []; changed: [] }>()
const client = createLitiClient()
const running = ref(false)
const error = ref('')
const busy = computed(() => loading || running.value)
const schedule = ref('')
const revisions = ref<Array<Pick<Revision, 'id' | 'createdAt'>>>()
const selectedRevision = ref<string>()
async function run(operation: () => Promise<unknown>, changed = true) {
    if (busy.value) return
    running.value = true
    error.value = ''
    try {
        await operation()
        if (changed) emit('changed')
    } catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'The operation failed.'
    } finally {
        running.value = false
    }
}
const history = () =>
    run(async () => {
        revisions.value = await client.listRevisions(entry.id)
    }, false)
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
        <UPopover>
            <UButton
                aria-label="Entry actions"
                icon="mingcute:more-1-line"
                variant="ghost"
                color="neutral"
                size="sm"
            />
            <template #content>
                <div class="flex w-80 flex-col gap-3 p-4">
                    <p class="truncate text-sm font-medium">
                        {{ title }}
                    </p>
                    <UAlert v-if="error" :title="error" color="error" />
                    <template v-if="features.publishing">
                        <UButton
                            :label="posts ? 'Edit & Publish' : 'Publish'"
                            variant="soft"
                            color="neutral"
                            :disabled="busy"
                            @click="
                                posts
                                    ? emit('edit')
                                    : run(() =>
                                          client.publishEntry(entry.id, {
                                              expectedVersion: entry.version,
                                          }),
                                      )
                            "
                        />
                        <UButton
                            v-if="entry.publishedRevisionId"
                            label="Unpublish"
                            variant="ghost"
                            color="neutral"
                            :disabled="busy"
                            @click="
                                run(() =>
                                    client.unpublishEntry(entry.id, {
                                        expectedVersion: entry.version,
                                    }),
                                )
                            "
                        />
                    </template>
                    <template v-if="features.scheduling && !posts">
                        <UInput
                            v-model="schedule"
                            type="datetime-local"
                            aria-label="Schedule publish time"
                        />
                        <UButton
                            label="Schedule Publish"
                            variant="soft"
                            color="neutral"
                            :disabled="busy || !schedule"
                            @click="
                                run(() =>
                                    client.schedulePublish(entry.id, {
                                        at: new Date(schedule).toISOString(),
                                        expectedVersion: entry.version,
                                    }),
                                )
                            "
                        />
                    </template>
                    <UButton
                        v-if="entry.scheduledRevisionId"
                        label="Cancel Schedule"
                        variant="ghost"
                        color="neutral"
                        :disabled="busy"
                        @click="
                            run(() =>
                                client.cancelScheduledPublish(entry.id, {
                                    expectedVersion: entry.version,
                                }),
                            )
                        "
                    />
                    <template v-if="features.revisions">
                        <UButton
                            label="Revision history"
                            icon="mingcute:history-line"
                            variant="ghost"
                            color="neutral"
                            :disabled="busy"
                            @click="history"
                        />
                        <template v-if="revisions">
                            <USelect
                                v-model="selectedRevision"
                                aria-label="Revision to restore"
                                :items="
                                    revisions.map((revision) => ({
                                        label: `${new Date(revision.createdAt).toLocaleString()} — ${revision.id}`,
                                        value: revision.id,
                                    }))
                                "
                                placeholder="Select a revision"
                            />
                            <UButton
                                label="Restore as draft"
                                variant="soft"
                                color="neutral"
                                :disabled="busy || !selectedRevision"
                                @click="
                                    run(() =>
                                        client.restoreRevision(entry.id, selectedRevision!, {
                                            expectedVersion: entry.version,
                                        }),
                                    )
                                "
                            />
                        </template>
                    </template>
                    <USeparator />
                    <UButton
                        label="Delete"
                        icon="mingcute:delete-2-line"
                        variant="ghost"
                        color="error"
                        :disabled="busy"
                        @click="
                            run(() =>
                                client.deleteEntry(entry.id, { expectedVersion: entry.version }),
                            )
                        "
                    />
                </div>
            </template>
        </UPopover>
    </div>
</template>
