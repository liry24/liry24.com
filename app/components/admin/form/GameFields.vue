<script setup lang="ts">
import type { AnyVueFormApi } from '@tanstack/vue-form'
interface Props {
    modelName: string
    values: Record<string, unknown>
    form: AnyVueFormApi
    upload: ReturnType<typeof useImageUpload>['upload']
    disabled?: boolean
}
const { modelName, values, form, upload, disabled } = defineProps<Props>()

const games = useLitiQuery('games', { immediate: modelName === 'gameStats', limit: 1000 })
const metrics = computed(() => (values.metrics ?? []) as GameMetric[])
const selectedGame = computed(() => games.data.value.find((entry) => entry.id === values.game))
const definitions = computed(() => (selectedGame.value?.data.metrics ?? []) as GameMetric[])
const statValues = computed(() => (values.values ?? []) as GameValue[])
const imageDescriptor = { key: 'image', kind: 'image', label: 'Image' }

const changeValue = (key: string, patch: Partial<GameValue> | null) => {
    const index = statValues.value.findIndex((item) => item.key === key)
    if (!patch) {
        if (index >= 0) remove('data.values', index)
    } else if (index < 0) append('data.values', { key, value: 0, ...patch })
    else
        for (const [field, value] of Object.entries(patch))
            form.setFieldValue(`data.values[${index}].${field}`, value)
}
function arrayValue(name: string): unknown[] {
    const value = form.getFieldValue(name)
    if (value === undefined) return []
    if (!Array.isArray(value)) throw new Error('Load the game array before editing it.')
    return value
}
function append(name: string, value: unknown) {
    form.setFieldValue(name, [...arrayValue(name), value])
}
function remove(name: string, index: number) {
    form.setFieldValue(
        name,
        arrayValue(name).filter((_, position) => position !== index),
    )
}
function move(name: string, from: number, to: number) {
    const values = [...arrayValue(name)],
        [item] = values.splice(from, 1)
    values.splice(to, 0, item)
    form.setFieldValue(name, values)
}
</script>

