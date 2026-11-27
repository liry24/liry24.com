<script setup lang="ts">
import { LazyImageViewer } from '#components'

const { data, title } = defineProps<{
    data: Array<MediaReference>
    title?: string
}>()

const appConfig = useAppConfig()
const overlay = useOverlay()
const imageViewer = overlay.create(LazyImageViewer)

const carousel = useTemplateRef('carousel')
const activeIndex = ref(0)
const hasMultiple = computed(() => data.length > 1)

const onSelect = (index: number) => {
    activeIndex.value = index
}

const select = (index: number) => {
    if (!data.length) return
    const wrapped = (index + data.length) % data.length
    activeIndex.value = wrapped
    carousel.value?.emblaApi?.scrollTo(wrapped)
}

const openLightbox = (image: MediaReference) => {
    imageViewer.open({
        src: mediaUrl(image),
        alt: title || '',
    })
}

useEventListener('keydown', (event) => {
    if (!hasMultiple.value || imageViewer.isOpen) return
    const target = event.target
    if (
        target &&
        typeof target === 'object' &&
        'matches' in target &&
        typeof target.matches === 'function' &&
        target.matches('input, textarea, select')
    )
        return

    if (event.key === 'ArrowLeft') {
        event.preventDefault()
        select(activeIndex.value - 1)
    } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        select(activeIndex.value + 1)
    }
})
</script>

<template>
    <div class="flex h-full w-full min-w-0 flex-col justify-center gap-4">
        <div class="relative flex min-h-0 w-full flex-1 items-center justify-center">
            <UCarousel
                ref="carousel"
                v-slot="{ item }"
                :items="data"
                :ui="{
                    container: 'items-center',
                    item: 'flex justify-center',
                }"
                class="w-full"
                @select="onSelect"
            >
                <button
                    type="button"
                    data-testid="enlarge-artwork"
                    aria-label="Enlarge image"
                    class="group relative mx-auto block max-w-full cursor-zoom-in overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4"
                    @click="openLightbox(item)"
                >
                    <NuxtImg
                        :src="mediaUrl(item)"
                        alt=""
                        :class="
                            cn(
                                'w-auto max-w-full rounded-xl object-contain',
                                hasMultiple
                                    ? 'max-h-[52dvh] sm:max-h-[58dvh] lg:max-h-[min(calc(100dvh-13rem),40rem)]'
                                    : 'max-h-[54dvh] sm:max-h-[60dvh] lg:max-h-[min(calc(100dvh-8rem),46rem)]',
                            )
                        "
                    />
                    <span
                        aria-hidden="true"
                        class="pointer-events-none absolute right-2.5 bottom-2.5 inline-flex size-8 items-center justify-center rounded-lg bg-black/65 text-white opacity-0 backdrop-blur-xs transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                    >
                        <Icon name="mingcute:fullscreen-line" class="size-4" />
                    </span>
                </button>
            </UCarousel>

            <template v-if="hasMultiple">
                <UButton
                    aria-label="Previous image"
                    :icon="appConfig.ui.icons.chevronLeft"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    square
                    class="bg-default/85 absolute left-2.5 z-1 rounded-full shadow-sm backdrop-blur-xs"
                    @click="select(activeIndex - 1)"
                />
                <UButton
                    aria-label="Next image"
                    :icon="appConfig.ui.icons.chevronRight"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    square
                    class="bg-default/85 absolute right-2.5 z-1 rounded-full shadow-sm backdrop-blur-xs"
                    @click="select(activeIndex + 1)"
                />
            </template>
        </div>

        <div v-if="hasMultiple" class="flex flex-wrap items-center justify-center gap-3 pt-1">
            <div class="flex max-w-full items-center gap-2.5 overflow-x-auto p-1.5">
                <button
                    v-for="(item, index) in data"
                    :key="index"
                    type="button"
                    :aria-label="`View image ${index + 1}`"
                    :aria-pressed="activeIndex === index"
                    :class="
                        cn(
                            'shrink-0 overflow-hidden rounded-lg transition-[opacity,box-shadow] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none',
                            activeIndex === index
                                ? 'ring-inverted opacity-100 ring-2'
                                : 'opacity-60 hover:opacity-100 focus-visible:opacity-100',
                        )
                    "
                    @click="select(index)"
                >
                    <NuxtImg
                        :src="mediaUrl(item)"
                        alt=""
                        :width="52"
                        :height="52"
                        class="size-12 object-cover sm:size-13"
                    />
                </button>
            </div>
            <span class="text-muted font-mono text-xs tabular-nums">
                {{ activeIndex + 1 }} / {{ data.length }}
            </span>
        </div>
    </div>
</template>
