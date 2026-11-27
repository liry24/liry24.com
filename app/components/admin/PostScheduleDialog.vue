<script setup lang="ts">
import type { ContentSchedule } from '@vite-hub/content'

const open = defineModel<boolean>('open', { required: true })
const props = withDefaults(
    defineProps<{
        schedules?: Array<ContentSchedule>
        busy?: boolean
        saving?: boolean
        error?: string
        finalFocus?: () => HTMLElement | null
    }>(),
    {
        schedules: () => [],
        busy: false,
        saving: false,
        error: '',
        finalFocus: undefined,
    },
)
const emit = defineEmits<{
    schedule: [at: string]
    unschedule: [scheduleId: string]
}>()

const localInput = ref('')
const validationError = ref('')
const displayError = computed(() => validationError.value || props.error)

watch(open, (value) => {
    if (!value) return
    validationError.value = ''
    localInput.value = defaultScheduleLocalInput()
})

const handleSubmit = () => {
    if (props.schedules.length > 0) return

    validationError.value = ''
    const at = toIsoFromLocalInput(localInput.value)
    if (!at || Date.parse(at) <= Date.now()) {
        validationError.value = 'Choose a future date and time.'
        return
    }
    emit('schedule', at)
}
</script>

<template>
    <UiFormDialog
        v-model:open="open"
        title="Scheduled publish"
        submit-label="Schedule"
        submitting-label="Scheduling…"
        :busy="busy"
        :saving="saving"
        :hide-submit="schedules.length > 0"
        :final-focus="finalFocus"
        @submit="handleSubmit"
    >
        <div class="grid gap-4">
            <UiAlert v-if="displayError">{{ displayError }}</UiAlert>
            <UiField
                v-if="!schedules.length"
                label="Schedule at"
                description="Use your local time."
                required
            >
                <UiInput v-model="localInput" type="datetime-local" :disabled="busy" required />
            </UiField>
            <ul v-if="schedules.length" class="border-default divide-default divide-y border-t">
                <li
                    v-for="entry in schedules"
                    :key="entry.id"
                    class="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                    <span>
                        <NuxtTime :datetime="entry.at" date-style="medium" time-style="short" />
                        · {{ entry.status }}
                    </span>
                    <UiButton
                        variant="ghost"
                        color="error"
                        :disabled="busy"
                        @click="emit('unschedule', entry.id)"
                    >
                        Cancel schedule
                    </UiButton>
                </li>
            </ul>
        </div>
    </UiFormDialog>
</template>
