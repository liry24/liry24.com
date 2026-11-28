<script setup lang="ts">
import { fieldErrors, submitForm } from 'vite-hub/forms/client'

const props = defineProps<{
    item?: AdminEntryRecord<GameRecordData>
    meta?: GameCatalogMeta
    finalFocus?: () => HTMLElement | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()
const toast = useToast()

const game = ref<GameRecordData>()
const metricsDraft = ref<Array<AdminMetricDraft>>([])
const primaryUid = ref<string>()
const saving = ref(false)
const uploading = ref(false)
const busy = computed(() => saving.value || uploading.value)
const errorMessage = ref('')
const errors = ref<Record<string, string>>({})
const summary = useTemplateRef('summary')

watch(open, (value) => {
    if (!value || !props.item) return
    game.value = { ...props.item.data }
    metricsDraft.value = toMetricDrafts(props.item.data.metrics ?? [])
    primaryUid.value = metricsDraft.value.find(
        (metric) => metric.key === props.item?.data.primaryMetric,
    )?.uid
    errorMessage.value = ''
    errors.value = {}
})

function existingKeysExcept(uid: string): ReadonlySet<string> {
    return new Set(
        metricsDraft.value
            .filter((item) => item.uid !== uid)
            .map((item) => item.key.trim())
            .filter(Boolean),
    )
}

function addMetric() {
    const existingKeys = new Set(metricsDraft.value.map((item) => item.key.trim()).filter(Boolean))
    const next = createMetricDraft(existingKeys)
    metricsDraft.value.push(next)
    if (!primaryUid.value) primaryUid.value = next.uid
}

function togglePrimary(uid: string) {
    primaryUid.value = primaryUid.value === uid ? undefined : uid
}

function removeMetric(uid: string) {
    metricsDraft.value = metricsDraft.value.filter((item) => item.uid !== uid)
    if (primaryUid.value === uid) primaryUid.value = metricsDraft.value[0]?.uid
}

async function showErrors(message: string, fields: Record<string, string> = {}) {
    errorMessage.value = message
    errors.value = fields
    await nextTick()
    const invalid = summary.value?.el
        ?.closest('form')
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (invalid) {
        const details = invalid.closest('details')
        if (details) details.open = true
        invalid.focus()
        if (document.activeElement === invalid) return
    }
    summary.value?.focus()
}

async function save() {
    if (!props.item || !game.value || busy.value) return
    errorMessage.value = ''
    errors.value = {}

    const collected = collectAdminGameMetrics(metricsDraft.value, primaryUid.value)
    if (Object.keys(collected.errors).length) {
        await showErrors('Check the highlighted fields.', collected.errors)
        return
    }

    saving.value = true
    let failed: { message: string; fields?: Record<string, string> } | undefined
    try {
        const { order: _order, ...rest } = game.value
        const payload = {
            ...rest,
            primaryMetric: collected.primaryMetric,
            metrics: collected.metrics,
        }
        const [error] = await submitForm('game', { id: props.item.id, data: payload })
        if (error) failed = { message: error.message, fields: fieldErrors(error) }
    } catch (error) {
        failed = { message: adminErrorMessage(error, 'Could not save game settings.') }
    } finally {
        saving.value = false
    }

    if (failed) {
        await showErrors(failed.message, failed.fields)
        return
    }
    toast.add({ title: 'Saved game settings', color: 'success' })
    open.value = false
    emit('saved')
}
</script>

<template>
    <UiFormDialog
        v-model:open="open"
        :title="`Game settings: ${game?.name ?? item?.id ?? ''}`"
        submit-label="Save settings"
        :busy="busy"
        :saving="saving"
        wide
        :final-focus="finalFocus"
        @submit="save"
    >
        <UiAlert v-if="errorMessage" ref="summary" class="mb-4 w-full" tabindex="-1">
            {{ errorMessage }}
        </UiAlert>

        <fieldset v-if="open && game" :disabled="busy" class="grid min-w-0 gap-5">
            <div class="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
                <div>
                    <p class="text-sm font-medium">{{ game.name }}</p>
                    <p class="text-muted font-mono text-xs">
                        {{ game.slug }} · IGDB #{{ game.igdbId }}
                    </p>
                </div>
            </div>

            <div class="grid gap-2">
                <AdminEntryImages
                    :model-value="game.icon ? [game.icon] : []"
                    label="Custom icon"
                    folder="games"
                    :disabled="busy"
                    @update:model-value="game.icon = $event[0]"
                    @busy="uploading = $event"
                />
                <p class="ui-description">
                    Shown in post mentions and admin game lists instead of the IGDB cover.
                </p>
            </div>

            <section class="grid gap-3" aria-label="Game metrics">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <h3 class="text-sm font-semibold">Metrics</h3>
                    <UiButton type="button" :disabled="busy" @click="addMetric">
                        <Icon name="mingcute:add-line" aria-hidden="true" />
                        Add metric
                    </UiButton>
                </div>

                <p v-if="!metricsDraft.length" class="ui-description">
                    No metrics configured yet. Add metrics here or directly when creating a stat
                    period.
                </p>

                <p v-if="errors['gameConfig.metrics']" class="ui-error" role="alert">
                    {{ errors['gameConfig.metrics'] }}
                </p>

                <UiCard
                    v-for="(metricDraft, index) in metricsDraft"
                    :key="metricDraft.uid"
                    class="p-3"
                >
                    <AdminEntryGameMetricConfigFields
                        v-model="metricsDraft[index]!"
                        :locked="isGameMetricLocked(meta, metricDraft.key)"
                        :is-primary="primaryUid === metricDraft.uid"
                        :existing-keys="existingKeysExcept(metricDraft.uid)"
                        :errors="errors"
                        :error-prefix="`gameConfig.metrics.${metricDraft.uid}`"
                        :disabled="busy"
                        @set-primary="togglePrimary(metricDraft.uid)"
                        @remove="removeMetric(metricDraft.uid)"
                    />
                </UiCard>
            </section>
        </fieldset>
    </UiFormDialog>
</template>
