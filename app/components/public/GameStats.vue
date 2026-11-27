<script setup lang="ts">
import { LazyGameStatsViewer } from '#components'

interface Props {
    game: GameStatsDisplay
    periods: Array<GamePeriod>
}
const { game, periods } = defineProps<Props>()

const overlay = useOverlay()
const modalGameStats = overlay.create(LazyGameStatsViewer)

const sortedPeriods = computed(() => [...periods].sort((a, b) => a.order - b.order))
const latest = computed(() => sortedPeriods.value.at(-1))
const metric = computed(
    () => game.metrics?.find((item) => item.key === game.primaryMetric) ?? game.metrics?.[0],
)
const representative = computed(() =>
    latest.value?.values.find((value) => value.key === metric.value?.key),
)
const representativeImage = computed(() => mediaUrl(representative.value?.image))
const representativeText = computed(() => formatGameValue(representative.value, metric.value))

const openViewer = () => {
    modalGameStats.open({ game, periods })
}
</script>

<template>
    <button
        type="button"
        aria-haspopup="dialog"
        class="hover:bg-muted mx-auto flex cursor-pointer flex-wrap items-center justify-center gap-2 rounded-xl px-6 py-3 text-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none sm:text-2xl"
        @click="openViewer"
    >
        <span class="font-bold">{{ game.name }}</span>
        <span v-if="latest?.period" class="text-muted font-light">{{ latest.period }}</span>
        <img
            v-if="representativeImage"
            :src="representativeImage"
            :alt="representativeText !== '—' ? representativeText : ''"
            class="size-10 object-contain"
        />
        <span
            v-else-if="representativeText && representativeText !== '—'"
            class="text-muted text-sm font-normal"
        >
            {{ representativeText }}
        </span>
    </button>
</template>
