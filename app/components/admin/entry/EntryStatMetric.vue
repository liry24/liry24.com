<script setup lang="ts">
import { UiField, UiInput } from '@liry24/ui'

const props = defineProps<{
    metric: GameMetric
    errors: Record<string, string>
    disabled: boolean
}>()
const draft = defineModel<AdminStatDraft>({ required: true })
defineEmits<{ busy: [busy: boolean] }>()

const path = computed(() => `data.values.${props.metric.key}`)
const unit = computed(() => (props.metric.format === 'percent' ? '%' : props.metric.unit))
const format = computed(
    () =>
        ({
            integer: 'Whole number · 0 or higher',
            decimal: 'Decimal · 0 or higher',
            percent: 'Percentage · 0 to 100',
        })[props.metric.format],
)
</script>

<template>
    <section class="ui-card grid gap-2 p-3" :aria-label="metric.label">
        <UiField :label="metric.label" :description="format" :error="errors[path]">
            <div class="flex items-center gap-2">
                <UiInput
                    v-model="draft.number"
                    :name="path"
                    :inputmode="metric.format === 'integer' ? 'numeric' : 'decimal'"
                    placeholder="—"
                    class="ui-input"
                />
                <span v-if="unit" class="ui-description shrink-0">{{ unit }}</span>
            </div>
        </UiField>
        <details class="border-default border-t pt-2">
            <summary class="ui-label cursor-pointer">Display settings</summary>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <AdminEntryText
                    v-model="draft.label"
                    label="Display label"
                    :name="`${path}.label`"
                    :error="errors[`${path}.label`]"
                />
                <AdminEntryText
                    v-model="draft.color"
                    label="Color"
                    :name="`${path}.color`"
                    :error="errors[`${path}.color`]"
                    placeholder="#2563EB"
                />
                <AdminEntryImages
                    :model-value="draft.image ? [draft.image] : []"
                    label="Metric image"
                    folder="uploads"
                    :disabled="disabled"
                    class="sm:col-span-2"
                    @update:model-value="draft.image = $event[0]"
                    @busy="$emit('busy', $event)"
                />
            </div>
        </details>
    </section>
</template>
