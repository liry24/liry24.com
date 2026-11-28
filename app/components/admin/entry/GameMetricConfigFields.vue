<script setup lang="ts">
import { UiButton, UiField, UiInput, UiSelect } from '@liry24/ui'

const draft = defineModel<AdminMetricDraft>({ required: true })
const props = defineProps<{
    locked?: boolean
    isPrimary: boolean
    existingKeys: ReadonlySet<string>
    errors: Record<string, string>
    errorPrefix: string
    disabled?: boolean
}>()
const emit = defineEmits<{
    'set-primary': []
    remove: []
}>()

const formatOptions: Array<{ value: GameMetric['format']; label: string }> = [
    { value: 'integer', label: 'Whole number' },
    { value: 'decimal', label: 'Decimal' },
    { value: 'percent', label: 'Percentage (%)' },
]

function updateLabel(next: string) {
    draft.value.label = next
    if (draft.value.autoKey && !props.locked)
        draft.value.key = next.trim() ? deriveGameMetricKey(next, props.existingKeys) : ''
}

function updateKey(next: string) {
    draft.value.autoKey = false
    draft.value.key = next
}

function updateFormat(next: string) {
    if (next === 'integer' || next === 'decimal' || next === 'percent') {
        draft.value.format = next
        if (next === 'percent') draft.value.unit = ''
    }
}

function addPosition() {
    draft.value.positions.push(createMetricPositionDraft())
}

function removePosition(uid: string) {
    draft.value.positions = draft.value.positions.filter((pos) => pos.uid !== uid)
}

const hasAdvancedError = computed(() =>
    Object.keys(props.errors).some(
        (key) =>
            key === `${props.errorPrefix}.key` || key.startsWith(`${props.errorPrefix}.positions`),
    ),
)
</script>

<template>
    <div class="grid gap-3">
        <div class="grid gap-3 sm:grid-cols-2">
            <UiField label="Metric label" :error="errors[`${errorPrefix}.label`]" required>
                <UiInput
                    :model-value="draft.label"
                    :name="`${errorPrefix}.label`"
                    placeholder="Peak Rank"
                    :disabled="disabled"
                    class="ui-input"
                    @update:model-value="updateLabel"
                />
            </UiField>

            <UiField label="Format" :error="errors[`${errorPrefix}.format`]">
                <UiSelect
                    :model-value="draft.format"
                    :options="formatOptions"
                    :disabled="disabled || locked"
                    @update:model-value="updateFormat"
                />
            </UiField>

            <UiField
                v-if="draft.format !== 'percent'"
                label="Unit"
                description="Optional suffix (e.g. LP, RR, pts)"
                :error="errors[`${errorPrefix}.unit`]"
            >
                <UiInput
                    v-model="draft.unit"
                    :name="`${errorPrefix}.unit`"
                    placeholder="RR"
                    :disabled="disabled || locked"
                    class="ui-input"
                />
            </UiField>

            <div class="flex items-end">
                <label class="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        :checked="isPrimary"
                        :disabled="disabled"
                        class="accent-current"
                        @change="emit('set-primary')"
                    />
                    Primary metric (shown in overview & chart)
                </label>
            </div>
        </div>

        <p v-if="locked" class="ui-description">
            Key, format, unit, and deletion are locked because this metric already has recorded
            values in published or other stat periods.
        </p>

        <details :open="hasAdvancedError || undefined" class="border-default border-t pt-2">
            <summary class="ui-label cursor-pointer">
                Advanced settings (key & chart markers)
            </summary>
            <div class="mt-3 grid gap-4">
                <UiField
                    label="Metric key"
                    description="Auto-generated from label. Letters, numbers, and underscores only."
                    :error="errors[`${errorPrefix}.key`]"
                >
                    <UiInput
                        :model-value="draft.key"
                        :name="`${errorPrefix}.key`"
                        placeholder="peak_rank"
                        :disabled="disabled || locked"
                        class="ui-input font-mono"
                        @update:model-value="updateKey"
                    />
                </UiField>

                <div class="grid gap-2">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p class="ui-label">Chart axis markers</p>
                            <p class="ui-description">
                                Optional labeled Y-axis ticks (e.g. rank tiers on the chart).
                            </p>
                        </div>
                        <UiButton
                            type="button"
                            class="ui-button"
                            :disabled="disabled"
                            @click="addPosition"
                        >
                            Add marker
                        </UiButton>
                    </div>

                    <p v-if="errors[`${errorPrefix}.positions`]" class="ui-error" role="alert">
                        {{ errors[`${errorPrefix}.positions`] }}
                    </p>

                    <div
                        v-for="position in draft.positions"
                        :key="position.uid"
                        class="border-default grid items-start gap-2 rounded-lg border p-2.5 sm:grid-cols-[0.8fr_1.2fr_0.9fr_auto]"
                    >
                        <UiField
                            label="Value"
                            :error="errors[`${errorPrefix}.positions.${position.uid}.value`]"
                        >
                            <UiInput
                                v-model="position.value"
                                :name="`${errorPrefix}.positions.${position.uid}.value`"
                                :inputmode="draft.format === 'integer' ? 'numeric' : 'decimal'"
                                placeholder="2100"
                                :disabled="disabled"
                                class="ui-input"
                            />
                        </UiField>
                        <UiField
                            label="Label"
                            :error="errors[`${errorPrefix}.positions.${position.uid}.label`]"
                        >
                            <UiInput
                                v-model="position.label"
                                :name="`${errorPrefix}.positions.${position.uid}.label`"
                                placeholder="Immortal 1"
                                :disabled="disabled"
                                class="ui-input"
                            />
                        </UiField>
                        <UiField
                            label="Color"
                            :error="errors[`${errorPrefix}.positions.${position.uid}.color`]"
                        >
                            <UiInput
                                v-model="position.color"
                                :name="`${errorPrefix}.positions.${position.uid}.color`"
                                placeholder="#EF4444"
                                :disabled="disabled"
                                class="ui-input font-mono"
                            />
                        </UiField>
                        <div class="flex items-end pt-6">
                            <UiButton
                                type="button"
                                class="ui-button"
                                data-variant="ghost"
                                data-tone="danger"
                                :aria-label="
                                    `Remove marker ${position.label || position.value || ''}`.trim()
                                "
                                :disabled="disabled"
                                @click="removePosition(position.uid)"
                            >
                                Remove
                            </UiButton>
                        </div>
                    </div>
                </div>
            </div>
        </details>

        <div class="flex justify-end">
            <UiButton
                type="button"
                class="ui-button"
                data-variant="ghost"
                data-tone="danger"
                :disabled="disabled || locked"
                @click="emit('remove')"
            >
                Remove metric
            </UiButton>
        </div>
    </div>
</template>
