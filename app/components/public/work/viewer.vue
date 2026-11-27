<script setup lang="ts">
import { LazyImageViewer } from '#components'

const open = defineModel<boolean>('open', { default: false })

const { item } = defineProps<{
    item: PortfolioItem<'works'>
}>()

const overlay = useOverlay()
const imageViewer = overlay.create(LazyImageViewer)

const imageSrc = computed(() => mediaUrl(item.data.image))
const hostname = computed(() => {
    if (!item.data.href) return undefined
    try {
        return new URL(item.data.href).hostname.replace(/^www\./, '')
    } catch {
        return undefined
    }
})
const hasMeta = computed(() =>
    Boolean(item.data.category || item.data.price || item.data.authoredAt || hostname.value),
)

const openLightbox = () => {
    if (!imageSrc.value) return
    imageViewer.open({
        src: imageSrc.value,
        alt: item.data.title,
    })
}
</script>

<template>
    <EntryViewerModal
        v-model:open="open"
        :title="item.data.title"
        :has-media="Boolean(imageSrc)"
        :share-path="`/works?open=${encodeURIComponent(item.data.slug)}`"
        :external-href="item.data.href"
        external-label="Visit project"
    >
        <template #trigger>
            <slot />
        </template>

        <template v-if="item.data.icon" #leading>
            <span
                class="bg-muted ring-default/70 inline-grid size-10 shrink-0 place-items-center rounded-xl ring-1"
            >
                <Icon
                    :name="item.data.icon"
                    data-icon-ic="false"
                    class="text-highlighted size-5"
                    aria-hidden="true"
                />
            </span>
        </template>

        <template v-if="imageSrc" #media>
            <button
                type="button"
                data-testid="enlarge-work-image"
                aria-label="Enlarge image"
                class="group relative mx-auto block max-w-full cursor-zoom-in overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4"
                @click="openLightbox"
            >
                <NuxtImg
                    :src="imageSrc"
                    alt=""
                    class="max-h-[48dvh] w-auto max-w-full rounded-xl object-contain sm:max-h-[54dvh] lg:max-h-[68dvh]"
                />
                <span
                    aria-hidden="true"
                    class="pointer-events-none absolute right-2.5 bottom-2.5 inline-flex size-8 items-center justify-center rounded-lg bg-black/65 text-white opacity-0 backdrop-blur-xs transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                >
                    <Icon name="mingcute:fullscreen-line" class="size-4" />
                </span>
            </button>
        </template>

        <template v-if="hasMeta" #meta>
            <dl class="border-default grid grid-cols-2 gap-x-6 gap-y-3 border-b pb-4 text-sm">
                <div v-if="item.data.category" class="min-w-0">
                    <dt class="text-muted text-xs">Category</dt>
                    <dd class="text-highlighted mt-0.5 font-medium break-words">
                        {{ item.data.category }}
                    </dd>
                </div>
                <div v-if="item.data.price" class="min-w-0">
                    <dt class="text-muted text-xs">Price</dt>
                    <dd class="text-highlighted mt-0.5 font-mono font-medium tabular-nums">
                        {{ item.data.price }}
                    </dd>
                </div>
                <div v-if="item.data.authoredAt" class="min-w-0">
                    <dt class="text-muted text-xs">Released</dt>
                    <dd class="text-highlighted mt-0.5 font-mono tabular-nums">
                        <NuxtTime :datetime="item.data.authoredAt" date-style="medium" />
                    </dd>
                </div>
                <div v-if="hostname" class="min-w-0">
                    <dt class="text-muted text-xs">Link</dt>
                    <dd class="text-toned mt-0.5 truncate font-mono text-xs sm:text-sm">
                        {{ hostname }}
                    </dd>
                </div>
            </dl>
        </template>

        <p
            v-if="item.data.description"
            class="text-toned text-sm leading-relaxed whitespace-pre-line sm:text-base"
        >
            {{ item.data.description }}
        </p>
    </EntryViewerModal>
</template>
