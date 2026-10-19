<script setup lang="ts">
import type { Entry, Revision } from '@liria24/site-admin'

import type { useAdminEntries } from '#build/site-admin/client'

const {
    entry,
    resource,
    posts = false,
} = defineProps<{
    entry: Entry
    resource: ReturnType<typeof useAdminEntries<string>>
    posts?: boolean
}>()
const emit = defineEmits<{ edit: [] }>()
const { features, status } = resource
const busy = computed(() => status.value === 'pending')
const schedule = ref('')
const revisions = ref<Revision[]>()
const selectedRevision = ref<string>()
const history = async () => {
    revisions.value = (await resource.revisions(entry)) ?? []
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
                        {{ resource.display(entry.data).title }}
                    </p>
                    <template v-if="features.publishing">
                        <UButton
                            :label="posts ? 'Edit & Publish' : 'Publish'"
                            variant="soft"
                            color="neutral"
                            :disabled="busy"
                            @click="posts ? emit('edit') : resource.publish(entry)"
                        />
                        <UButton
                            v-if="entry.publishedRevisionId"
                            label="Unpublish"
                            variant="ghost"
                            color="neutral"
                            :disabled="busy"
                            @click="resource.unpublish(entry)"
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
                            @click="resource.schedule(entry, schedule)"
                        />
                    </template>
                    <UButton
                        v-if="entry.scheduledRevisionId"
                        label="Cancel Schedule"
                        variant="ghost"
                        color="neutral"
                        :disabled="busy"
                        @click="resource.cancelSchedule(entry)"
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
                                @click="resource.restore(entry, selectedRevision!)"
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
                        @click="resource.remove(entry)"
                    />
                </div>
            </template>
        </UPopover>
    </div>
</template>
