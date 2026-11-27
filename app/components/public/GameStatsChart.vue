<script setup lang="ts">
const { game, metric, periods } = defineProps<{
    game: string
    metric: GameMetric
    periods: Array<GamePeriod>
}>()

const gradientId = useId().replaceAll(':', '')
const hasPoints = computed(() =>
    periods.some((period) => period.values.some((value) => value.key === metric.key)),
)
const definition = computed(() => gameChart(periods, metric, gradientId))
const tooltipData = (value: unknown) => {
    const datum = value as RankPoint
    return {
        imageSrc: mediaUrl(datum.record.image),
        period: datum.period.period,
        formatted: formatGameValue(datum.record, metric),
    }
}
</script>

<template>
    <UChart
        v-if="hasPoints"
        type="area"
        curve="monotone"
        :definition
        :height="280"
        :tooltip="{ portal: true, content: { collisionPadding: 16, sticky: 'always' } }"
        :aria-label="`${game} ${metric.label} history`"
    >
        <template #tooltip="{ primaryPoint }">
            <div
                v-for="tip in [tooltipData(primaryPoint.datum)]"
                :key="tip.period"
                class="flex items-center gap-2.5"
            >
                <img v-if="tip.imageSrc" :src="tip.imageSrc" alt="" class="size-8 object-contain" />
                <div>
                    <p class="text-muted text-xs">
                        {{ tip.period }}
                    </p>
                    <p class="font-medium tabular-nums">
                        {{ tip.formatted }}
                    </p>
                </div>
            </div>
        </template>
    </UChart>
    <p v-else class="text-muted py-12 text-center text-sm">
        No recorded values for {{ metric.label }} yet.
    </p>
</template>
