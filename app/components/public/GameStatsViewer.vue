<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

const { game, periods } = defineProps<{
    game: GameStatsDisplay
    periods: Array<GamePeriod>
}>()

const appConfig = useAppConfig()
const { restoreFocus } = useViewerModal(open)
const { isSupported: isCopySupported, copy, copied } = useClipboard()

const coverFailed = ref(false)
watch(
    () => game.cover,
    () => {
        coverFailed.value = false
    },
)

const coverSrc = computed(() => (coverFailed.value ? undefined : igdbCoverUrl(game.cover)))
const iconSrc = computed(() => mediaUrl(game.icon))
const sharePath = computed(() => `/?game=${encodeURIComponent(game.slug)}`)

const sortedPeriods = computed(() => [...periods].sort((a, b) => a.order - b.order))
const latest = computed(() => sortedPeriods.value.at(-1))
const metrics = computed(() => game.metrics ?? [])

const primaryMetric = computed(
    () => metrics.value.find((item) => item.key === game.primaryMetric) ?? metrics.value[0],
)
const selectedMetricKey = ref('')
watch(
    () => primaryMetric.value?.key,
    (key) => {
        if (!key) return
        if (!metrics.value.some((item) => item.key === selectedMetricKey.value))
            selectedMetricKey.value = key
    },
    { immediate: true },
)

const activeMetric = computed(
    () => metrics.value.find((item) => item.key === selectedMetricKey.value) ?? primaryMetric.value,
)

const primaryValue = computed(() =>
    latest.value?.values.find((value) => value.key === primaryMetric.value?.key),
)
const primaryImage = computed(() => mediaUrl(primaryValue.value?.image))
const primaryText = computed(() => formatGameValue(primaryValue.value, primaryMetric.value))

const activeLatestValue = computed(() => {
    const key = activeMetric.value?.key
    if (!key) return undefined
    for (let index = sortedPeriods.value.length - 1; index >= 0; index--) {
        const period = sortedPeriods.value[index]
        const found = period?.values.find((value) => value.key === key)
        if (found) return { period: period?.period, value: found }
    }
    return undefined
})

const latestProfileHref = computed(() => {
    for (let index = sortedPeriods.value.length - 1; index >= 0; index--) {
        const href = sortedPeriods.value[index]?.href
        if (href) return href
    }
    return undefined
})

