<script setup lang="ts">
import type { GameMetric, GameValue } from '~~/shared/utils/games'
import { formatGameValue } from '~~/shared/utils/games'
const props = defineProps<{
    modelName: string
    values: Record<string, unknown>
    form: {
        setFieldValue(name: string, value: unknown): void
        pushFieldValue(name: string, value: unknown): void
        removeFieldValue(name: string, index: number): void
        moveFieldValue(name: string, from: number, to: number): void
    }
    upload: ReturnType<typeof useAdminForm>['upload']
    disabled?: boolean
}>()
const games = useAdminEntries('games', { all: true, immediate: props.modelName === 'gameStats' })
const metrics = computed(() => (props.values.metrics ?? []) as GameMetric[])
const selectedGame = computed(() =>
    games.data.value?.items.find((entry) => entry.id === props.values.game),
)
const definitions = computed(() => (selectedGame.value?.data.metrics ?? []) as GameMetric[])
const statValues = computed(() => (props.values.values ?? []) as GameValue[])
function changeValue(key: string, patch: Partial<GameValue> | null) {
    const index = statValues.value.findIndex((item) => item.key === key)
    if (!patch) {
        if (index >= 0) props.form.removeFieldValue('values', index)
    } else if (index < 0) props.form.pushFieldValue('values', { key, value: 0, ...patch })
    else
        for (const [field, value] of Object.entries(patch))
            props.form.setFieldValue(`values[${index}].${field}`, value)
}
const imageDescriptor = { key: 'image', kind: 'image', label: 'Image' }
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
                    @update:model-value="form.setFieldValue('icon', $event)"
                    @upload="upload('icon', $event)"
                />
                <UFormField label="Representative metric"
                    ><USelect
                        :model-value="String(values.primaryMetric || '')"
                        :items="
                            metrics.map((metric) => ({ label: metric.label, value: metric.key }))
                        "
                        class="w-full"
                        @update:model-value="form.setFieldValue('primaryMetric', $event)"
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
                                    form.setFieldValue(`metrics[${index}].key`, String($event))
                                "
                        /></UFormField>
                        <UFormField label="Label"
                            ><UInput
                                :model-value="metric.label"
                                class="w-full"
                                @update:model-value="
                                    form.setFieldValue(`metrics[${index}].label`, String($event))
                                "
                        /></UFormField>
                        <UFormField label="Number format"
                            ><USelect
                                :model-value="metric.format"
                                :items="['integer', 'decimal', 'percent']"
                                @update:model-value="
                                    form.setFieldValue(`metrics[${index}].format`, $event)
                                "
                        /></UFormField>
                        <UFormField label="Unit"
                            ><UInput
                                :model-value="metric.unit ?? ''"
                                @update:model-value="
                                    form.setFieldValue(`metrics[${index}].unit`, String($event))
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
                                            `metrics[${index}].positions[${p}].value`,
                                            Number($event),
                                        )
                                    "
                            /></UFormField>
                            <UFormField label="Position label"
                                ><UInput
                                    :model-value="position.label"
                                    @update:model-value="
                                        form.setFieldValue(
                                            `metrics[${index}].positions[${p}].label`,
                                            String($event),
                                        )
                                    "
                            /></UFormField>
                            <UFormField label="Color (#RRGGBB)"
                                ><UInput
                                    :model-value="position.color ?? ''"
                                    @update:model-value="
                                        form.setFieldValue(
                                            `metrics[${index}].positions[${p}].color`,
                                            $event ? String($event) : null,
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
                                    `metrics[${index}].positions[${p}].image`,
                                    $event,
                                )
                            "
                            @upload="upload(`metrics[${index}].positions[${p}].image`, $event)"
                        />
                        <UButton
                            label="Remove position"
                            variant="ghost"
                            @click="form.removeFieldValue(`metrics[${index}].positions`, p)"
                        />
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <UButton
                            label="Add position"
                            variant="soft"
                            @click="
                                form.pushFieldValue(`metrics[${index}].positions`, {
                                    value: 0,
                                    label: '',
                                })
                            "
                        />
                        <UButton
                            label="Move up"
                            variant="ghost"
                            :disabled="index === 0"
                            @click="form.moveFieldValue('metrics', index, index - 1)"
                        />
                        <UButton
                            label="Remove metric"
                            variant="ghost"
                            @click="form.removeFieldValue('metrics', index)"
                        />
                    </div>
                </section>
                <UButton
                    label="Add metric"
                    variant="soft"
                    @click="
                        form.pushFieldValue('metrics', {
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
                        games.data.value?.items.map((game) => ({
                            label: game.data.name,
                            value: game.id,
                        })) ?? []
                    "
                    :disabled="Boolean(values.game) && Boolean(statValues.length)"
                    class="w-full"
                    @update:model-value="form.setFieldValue('game', $event)"
            /></UFormField>
            <div class="grid grid-cols-2 gap-3">
                <UFormField label="Period key" required
                    ><UInput
                        :model-value="String(values.periodKey ?? '')"
                        placeholder="2026-act-6"
                        @update:model-value="form.setFieldValue('periodKey', String($event))"
                /></UFormField>
                <UFormField label="Period name" required
                    ><UInput
                        :model-value="String(values.period ?? '')"
                        placeholder="Act 6"
                        @update:model-value="form.setFieldValue('period', String($event))"
                /></UFormField>
                <UFormField label="Period order" required
                    ><UInput
                        type="number"
                        :model-value="Number(values.order ?? 0)"
                        @update:model-value="form.setFieldValue('order', Number($event))"
                /></UFormField>
                <UFormField label="External URL"
                    ><UInput
                        :model-value="String(values.href ?? '')"
                        @update:model-value="form.setFieldValue('href', $event || null)"
                /></UFormField>
                <AdminFormField
                    v-for="key in ['start', 'end']"
                    :key="key"
                    :disabled
                    :descriptor="{ key, label: key, kind: 'datetime' }"
                    :model-value="values[key]"
                    @update:model-value="form.setFieldValue(key, $event)"
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
                                image: metric.positions![Number(index)]!.image ?? null,
                                color: metric.positions![Number(index)]!.color ?? null,
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
                                changeValue(metric.key, { label: $event || null })
                            "
                    /></UFormField>
                    <UFormField label="Recorded color (#RRGGBB)"
                        ><UInput
                            :model-value="
                                statValues.find((item) => item.key === metric.key)?.color ?? ''
                            "
                            @update:model-value="
                                changeValue(metric.key, { color: $event || null })
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
