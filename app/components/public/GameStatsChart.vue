<script setup lang="ts">
const { game, metric, periods } = defineProps<{
    game: string
    metric: GameMetric
    periods: Array<GamePeriod>
}>()

const gradientId = useId().replaceAll(':', '')
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
        type="area"
        curve="monotone"
        :definition
        :height="280"
        :x-axis="false"
        :tooltip="{ portal: true, content: { collisionPadding: 16, sticky: 'always' } }"
        :aria-label="`${game} ${metric.label} history`"
    >
        <template #tooltip="{ primaryPoint }">
            <div
                v-for="tip in [tooltipData(primaryPoint.datum)]"
                :key="tip.period"
                class="flex items-center gap-2"
            >
                <img v-if="tip.imageSrc" :src="tip.imageSrc" alt="" class="size-8 object-contain" />
                <div>
                    <p class="text-muted text-xs">
                        {{ tip.period }}
                    </p>
                    <p class="font-medium">
                        {{ tip.formatted }}
                    </p>
                </div>
            </div>
        </template>
    </UChart>
</template>