const tableRows = computed(() =>
    [...sortedPeriods.value].reverse().map((period) => {
        const byKey = new Map(period.values.map((value) => [value.key, value]))
        return {
            period,
            cells: metrics.value.map((item) => {
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

const copyShareLink = () => {
    if (!import.meta.client) return
    void copy(new URL(sharePath.value, window.location.origin).href)
}
</script>

<template>
    <UModal
        v-model:open="open"
        :title="game.name"
        description="Period stats and rank history"
        :content="{ onCloseAutoFocus: restoreFocus }"
        :ui="{
            content:
                'divide-y-0 overflow-hidden rounded-2xl p-0 shadow-2xl max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-6xl sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100vw-3rem)] lg:h-[min(calc(100dvh-4rem),54rem)]',
        }"
    >
        <template #content>
            <div class="flex min-h-0 flex-1 flex-col overflow-hidden lg:h-full">
                <header
                    class="border-default flex items-center justify-between gap-3 border-b px-5 py-4 sm:px-6"
                >
                    <div class="flex min-w-0 flex-1 items-center gap-3">
                        <img
                            v-if="iconSrc"
                            :src="iconSrc"
                            alt=""
                            class="ring-default/70 size-9 shrink-0 rounded-lg object-cover ring-1"
                        />
                        <div class="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                            <h2
                                class="text-highlighted min-w-0 text-lg font-semibold tracking-tight wrap-break-word sm:text-xl lg:text-2xl"
                            >
                                {{ game.name }}
                            </h2>
                            <span
                                v-if="latest?.period"
                                class="text-muted shrink-0 font-mono text-xs tabular-nums sm:text-sm"
                            >
                                {{ latest.period }}
                            </span>
                        </div>
                    </div>

                    <UButton
                        aria-label="Close"
                        :icon="appConfig.ui.icons.close"
                        variant="ghost"
                        color="neutral"
                        size="md"
                        square
                        class="shrink-0"
                        @click="open = false"
                    />
                </header>

                <div
                    class="grid min-h-0 flex-1 overflow-x-hidden overflow-y-auto lg:grid-cols-[minmax(15rem,17.5rem)_minmax(0,1fr)] lg:overflow-hidden"
                >
                    <aside
                        class="bg-muted/45 border-default flex flex-row items-center gap-4 border-b p-4 sm:gap-5 sm:p-6 lg:flex-col lg:items-stretch lg:overflow-y-auto lg:border-e lg:border-b-0 dark:bg-neutral-950/60"
                    >
                        <div
                            class="bg-muted ring-default/70 relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-xl shadow-md ring-1 sm:w-28 lg:mx-auto lg:w-full lg:max-w-56"
                        >
                            <img
                                v-if="coverSrc"
                                :src="coverSrc"
                                :alt="`${game.name} cover`"
                                class="size-full object-cover"
                                @error="coverFailed = true"
                            />
                            <div
                                v-else
                                class="from-muted to-elevated/60 flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-b p-4 text-center"
                            >
                                <img
                                    v-if="iconSrc"
                                    :src="iconSrc"
                                    alt=""
                                    class="size-14 rounded-xl object-contain"
                                />
                                <Icon
                                    v-else
                                    name="mingcute:game-2-line"
                                    data-icon-ic="false"
                                    aria-hidden="true"
                                    class="text-muted size-10"
                                />
                                <span
                                    class="text-muted line-clamp-2 text-xs font-medium tracking-tight"
                                >
                                    {{ game.name }}
                                </span>
                            </div>
                        </div>

                        <div class="flex min-w-0 flex-1 flex-col gap-3">
                            <div
                                v-if="primaryMetric"
                                class="bg-default ring-default/70 flex items-center gap-3 rounded-xl p-3.5 ring-1"
                            >
                                <img
                                    v-if="primaryImage"
                                    :src="primaryImage"
                                    alt=""
                                    class="size-10 shrink-0 object-contain"
                                />
                                <div class="min-w-0">
                                    <p class="text-muted text-xs">
                                        {{ primaryMetric.label }}
                                    </p>
                                    <p
                                        class="text-highlighted truncate text-base font-semibold tabular-nums sm:text-lg"
                                    >
                                        {{ primaryText }}
                                    </p>
                                    <p
                                        v-if="latest?.period"
                                        class="text-muted font-mono text-xs tabular-nums"
                                    >
                                        {{ latest.period }}
                                    </p>
                                </div>
                            </div>

                            <dl class="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                                <div
                                    class="bg-default/70 ring-default/60 rounded-xl px-3 py-2.5 ring-1"
                                >
                                    <dt class="text-muted text-xs">Periods</dt>
                                    <dd
                                        class="text-highlighted mt-0.5 font-mono font-semibold tabular-nums"
                                    >
                                        {{ sortedPeriods.length }}
                                    </dd>
                                </div>
                                <div
                                    class="bg-default/70 ring-default/60 rounded-xl px-3 py-2.5 ring-1"
                                >
                                    <dt class="text-muted text-xs">Metrics</dt>
                                    <dd
                                        class="text-highlighted mt-0.5 font-mono font-semibold tabular-nums"
                                    >
                                        {{ metrics.length }}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    </aside>

                    <div
                        class="flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-4 sm:p-6 lg:overflow-y-auto"
                    >
                        <section
                            v-if="activeMetric"
                            aria-label="Metric trend chart"
                            class="bg-muted/30 ring-default/70 flex flex-col gap-4 rounded-xl p-4 ring-1 sm:p-5"
                        >
                            <div class="flex flex-wrap items-center justify-between gap-3">
                                <div class="min-w-0">
                                    <h3
                                        class="text-highlighted text-sm font-semibold tracking-tight sm:text-base"
                                    >
                                        {{ activeMetric.label }}
                                    </h3>
                                    <p
                                        v-if="activeLatestValue"
                                        class="text-muted mt-0.5 font-mono text-xs tabular-nums"
                                    >
                                        Latest ({{ activeLatestValue.period }}):
                                        <span class="text-highlighted font-medium">
                                            {{
                                                formatGameValue(
                                                    activeLatestValue.value,
                                                    activeMetric,
                                                )
                                            }}
                                        </span>
                                    </p>
                                </div>

                                <div
                                    v-if="metrics.length > 1"
                                    role="group"
                                    aria-label="Select metric"
                                    class="flex flex-wrap items-center gap-1.5"
                                >
                                    <UButton
                                        v-for="item in metrics"
                                        :key="item.key"
                                        :label="item.label"
                                        size="xs"
                                        color="neutral"
                                        :variant="
                                            activeMetric.key === item.key ? 'solid' : 'outline'
                                        "
                                        :aria-pressed="activeMetric.key === item.key"
                                        @click="selectedMetricKey = item.key"
                                    />
                                </div>
                            </div>

                            <LazyGameStatsChart
                                :key="activeMetric.key"
                                :game="game.name"
                                :metric="activeMetric"
                                :periods="sortedPeriods"
                            />
                        </section>

                        <section aria-label="Period breakdown" class="min-w-0">
                            <div class="ring-default/70 overflow-x-auto rounded-xl ring-1">
                                <table class="w-full text-left text-sm tabular-nums">
                                    <caption class="sr-only">
                                        {{ game.name }}
                                        period stats
                                    </caption>
                                    <thead class="bg-muted/40">
                                        <tr class="text-muted text-xs font-medium">
                                            <th scope="col" class="px-3.5 py-2.5">Period</th>
                                            <th
                                                v-for="itemMetric in metrics"
                                                :key="itemMetric.key"
                                                scope="col"
                                                class="px-3.5 py-2.5"
                                            >
                                                {{ itemMetric.label }}
                                            </th>
                                            <th scope="col" class="px-3.5 py-2.5 text-right">
                                                Profile
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for="{ period, cells } in tableRows"
                                            :key="period.periodKey"
                                            class="border-default border-t"
                                        >
                                            <th
                                                scope="row"
                                                class="text-highlighted px-3.5 py-2.5 font-medium whitespace-nowrap"
                                            >
                                                {{ period.period }}
                                            </th>
                                            <td
                                                v-for="cell in cells"
                                                :key="cell.key"
                                                class="px-3.5 py-2.5 whitespace-nowrap"
                                            >
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
                                            <td class="px-3.5 py-2.5 text-right">
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
                        </section>
                    </div>
                </div>

                <footer
                    class="border-default bg-muted/30 flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3.5 sm:px-6"
                >
                    <div class="flex flex-wrap items-center gap-3">
                        <UButton
                            v-if="latestProfileHref"
                            :to="latestProfileHref"
                            target="_blank"
                            rel="noopener"
                            label="Open profile"
                            :trailing-icon="appConfig.ui.icons.external"
                            color="neutral"
                        />
                        <NuxtLink
                            :to="`https://www.igdb.com/games/${game.slug}`"
                            target="_blank"
                            rel="noopener"
                            class="text-muted hover:text-highlighted text-xs transition-colors"
                        >
                            Game information by IGDB
                        </NuxtLink>
                    </div>

                    <ClientOnly>
                        <UButton
                            v-if="isCopySupported"
                            :icon="copied ? appConfig.ui.icons.copyCheck : appConfig.ui.icons.copy"
                            :label="copied ? 'Copied' : 'Copy link'"
                            variant="ghost"
                            color="neutral"
                            size="sm"
                            class="ms-auto"
                            @click="copyShareLink"
                        />
                    </ClientOnly>
                </footer>
            </div>
        </template>
    </UModal>
</template>
