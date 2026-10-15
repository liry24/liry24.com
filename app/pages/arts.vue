<script setup lang="ts">
import { MasonryWall } from '@yeger/vue-masonry-wall'

import { ArtViewer } from '#components'

const route = useRoute()
const overlay = useOverlay()

const { data } = await useContent('arts', { default: () => [] })

const modalArtViewer = overlay.create(ArtViewer)

onMounted(() => {
    if (
        route.query.open &&
        data.value?.map((i) => i.data.slug).includes(route.query.open as string)
    )
        modalArtViewer.open({ item: data.value.find((i) => i.data.slug === route.query.open)! })
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
                <button
                    type="button"
                    :aria-label="`View ${item.data.title}`"
                    class="group relative block w-full cursor-pointer overflow-clip rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4"
                    @click="modalArtViewer.open({ item })"
                >
                    <NuxtImg
                        :src="item.data.images[0]?.url"
                        :alt="item.data.title"
                        :width="520"
                        format="webp"
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