<template>
    <fieldset
        :disabled="disabled || (modelName === 'gameStats' && games.status.value === 'pending')"
        class="grid min-w-0 gap-4"
    >
        <UAlert v-if="games.error.value" :title="games.error.value.message" color="error" />
        <template v-if="modelName === 'games'">
            <p v-if="!values.igdbId" role="status" class="text-muted text-sm">Loading game…</p>
            <template v-else>
                <p class="font-medium">
                    {{ values.name }}
                    <span class="text-muted text-sm"
                        >IGDB #{{ values.igdbId }} · {{ values.slug }}</span
                    >
                </p>
                <AdminFormField
                    :descriptor="imageDescriptor"
                    :disabled
                    :model-value="values.icon"
                    @update:model-value="form.setFieldValue('data.icon', $event)"
                    @upload="upload('icon', $event)"
                />
                <UFormField label="Representative metric"
                    ><USelect
                        :model-value="String(values.primaryMetric || '')"
                        :items="
                            metrics.map((metric) => ({ label: metric.label, value: metric.key }))
                        "
                        class="w-full"
                        @update:model-value="form.setFieldValue('data.primaryMetric', $event)"
                /></UFormField>
                <section
                    v-for="(metric, index) in metrics"
                    :key="index"
                    class="border-default grid gap-3 rounded-lg border p-4"
                >
                    <div class="grid grid-cols-2 gap-2">
                        <UFormField label="Metric key"
                            ><UInput
                                :model-value="metric.key"
                                class="w-full"
                                @update:model-value="
                                    form.setFieldValue(`data.metrics[${index}].key`, String($event))
                                "
                        /></UFormField>
                        <UFormField label="Label"
                            ><UInput
                                :model-value="metric.label"
                                class="w-full"
                                @update:model-value="
                                    form.setFieldValue(
                                        `data.metrics[${index}].label`,
                                        String($event),
                                    )
                                "
                        /></UFormField>
                        <UFormField label="Number format"
                            ><USelect
                                :model-value="metric.format"
                                :items="['integer', 'decimal', 'percent']"
                                @update:model-value="
                                    form.setFieldValue(`data.metrics[${index}].format`, $event)
                                "
                        /></UFormField>
                        <UFormField label="Unit"
                            ><UInput
                                :model-value="metric.unit ?? ''"
                                @update:model-value="
                                    form.setFieldValue(
                                        `data.metrics[${index}].unit`,
                                        String($event),
                                    )
                                "
                        /></UFormField>
                    </div>
                    <div
                        v-for="(position, p) in metric.positions"
                        :key="p"
                        class="bg-muted grid gap-2 rounded p-3"
                    >
                        <div class="grid grid-cols-2 gap-2">
                            <UFormField label="Position value"
                                ><UInput
                                    type="number"
                                    :model-value="position.value"
                                    @update:model-value="
                                        form.setFieldValue(
                                            `data.metrics[${index}].positions[${p}].value`,
                                            Number($event),
                                        )
                                    "
                            /></UFormField>
                            <UFormField label="Position label"
                                ><UInput
                                    :model-value="position.label"
                                    @update:model-value="
                                        form.setFieldValue(
                                            `data.metrics[${index}].positions[${p}].label`,
                                            String($event),
                                        )
                                    "
                            /></UFormField>
                            <UFormField label="Color (#RRGGBB)"
                                ><UInput
                                    :model-value="position.color ?? ''"
                                    @update:model-value="
                                        form.setFieldValue(
                                            `data.metrics[${index}].positions[${p}].color`,
                                            $event ? String($event) : undefined,
                                        )
                                    "
                            /></UFormField>
                        </div>
                        <AdminFormField
                            :descriptor="imageDescriptor"
                            :disabled
                            :model-value="position.image"
                            @update:model-value="
                                form.setFieldValue(
                                    `data.metrics[${index}].positions[${p}].image`,
                                    $event,
                                )
                            "
                            @upload="upload(`metrics[${index}].positions[${p}].image`, $event)"
                        />
                        <UButton
                            label="Remove position"
                            variant="ghost"
                            @click="remove(`data.metrics[${index}].positions`, p)"
                        />
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <UButton
                            label="Add position"
                            variant="soft"
                            @click="
                                append(`data.metrics[${index}].positions`, {
                                    value: 0,
                                    label: '',
                                })
                            "
                        />
                        <UButton
                            label="Move up"
                            variant="ghost"
                            :disabled="index === 0"
                            @click="move('data.metrics', index, index - 1)"
                        />
                        <UButton
                            label="Remove metric"
                            variant="ghost"
                            @click="remove('data.metrics', index)"
                        />
                    </div>
                </section>
                <UButton
                    label="Add metric"
                    variant="soft"
                    @click="
                        append('data.metrics', {
                            key: '',
                            label: '',
                            format: 'decimal',
                            positions: [],
                        })
                    "
                />
            </template>
        </template>
        <template v-else>
            <UFormField label="Game" required
                ><USelect
                    :model-value="String(values.game ?? '')"
                    :items="
                        games.data.value.map((game) => ({
                            label: game.data.name,
                            value: game.id,
                        })) ?? []
                    "
                    :disabled="Boolean(values.game) && Boolean(statValues.length)"
                    class="w-full"
                    @update:model-value="form.setFieldValue('data.game', $event)"
            /></UFormField>
            <div class="grid grid-cols-2 gap-3">
                <UFormField label="Period key" required
                    ><UInput
                        :model-value="String(values.periodKey ?? '')"
                        placeholder="2026-act-6"
                        @update:model-value="form.setFieldValue('data.periodKey', String($event))"
                /></UFormField>
                <UFormField label="Period name" required
                    ><UInput
                        :model-value="String(values.period ?? '')"
                        placeholder="Act 6"
                        @update:model-value="form.setFieldValue('data.period', String($event))"
                /></UFormField>
                <UFormField label="Period order" required
                    ><UInput
                        type="number"
                        :model-value="Number(values.order ?? 0)"
                        @update:model-value="form.setFieldValue('data.order', Number($event))"
                /></UFormField>
                <UFormField label="External URL"
                    ><UInput
                        :model-value="String(values.href ?? '')"
                        @update:model-value="form.setFieldValue('data.href', $event || undefined)"
                /></UFormField>
                <AdminFormField
                    v-for="key in ['start', 'end']"
                    :key="key"
                    :disabled
                    :descriptor="{ key, label: key, kind: 'datetime' }"
                    :model-value="values[key]"
                    @update:model-value="form.setFieldValue(`data.${key}`, $event)"
                />
            </div>
            <section
                v-for="metric in definitions"
                :key="metric.key"
                class="border-default grid gap-3 rounded-lg border p-4"
            >
                <h3 class="font-medium">{{ metric.label }}</h3>
                <USelect
                    v-if="metric.positions?.length"
                    :aria-label="`${metric.label} position`"
                    :items="
                        metric.positions.map((position, i) => ({ label: position.label, value: i }))
                    "
                    placeholder="Copy position into this record"
                    @update:model-value="
                        (index) =>
                            changeValue(metric.key, {
                                ...metric.positions![Number(index)],
                                image: metric.positions![Number(index)]!.image ?? undefined,
                                color: metric.positions![Number(index)]!.color ?? undefined,
                            })
                    "
                />
                <UFormField label="Numeric value (empty = missing)"
                    ><UInput
                        type="number"
                        step="any"
                        :model-value="
                            String(statValues.find((item) => item.key === metric.key)?.value ?? '')
                        "
                        @update:model-value="
                            (value) =>
                                changeValue(
                                    metric.key,
                                    value === '' ? null : { value: Number(value) },
                                )
                        "
                /></UFormField>
                <template v-if="statValues.some((item) => item.key === metric.key)">
                    <UFormField label="Recorded display label"
                        ><UInput
                            :model-value="
                                statValues.find((item) => item.key === metric.key)?.label ?? ''
                            "
                            class="w-full"
                            @update:model-value="
                                changeValue(metric.key, { label: $event || undefined })
                            "
                    /></UFormField>
                    <UFormField label="Recorded color (#RRGGBB)"
                        ><UInput
                            :model-value="
                                statValues.find((item) => item.key === metric.key)?.color ?? ''
                            "
                            @update:model-value="
                                changeValue(metric.key, { color: $event || undefined })
                            "
                    /></UFormField>
                    <AdminFormField
                        :descriptor="imageDescriptor"
                        :disabled
                        :model-value="statValues.find((item) => item.key === metric.key)?.image"
                        @update:model-value="
                            changeValue(metric.key, { image: $event as GameValue['image'] })
                        "
                        @upload="
                            upload(
                                `values[${statValues.findIndex((item) => item.key === metric.key)}].image`,
                                $event,
                            )
                        "
                    />
                </template>
                <p class="text-muted text-sm">
                    Preview:
                    {{
                        formatGameValue(
                            statValues.find((item) => item.key === metric.key),
                            metric,
                        )
                    }}
                </p>
            </section>
        </template>
    </fieldset>
</template>
