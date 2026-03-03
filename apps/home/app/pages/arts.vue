<script setup lang="ts">
import { MasonryWall } from '@yeger/vue-masonry-wall'

import { ArtViewer } from '#components'

const route = useRoute()
const overlay = useOverlay()

const { data } = useFetch('/api/arts')

const modalArtViewer = overlay.create(ArtViewer)

onMounted(() => {
    if (route.query.open && data.value?.map((i) => i.slug).includes(route.query.open as string)) {
        modalArtViewer.open({ item: data.value.find((i) => i.slug === route.query.open)! })
    }
})

defineSeo({
    title: 'Arts',
    titleTemplate: '%s | Liry24',
    description: 'A collection of artworks by Liry24.',
    image: {
        component: 'Home.takumi',
        props: { title: 'Liry24', subpath: 'arts' },
        options: [{ key: 'og' }, { key: 'whatsapp', width: 800, height: 800 }],
    },
})
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
            <template #default="{ item }">
                <div
                    class="group relative cursor-pointer overflow-clip rounded-xl"
                    @click="modalArtViewer.open({ item })"
                >
                    <NuxtImg
                        :src="item.images[0]?.src"
                        :alt="item.title"
                        :width="520"
                        format="webp"
                        class="size-full"
                    />

                    <div
                        class="absolute inset-0 flex flex-col gap-3 bg-black/50 p-4 text-zinc-100 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                        <span class="font-[Special_Gothic_Expanded_One] text-3xl font-bold">
                            {{ item.title }}
                        </span>

                        <div class="mt-auto ml-auto flex items-center gap-1">
                            <Icon name="mingcute:photo-album-fill" size="20" />
                            <span class="font-bold">{{ item.images.length }}</span>
                        </div>
                    </div>
                </div>
            </template>
        </MasonryWall>
    </div>
</template>
