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
        <MasonryWall
            :items="data"
            :column-width="240"
            :gap="24"
            :min-columns="1"
            :max-columns="3"
            :ssr-columns="2"
        >
            <template #default="{ item, index }">
                <button
                    type="button"
                    :aria-label="`View ${item.data.title}`"
                    class="group relative block w-full cursor-pointer overflow-clip rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4"
                    @click="modalArtViewer.open({ item })"
                >
                    <NuxtImg
                        :src="mediaUrl(item.data.images[0])"
                        :alt="item.data.title"
                        :width="520"
                        format="webp"
                        sizes="100vw 641px:50vw 1025px:520px"
                        decoding="async"
                        :fetchpriority="index < 2 ? 'high' : undefined"
                        :loading="index >= 4 ? 'lazy' : undefined"
                        class="size-full"
                    />

                    <div
                        class="absolute inset-0 flex flex-col gap-3 bg-black/50 p-4 text-zinc-100 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                        <span class="font-[Special_Gothic_Expanded_One] text-3xl font-bold">
                            {{ item.data.title }}
                        </span>

                        <div class="mt-auto ml-auto flex items-center gap-1">
                            <Icon name="mingcute:photo-album-fill" size="20" />
                            <span class="font-bold">{{ item.data.images.length }}</span>
                        </div>
                    </div>
                </button>
            </template>
        </MasonryWall>
    </div>
</template>
