<script setup lang="ts">
const {
    entries,
    revision,
    disabled = false,
    label,
} = defineProps<{
    entries: AdminEntry[]
    revision: string | null
    disabled?: boolean
    label: string
}>()
const emit = defineEmits<{ changed: [] }>()
const request = useRequestFetch(),
    origin = useRequestURL().origin
const open = ref(false),
    busy = ref(false),
    error = ref('')
const reviewed = ref<{ entries: AdminEntry[]; revision: string }>()
function review() {
    if (disabled || !revision || !entries.length || entries.some((entry) => !entry.digest)) return
    reviewed.value = { entries: structuredClone(toRaw(entries)), revision }
    error.value = ''
    open.value = true
}
function reload() {
    open.value = false
    emit('changed')
}
async function publish() {
    if (busy.value || !reviewed.value) return
    busy.value = true
    error.value = ''
    try {
        await request('/api/_liti/manage', {
            method: 'POST',
            headers: { origin },
            body: {
                action: 'publishMany',
                revision: reviewed.value.revision,
                entries: reviewed.value.entries.map((entry) => ({
                    model: entry.model,
                    id: entry.id,
                    digests: { [entry.locale ?? 'und']: entry.digest },
                })),
            },
        })
        open.value = false
        emit('changed')
    } catch (cause) {
        error.value = adminErrorMessage(cause, 'Could not publish the reviewed list.')
    } finally {
        busy.value = false
    }
}
</script>
<template>
    <UButton
        label="Review & publish list"
        variant="soft"
        color="neutral"
        :disabled="disabled || !revision || !entries.length"
        @click="review"
    />
    <UModal v-model:open="open" :title="'Review ' + label" :dismissible="!busy" :close="!busy">
        <template #body>
            <div class="grid gap-4">
                <p class="text-sm">
                    Publish every draft below, including its fields and list order. Later edits
                    require a new review.
                </p>
                <UAlert v-if="error" :title="error" color="error">
                    <template #actions><UButton label="Reload list" @click="reload" /></template>
                </UAlert>
                <ol class="grid gap-4">
                    <li v-for="(entry, index) in reviewed?.entries" :key="entry.id">
                        <p class="text-sm font-medium">{{ index + 1 }}. {{ entry.id }}</p>
                        <pre class="bg-muted overflow-auto rounded-lg p-3 text-xs">{{
                            JSON.stringify(entry.data, null, 2)
                        }}</pre>
                    </li>
                </ol>
                <UButton label="Publish reviewed list" :loading="busy" @click="publish" />
            </div>
        </template>
    </UModal>
</template>
