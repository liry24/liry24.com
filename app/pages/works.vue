<script setup lang="ts">
import { markdownPlainText } from '@liry24/ui/markdown'
import { MasonryWall } from '@yeger/vue-masonry-wall'

import { LazyWorkViewer } from '#components'

const route = useRoute()
const overlay = useOverlay()
const appConfig = useAppConfig()

const { data } = await usePortfolioData('works')
const modalWorkViewer = overlay.create(LazyWorkViewer)

onMounted(() => {
    const slug = typeof route.query.open === 'string' ? route.query.open : undefined
    const matched = slug ? data.value?.find((entry) => entry.data.slug === slug) : undefined
    if (matched) modalWorkViewer.open({ item: matched })
})

useSeoMeta({ title: 'Works', description: 'A collection of works by Liry24.' })
defineOgImage('Home.takumi', { title: 'Liry24', subpath: 'works' }, [
    { key: 'og' },
    { key: 'whatsapp', width: 800, height: 800 },
])
</script>

<template>
    <UPage v-if="data" :ui="{ center: 'grid gap-8' }">
        <p v-if="!data.length" class="text-muted py-12 text-center text-sm">No works yet.</p>
        <MasonryWall
            v-else
            :items="data"
            :column-width="260"
            :gap="20"
            :min-columns="1"
            :max-columns="3"
            :ssr-columns="2"
        >
            <template #default="{ item, index }">
                <button
                    type="button"
                    class="group bg-default ring-default/80 hover:bg-muted/45 hover:ring-accented block w-full cursor-pointer overflow-hidden rounded-2xl text-left ring-1 transition-[background-color,box-shadow] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none"
                    @click="modalWorkViewer.open({ item })"
                >
                    <div v-if="item.data.style === 'small'" class="flex items-start gap-3.5 p-4">
                        <NuxtImg
                            v-if="item.data.image"
                            :src="mediaUrl(item.data.image)"
                            alt=""
                            :width="160"
                            :height="160"
                            format="webp"
                            decoding="async"
                            :loading="index >= 4 ? 'lazy' : undefined"
                            class="bg-muted ring-default/60 size-20 shrink-0 rounded-xl object-cover ring-1"
                        />
                        <span
                            v-else-if="item.data.icon"
                            class="bg-muted ring-default/60 inline-grid size-14 shrink-0 place-items-center rounded-xl ring-1"
                        >
                            <Icon
                                :name="item.data.icon"
                                data-icon-ic="false"
                                class="text-highlighted size-6"
                                aria-hidden="true"
                            />
                        </span>

                        <div class="flex min-w-0 flex-1 flex-col gap-1">
                            <div
                                v-if="item.data.category || item.data.price"
                                class="text-muted flex flex-wrap items-center gap-x-2 text-xs"
                            >
                                <span v-if="item.data.category">{{ item.data.category }}</span>
                                <span
                                    v-if="item.data.category && item.data.price"
                                    aria-hidden="true"
                                    class="text-dimmed"
                                    >·</span
                                >
                                <span v-if="item.data.price" class="font-mono tabular-nums">{{
                                    item.data.price
                                }}</span>
                            </div>

                            <div class="flex items-start justify-between gap-2">
                                <h2
                                    class="text-highlighted min-w-0 text-base leading-snug font-semibold tracking-tight"
                                >
                                    {{ item.data.title }}
                                </h2>
                                <UIcon
                                    v-if="item.data.href"
                                    :name="appConfig.ui.icons.external"
                                    aria-hidden="true"
                                    class="text-muted group-hover:text-highlighted mt-0.5 size-4 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                                />
                            </div>

                            <p
                                v-if="item.data.description"
                                class="text-muted line-clamp-3 text-sm leading-relaxed"
                            >
                                {{ markdownPlainText(item.data.description) }}
                            </p>
                        </div>
                    </div>

                    <div v-else class="flex flex-col">
                        <div
                            v-if="item.data.image"
                            class="bg-muted/50 border-default/60 overflow-hidden border-b"
                        >
                            <NuxtImg
                                :src="mediaUrl(item.data.image)"
                                alt=""
                                :width="520"
                                format="webp"
                                sizes="(max-width: 640px) 100vw, 520px"
                                decoding="async"
                                :loading="index >= 2 ? 'lazy' : undefined"
                                class="w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                            />
                        </div>

                        <div class="flex flex-col gap-1.5 p-4 sm:p-5">
                            <div
                                v-if="item.data.category || item.data.price"
                                class="text-muted flex flex-wrap items-center gap-x-2 text-xs"
                            >
                                <span v-if="item.data.category">{{ item.data.category }}</span>
                                <span
                                    v-if="item.data.category && item.data.price"
                                    aria-hidden="true"
                                    class="text-dimmed"
                                    >·</span
                                >
                                <span v-if="item.data.price" class="font-mono tabular-nums">{{
                                    item.data.price
                                }}</span>
                            </div>

                            <div class="flex items-start justify-between gap-2">
                                <span class="flex min-w-0 items-center gap-2">
                                    <Icon
                                        v-if="item.data.icon"
                                        :name="item.data.icon"
                                        data-icon-ic="false"
                                        class="text-toned size-4.5 shrink-0"
                                        aria-hidden="true"
                                    />
                                    <h2
                                        class="text-highlighted min-w-0 text-base leading-snug font-semibold tracking-tight sm:text-lg"
                                    >
                                        {{ item.data.title }}
                                    </h2>
                                </span>
                                <UIcon
                                    v-if="item.data.href"
                                    :name="appConfig.ui.icons.external"
                                    aria-hidden="true"
                                    class="text-muted group-hover:text-highlighted mt-0.5 size-4 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                                />
                            </div>

                            <p
                                v-if="item.data.description"
                                class="text-muted line-clamp-2 text-sm leading-relaxed"
                            >
                                {{ markdownPlainText(item.data.description) }}
                            </p>
                        </div>
                    </div>
                </button>
            </template>
        </MasonryWall>
    </UPage>
</template>
