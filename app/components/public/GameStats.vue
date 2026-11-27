<script setup lang="ts">
interface Props {
    game: GameStatsDisplay
    periods: Array<GamePeriod>
}
const { game, periods } = defineProps<Props>()
const appConfig = useAppConfig()

const sortedPeriods = computed(() => [...periods].sort((a, b) => a.order - b.order))
const latest = computed(() => sortedPeriods.value.at(-1))
const metric = computed(() => game.metrics?.find((metric) => metric.key === game.primaryMetric))
const representative = computed(() =>
    latest.value?.values.find((value) => value.key === metric.value?.key),
)
const badge = computed(() => representative.value?.image)
const representativeImage = computed(() => mediaUrl(representative.value?.image))
const representativeText = computed(() => formatGameValue(representative.value, metric.value))
const tableRows = computed(() =>
    [...sortedPeriods.value].reverse().map((period) => {
        const byKey = new Map(period.values.map((value) => [value.key, value]))
        return {
            period,
            cells: (game.metrics ?? []).map((item) => {
                const value = byKey.get(item.key)
                return {
                    key: item.key,
                    imageSrc: mediaUrl(value?.image),
                    text: formatGameValue(value, item),
                }
            }),
        }
    }),
)
</script>

<template>
    <NuxtLink
        v-if="latest?.href && badge"
        :to="latest.href"
        target="_blank"
        rel="noopener"
        class="group bg-default ring-default/70 hover:bg-muted/60 hover:ring-accented flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 ring-1 transition-[background-color,box-shadow] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none"
    >
        <span class="flex min-w-0 items-baseline gap-2.5">
            <span
                class="text-highlighted truncate text-base font-semibold tracking-tight sm:text-lg"
            >
                {{ game.name }}
            </span>
            <span class="text-muted shrink-0 font-mono text-xs tabular-nums sm:text-sm">
                {{ latest.period }}
            </span>
        </span>
        <span class="flex shrink-0 items-center gap-2.5">
            <NuxtImg
                :src="mediaUrl(badge)"
                :alt="representativeText"
                :width="36"
                :height="36"
                class="size-8 object-contain sm:size-9"
            />
            <UIcon
                :name="appConfig.ui.icons.external"
                aria-hidden="true"
                class="text-muted group-hover:text-highlighted size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
            />
        </span>
    </NuxtLink>
    <UModal
        v-else
        :title="game.name"
        description="Period stats and highest rank history"
        :ui="{ content: 'sm:max-w-4xl' }"
    >
        <UButton
            variant="ghost"
            color="neutral"
            class="group bg-default ring-default/70 hover:bg-muted/60 hover:ring-accented flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left ring-1 transition-[background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none"
        >
            <span class="flex min-w-0 items-baseline gap-2.5">
                <span
                    class="text-highlighted truncate text-base font-semibold tracking-tight sm:text-lg"
                >
                    {{ game.name }}
                </span>
                <span
                    v-if="latest?.period"
                    class="text-muted shrink-0 font-mono text-xs tabular-nums sm:text-sm"
                >
                    {{ latest.period }}
                </span>
            </span>
            <span class="flex shrink-0 items-center gap-2.5">
                <img
                    v-if="representativeImage"
                    :src="representativeImage"
                    alt=""
                    class="size-8 object-contain sm:size-9"
                />
                <span v-if="representativeText" class="text-toned text-sm font-medium tabular-nums">
                    {{ representativeText }}
                </span>
                <UIcon
                    :name="appConfig.ui.icons.chevronRight"
                    aria-hidden="true"
                    class="text-muted group-hover:text-highlighted size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
            </span>
        </UButton>
        <template #body>
            <div v-if="metric" class="bg-muted/35 ring-default/70 rounded-xl p-3 ring-1 sm:p-4">
                <LazyGameStatsChart :game="game.name" :metric :periods="sortedPeriods" />
            </div>
            <div class="mt-5 overflow-x-auto">
                <table class="w-full text-left text-sm tabular-nums">
                    <caption class="sr-only">
                        {{ game.name }}
                        period stats
                    </caption>
                    <thead>
                        <tr class="text-muted text-xs font-medium">
                            <th scope="col" class="px-3 py-2">Period</th>
                            <th
                                v-for="itemMetric in game.metrics"
                                :key="itemMetric.key"
                                scope="col"
                                class="px-3 py-2"
                            >
                                {{ itemMetric.label }}
                            </th>
                            <th scope="col" class="px-3 py-2 text-right">Profile</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="{ period, cells } in tableRows"
                            :key="period.periodKey"
                            class="border-default border-t"
                        >
                            <th scope="row" class="text-highlighted px-3 py-2.5 font-medium">
                                {{ period.period }}
                            </th>
                            <td v-for="cell in cells" :key="cell.key" class="px-3 py-2.5">
                                <span class="inline-flex items-center gap-1.5">
                                    <img
                                        v-if="cell.imageSrc"
                                        :src="cell.imageSrc"
                                        alt=""
                                        class="size-6 object-contain"
                                    />
                                    {{ cell.text }}
                                </span>
                            </td>
                            <td class="px-3 py-2.5 text-right">
                                <UButton
                                    v-if="period.href"
                                    :to="period.href"
                                    target="_blank"
                                    rel="noopener"
                                    variant="ghost"
                                    color="neutral"
                                    size="xs"
                                    :icon="appConfig.ui.icons.external"
                                    :aria-label="`${period.period} external profile`"
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <NuxtLink
                :to="`https://www.igdb.com/games/${game.slug}`"
                target="_blank"
                rel="noopener"
                class="text-muted hover:text-default mt-4 inline-block text-xs transition-colors"
                >Game information by IGDB</NuxtLink
            >
        </template>
    </UModal>
</template>
