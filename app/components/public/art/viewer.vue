<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

const { item } = defineProps<{
    item: PortfolioItem<'arts'>
}>()

const hasMeta = computed(() => Boolean(item.data.authoredAt || item.data.images.length > 1))
</script>

<template>
    <EntryViewerModal
        v-model:open="open"
        :title="item.data.title"
        :share-path="`/arts?open=${encodeURIComponent(item.data.slug)}`"
        :external-href="item.data.href"
        external-label="Open artwork"
    >
        <template #trigger>
            <slot />
        </template>

        <template #media>
            <ArtCarousel :data="item.data.images" :title="item.data.title" />
        </template>

        <template v-if="hasMeta" #meta>
            <div class="text-muted flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs">
                <NuxtTime
                    v-if="item.data.authoredAt"
                    :datetime="item.data.authoredAt"
                    date-style="medium"
                    class="tabular-nums"
                />
                <span
                    v-if="item.data.authoredAt && item.data.images.length > 1"
                    aria-hidden="true"
                    class="text-dimmed"
                    >·</span
                >
                <span v-if="item.data.images.length > 1" class="tabular-nums">
                    {{ item.data.images.length }} images
                </span>
            </div>
        </template>

        <Markdown
            v-if="item.data.description"
            :value="item.data.description"
            :plugins="[postMarkdownSecurity]"
            class="min-w-0 text-sm leading-relaxed wrap-break-word *:first:mt-0 *:last:mb-0"
        />
    </EntryViewerModal>
</template>
