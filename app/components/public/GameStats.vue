<script setup lang="ts">
interface Props {
    game: GameStatsDisplay
    periods: Array<GamePeriod>
}
const { game, periods } = defineProps<Props>()

const sortedPeriods = computed(() => [...periods].sort((a, b) => a.order - b.order))
const latest = computed(() => sortedPeriods.value.at(-1))
const metric = computed(() => game.metrics?.find((metric) => metric.key === game.primaryMetric))
const representative = computed(() =>
    latest.value?.values.find((value) => value.key === metric.value?.key),
)
const badge = computed(() => representative.value?.image)
const representativeImage = computed(() => mediaUrl(representative.value?.image))
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
        class="hover:bg-muted mx-auto flex items-center gap-1 rounded-xl px-6 py-3 text-2xl"
    >
        <span class="font-bold">{{ game.name.toUpperCase() }}</span
        ><span class="text-muted font-light">{{ latest.period }}</span
        ><NuxtImg
            :src="mediaUrl(badge)"
            :alt="formatGameValue(representative, metric)"
            :width="40"
            :height="40"
        />
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
            class="mx-auto flex flex-wrap items-center justify-center gap-2 px-6 py-3 text-xl"
        >
            <span class="font-bold">{{ game.name }}</span
            ><span class="text-muted font-light">{{ latest?.period }}</span>
            <img
                v-if="representativeImage"
                :src="representativeImage"
                alt=""
                class="size-10 object-contain"
            />
            <span class="text-sm">{{ formatGameValue(representative, metric) }}</span>
        </UButton>
        <template #body>
            <LazyGameStatsChart v-if="metric" :game="game.name" :metric :periods="sortedPeriods" />
            <div class="mt-4 overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <caption class="sr-only">
                        {{ game.name }}
                        period stats
                    </caption>
                    <thead>
                        <tr>
                            <th scope="col" class="p-2">Period</th>
                            <th
                                v-for="metric in game.metrics"
                                :key="metric.key"
                                scope="col"
                                class="p-2"
                            >
                                {{ metric.label }}
                            </th>
                            <th scope="col" class="p-2">Profile</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="{ period, cells } in tableRows"
                            :key="period.periodKey"
                            class="border-default border-t"
                        >
                            <th scope="row" class="p-2 font-medium">{{ period.period }}</th>
                            <td v-for="cell in cells" :key="cell.key" class="p-2">
                                <span class="inline-flex items-center gap-1"
                                    ><img
                                        v-if="cell.imageSrc"
                                        :src="cell.imageSrc"
                                        alt=""
                                        class="size-6 object-contain"
                                    />{{ cell.text }}</span
                                >
                            </td>
                            <td class="p-2">
                                <UButton
                                    v-if="period.href"
                                    :to="period.href"
                                    target="_blank"
                                    rel="noopener"
                                    variant="link"
                                    icon="mingcute:external-link-line"
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
                class="text-muted mt-4 inline-block text-xs"
                >Game information by IGDB</NuxtLink
            >
        </template>
    </UModal>
</template>
