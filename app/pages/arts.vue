<script setup lang="ts">
import { MasonryWall } from '@yeger/vue-masonry-wall'

import { LazyArtViewer } from '#components'

const route = useRoute()
const overlay = useOverlay()

const { data } = await usePortfolioData('arts')

const modalArtViewer = overlay.create(LazyArtViewer)

onMounted(() => {
    const slug = typeof route.query.open === 'string' ? route.query.open : undefined
    const matched = slug ? data.value?.find((entry) => entry.data.slug === slug) : undefined
    if (matched) modalArtViewer.open({ item: matched })
})

useSeoMeta({ title: 'Arts', description: 'A collection of artworks by Liry24.' })
defineOgImage('Home.takumi', { title: 'Liry24', subpath: 'arts' }, [
    { key: 'og' },
    { key: 'whatsapp', width: 800, height: 800 },
])
</script>

<template>
    <div v-if="data" class="grid gap-8">
        <p v-if="!data.length" class="text-muted py-12 text-center text-sm">No artworks yet.</p>
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
                    :aria-label="`View ${item.data.title}`"
                    class="group bg-muted/50 ring-default/60 hover:ring-accented relative block w-full cursor-pointer overflow-clip rounded-2xl text-left ring-1 transition-shadow duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none"
                    @click="modalArtViewer.open({ item })"
                >
                    <NuxtImg
                        :src="mediaUrl(item.data.images[0])"
                        :alt="item.data.title"
                        :width="520"
                        format="webp"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 520px"
                        decoding="async"
                        :fetchpriority="index < 2 ? 'high' : undefined"
                        :loading="index >= 4 ? 'lazy' : undefined"
                        class="size-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />

                    <div
                        aria-hidden="true"
                        class="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-4 pt-14 pb-4 text-white opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                    >
                        <span
                            class="line-clamp-2 text-base leading-snug font-semibold tracking-tight sm:text-lg"
                        >
                            {{ item.data.title }}
                        </span>

                        <span
                            v-if="item.data.images.length > 1"
                            class="inline-flex shrink-0 items-center gap-1 font-mono text-xs font-medium tabular-nums"
                        >
                            <Icon name="mingcute:photo-album-fill" class="size-4" />
                            <span>{{ item.data.images.length }}</span>
                        </span>
                    </div>
                </button>
            </template>
        </MasonryWall>
    </div>
</template>
