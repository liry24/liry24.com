<script setup lang="ts">
import { ImageViewer } from '#components'
import type { ArtImage } from '~/utils/contentPresentation'

const { data } = defineProps<{
    data: ArtImage[]
}>()

const overlay = useOverlay()

const imageViewer = overlay.create(ImageViewer)

const carousel = useTemplateRef('carousel')
const activeIndex = ref(0)

const onClickPrev = () => {
    activeIndex.value--
}
const onClickNext = () => {
    activeIndex.value++
}
const onSelect = (index: number) => {
    activeIndex.value = index
}

const select = (index: number) => {
    activeIndex.value = index

    carousel.value?.emblaApi?.scrollTo(index)
}
</script>

<template>
    <div class="flex w-full flex-col gap-4">
        <UCarousel
            ref="carousel"
            v-slot="{ item }"
            :items="data"
            :prev="{ onClick: onClickPrev }"
            :next="{ onClick: onClickNext }"
            :ui="{ container: 'items-center' }"
            class="mx-auto w-full"
            @select="onSelect"
        >
            <NuxtImg
                :src="item.src"
                :alt="item.alt || ''"
                class="max-h-[70svh] rounded-lg"
                @click="
                    imageViewer.open({
                        src: item.src,
                        alt: item.alt || '',
                    })
                "
            />
        </UCarousel>

        <div class="mx-auto flex gap-2">
            <div
                v-for="(item, index) in data"
                :key="index"
                class="opacity-25 transition-opacity hover:opacity-100"
                :class="{ 'opacity-100': activeIndex === index }"
                @click="select(index)"
            >
                <NuxtImg
                    :src="item.src"
                    :alt="item.alt || ''"
                    :width="48"
                    :height="48"
                    class="size-12 cursor-pointer rounded-lg object-cover"
                />
            </div>
        </div>
    </div>
</template>
