<script setup lang="ts">
const { game, metric, periods } = defineProps<{
    game: string
    metric: GameMetric
    periods: Array<GamePeriod>
}>()

const gradientId = useId().replaceAll(':', '')
const definition = computed(() => gameChart(periods, metric, gradientId))
const point = (value: unknown) => value as RankPoint
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
            <div class="flex items-center gap-2">
                <img
                    v-if="gameImageUrl(point(primaryPoint.datum).record.image)"
                    :src="gameImageUrl(point(primaryPoint.datum).record.image)"
                    alt=""
                    class="size-8 object-contain"
                />
                <div>
                    <p class="text-muted text-xs">
                        {{ point(primaryPoint.datum).period.period }}
                    </p>
                    <p class="font-medium">
                        {{ formatGameValue(point(primaryPoint.datum).record, metric) }}
                    </p>
                </div>
            </div>
        </template>
    </UChart>
</template>
