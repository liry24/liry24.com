<script setup lang="ts">
import {
    formatGameValue,
    gameImageUrl,
    type GameData,
    type GamePeriod,
} from '~~/shared/utils/games'

import { gameChart, type RankPoint } from '~/utils/gameChart'
const props = defineProps<{ game: GameData; periods: GamePeriod[] }>()
const gradientId = useId().replaceAll(':', '')
const periods = computed(() => [...props.periods].sort((a, b) => a.order - b.order))
const latest = computed(() => periods.value.at(-1))
const metric = computed(() =>
    props.game.metrics?.find((metric) => metric.key === props.game.primaryMetric),
)
const representative = computed(() =>
    latest.value?.values.find((value) => value.key === metric.value?.key),
)
const definition = computed(() =>
    metric.value ? gameChart(periods.value, metric.value, gradientId) : undefined,
)
const point = (value: unknown) => value as RankPoint
</script>
<template>
    <UModal
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
                v-if="gameImageUrl(representative?.image)"
                :src="gameImageUrl(representative?.image)"
                alt=""
                class="size-10 object-contain"
            />
            <span class="text-sm">{{ formatGameValue(representative, metric) }}</span>
        </UButton>
        <template #body>
            <UChart
                v-if="definition"
                type="area"
                curve="monotone"
                :definition
                :height="280"
                :x-axis="false"
                :tooltip="{ portal: true, content: { collisionPadding: 16, sticky: 'always' } }"
                :aria-label="`${game.name} ${metric?.label} history`"
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
            <div class="mt-4 overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <caption class="sr-only">
                        {{
                            game.name
                        }}
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
                            v-for="period in [...periods].reverse()"
                            :key="period.periodKey"
                            class="border-default border-t"
                        >
                            <th scope="row" class="p-2 font-medium">{{ period.period }}</th>
                            <td v-for="metric in game.metrics" :key="metric.key" class="p-2">
                                <span class="inline-flex items-center gap-1"
                                    ><img
                                        v-if="
                                            gameImageUrl(
                                                period.values.find(
                                                    (value) => value.key === metric.key,
                                                )?.image,
                                            )
                                        "
                                        :src="
                                            gameImageUrl(
                                                period.values.find(
                                                    (value) => value.key === metric.key,
                                                )?.image,
                                            )
                                        "
                                        alt=""
                                        class="size-6 object-contain"
                                    />{{
                                        formatGameValue(
                                            period.values.find((value) => value.key === metric.key),
                                            metric,
                                        )
                                    }}</span
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
